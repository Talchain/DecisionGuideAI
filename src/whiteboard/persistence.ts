import { supabase } from '@/lib/supabase'

// Simple debounce helper (per key)
const timers = new Map<string, any>()
export function debounce<T extends (...args: any[]) => void>(key: string, fn: T, wait = 500) {
  return (...args: Parameters<T>) => {
    if (timers.has(key)) clearTimeout(timers.get(key))
    const t = setTimeout(() => fn(...args), wait)
    timers.set(key, t)
  }
}

export type CanvasDoc = {
  meta?: { decision_id?: string; kind?: string; [k: string]: any }
  shapes: any[]
  bindings: any[]
  [k: string]: any
}

export async function ensureCanvasForDecision(decisionId: string): Promise<{ canvasId: string }>{
  if (!decisionId) throw new Error('decisionId required')

  // Try by column decision_id first (preferred schema)
  const byCol = await (supabase as any)
    .from('canvases')
    .select('id')
    .eq('decision_id', decisionId)
    .limit(1)
    .maybeSingle()

  if (byCol.data?.id) return { canvasId: byCol.data.id as string }

  // Fallback: JSON meta path search if column isn't present or no row
  const byJson = await (supabase as any)
    .from('canvases')
    .select('id, canvas_data')
    .contains('canvas_data', { meta: { decision_id: decisionId } as any })
    .limit(1)
    .maybeSingle()

  if (byJson.data?.id) return { canvasId: byJson.data.id as string }

  // Insert minimal doc
  const initialDoc: CanvasDoc = {
    meta: { decision_id: decisionId, kind: 'sandbox' },
    shapes: [],
    bindings: [],
  }

  const insertPayload: any = { canvas_data: initialDoc }
  // If DB has decision_id column, include it; ignore if DB rejects extra key
  insertPayload.decision_id = decisionId

  const { data, error } = await (supabase as any)
    .from('canvases')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) throw error
  return { canvasId: data!.id as string }
}

export async function loadCanvasDoc(canvasId: string): Promise<CanvasDoc | null> {
  const { data, error } = await (supabase as any)
    .from('canvases')
    .select('canvas_data')
    .eq('id', canvasId)
    .maybeSingle()

  if (error) throw error
  return (data as any)?.canvas_data ?? null
}

// Debounced saver per canvasId
const saveDebounced = new Map<string, ReturnType<typeof debounce>>()

export async function saveCanvasDoc(canvasId: string, doc: CanvasDoc) {
  if (!saveDebounced.has(canvasId)) {
    saveDebounced.set(
      canvasId,
      debounce(`save:${canvasId}`, async (id: string, payload: CanvasDoc) => {
        await (supabase as any)
          .from('canvases')
          .upsert({ id, canvas_data: payload } as any, { onConflict: 'id' })
      }, 500)
    )
  }
  const fn = saveDebounced.get(canvasId)!
  fn(canvasId, doc)
}

export async function saveSnapshot(canvasId: string, name = 'snapshot') {
  // Determine next version_number
  const { data: latest } = await (supabase as any)
    .from('canvas_versions')
    .select('version_number')
    .eq('canvas_id', canvasId)
    .order('version_number', { ascending: false })
    .limit(1)

  const next = (latest?.[0]?.version_number ?? 0) + 1

  // Read current canvas
  const doc = await loadCanvasDoc(canvasId)
  const { error } = await (supabase as any)
    .from('canvas_versions')
    .insert({
      canvas_id: canvasId,
      name,
      version_number: next,
      canvas_data: doc ?? {},
    } as any)

  if (error) throw error
  return { version: next }
}

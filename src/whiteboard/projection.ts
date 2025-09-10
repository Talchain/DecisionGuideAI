import { supabase } from '@/lib/supabase'

// Extract a minimal projection from the tldraw document
export function extractProjection(doc: any) {
  const board_id = doc?.id ?? doc?.meta?.decision_id ?? 'sandbox'
  const last_updated_at = new Date().toISOString()

  // naive scan: treat scenario-tile shapes as scenarios; probability-connector as edges
  const shapes = Array.isArray(doc?.shapes) ? doc.shapes : []
  const scenarios = shapes
    .filter((s: any) => s.type === 'scenario-tile')
    .map((s: any) => ({ id: s.id, title: s?.props?.title ?? 'Scenario' }))

  const edges = shapes
    .filter((s: any) => s.type === 'probability-connector')
    .map((s: any) => ({
      id: s.id,
      from: s?.props?.from,
      to: s?.props?.to,
      p: s?.props?.p ?? 0.5,
      fromSide: s?.props?.fromSide ?? 'right',
      toSide: s?.props?.toSide ?? 'left',
    }))

  return { board_id, scenarios, edges, last_updated_at }
}

// Merge into decision_analysis.analysis_data.sandbox without overwriting other keys
export async function writeProjection(decisionId: string, doc: any) {
  if (!decisionId) throw new Error('decisionId required')

  const { data: row, error } = await supabase
    .from('decision_analysis')
    .select('analysis_data')
    .eq('decision_id', decisionId)
    .maybeSingle()

  if (error) throw error
  const existing = (row?.analysis_data ?? {}) as any
  const nextSandbox = extractProjection(doc)
  const merged = { ...existing, sandbox: nextSandbox }

  const { error: upErr } = await supabase
    .from('decision_analysis')
    .upsert({
      decision_id: decisionId,
      analysis_data: merged,
      status: 'draft',
    } as any, { onConflict: 'decision_id' })

  if (upErr) throw upErr
}

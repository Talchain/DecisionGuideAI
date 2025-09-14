import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mock for Supabase with fluent tables and exposed spies
vi.mock('@/lib/supabase', () => {
  const upsertSpy = vi.fn(async () => ({ data: null, error: null }))
  const insertVersionSpy = vi.fn(async () => ({ data: null, error: null }))
  const canvasesTable: any = {}
  canvasesTable.select = vi.fn(() => canvasesTable)
  canvasesTable.eq = vi.fn(() => canvasesTable)
  canvasesTable.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  canvasesTable.insert = vi.fn(async () => ({ data: { id: 'c1' }, error: null }))
  canvasesTable.single = vi.fn(async () => ({ data: { id: 'c1' }, error: null }))
  canvasesTable.upsert = upsertSpy

  const canvasVersionsTable: any = {}
  canvasVersionsTable.select = vi.fn(() => canvasVersionsTable)
  canvasVersionsTable.eq = vi.fn(() => canvasVersionsTable)
  canvasVersionsTable.order = vi.fn(() => canvasVersionsTable)
  canvasVersionsTable.limit = vi.fn(async () => ({ data: [{ version_number: 2 }], error: null }))
  canvasVersionsTable.insert = insertVersionSpy

  const supabase = {
    from: (name: string) => (name === 'canvases' ? canvasesTable : name === 'canvas_versions' ? canvasVersionsTable : canvasesTable),
    __testSpies: { upsertSpy, insertVersionSpy, canvasesTable, canvasVersionsTable },
  }
  return { supabase }
})

const persistence = await import('../persistence')
const supaMod: any = await import('@/lib/supabase')
const { upsertSpy, insertVersionSpy, canvasesTable, canvasVersionsTable } = supaMod.supabase.__testSpies

beforeEach(() => {
  vi.useFakeTimers()
  upsertSpy.mockClear()
  insertVersionSpy.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('saveCanvasDoc debounce', () => {
  it('debounces multiple saves and only upserts once with last payload', async () => {
    const canvasId = 'cv_1'
    const docA = { shapes: [{ id: 'a' }], bindings: [] }
    const docB = { shapes: [{ id: 'b' }], bindings: [] }

    // Two rapid calls
    await persistence.saveCanvasDoc(canvasId, docA as any)
    await persistence.saveCanvasDoc(canvasId, docB as any)

    // Not yet: debounce window
    expect(upsertSpy).not.toHaveBeenCalled()

    // After debounce
    vi.advanceTimersByTime(600)

    // Allow any pending promises to resolve
    await Promise.resolve()

    expect(upsertSpy).toHaveBeenCalledTimes(1)
    const args = (upsertSpy.mock.calls[0] as any[])[0]
    expect(args).toEqual({ id: canvasId, canvas_data: docB })
  })
})

describe('saveSnapshot', () => {
  it('increments version number and inserts snapshot with current doc', async () => {
    const canvasId = 'cv_2'
    const doc = { shapes: [], bindings: [], meta: { decision_id: 'd1' } }
    ;(canvasesTable.maybeSingle as any).mockResolvedValueOnce({ data: { canvas_data: doc }, error: null })

    const result = await persistence.saveSnapshot(canvasId as any, 'auto')

    expect(result.version).toBe(3) // 2 + 1 from mock
    expect(insertVersionSpy).toHaveBeenCalledTimes(1)
    const payload = (insertVersionSpy.mock.calls[0] as any[])[0] as any
    expect(payload.canvas_id).toBe(canvasId)
    expect(payload.version_number).toBe(3)
    expect(payload.canvas_data).toEqual(doc)
  })
})

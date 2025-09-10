import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as persistence from '../persistence'

// Mock supabase client used inside the module
const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null })
const selectLatestSpy = vi.fn().mockResolvedValue({ data: [{ version_number: 2 }], error: null })
const insertVersionSpy = vi.fn().mockResolvedValue({ data: null, error: null })

const canvasesTable = {
  upsert: upsertSpy,
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
  single: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
}

const canvasVersionsTable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [{ version_number: 2 }], error: null }),
  insert: insertVersionSpy,
}

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'canvases') return canvasesTable as any
        if (table === 'canvas_versions') return canvasVersionsTable as any
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      },
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  upsertSpy.mockClear()
  selectLatestSpy.mockClear()
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
    const args = upsertSpy.mock.calls[0][0]
    expect(args).toEqual({ id: canvasId, canvas_data: docB })
  })
})

describe('saveSnapshot', () => {
  it('increments version number and inserts snapshot with current doc', async () => {
    const canvasId = 'cv_2'
    const doc = { shapes: [], bindings: [], meta: { decision_id: 'd1' } }
    ;(canvasesTable.maybeSingle as any).mockResolvedValueOnce({ data: { canvas_data: doc }, error: null })

    const result = await persistence.saveSnapshot(canvasId, 'auto')

    expect(result.version).toBe(3) // 2 + 1 from mock
    expect(insertVersionSpy).toHaveBeenCalledTimes(1)
    const payload = insertVersionSpy.mock.calls[0][0]
    expect(payload.canvas_id).toBe(canvasId)
    expect(payload.version_number).toBe(3)
    expect(payload.canvas_data).toEqual(doc)
  })
})

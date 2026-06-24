import { describe, it, expect, vi, beforeEach } from 'vitest'
import { commitValidatedMutation } from '../commitValidatedMutation'
import type { PatchOperation } from '../../conversation/types'

// Mock the plot adapter module
vi.mock('../../../adapters/plot', () => ({
  plot: {},
}))

// Mock the canvas store
const markAnalysisFreshnessDirty = vi.fn()
vi.mock('../../store', () => {
  const state = {
    nodes: [{ id: 'n1', type: 'factor', data: { label: 'Test' } }],
    edges: [],
    pushHistory: vi.fn(),
    markAnalysisFreshnessDirty: () => markAnalysisFreshnessDirty(),
  }
  return {
    useCanvasStore: {
      getState: vi.fn(() => state),
      setState: vi.fn(),
    },
  }
})

describe('commitValidatedMutation', () => {
  let showToast: ReturnType<typeof vi.fn>
  let localApply: ReturnType<typeof vi.fn>
  const ops: PatchOperation[] = [{ op: 'remove_node', target_id: 'n1', data: {} }]

  beforeEach(() => {
    vi.clearAllMocks()
    showToast = vi.fn()
    localApply = vi.fn()
  })

  it('falls back to localApply when adapter has no validatePatch', async () => {
    const result = await commitValidatedMutation(ops, localApply, showToast)

    expect(result.success).toBe(true)
    expect(localApply).toHaveBeenCalledOnce()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('calls localApply and returns success', async () => {
    const result = await commitValidatedMutation(ops, localApply)

    expect(result.success).toBe(true)
    expect(localApply).toHaveBeenCalledOnce()
  })

  it('does not call showToast on success via local path', async () => {
    await commitValidatedMutation(ops, localApply, showToast)

    expect(showToast).not.toHaveBeenCalled()
  })

  it('marks the freshness overlay dirty on a successful mutation (covers bare-setState localApply e.g. insert-factor-between)', async () => {
    await commitValidatedMutation(ops, localApply, showToast)
    expect(markAnalysisFreshnessDirty).toHaveBeenCalled()
  })

  it('falls back to localApply when adapter import throws', async () => {
    // Override the mock to throw on import
    vi.doMock('../../../adapters/plot', () => {
      throw new Error('Module not found')
    })

    const result = await commitValidatedMutation(ops, localApply, showToast)

    expect(result.success).toBe(true)
    expect(localApply).toHaveBeenCalledOnce()

    // Restore original mock
    vi.doMock('../../../adapters/plot', () => ({ plot: {} }))
  })
})

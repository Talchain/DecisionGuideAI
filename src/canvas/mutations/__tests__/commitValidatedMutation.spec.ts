import { describe, it, expect, vi, beforeEach } from 'vitest'
import { commitValidatedMutation } from '../commitValidatedMutation'
import type { PatchOperation } from '../../conversation/types'

// Mock the plot adapter module. `validatePatch` is settable per-test (via the
// hoisted holder) so we can exercise the dormant Phase-1 validated-graph branch
// in addition to the Phase-2 localApply fallback.
const plotState = vi.hoisted(() => ({ validatePatch: undefined as ((arg: unknown) => unknown) | undefined }))
vi.mock('../../../adapters/plot', () => ({
  plot: {
    get validatePatch() {
      return plotState.validatePatch
    },
  },
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
    plotState.validatePatch = undefined // default: no PLoT validate-patch → Phase 2
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

  it('Phase-1 validated graph: marks dirty on success', async () => {
    plotState.validatePatch = vi.fn(async () => ({ valid: true, graph: { nodes: [], edges: [] } }))
    const result = await commitValidatedMutation(ops, localApply, showToast)
    expect(result.success).toBe(true)
    expect(markAnalysisFreshnessDirty).toHaveBeenCalledTimes(1)
    expect(localApply).not.toHaveBeenCalled() // full graph returned → no local fallback
  })

  it('Phase-1 rejected: does NOT dirty and surfaces the toast', async () => {
    plotState.validatePatch = vi.fn(async () => ({ valid: false, message: 'nope' }))
    const result = await commitValidatedMutation(ops, localApply, showToast)
    expect(result.success).toBe(false)
    expect(markAnalysisFreshnessDirty).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith('nope', 'error')
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

/**
 * SM4 (30 Oct): the share of a MODEL PROGRAM scenario carries its Run. The program never writes `scenarios.brief`; its Run
 * is the `canonical_analysis_view` CEE serves on the scenario read, so the snapshot takes it from that read (the same
 * identity as the canvas) into `p_analysis`. A read that does not answer leaves the share as it was.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import served from '../../pages/__tests__/fixtures/served-program-run-view.json'

const mockRpc = vi.fn()
const mockSingle = vi.fn()
const mockFetchScenarioGraph = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }),
    rpc: (fn: string, params: unknown) => mockRpc(fn, params),
  },
  getSessionIdentity: async () => ({ userId: 'u-1', accessToken: 'token-1' }),
}))
vi.mock('../../adapters/cee/scenarioGraph', () => ({
  fetchScenarioGraph: (...args: unknown[]) => mockFetchScenarioGraph(...args),
}))

const ROW = { graph: { nodes: served.nodes, edges: [], living_model: { model_program: 'v1' } }, brief: null, brief_text: 'Should we add a support specialist?', graph_identity_hash: null }

describe('createSharedSnapshot: a program scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: ROW, error: null })
    mockRpc.mockResolvedValue({ data: { id: 'snap-1', slug: 'abc123' }, error: null })
  })

  it('carries the scenario read\'s canonical_analysis_view in p_analysis, read with the session identity', async () => {
    mockFetchScenarioGraph.mockResolvedValue({ status: 'graph', graph: ROW.graph, canonicalAnalysisView: served.canonical_analysis_view })
    const { createSharedSnapshot } = await import('../scenarioService')
    await createSharedSnapshot('scenario-1')
    expect(mockFetchScenarioGraph).toHaveBeenCalledWith('scenario-1', { userId: 'u-1', accessToken: 'token-1' })
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_graph: ROW.graph, p_analysis: { canonical_analysis_view: served.canonical_analysis_view } })
  })

  it('NEGATIVE: a read that does not answer shares the model as before (p_analysis null), never a failed share', async () => {
    mockFetchScenarioGraph.mockRejectedValue(new Error('offline'))
    const { createSharedSnapshot } = await import('../scenarioService')
    await expect(createSharedSnapshot('scenario-1')).resolves.toEqual({ id: 'snap-1', slug: 'abc123' })
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_analysis: null })
  })
})

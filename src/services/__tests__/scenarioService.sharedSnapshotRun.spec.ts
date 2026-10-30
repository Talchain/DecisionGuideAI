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

  const RUN_HASH = served.canonical_analysis_view.run.graph_hash_at_run
  const READ_GRAPH = { ...ROW.graph, nodes: [...served.nodes, { id: 'added_in_read', kind: 'factor', label: 'From the read' }] }
  const answers = (graphHash: string | null) => mockFetchScenarioGraph.mockResolvedValue({
    status: 'graph', graph: READ_GRAPH, graphHash, canonicalAnalysisView: served.canonical_analysis_view })
  const sent = () => mockRpc.mock.calls[0]![1] as { p_graph: unknown; p_analysis: { canonical_analysis_view: Record<string, any> } }

  it('carries the Run from the SAME read as the model, read with the session identity', async () => {
    answers(RUN_HASH)
    const { createSharedSnapshot } = await import('../scenarioService')
    await createSharedSnapshot('scenario-1')
    expect(mockFetchScenarioGraph).toHaveBeenCalledWith('scenario-1', { userId: 'u-1', accessToken: 'token-1' })
    expect(sent().p_graph).toEqual(READ_GRAPH)
    const view = sent().p_analysis.canonical_analysis_view
    expect(view.options.map((o: { cell: { face: string } }) => o.cell.face)).toEqual(served.canonical_analysis_view.options.map(o => o.cell.face))
    expect(view.staleness.stale).toBe(false)
    expect(view.leader.words).toBe(served.canonical_analysis_view.leader.words)
  })

  it('the public view carries no Run id, no graph hash and no revision', async () => {
    answers(RUN_HASH)
    const { createSharedSnapshot } = await import('../scenarioService')
    await createSharedSnapshot('scenario-1')
    const json = JSON.stringify(sent().p_analysis)
    expect(json).not.toContain(served.canonical_analysis_view.run.run_id)
    expect(json).not.toContain(RUN_HASH)
    expect(sent().p_analysis.canonical_analysis_view.staleness).toMatchObject({ revision: null, run_revision: null })
  })

  it('a Run not bound to the read\'s model hash is stored as not current, with no "most likely"', async () => {
    answers('0'.repeat(64))
    const { createSharedSnapshot } = await import('../scenarioService')
    await createSharedSnapshot('scenario-1')
    const view = sent().p_analysis.canonical_analysis_view
    expect(view.staleness.stale).toBe(true)
    expect(view.leader).toBeUndefined()
  })

  it('a program scenario whose read fails shares the model with NO analysis, never its stale legacy brief', async () => {
    mockSingle.mockResolvedValue({ data: { ...ROW, brief: { headline: 'An older brief', options: [] } }, error: null })
    mockFetchScenarioGraph.mockRejectedValue(new Error('offline'))
    const { createSharedSnapshot } = await import('../scenarioService')
    await createSharedSnapshot('scenario-1')
    expect(sent().p_analysis).toBeNull()
    expect(sent().p_graph).toEqual(ROW.graph)
  })

  it('NEGATIVE: a read that does not answer shares the model as before (p_analysis null), never a failed share', async () => {
    mockFetchScenarioGraph.mockRejectedValue(new Error('offline'))
    const { createSharedSnapshot } = await import('../scenarioService')
    await expect(createSharedSnapshot('scenario-1')).resolves.toEqual({ id: 'snap-1', slug: 'abc123' })
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_analysis: null })
  })
})

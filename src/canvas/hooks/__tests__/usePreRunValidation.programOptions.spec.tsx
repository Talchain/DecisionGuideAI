/**
 * A PROGRAM GRAPH'S QUESTION IS NOT AN OPTION (S3 #3709 item 6, 23 Oct). With no served option list, the run gate's
 * fallback read every `decision` node as an option, so on a program board (`model_program` "v1") the question node
 * was listed under "Options need configuration". On a program graph the fallback takes the projected option nodes
 * only; every other board keeps today's fallback. Fixture: CEE's served capacity read (S3 smoke-alpha3), nodes through
 * the real `mapDraftNodeToCanvas`; the hook rows read the program flag through the real saved-graph read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePreRunValidation, validateBeforeRun } from '../usePreRunValidation'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { useCanvasStore } from '../../store'
import { useSavedGraph } from '../../nodes/shared/savedGraph'
import capacity from '../../runView/__tests__/fixtures/alpha3-capacity-r1-read.json'

const nodes = capacity.graph.nodes.map((n) => mapDraftNodeToCanvas(n))
const listed = (blockers: readonly { affectedIds?: readonly string[] }[]) => blockers.flatMap(b => b.affectedIds ?? [])

describe('the fallback option list', () => {
  it('a program graph: the question node is not an option', () => {
    const v = validateBeforeRun('support_capacity_goal', nodes as never, [], null, true)
    expect(v.blockers.map(b => [b.code, b.affectedIds])).toEqual([['OPTIONS_NEED_MAPPING', ['add_one_specialist']]])
  })
  it('CONTRAST: any other board keeps today’s fallback, which lists the decision node', () => {
    const v = validateBeforeRun('support_capacity_goal', nodes as never, [], null)
    expect(v.blockers.map(b => [b.code, b.affectedIds])).toEqual([['OPTIONS_NEED_MAPPING', ['mp:decision', 'add_one_specialist']]])
  })
})

type Rec = Record<string, unknown>
let served: Rec = {}
let n = 0
function board(livingModel: Rec) {
  n += 1
  const graphHash = `${capacity.graph_hash}${n}`
  served = { schema: 'scenario_graph.v1', scenario_id: capacity.scenario_id, graph_present: true, graph_hash: graphHash,
    graph: { nodes: capacity.graph.nodes, edges: [], living_model: livingModel } }
  useCanvasStore.setState({ currentScenarioId: capacity.scenario_id, lastServerGraphHash: graphHash, nodes, edges: [],
    outcomeNodeId: 'support_capacity_goal', ceeAnalysisReady: null } as never)
}
/** The gate hook beside the saved-graph reader it reads the program flag through. */
const gate = () => renderHook(() => ({ v: usePreRunValidation(), saved: useSavedGraph() as { living_model?: unknown } | null }))
/** Until the saved-graph read has ANSWERED with this board's graph (its own living model), never a fixed sleep: the read
 *  loads the auth client first (#2979), so a 30 ms wait could assert before it began. */
const settle = async (result: { current: { saved: { living_model?: unknown } | null } }) => {
  await waitFor(() => expect(result.current.saved?.living_model).toEqual((served.graph as Rec).living_model))
  expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith(`/scenarios/${capacity.scenario_id}/graph`))).toBe(true)
}

describe('the run gate hook reads the program flag from the saved model', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?ai=core-route')
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (
      /\/scenarios\/[^/]+\/graph$/.test(String(url))
        ? new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response('{}', { status: 404 })
    )))
  })
  afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

  it('model_program "v1": the question node is never listed', async () => {
    board({ model_program: 'v1' })
    const { result } = gate()
    await settle(result)
    expect(listed(result.current.v.blockers)).toEqual(['add_one_specialist'])
  })
  it('CONTRAST: a core model with no model_program keeps today’s list', async () => {
    board({ aims: [], links: [], factors: [], options: [] })
    const { result } = gate()
    await settle(result)
    expect(listed(result.current.v.blockers)).toEqual(['mp:decision', 'add_one_specialist'])
  })
})

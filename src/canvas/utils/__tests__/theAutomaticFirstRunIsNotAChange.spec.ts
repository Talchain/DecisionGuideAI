/**
 * ⭐ THE AUTOMATIC FIRST RUN IS NOT "A CHANGE TO YOUR MODEL".
 *
 * Joined guest witness, #63 5824916222 (25 Sep 2026, UI `820aeed1`, CEE
 * `c673223`, OpenAI): on BOTH briefs the first turn carried the draft AND the
 * run's own verdict together, `analysis_ready.freshness: 'fresh'` with
 * `graph_hash_at_run === current_graph_hash` and `run_state: complete_current`.
 * With no edit by the user, the Reasoning tab's first line read "The model has
 * changed since this analysis ran." and the footer read "Model changed. Results
 * may be out of date."
 *
 * The turn handler ingests the verdict first (`applyV5State` step 4), then
 * applies the inline draft (`applyDraftResult`). The draft marked the overlay
 * dirty, and its own copy of the SAME verdict was then refused by the
 * reducer's echo guard, so nothing cleared it. `complete_current` + dirty is
 * `'changed'` in `analysisStateSelector`.
 *
 * This replays that order on the real store, with the freshness fields copied
 * from the hiring capture. The controls keep the overlay dirty wherever the
 * verdict does not itself say it ran on this graph: no hashes, or hashes that
 * disagree. A "fresh" label alone is not that evidence.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../../store'
import { applyDraftResult } from '../applyDraftResult'
import { attachAnalysisReadyToInlineDraftGraph } from '../../conversation/useConversation'

const HASH = '0f46ca687c1be23f'

/** The hiring turn's verdict fields, as captured on the wire. */
const capturedVerdict = {
  status: 'ready',
  goal_node_id: 'delivery_velocity',
  options: [
    { option_id: 'hire_a_tech_lead', label: 'Hire a Tech Lead', status: 'ready', interventions: { tech_lead_hires: 0.1 }, is_baseline: false },
    { option_id: 'continue_current_staffing', label: 'Continue Current Staffing', status: 'ready', interventions: { tech_lead_hires: 0 }, is_baseline: false },
  ],
  freshness: 'fresh',
  freshness_reason: 'agent_readback_run_state_current',
  graph_hash_at_run: HASH,
  current_graph_hash: HASH,
  computed_at: '2026-09-25T01:00:37.545Z',
}

const draftGraph = {
  nodes: [
    { id: 'decision_delivery_velocity', kind: 'decision', label: 'Delivery velocity' },
    { id: 'delivery_velocity', kind: 'goal', label: 'Delivery velocity' },
    { id: 'hire_a_tech_lead', kind: 'option', label: 'Hire a Tech Lead' },
    { id: 'continue_current_staffing', kind: 'option', label: 'Continue Current Staffing' },
    { id: 'tech_lead_hires', kind: 'factor', label: 'Tech lead hires' },
  ],
  edges: [
    { from: 'decision_delivery_velocity', to: 'hire_a_tech_lead' },
    { from: 'decision_delivery_velocity', to: 'continue_current_staffing' },
    { from: 'hire_a_tech_lead', to: 'tech_lead_hires' },
    { from: 'continue_current_staffing', to: 'tech_lead_hires' },
    { from: 'tech_lead_hires', to: 'delivery_velocity' },
  ],
}

/** The turn handler's order: verdict first (applyV5State step 4), then the inline draft. */
function replayTurn(analysisReady: Record<string, unknown>) {
  const response = { draft_graph: draftGraph, analysis_ready: analysisReady }
  useCanvasStore.getState().setAnalysisFreshness(response.analysis_ready)
  const inline = attachAnalysisReadyToInlineDraftGraph(response.draft_graph, response)
  expect(inline, 'PRECONDITION: the inline path has a graph to apply').toBeTruthy()
  applyDraftResult(inline as never)
}

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
})

describe('the automatic first run is not a change to the model', () => {
  it('⭐ a draft that arrives with its own current verdict leaves the overlay clean', () => {
    replayTurn(capturedVerdict)
    const s = useCanvasStore.getState()
    expect(s.nodes.length, 'PRECONDITION: the draft reached the canvas').toBeGreaterThan(0)
    expect(s.analysisFreshness?.freshness, 'PRECONDITION: the run\'s verdict was ingested').toBe('fresh')
    expect(s.analysisFreshnessDirty).toBe(false)
  })

  it('OPPOSITE CONTROL: a "fresh" that carries no hashes is not evidence it describes this graph', () => {
    const { graph_hash_at_run: _a, current_graph_hash: _c, ...unhashed } = capturedVerdict
    replayTurn(unhashed)
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTROL: a verdict whose own hashes disagree is not treated as current', () => {
    replayTurn({ ...capturedVerdict, current_graph_hash: 'ffffffffffffffff' })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTROL: a user edit after the first run still marks the result out of date', () => {
    replayTurn(capturedVerdict)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    useCanvasStore.getState().markAnalysisFreshnessDirty()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
})

/**
 * THE GOAL TARGET A FIRST TURN STATES IS ON THE LIVE CANVAS, NOT ONLY AFTER A REOPEN.
 *
 * Served capture (recovery/outbox/T1H.md, 14:39Z 14 Oct 2026; run
 * live/runs/2026-10-14T135154Z-capacity-e2e-8f52bfd5-5ebc9b0c/capacity,
 * turns/01.json, trimmed in `fixtures/capacity-turn1-needs-user-input.8f52bfd5.turn.json`):
 * the capacity brief says "at least 100 tickets per week". CEE's turn-1
 * `draft_graph` goal node and its `analysis_ready` both carry raw 100,
 * `threshold_source: 'brief_extraction'`. The live goal read "Needs input"
 * (store `goalThreshold` null); after a cold reopen it read 100.
 *
 * Mechanism: the readiness is `needs_user_input`, so the strict attach contract
 * keeps it off the inline draft. `applyV5State` step 4 writes it (and syncs
 * 100) BEFORE `applyDraftResult`, whose wholesale replacement clears
 * `goalThreshold`; nothing re-synced it. The reopen installs the graph first and
 * then restores the same readiness, so its sync lands.
 *
 * This drives the production turn order on the real store (as
 * `theAutomaticFirstRunIsNotAChange.spec.ts` does), then the real boot reopen
 * (`hydrateGraphSlice` + `restoreCeeAnalysisReady`) on what that turn left
 * persisted, and compares the two by goal node id.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../../store'
import { applyDraftResult, backfillGoalThresholdOntoGoalNode } from '../applyDraftResult'
import { attachAnalysisReadyToInlineDraftGraph } from '../../conversation/useConversation'
import { applyV5State } from '../../../v5/applyV5State'
import { restoreCeeAnalysisReady } from '../../ReactFlowGraph'
import { isGoalDefined } from '../../../utils/isGoalDefined'
import capture from './fixtures/capacity-turn1-needs-user-input.8f52bfd5.turn.json'

type Json = Record<string, unknown>
const GOAL_ID = 'weekly_support_capacity'
const clone = (): Json => JSON.parse(JSON.stringify(capture)) as Json

/** The turn handler's order and store snapshot (useConversation applyV5State, then the inline draft). */
function replayTurn(response: Json) {
  const s = useCanvasStore.getState()
  applyV5State(response as never, {
    ...s,
    currentResultsHash: s.results?.hash ?? null,
    backfillGoalThreshold: backfillGoalThresholdOntoGoalNode,
  } as never)
  expect(useCanvasStore.getState().nodes.length, 'PRECONDITION: turn 1 lands on an empty canvas').toBe(0)
  const inline = attachAnalysisReadyToInlineDraftGraph(response.draft_graph, response)
  expect(inline, 'PRECONDITION: the inline path has a graph to apply').toBeTruthy()
  applyDraftResult(inline as never, {
    turnVerdict: { analysisReady: response.analysis_ready, graphHash: response.graph_hash },
  })
}

/** What the goal shows, read by node id. */
function goalView() {
  const s = useCanvasStore.getState()
  const node = s.nodes.find((n) => n.id === GOAL_ID)
  const data = (node?.data ?? {}) as Json
  return {
    outcomeNodeId: s.outcomeNodeId,
    goalThreshold: s.goalThreshold,
    goalThresholdRepresentation: s.goalThresholdRepresentation,
    defined: isGoalDefined(s.goalThreshold, s.goalConstraints),
    threshold_source: data.threshold_source,
    success_threshold: data.success_threshold,
  }
}

/** The boot reopen, on what the live turn left persisted (guest autosave). */
function reopen() {
  const live = useCanvasStore.getState()
  const autosave = {
    nodes: JSON.parse(JSON.stringify(live.nodes)),
    edges: JSON.parse(JSON.stringify(live.edges)),
    goalConstraints: live.goalConstraints ?? null,
    ceeAnalysisReady: JSON.parse(JSON.stringify(live.ceeAnalysisReady)),
  }
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.getState().hydrateGraphSlice({
    nodes: autosave.nodes,
    edges: autosave.edges,
    goalConstraints: autosave.goalConstraints,
  })
  restoreCeeAnalysisReady('autosave', autosave as never, null, useCanvasStore.getState().nodes)
}

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  try { sessionStorage.clear() } catch { /* jsdom */ }
})

describe('capacity turn 1: the live goal target equals the reopened one', () => {
  it('PRECONDITION: the capture is the turn the witness saw', () => {
    const r = clone()
    const ready = r.analysis_ready as Json
    expect(ready.status, 'the strict contract will not admit this readiness').toBe('needs_user_input')
    expect(ready.goal_node_id).toBe(GOAL_ID)
    expect(ready.goal_threshold_raw).toBe(100)
    const goal = ((r.draft_graph as Json).nodes as Json[]).find((n) => n.id === GOAL_ID) as Json
    expect(goal.goal_threshold_raw).toBe(100)
    expect(goal.threshold_source).toBe('brief_extraction')
    expect((attachAnalysisReadyToInlineDraftGraph(r.draft_graph, r) as Json).analysis_ready).toBeUndefined()
  })

  it('⭐ after the turn-1 apply the goal shows 100 from the brief, and the reopen shows the same', () => {
    replayTurn(clone())
    const live = goalView()
    expect(live.outcomeNodeId).toBe(GOAL_ID)
    expect(live.goalThreshold).toBe(100)
    expect(live.goalThresholdRepresentation).toBe('raw')
    expect(live.defined, 'the goal does not read "Needs input"').toBe(true)
    // Provenance kept: still the brief's, never relabelled as the user's.
    expect(live.threshold_source).toBe('brief_extraction')
    expect(live.success_threshold).toBeUndefined()

    reopen()
    expect(goalView()).toEqual(live)
  })

  it('NEGATIVE: a turn whose brief states no target still shows "Needs input", live and reopened', () => {
    const r = clone()
    for (const k of ['goal_threshold', 'goal_threshold_raw', 'goal_threshold_unit', 'goal_threshold_cap', 'goal_threshold_cap_provenance']) {
      delete (r.analysis_ready as Json)[k]
      delete (((r.draft_graph as Json).nodes as Json[]).find((n) => n.id === GOAL_ID) as Json)[k]
    }
    replayTurn(r)
    const live = goalView()
    expect(live.goalThreshold).toBeNull()
    expect(live.defined).toBe(false)
    reopen()
    expect(goalView()).toEqual(live)
  })

  it('NEGATIVE: a draft applied with no readiness of its own does not take one left in the store', () => {
    replayTurn(clone())
    expect(useCanvasStore.getState().ceeAnalysisReady?.goal_node_id, 'PRECONDITION: a readiness for this goal is held').toBe(GOAL_ID)
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    const r = clone()
    // The DB re-fetch / streamed-preview call shape: no turn readiness.
    applyDraftResult(attachAnalysisReadyToInlineDraftGraph(r.draft_graph, { draft_graph: r.draft_graph }) as never)
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })

  it("NEGATIVE: a target the user then sets stays the user's, live and reopened", () => {
    replayTurn(clone())
    useCanvasStore.getState().setGoalThresholdAndUpdateNode(GOAL_ID, 120)
    const live = goalView()
    expect(live.goalThreshold).toBe(120)
    expect(live.threshold_source).toBe('user')
    reopen()
    expect(goalView()).toEqual(live)
  })
})

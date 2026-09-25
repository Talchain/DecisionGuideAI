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
 * The turn handler ingests the verdict first (`applyV5State`, useConversation
 * `:5009`), then applies the inline draft (`applyDraftResult`, `:5168`). Two
 * writes in the draft path marked the overlay dirty after the verdict had
 * cleared it: the draft's own unconditional mark (its copy of the verdict is
 * refused as an echo, so it never cleared that mark), and `setOutcomeNode` on
 * the draft's goal. `complete_current` + dirty is `'changed'` in
 * `analysisStateSelector`.
 *
 * This drives the production sequence on the real store: `applyV5State` with
 * the store snapshot the turn handler passes, then the inline draft through
 * `attachAnalysisReadyToInlineDraftGraph` and `applyDraftResult` (backfills
 * included). The input is the hiring turn's terminal event as captured on the
 * wire (`fixtures/hiring-auto-first-run.c673223.terminal.json`; the trim is
 * recorded inside it). The assertion is on the composed semantic every
 * freshness surface renders, read through the production hook.
 *
 * Controls (Independent Review 5824961777, RC 5824943566):
 * - a "fresh" with no hashes, or hashes that disagree, is not affirmed;
 * - a queued edit, or an import the server has not registered, keeps its hold;
 * - a real edit after the first run turns the result stale until a rerun, and
 *   the rerun makes it current again.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { applyDraftResult, backfillGoalThresholdOntoGoalNode } from '../applyDraftResult'
import { attachAnalysisReadyToInlineDraftGraph } from '../../conversation/useConversation'
import { applyV5State } from '../../../v5/applyV5State'
import { useAnalysisState } from '../../state/analysisStateSelector'
import capture from './fixtures/hiring-auto-first-run.c673223.terminal.json'

type Json = Record<string, unknown>
const HASH = '0f46ca687c1be23f'
const clone = (): Json => JSON.parse(JSON.stringify(capture)) as Json

/** The turn handler's order and store snapshot (useConversation `:5009` then `:5168`). */
function replayTurn(response: Json) {
  const s = useCanvasStore.getState()
  applyV5State(response as never, {
    ...s,
    currentResultsHash: s.results?.hash ?? null,
    backfillGoalThreshold: backfillGoalThresholdOntoGoalNode,
  } as never)
  if (response.draft_graph && useCanvasStore.getState().nodes.length === 0) {
    const inline = attachAnalysisReadyToInlineDraftGraph(response.draft_graph, response)
    expect(inline, 'PRECONDITION: the inline path has a graph to apply').toBeTruthy()
    applyDraftResult(inline as never)
  }
}

const semantic = () => renderHook(() => useAnalysisState()).result.current.trust.semantic

/** The capture with its verdict's fields replaced. */
const withVerdict = (patch: Json): Json => {
  const r = clone()
  r.analysis_ready = { ...(r.analysis_ready as Json), ...patch }
  return r
}

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
  } as never)
})

describe('the automatic first run is not a change to the model', () => {
  it('PRECONDITION: the capture is the turn the witness saw', () => {
    const r = clone()
    const ready = r.analysis_ready as Json
    expect((r.analysis_state as Json).run_state).toMatchObject({ kind: 'complete_current' })
    expect(ready.freshness).toBe('fresh')
    expect(ready.graph_hash_at_run).toBe(HASH)
    expect(ready.current_graph_hash).toBe(HASH)
    expect(((r.draft_graph as Json).nodes as unknown[]).length).toBe(12)
  })

  it('⭐ the captured first run leaves the overlay clean and reads current, not changed', () => {
    replayTurn(clone())
    const s = useCanvasStore.getState()
    expect(s.nodes.length, 'PRECONDITION: the draft reached the canvas').toBe(12)
    expect(s.analysisStateV1?.run_state.kind, 'PRECONDITION: the wire verdict was ingested').toBe('complete_current')
    expect(s.analysisFreshness?.freshness, 'PRECONDITION: the freshness verdict was ingested').toBe('fresh')
    expect(s.analysisFreshnessDirty).toBe(false)
    expect(semantic()).not.toBe('changed')
  })

  it('OPPOSITE CONTROL: a "fresh" that carries no hashes is not evidence it describes this graph', () => {
    replayTurn(withVerdict({ graph_hash_at_run: undefined, current_graph_hash: undefined }))
    expect(useCanvasStore.getState().nodes.length).toBe(12)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTROL: a verdict whose own hashes disagree is not treated as current', () => {
    replayTurn(withVerdict({ current_graph_hash: 'ffffffffffffffff' }))
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTROL: a queued edit keeps its hold', () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true, pendingEmittedEdits: 1 } as never)
    replayTurn(clone())
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTROL: an import the server has not registered keeps its hold', () => {
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    replayTurn(clone())
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTROL: a real edit after the first run reads changed until a rerun makes it current', () => {
    replayTurn(clone())
    expect(semantic(), 'PRECONDITION: the first run reads current').not.toBe('changed')

    const factor = useCanvasStore.getState().nodes.find((n) => n.id === 'technical_coordination')
    expect(factor, 'PRECONDITION: the factor to edit is on the canvas').toBeTruthy()
    useCanvasStore.getState().updateNode('technical_coordination', {
      data: { observedState: { ...(factor!.data as Json).observedState as Json, value: 0.7, raw_value: 70 } },
    } as never)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(semantic()).toBe('changed')

    // The rerun: the same terminal shape with no draft, on the edited graph.
    const rerun = clone()
    delete rerun.draft_graph
    const EDITED = 'abcdef0123456789'
    rerun.graph_hash = EDITED
    rerun.analysis_state = { ...(rerun.analysis_state as Json), run_state: { kind: 'complete_current', computed_at: '2026-09-25T01:05:00.000Z' } }
    rerun.analysis_ready = { ...(rerun.analysis_ready as Json), graph_hash_at_run: EDITED, current_graph_hash: EDITED, computed_at: '2026-09-25T01:05:00.000Z' }
    rerun.blocks = [{ ...((rerun.blocks as Json[])[0]), computed_against_hash: EDITED }]
    replayTurn(rerun)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(semantic()).not.toBe('changed')
  })
})

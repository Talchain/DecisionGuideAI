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
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { applyDraftResult, backfillGoalThresholdOntoGoalNode } from '../applyDraftResult'
import { attachAnalysisReadyToInlineDraftGraph } from '../../conversation/useConversation'
import { applyV5State } from '../../../v5/applyV5State'
import { useAnalysisState } from '../../state/analysisStateSelector'
import capture from './fixtures/hiring-auto-first-run.c673223.terminal.json'
import pricingCapture from './fixtures/pricing-auto-first-run.c673223.terminal.json'

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
    // As useConversation's inline call site passes it: this response's raw verdict.
    applyDraftResult(inline as never, {
      turnVerdict: { analysisReady: response.analysis_ready, graphHash: response.graph_hash },
    })
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

  /**
   * R&C 5825272740, measured on served bytes: the pricing first pass carries
   * `analysis_ready.status: 'needs_user_input'`, so the contract drops it from
   * the inline draft and only the raw response still holds the verdict.
   */
  it('⭐ the pricing first pass, whose readiness is needs_user_input, also reads current', () => {
    const r = JSON.parse(JSON.stringify(pricingCapture)) as Json
    const ready = r.analysis_ready as Json
    expect(ready.status, 'PRECONDITION: the contract will not admit this readiness').toBe('needs_user_input')
    expect((r.analysis_state as Json).run_state).toMatchObject({ kind: 'complete_current' })
    expect(ready.graph_hash_at_run).toBe(r.graph_hash)
    expect(ready.current_graph_hash).toBe(r.graph_hash)
    const inline = attachAnalysisReadyToInlineDraftGraph(r.draft_graph, r) as Json
    expect(inline.analysis_ready, 'PRECONDITION: the inline draft carries no verdict').toBeUndefined()

    replayTurn(r)
    const s = useCanvasStore.getState()
    expect(s.nodes.length, 'PRECONDITION: the draft reached the canvas').toBeGreaterThan(0)
    expect(s.analysisStateV1?.run_state.kind).toBe('complete_current')
    expect(s.analysisFreshnessDirty).toBe(false)
    expect(semantic()).not.toBe('changed')
  })

  it('CONTROL: a response whose own graph_hash disagrees with its verdict is not affirmed', () => {
    const r = JSON.parse(JSON.stringify(pricingCapture)) as Json
    r.graph_hash = 'ffffffffffffffff'
    replayTurn(r)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTROL: a later draft with no verdict of its own does not inherit the fresh one in the store', () => {
    replayTurn(clone())
    expect(useCanvasStore.getState().analysisFreshness?.freshness, 'PRECONDITION: a fresh verdict is held').toBe('fresh')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    // A redraft on a cleared canvas, carrying a graph and nothing else.
    const redraft = clone()
    delete redraft.analysis_ready
    delete redraft.analysis_state
    delete redraft.graph_hash
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    replayTurn(redraft)
    expect(useCanvasStore.getState().nodes.length).toBe(12)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
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

/**
 * The spec above replays the inline call site; this pins that the real one
 * still passes the response's raw verdict. Interim, until R&C's served-journey
 * spec (`openaiRouteCoachingJourney.served.acceptance.spec.tsx`, which drives
 * the real `useConversation`) is on staging.
 */
describe('the inline draft call site passes this response\'s own verdict', () => {
  it('useConversation hands applyDraftResult the raw analysis_ready and graph_hash', () => {
    const src = readFileSync('src/canvas/conversation/useConversation.ts', 'utf8')
    const calls = src.match(/applyDraftResult\(inlineGraph[\s\S]*?\)\n/g) ?? []
    expect(calls.length, 'PRECONDITION: the inline call site is found').toBe(1)
    expect(calls[0]).toContain('turnVerdict: { analysisReady: target.response.analysis_ready, graphHash: target.response.graph_hash }')
  })
})

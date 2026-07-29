/**
 * ROADMAP 2.129 (a) — the freshness strip was INVERTED on the applied-edit path.
 *
 * THE DEFECT THIS PINS, live-proven on staging `98aae72e` before the fix
 * (`PHASE0-EVIDENCE-2026-07-28/fix-2121-slice1-liveproof.md` §4a, 11 runs):
 *
 *   | what CEE did with the Model-tab edit | freshness bar |
 *   |---|---|
 *   | REJECTED ("I haven't changed anything")            | PRESENT |
 *   | APPLIED  ("This makes the last analysis stale")     | ABSENT (15 samples / 70 s) |
 *
 * The strip fired when the edit did NOT take and went silent when it did — and
 * because the bar owns the only re-analyse control on the Model tab, an accepted
 * edit left the tester with no way to close the loop.
 *
 * THE MECHANISM, from the probe's own captured bytes (turn-responses-run2.json[2],
 * run3[2], run11[2] — all three identical in shape): a `graph_patch:applied` reply
 * carries a readiness-ONLY `analysis_ready`
 *
 *     { options: [...], goal_node_id: 'goal_x', status: 'ready', computed_at: <newer> }
 *
 * with NO `freshness`, NO `freshness_reason` and NO hashes. The UI degraded that
 * silence to a fabricated 'unknown' verdict, which then (i) SUPERSEDED CEE's real
 * 'fresh' verdict and (ii) was read by `setAnalysisFreshness` as proof the server
 * had re-verified freshness — so it CLEARED the local dirty overlay. Both inputs
 * to "changed" were destroyed by one payload that never mentioned the subject.
 *
 * WHY THESE ASSERTIONS. The fixture payloads are the captured shapes verbatim, so
 * a test that passes does so for the live reason. The rejected-edit case is a
 * CONTROL that was GREEN before the fix (proving these tests can see BOTH sides of
 * the inversion, not just the broken one), and the CEE-stated-'unknown' and
 * orphan cases are controls against the fix over-reaching into
 * cannot-confirm — the semantic the strip must never claim "you edited" over.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { classifyFreshnessForDisplay, VERDICT_ABSENT_FROM_PAYLOAD } from '../analysisFreshness'
import { computeAnalysisTrust } from '../../hooks/useAnalysisTrust'

/** The RUN's verdict, verbatim from turn-responses-run2.json[1]. */
const RUN_VERDICT = {
  options: [],
  goal_node_id: 'goal_billing',
  status: 'ready',
  computed_at: '2026-07-29T02:10:31.421Z',
  freshness: 'fresh',
  freshness_reason: 'graph_hash_match',
  graph_hash_at_run: 'c2aeb044a4bd8d6d',
  current_graph_hash: 'c2aeb044a4bd8d6d',
}

/**
 * The APPLIED-EDIT reply's `analysis_ready`, verbatim from
 * turn-responses-run2.json[2]. Note the key set — this is the whole defect:
 * readiness only, a NEWER computed_at, and total silence on freshness.
 */
const APPLIED_EDIT_READINESS = {
  options: [],
  goal_node_id: 'goal_billing',
  status: 'ready',
  computed_at: '2026-07-29T02:11:09.522Z',
}

function seedRunThenLocalEdit() {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
  } as never)
  // 1. the run lands CEE's real 'fresh' verdict
  useCanvasStore.getState().setAnalysisFreshness(RUN_VERDICT)
  // 2. the user commits a Model-tab value edit → the optimistic local write
  //    dirties the overlay (store.updateNode → invalidateAnalysisReady)
  useCanvasStore.getState().markAnalysisFreshnessDirty()
}

/** The composed semantic every trust surface reads (useAnalysisTrust). */
function semanticNow() {
  const s = useCanvasStore.getState()
  return computeAnalysisTrust({
    freshness: s.analysisFreshness,
    dirty: s.analysisFreshnessDirty,
    source: null,
    resultsStatus: 'complete',
  }).semantic
}

beforeEach(() => {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
  } as never)
})

describe('the APPLIED edit — the live FAIL', () => {
  it('keeps the dirty overlay when the reply says NOTHING about freshness', () => {
    seedRunThenLocalEdit()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)

    useCanvasStore.getState().setAnalysisFreshness(APPLIED_EDIT_READINESS)

    // RED before the fix: `verdictChanged` was true, so the overlay was cleared
    // — the UI discarded a fact it knew first-hand (the user edited the model
    // since the run) on the strength of a payload that never mentioned freshness.
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('marks the degraded verdict as SOURCED FROM SILENCE, not as a CEE verdict', () => {
    seedRunThenLocalEdit()
    useCanvasStore.getState().setAnalysisFreshness(APPLIED_EDIT_READINESS)

    const v = useCanvasStore.getState().analysisFreshness
    // The 'never absence→fresh' rule is UNCHANGED — it still degrades.
    expect(v?.freshness).toBe('unknown')
    // What is new is the provenance: this 'unknown' is the UI's own degradation
    // of a silent payload, NOT something CEE said. Without the distinction the
    // two are indistinguishable at the display layer, which is what made the
    // strip read cannot-confirm over a model the user demonstrably changed.
    expect(v?.freshnessReason).toBe(VERDICT_ABSENT_FROM_PAYLOAD)
  })

  it('reads CHANGED — the strip must flag the analysis stale after an applied edit', () => {
    seedRunThenLocalEdit()
    useCanvasStore.getState().setAnalysisFreshness(APPLIED_EDIT_READINESS)

    // RED before the fix: 'cannot_confirm' → ReanalyseBar returns null → no
    // staleness copy AND no re-analyse control anywhere on the Model tab.
    expect(semanticNow()).toBe('changed')
  })
})

describe('the REJECTED edit — the control that was GREEN before the fix', () => {
  it('still reads CHANGED when the reply carries no analysis_ready at all', () => {
    seedRunThenLocalEdit()
    // turn-responses.json[2]: blocks [], no analysis_ready, no graph_hash.
    useCanvasStore.getState().setAnalysisFreshness(undefined)

    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('fresh')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(semanticNow()).toBe('changed')
  })
})

describe('controls — the fix must NOT widen "changed" beyond the silent-payload case', () => {
  it('a CEE-STATED unknown verdict stays cannot-confirm, dirty or not', () => {
    expect(classifyFreshnessForDisplay({ freshness: 'unknown' }, false)).toBe('cannot_confirm')
    expect(classifyFreshnessForDisplay({ freshness: 'unknown' }, true)).toBe('cannot_confirm')
    expect(
      classifyFreshnessForDisplay(
        { freshness: 'unknown', freshnessReason: 'engine_could_not_determine' },
        true,
      ),
    ).toBe('cannot_confirm')
  })

  it('the orphan synthesis and the run-completion write stay cannot-confirm', () => {
    expect(
      classifyFreshnessForDisplay({ freshness: 'unknown', freshnessReason: 'orphaned_result' }, true),
    ).toBe('cannot_confirm')
    expect(
      classifyFreshnessForDisplay(
        { freshness: 'unknown', freshnessReason: 'run_completed_without_verdict' },
        true,
      ),
    ).toBe('cannot_confirm')
  })

  it('a silent payload with NO local edit stays cannot-confirm — never "you changed it"', () => {
    // The overlay is the only thing that licenses the factual "Model changed"
    // claim. Silence alone must not manufacture it.
    expect(
      classifyFreshnessForDisplay(
        { freshness: 'unknown', freshnessReason: VERDICT_ABSENT_FROM_PAYLOAD },
        false,
      ),
    ).toBe('cannot_confirm')
  })

  it('a silent payload does not clear the overlay held by an UNDISPATCHED edit either', () => {
    seedRunThenLocalEdit()
    useCanvasStore.setState({ pendingEmittedEdits: 1 } as never)
    useCanvasStore.getState().setAnalysisFreshness(APPLIED_EDIT_READINESS)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('a payload that DOES carry a verdict still clears the overlay (no regression)', () => {
    seedRunThenLocalEdit()
    // A genuine re-run: CEE speaks, hashes match the post-edit graph.
    useCanvasStore.getState().setAnalysisFreshness({
      ...RUN_VERDICT,
      computed_at: '2026-07-29T02:24:37.734Z',
      graph_hash_at_run: 'a36f4f1a643df6cd',
      current_graph_hash: 'a36f4f1a643df6cd',
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(semanticNow()).toBe('current')
  })
})

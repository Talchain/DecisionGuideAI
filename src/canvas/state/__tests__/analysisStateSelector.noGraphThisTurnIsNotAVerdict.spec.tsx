/**
 * `no_graph_this_turn` IS NOT A VERDICT, SO IT CANNOT OUTRANK A LOCAL EDIT.
 *
 * ── THE DEFECT, WITNESSED ON SERVED `76e25c5f` (23 Sep 2026) ──────────────
 * A run completes (`run_state.kind: complete_current`). The user sets one
 * factor value in the Model tab. That `factor_value_edit` turn answers with a
 * `graph_patch` block and an `analysis_state` whose run state is
 *
 *     { kind: 'unknown_degraded', cause: 'no_graph_this_turn' }
 *
 * The store REPLACES the turn-scoped wire slice with it (`applyV5State`, step 4:
 * "non-null means CEE stated a verdict FOR THIS TURN"), and the selector's only
 * local-edit arm fired for `complete_current` — so the edit was out-ranked by a
 * turn that had not looked at currency at all. Reasoning then offered no footer
 * Re-analyse (`ReanalyseBar` returns null on `cannot_confirm`) and the ribbon
 * swapped "Re-run to be sure" for "Review or set an estimate", the act the user
 * had just performed. After a reload the same model reads `'changed'`.
 *
 * ── WHY THE CAUSE IS "NOT A VERDICT" — DERIVED AT THE PRODUCER ────────────
 * CEE `orchestrator-v5/compose/analysis-state-v1.ts` @ `fa101898` (the CEE the
 * witness ran against) mints exactly this shape from ONE input: canonical
 * `freshness: 'unknown'` with `reason: 'current_graph_hash_unavailable'`,
 * i.e. "no graph was in scope, so there was nothing to classify" — the schema's
 * own wording for the cause. Its docblock names the case: "genuinely nothing was
 * looked at (today: the `system_event` family …)", and `factor_value_edit` is a
 * `system_event` turn (`v5/buildPayload.ts`).
 *
 * ── WHAT THIS DOES *NOT* DO — EACH BOUNDARY IS PINNED BELOW ───────────────
 *   · every OTHER `unknown_degraded` cause is untouched (a store that could not
 *     be read, a legacy fact, an unverified refusal are real epistemic failures);
 *   · without a local edit nothing moves — no staleness invented, and no
 *     currency either;
 *   · under an import hold it answers exactly as the `complete_current` arm
 *     does — cannot-confirm, never "changed";
 *   · a model that has never completed a run is not "out of date".
 *
 * Assertions bind by IDENTITY — the exact member, the exact kind and cause, the
 * surface's own testid — never by a value predicate a sibling state could meet.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import {
  AnalysisStateV1Schema,
  AnalysisDegradedCauseSchema,
  type AnalysisDegradedCause,
  type AnalysisStateV1,
} from '@talchain/schemas/boundary'

import {
  composeAnalysisState,
  type ComposeAnalysisStateInput,
} from '../analysisStateSelector'
import {
  VERDICT_ABSENT_FROM_PAYLOAD,
  type AnalysisFreshnessState,
} from '../../store/analysisFreshness'
import { useCanvasStore } from '../../store'
import { applyV5State } from '../../../v5/applyV5State'
import { withObservedStateUpdate } from '../../utils/observedStateHelpers'
import { ReanalyseBar } from '../../components/model-tab/ReanalyseBar'
import { staleReasonFromTrustSemantic } from '../../../components/results/analysisNew/staleReason'
import { buildAnalysisNewViewModel } from '../../../components/results/analysisNew/buildAnalysisNewViewModel'
import { AtAGlance } from '../../../components/results/analysisNew/sections/AtAGlance'
import { decisionWithLeaderWithheldAndReason } from '../../../components/results/analysisNew/__tests__/analysisNewFixtures'

vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — built through the REAL contract parser, never hand-cast.
// ─────────────────────────────────────────────────────────────────────────────

function wireVerdict(over: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  const parsed = AnalysisStateV1Schema.safeParse({
    run_state: { kind: 'complete_current', computed_at: '2026-09-23T10:00:00.000Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  })
  if (!parsed.success) {
    throw new Error(
      `fixture does not satisfy AnalysisStateV1: ${JSON.stringify(parsed.error.issues)}`,
    )
  }
  return parsed.data
}

/**
 * A degraded verdict with the given cause. The usability members are all false
 * because CEE's no-fact synthesis drives "every usability predicate to false"
 * (`selected_fact_index: null`, same file as above); `requires_rerun: false`
 * is what that synthesis copies from a canonical state with no fact selected.
 */
function degraded(cause: AnalysisDegradedCause): AnalysisStateV1 {
  return wireVerdict({
    run_state: { kind: 'unknown_degraded', cause },
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
  })
}

const NO_GRAPH_THIS_TURN = degraded('no_graph_this_turn')

/** CEE's run verdict on the legacy slice: the analysis matched the graph. */
const CEE_SAID_FRESH: AnalysisFreshnessState = {
  freshness: 'fresh',
  freshnessReason: 'graph_hash_match',
  graphHashAtRun: 'hash_a',
  currentGraphHash: 'hash_a',
  computedAt: '2026-09-23T09:59:00.000Z',
}

/**
 * The slice after a readiness-only `analysis_ready` — which is what CEE's
 * `dispatchFactorValueEdit` returns (`buildCanonicalAnalysisReadyFromGraph`,
 * no `freshness`, at `fa101898`) and what the captured staging applied-edit
 * reply looks like (`store/__tests__/freshnessOnAppliedEdit.spec.ts`).
 */
const SILENT_ON_FRESHNESS: AnalysisFreshnessState = {
  freshness: 'unknown',
  freshnessReason: VERDICT_ABSENT_FROM_PAYLOAD,
  computedAt: '2026-09-23T10:01:00.000Z',
}

/** A CEE-STATED stale verdict on the legacy slice — a verdict, not an inference. */
const CEE_STATED_STALE: AnalysisFreshnessState = {
  freshness: 'stale',
  freshnessReason: 'graph_hash_diverged',
  graphHashAtRun: 'hash_a',
  currentGraphHash: 'hash_b',
  computedAt: '2026-09-23T10:01:00.000Z',
}

/** A completed, on-screen analysis whose wire verdict vouches for it. */
const AFTER_THE_RUN: ComposeAnalysisStateInput = {
  analysisState: wireVerdict(),
  freshness: CEE_SAID_FRESH,
  dirty: false,
  source: 'cee_v5_run_analysis',
  resultsStatus: 'complete',
  resultsStartedAt: 1_760_000_000_000,
  importHold: false,
  hasReport: true,
  hasCompletedFirstRun: true,
  ceeAnalysisReadyStatus: 'ready',
  aiPanelV2On: true,
}

/** The witnessed state: the edit turn's verdict has REPLACED the run's. */
const AFTER_THE_EDIT_TURN: ComposeAnalysisStateInput = {
  ...AFTER_THE_RUN,
  analysisState: NO_GRAPH_THIS_TURN,
  dirty: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — the composition
// ─────────────────────────────────────────────────────────────────────────────

describe('a no_graph_this_turn verdict does not outrank a local edit', () => {
  it('RED — run, local edit, then a no_graph_this_turn turn: the analysis reads CHANGED', () => {
    // PRECONDITIONS, pinned in-test (trap 13b): each step of the witnessed
    // journey really produced the state the next step assumes.
    const run = composeAnalysisState(AFTER_THE_RUN)
    expect(run.runStateKind).toBe('complete_current')
    expect(run.semantic).toBe('current')
    const edited = composeAnalysisState({ ...AFTER_THE_RUN, dirty: true })
    expect(edited.semantic, 'the existing complete_current arm').toBe('changed')

    const composed = composeAnalysisState(AFTER_THE_EDIT_TURN)

    // Still the wire's turn — this is not a demotion to the legacy branch, and
    // the verbatim kind is kept (`authority === 'wire'` ⟺ `runStateKind !== null`).
    expect(composed.authority).toBe('wire')
    expect(composed.runStateKind).toBe('unknown_degraded')
    expect(composed.wire?.run_state).toEqual({ kind: 'unknown_degraded', cause: 'no_graph_this_turn' })

    // ⚠ THE SAME THREE MEMBERS, AS ONE UNIT, WITH THE SAME VALUES the
    // complete_current supersession produces — `'unknown'`, never a fabricated
    // `'stale'`, for the displayed value.
    expect(composed.semantic).toBe('changed')
    expect(composed.trust.semantic).toBe('changed')
    expect(composed.displayedFreshness).toBe('unknown')
    expect(composed.requiresRerun).toBe(true)
  })

  it('RED — the same, when the edit turn\'s analysis_ready was silent on freshness', () => {
    const composed = composeAnalysisState({ ...AFTER_THE_EDIT_TURN, freshness: SILENT_ON_FRESHNESS })
    expect(composed.semantic).toBe('changed')
    expect(composed.requiresRerun).toBe(true)
  })

  it('CONTROL (a) — every OTHER unknown_degraded cause is unchanged: cannot-confirm, dirty or not', () => {
    // Derived from the contract's own enum, so a cause added at the next pin
    // bump is held to "unchanged" by default rather than silently exempted.
    const OTHER_CAUSES = AnalysisDegradedCauseSchema.options.filter(
      (c) => c !== 'no_graph_this_turn',
    )
    expect(OTHER_CAUSES.length, 'the control must iterate something').toBeGreaterThan(0)

    for (const cause of OTHER_CAUSES) {
      for (const freshness of [CEE_SAID_FRESH, SILENT_ON_FRESHNESS]) {
        const clean = composeAnalysisState({
          ...AFTER_THE_RUN,
          analysisState: degraded(cause),
          freshness,
          dirty: false,
        })
        const dirtied = composeAnalysisState({
          ...AFTER_THE_RUN,
          analysisState: degraded(cause),
          freshness,
          dirty: true,
        })
        expect(dirtied.semantic, `semantic for ${cause}`).toBe('cannot_confirm')
        expect(dirtied.semantic, `semantic moved for ${cause}`).toBe(clean.semantic)
        expect(dirtied.displayedFreshness, `displayedFreshness moved for ${cause}`).toBe(
          clean.displayedFreshness,
        )
        expect(dirtied.requiresRerun, `requiresRerun moved for ${cause}`).toBe(clean.requiresRerun)
      }
    }
  })

  it('CONTROL (b) — complete_current + local edit + import hold stays cannot-confirm', () => {
    const composed = composeAnalysisState({ ...AFTER_THE_RUN, dirty: true, importHold: true })
    expect(composed.semantic).toBe('cannot_confirm')
    expect(composed.displayedFreshness).toBe('unknown')
    expect(composed.requiresRerun).toBe(true)
  })

  it('CONTROL (b\') — under an import hold, no_graph_this_turn answers EXACTLY as the complete_current arm does', () => {
    // The complete_current arm under a hold: cannot-confirm, 'unknown', and the
    // rerun still offered ("the weaker claim, never silence"). This route must
    // give the identical triple — including over a CEE-STATED stale on the
    // legacy slice, so it can never be the one route that says "changed" under
    // a hold (interim 2.467).
    const reference = composeAnalysisState({ ...AFTER_THE_RUN, dirty: true, importHold: true })
    for (const freshness of [CEE_SAID_FRESH, SILENT_ON_FRESHNESS, CEE_STATED_STALE]) {
      const composed = composeAnalysisState({ ...AFTER_THE_EDIT_TURN, freshness, importHold: true })
      expect(composed.semantic, `semantic over ${freshness.freshnessReason}`).toBe('cannot_confirm')
      expect(composed.semantic).toBe(reference.semantic)
      expect(composed.displayedFreshness).toBe(reference.displayedFreshness)
      expect(composed.requiresRerun).toBe(reference.requiresRerun)
    }
  })

  it('CONTROL (c) — with NO local edit, a no_graph_this_turn turn invents nothing', () => {
    // ⚠ CEE_STATED_STALE is the discriminating row: the derived classifier says
    // 'changed' for it WITHOUT an edit, so only the arm's own `dirty` conjunct
    // keeps this route keyed on the UI's record of an edit. Pinned so that
    // conjunct cannot be deleted silently.
    for (const freshness of [CEE_SAID_FRESH, SILENT_ON_FRESHNESS, CEE_STATED_STALE, null]) {
      const composed = composeAnalysisState({ ...AFTER_THE_EDIT_TURN, freshness, dirty: false })
      // No staleness invented…
      expect(composed.semantic).not.toBe('changed')
      // …and no currency either: the value is exactly today's.
      expect(composed.semantic).toBe('cannot_confirm')
      expect(composed.displayedFreshness).toBe('unknown')
      expect(composed.requiresRerun).toBe(false)
    }
  })

  it('CONTROL (c\') — a model that has never completed a run is not "out of date"', () => {
    const composed = composeAnalysisState({
      ...AFTER_THE_EDIT_TURN,
      hasCompletedFirstRun: false,
      hasReport: false,
    })
    expect(composed.semantic).not.toBe('changed')
  })

  it('CONTROL (c\'\') — a CEE-STATED unknown plus an edit stays cannot-confirm, as on the derived branch', () => {
    // The local record decides only where it is evidence of a change since a
    // run CEE vouched for (or said nothing about). A CEE-stated `unknown` is a
    // verdict, and the derived branch keeps it cannot-confirm too.
    const ceeStatedUnknown: AnalysisFreshnessState = {
      freshness: 'unknown',
      freshnessReason: 'derivation_failed',
      computedAt: '2026-09-23T10:01:00.000Z',
    }
    const composed = composeAnalysisState({ ...AFTER_THE_EDIT_TURN, freshness: ceeStatedUnknown })
    expect(composed.semantic).toBe('cannot_confirm')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — what the user sees
// ─────────────────────────────────────────────────────────────────────────────

/** The CEE run turn's `analysis_ready`: a stated fresh verdict. */
const RUN_ANALYSIS_READY = {
  options: [],
  goal_node_id: 'goal_1',
  status: 'ready',
  computed_at: '2026-09-23T09:59:00.000Z',
  freshness: 'fresh',
  freshness_reason: 'graph_hash_match',
  graph_hash_at_run: 'hash_a',
  current_graph_hash: 'hash_a',
}

/** The edit turn's `analysis_ready`: readiness only, a newer `computed_at`. */
const EDIT_ANALYSIS_READY = {
  options: [],
  goal_node_id: 'goal_1',
  status: 'ready',
  computed_at: '2026-09-23T10:01:00.000Z',
}

/**
 * A V5 store adapter whose two freshness writers are the REAL canvas store's —
 * so the slice the selector reads is written by the production reader, not
 * seeded by hand. Every other setter is a no-op double (the suite convention,
 * see `v5/__tests__/applyV5State.analysisState.spec.ts`).
 */
function realFreshnessAdapter() {
  const noop = () => {}
  return {
    setCurrentStage: noop,
    updateNode: noop,
    updateEdgeData: noop,
    nodes: [],
    edges: [],
    setRunMeta: noop,
    setCeeAnalysisReady: noop,
    setAnalysisRefusalNotice: noop,
    setAnalysisFreshness: (raw: unknown) => useCanvasStore.getState().setAnalysisFreshness(raw),
    setAnalysisStateV1: (v: AnalysisStateV1 | null) => useCanvasStore.getState().setAnalysisStateV1(v),
  }
}

function applyTurn(extra: Record<string, unknown>) {
  applyV5State(
    { response_version: 2, assistant_text: 'ok', blocks: [], ...extra } as never,
    realFreshnessAdapter() as never,
  )
}

/** The witnessed journey, driven through the real writers. */
function driveRunThenValueEditThenEditTurn() {
  useCanvasStore.setState({
    nodes: [
      { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
      {
        id: 'fac_1',
        type: 'factor',
        position: { x: 100, y: 100 },
        data: { label: 'Price', observedState: { value: 0.4 }, observed_state: { value: 0.4 } },
      },
    ] as never,
    edges: [] as never,
    results: {
      status: 'complete',
      report: { ok: true },
      hash: 'h1',
      startedAt: 1_760_000_000_000,
    } as never,
    hasCompletedFirstRun: true,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
  } as never)

  // 1. The run turn: CEE vouches for the result.
  applyTurn({ analysis_state: wireVerdict(), analysis_ready: RUN_ANALYSIS_READY })
  expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current')

  // 2. The Model-tab value edit — the store's own `updateNode` chokepoint, with
  //    the same `withObservedStateUpdate` shape `optimisticFactorEdit` writes.
  const factor = useCanvasStore.getState().nodes.find((n) => n.id === 'fac_1')
  act(() => {
    useCanvasStore
      .getState()
      .updateNode('fac_1', { data: withObservedStateUpdate(factor?.data, { value: 0.6 }) } as never)
  })
  expect(useCanvasStore.getState().analysisFreshnessDirty, 'the edit dirtied the overlay').toBe(true)

  // 3. The edit turn's reply: a verdict that looked at no graph.
  act(() => {
    applyTurn({ analysis_state: NO_GRAPH_THIS_TURN, analysis_ready: EDIT_ANALYSIS_READY })
  })
  // The wire slice is turn-scoped: the run's verdict is GONE, replaced.
  expect(useCanvasStore.getState().analysisStateV1?.run_state).toEqual({
    kind: 'unknown_degraded',
    cause: 'no_graph_this_turn',
  })
  // …and the reply's silence on freshness did not clear the local record.
  expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
}

describe('what the user sees after a value edit answered by a no_graph_this_turn turn', () => {
  beforeEach(() => {
    cleanup()
  })
  afterEach(() => {
    cleanup()
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      analysisStateV1: null,
    } as never)
  })

  it('(d) the footer Re-analyse renders, stating the model changed', () => {
    driveRunThenValueEditThenEditTurn()
    render(
      <ReanalyseBar onReanalyse={vi.fn()} canRun blockedReason={undefined} isAnalysing={false} />,
    )
    const bar = screen.getByTestId('reanalyse-bar')
    expect(bar).toHaveAttribute('data-reason', 'model-changed')
    expect(screen.getByTestId('reanalyse-button')).toBeInTheDocument()
  })

  it('(d) the Reasoning ribbon offers the re-run, not "review or set an estimate"', () => {
    // A withheld leader with a NAMEABLE cause — the only state in which the
    // ribbon swaps the re-run for the estimate route (`buildChecks`). The token
    // is the one a real run carried (`aWithheldClaimIsNotAMissingOne.spec.ts`).
    const WITHHOLD_REASON = 'constraint_verdict_withheld'
    const composed = composeAnalysisState(AFTER_THE_EDIT_TURN)

    // The dock's two hops, restated because they are inline in `OutputsDock`:
    // `staleReasonFromTrustSemantic(composed.trust.semantic)` and
    // `analysisNotConfirmedFresh = displayedFreshness === 'stale' || 'unknown'`.
    // ⚠ SCOPE: this pins the members those hops consume, not the hops.
    const staleReason = staleReasonFromTrustSemantic(composed.trust.semantic)
    const isStale =
      composed.displayedFreshness === 'stale' || composed.displayedFreshness === 'unknown'

    // ⚠ THE FIXTURE CARRIES THE ADMISSION REFUSAL: since bundle 3 the generic
    // token earns "a re-run would not help" only behind one (an explicit Run
    // recovered pricing's first pass, 25 Sep), so the precondition below needs
    // it to discriminate. The subject is unchanged.
    const vmFor = (reason: 'changed' | 'unconfirmed') =>
      buildAnalysisNewViewModel({
        data: decisionWithLeaderWithheldAndReason(),
        producerLeaderWithholdReason: WITHHOLD_REASON,
        recommendations: [],
        isPreRun: false,
        isRunning: false,
        isStale,
        staleReason: reason,
        responseHash: 'h1',
      } as never)

    // PRECONDITION: on this fixture the witnessed 'unconfirmed' reason really
    // does swap the act — so the assertion below discriminates.
    expect(vmFor('unconfirmed').checks.rerunWouldNotHelp).toBe(true)

    const vm = vmFor(staleReason)
    expect(staleReason).toBe('changed')
    expect(vm.checks.rerunWouldNotHelp).toBe(false)

    render(
      <AtAGlance
        glance={vm.atAGlance}
        isStale={vm.status.isStale && !vm.status.isPreRun}
        staleKind={vm.status.staleKind}
        rerunWouldNotHelp={vm.checks.rerunWouldNotHelp}
        reanalyseBlocked={false}
        reanalyseBlockedReason={null}
        isRunning={false}
        onReanalyse={vi.fn()}
        onReviewEstimates={vi.fn()}
      />,
    )
    expect(screen.getByTestId('analysis-new-status-stale')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-glance-ribbon-reanalyse')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-glance-ribbon-review-estimates')).toBeNull()
  })
})

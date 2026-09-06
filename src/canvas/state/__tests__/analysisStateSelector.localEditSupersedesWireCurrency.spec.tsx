/**
 * A LOCAL EDIT THE PRODUCER HAS NOT SEEN SUPERSEDES THE WIRE'S CURRENCY CLAIM.
 *
 * ── THE DEFECT, AND WHERE IT IS ALREADY WRITTEN DOWN ──────────────────────
 * `composeAnalysisState`'s precedence rule is deliberate and correct: when the
 * wire carries `analysis_state`, its verdict wins and the legacy semantic is
 * "not consulted, not blended, and not used as a tie-break". That is what stops
 * six surfaces deriving currency six ways.
 *
 * But the wire's verdict is a statement about THE GRAPH CEE SAW. The local
 * dirty overlay (`analysisFreshnessDirty`) is the UI's own first-hand record
 * that an analysis-affecting edit has happened SINCE — something the producer
 * cannot know, because it has not been told. Under the precedence rule as
 * written, an affirmative `complete_current` therefore survived that edit, and
 * the mounted freshness strip said
 *
 *     "Analysis reflects the current model."
 *
 * over a model the user had just changed.
 *
 * THIS IS NOT A NEW DIAGNOSIS. `serverGraphHydration.ts:187-192` already
 * records it, and works around it at one writer:
 *
 *   "⚠ AND IT MAY ONLY EVER WITHHOLD CURRENCY. `applyBootAnalysisVerdict`
 *    declines `complete_current` outright: on the selector's WIRE branch the
 *    local dirty overlay is not consulted, so restoring a currency claim here
 *    would render 'Analysis complete' over a canvas the merge below is about to
 *    mark stale."
 *
 * That guard covers the BOOT writer. The polling writer
 * (`applyScenarioAnalysisRead.ts`, at its divergence declines) has no such
 * decline — it applies
 * `complete_current` by design — so the window stays open behind it.
 *
 * ── THE TWO ROUTES INTO IT, BOTH MOUNTED ─────────────────────────────────
 *   1. restore a shared version — `mergeAppliedGraph.ts:717` fires
 *      `markGraphStructurallyEdited()` inside `reconcileAppliedGraph`;
 *   2. "add a baseline" — `useAddBaseline.ts:123` clears `ceeAnalysisReady`,
 *      and its `addNode` runs `invalidateAnalysisReady` → the dirty overlay.
 * Neither clears `analysisStateV1`; both leave the wire's currency claim
 * standing over a changed model.
 *
 * ── WHAT THIS DOES *NOT* DO, AND THE BOUNDARY IS THE POINT ───────────────
 * The supersession is keyed ONLY on the local dirty overlay — the UI's own
 * knowledge of an edit — never on a competing legacy VERDICT. A CEE-stated
 * legacy `stale` is still beaten outright by a wire `complete_current`
 * (pinned below, and in `analysisStateSelector.spec.ts`). Inverting THAT would
 * be reopening the divergence the precedence rule exists to close.
 *
 * Assertions bind by IDENTITY — the exact member, the exact kind, the exact
 * exported copy constant — never by a value predicate a sibling state could
 * satisfy.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import {
  AnalysisStateV1Schema,
  ANALYSIS_RUN_STATE_KINDS,
  type AnalysisStateV1,
} from '@talchain/schemas/boundary'

import {
  composeAnalysisState,
  type ComposeAnalysisStateInput,
} from '../analysisStateSelector'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
} from '../../store/analysisFreshness'
import { useCanvasStore } from '../../store'
import { useAddBaseline } from '../../hooks/useAddBaseline'
import {
  AnalysisFreshnessNotice,
  FRESHNESS_COPY,
} from '../../../components/results/AnalysisFreshnessNotice'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Built through the REAL contract parser, never hand-cast — a fixture that
 * cannot meet the contract cannot certify a consumer of it. Overriding
 * `run_state.kind` may require overriding the usability booleans too (the
 * 0.47.0 cross-checks); this helper deliberately does not auto-repair them, so
 * an incoherent pair throws here rather than being silently absorbed.
 */
function wireVerdict(over: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  const parsed = AnalysisStateV1Schema.safeParse({
    run_state: { kind: 'complete_current', computed_at: '2026-08-30T10:00:00.000Z' },
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

const CEE_SAID_FRESH: AnalysisFreshnessState = {
  freshness: 'fresh',
  freshnessReason: 'graph_hash_match',
  graphHashAtRun: 'hash_a',
  currentGraphHash: 'hash_a',
  computedAt: '2026-08-30T09:00:00.000Z',
}

/** A completed, on-screen analysis with a wire verdict that claims currency. */
const WIRE_SAYS_CURRENT: ComposeAnalysisStateInput = {
  analysisState: wireVerdict(),
  freshness: CEE_SAID_FRESH,
  dirty: false,
  source: 'cee_v5_run_analysis',
  resultsStatus: 'complete',
  resultsStartedAt: 1_760_000_000_000,
  importHold: false,
  hasReport: true,
  ceeAnalysisReadyStatus: 'ready',
  aiPanelV2On: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — the composition
// ─────────────────────────────────────────────────────────────────────────────

describe('wire currency is superseded by a local edit the producer has not seen', () => {
  it('complete_current + dirty: the composition withdraws the currency claim as ONE unit', () => {
    // PRECONDITION, PINNED IN-TEST. Without this the case could pass while
    // discriminating nothing — a guard whose power depends on an unpinned
    // fixture (trap 13b). The un-dirtied composition must genuinely claim
    // currency, or "it stopped claiming currency" says nothing.
    const before = composeAnalysisState(WIRE_SAYS_CURRENT)
    expect(before.authority).toBe('wire')
    expect(before.runStateKind).toBe('complete_current')
    expect(before.semantic).toBe('current')
    expect(before.displayedFreshness).toBe('fresh')
    expect(before.requiresRerun).toBe(false)

    const after = composeAnalysisState({ ...WIRE_SAYS_CURRENT, dirty: true })

    // The wire is still the authority — this is a supersession of ONE claim,
    // not a demotion to the legacy branch.
    expect(after.authority).toBe('wire')
    expect(after.runStateKind).toBe('complete_current')

    // ⚠ THE THREE MEMBERS MOVE TOGETHER OR NOT AT ALL. They are composed from
    // one verdict and answer one user-facing question between them; the file's
    // own "THE RUN PAIR" note records the two defects that splitting such a
    // group produced.
    expect(after.semantic).toBe('changed')
    expect(after.trust.semantic).toBe('changed')
    expect(after.displayedFreshness).toBe('unknown')
    expect(after.requiresRerun).toBe(true)
  })

  it('complete_current + dirty: the completion badge yields to "Results may be outdated" WITH a rerun route', () => {
    const before = composeAnalysisState(WIRE_SAYS_CURRENT)
    expect(before.displayState.state).toBe('complete')
    expect(before.displayState.headline).toBe('Analysis complete')

    const after = composeAnalysisState({ ...WIRE_SAYS_CURRENT, dirty: true })
    expect(after.displayState.state).toBe('results_stale')
    expect(after.displayState.headline).toBe('Results may be outdated')
    // The brief's "and how to run one": the stale row is the one that carries
    // the affordance. A withdrawn claim with no route is half a fix.
    expect(after.displayState.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })

  it('POSITIVE CONTROL — a genuinely current analysis still reads complete and fresh', () => {
    // Acceptance 4, and the case this change is most likely to break.
    const composed = composeAnalysisState(WIRE_SAYS_CURRENT)
    expect(composed.semantic).toBe('current')
    expect(composed.displayedFreshness).toBe('fresh')
    expect(composed.requiresRerun).toBe(false)
    expect(composed.displayState.state).toBe('complete')
    expect(composed.displayState.headline).toBe('Analysis complete')
  })

  it('POSITIVE CONTROL — a genuinely running analysis still reads running, dirty or not', () => {
    // Acceptance 3. A "does no harm" case whose state cannot arise asserts
    // nothing, so this drives the real in-flight status through BOTH arms.
    for (const dirty of [false, true]) {
      const composed = composeAnalysisState({
        ...WIRE_SAYS_CURRENT,
        dirty,
        resultsStatus: 'streaming',
      })
      expect(composed.trust.isRunning).toBe(true)
      expect(composed.trust.runStartedAt).toBe(WIRE_SAYS_CURRENT.resultsStartedAt)
    }
  })

  it('THE BOUNDARY — a CEE-stated legacy `stale` is STILL beaten by wire complete_current', () => {
    // The deliberate precedence rule is preserved exactly. The supersession is
    // keyed on the UI's own first-hand knowledge of an edit, never on a
    // competing verdict; without this pin the change could widen into "the
    // legacy branch wins again", which is the divergence the rule exists to
    // close.
    const legacyStale: ComposeAnalysisStateInput = {
      ...WIRE_SAYS_CURRENT,
      dirty: false,
      freshness: {
        freshness: 'stale',
        freshnessReason: 'graph_hash_diverged',
        graphHashAtRun: 'hash_a',
        currentGraphHash: 'hash_b',
        computedAt: '2026-08-30T09:00:00.000Z',
      },
    }
    expect(classifyFreshnessForDisplay(legacyStale.freshness, false, false)).toBe('changed')

    const composed = composeAnalysisState(legacyStale)
    expect(composed.semantic).toBe('current')
    expect(composed.displayedFreshness).toBe('fresh')
    expect(composed.requiresRerun).toBe(false)
  })

  it('THE OPPOSITE-DIRECTION TWIN — under an import hold the supersession may not mint the CHANGE claim', () => {
    // `classifyFreshnessForDisplay` forbids the positive "you changed the
    // model" claim under an import hold: the mitigation's identity match is
    // structural, so it also fires when the GENUINE server graph is on the
    // canvas (ROADMAP 2.467). The wire branch must obey the same rule, or this
    // fix re-opens that P0 in a new spelling.
    const composed = composeAnalysisState({
      ...WIRE_SAYS_CURRENT,
      dirty: true,
      importHold: true,
    })
    expect(composed.semantic).toBe('cannot_confirm')
    expect(composed.displayedFreshness).toBe('unknown')
    // Still withdrawn, still recoverable — the weaker claim, never silence.
    expect(composed.requiresRerun).toBe(true)

    // ⚠ AND THE HALF THAT IS DELIBERATELY *NOT* MOVED. `deriveAnalysisDisplayState`
    // treats cannot-confirm as the neutral completion FACT by ratified design
    // ("'Analysis complete' is a completion fact, not a currentness claim"), and
    // the derived branch has always done so for the identical inputs. This case
    // asserts the two branches AGREE rather than restating a literal, so a
    // future change to that rule moves both or REDs here.
    const derivedTwin = composeAnalysisState({
      ...WIRE_SAYS_CURRENT,
      analysisState: null,
      dirty: true,
      importHold: true,
    })
    expect(derivedTwin.semantic).toBe('cannot_confirm')
    expect(composed.displayState.state).toBe(derivedTwin.displayState.state)
  })

  it('THE THIRD SURFACE — Analysis (New) reads the same member, so its staleness line moves with it', () => {
    // `OutputsDock.tsx:980` composes
    //   `analysisNotConfirmedFresh = displayedFreshness === 'stale' || === 'unknown'`
    // and passes it to `<AnalysisNewTabBody isStale={…}>` at `:3472`. That panel
    // gates its staleness line on `isStale && !isPreRun`, where `isPreRun` is
    // `!hasCompletedFirstRun` — a DIFFERENT question ("is a completed analysis
    // being displayed at all?") which this change does not touch (#972's gate).
    //
    // ⚠ SCOPE, STATED RATHER THAN OVERCLAIMED. This case pins the MEMBER the
    // third surface consumes, on both sides of the window. It does NOT pin the
    // one wiring hop at `OutputsDock.tsx:980` — that expression lives inline in
    // the dock and is not importable, so a change there would not RED here.
    // Naming the unpinned hop is the honest form; claiming end-to-end coverage
    // from a composition test would not be.
    const notConfirmedFresh = (v: string | null) => v === 'stale' || v === 'unknown'

    expect(notConfirmedFresh(composeAnalysisState(WIRE_SAYS_CURRENT).displayedFreshness)).toBe(false)
    expect(
      notConfirmedFresh(composeAnalysisState({ ...WIRE_SAYS_CURRENT, dirty: true }).displayedFreshness),
    ).toBe(true)
  })

  it('EVERY OTHER RUN-STATE KIND IS UNTOUCHED BY THE OVERLAY — derived, not hand-listed', () => {
    // Derived from the contract's own kind list so a kind added at the next pin
    // bump is covered by default rather than silently exempted (trap 12).
    const OTHER_KINDS = ANALYSIS_RUN_STATE_KINDS.filter((k) => k !== 'complete_current')
    expect(OTHER_KINDS.length).toBeGreaterThan(0)

    // The usability booleans a non-current kind requires, per the 0.47.0
    // cross-checks. Incoherent pairs throw in `wireVerdict`, so a wrong entry
    // here fails loudly rather than skipping.
    const coherent: Record<string, Partial<AnalysisStateV1>> = {
      never_run: { usable_for_prose: false, usable_for_chips: false, usable_for_followup: false },
      running: { usable_for_chips: false },
      blocked: {
        blocked_unusable: true,
        usable_for_prose: false,
        usable_for_chips: false,
        usable_for_followup: false,
      },
      refused: { usable_for_chips: false },
      complete_stale: { usable_for_chips: false },
      unknown_degraded: { usable_for_chips: false },
    }
    const runState: Record<string, Record<string, unknown>> = {
      never_run: { kind: 'never_run' },
      running: { kind: 'running', started_at: '2026-08-30T10:00:00.000Z' },
      blocked: { kind: 'blocked', reason_code: 'model_not_analysable', blockers: [] },
      refused: { kind: 'refused', reason_code: 'analysis_declined_this_turn' },
      complete_stale: {
        kind: 'complete_stale',
        computed_at: '2026-08-30T10:00:00.000Z',
        cause: 'graph_changed',
      },
      unknown_degraded: { kind: 'unknown_degraded', cause: 'legacy_fact' },
    }

    for (const kind of OTHER_KINDS) {
      const state = wireVerdict({
        run_state: runState[kind] as AnalysisStateV1['run_state'],
        ...coherent[kind],
      })
      const clean = composeAnalysisState({ ...WIRE_SAYS_CURRENT, analysisState: state, dirty: false })
      const dirtied = composeAnalysisState({ ...WIRE_SAYS_CURRENT, analysisState: state, dirty: true })
      expect(dirtied.semantic, `semantic moved for ${kind}`).toBe(clean.semantic)
      expect(dirtied.displayedFreshness, `displayedFreshness moved for ${kind}`).toBe(
        clean.displayedFreshness,
      )
      expect(dirtied.requiresRerun, `requiresRerun moved for ${kind}`).toBe(clean.requiresRerun)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — the MOUNTED surface, driven through the REAL routes
//
// `AnalysisFreshnessNotice` is the deployed freshness surface: its testid and
// both of its copy strings are present in the staging bundle at `523baf2d`.
// The composition above proves the rule; these cases prove a user reaches it.
// ─────────────────────────────────────────────────────────────────────────────

/** The store state a session has after a completed analysis was delivered. */
function seedCompletedAnalysisSession(): void {
  useCanvasStore.setState({
    nodes: [
      { id: 'dec_1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Choose a route' } },
      {
        id: 'fac_1',
        type: 'factor',
        position: { x: 100, y: 100 },
        data: { label: 'Speed', observed_state: { value: 0.4 } },
      },
    ] as never,
    edges: [] as never,
    results: {
      status: 'complete',
      report: { ok: true },
      hash: 'h1',
      startedAt: 1_760_000_000_000,
    } as never,
    analysisFreshness: CEE_SAID_FRESH,
    analysisFreshnessDirty: false,
    analysisStateV1: wireVerdict(),
    ceeAnalysisReady: { status: 'ready', options: [] } as never,
    importPendingServerRegistration: false,
  })
}

function noticeFreshness(): string | null {
  return screen.getByTestId('analysis-freshness-notice').getAttribute('data-freshness')
}

describe('the mounted freshness strip, driven through the real routes', () => {
  beforeEach(() => {
    cleanup()
    seedCompletedAnalysisSession()
  })

  it('MOUNT PATH — the strip renders the wire currency claim before any edit', () => {
    render(<AnalysisFreshnessNotice />)
    // The mount is asserted by the surface's own testid, and the copy binds to
    // the exported constant rather than to a retyped literal.
    expect(noticeFreshness()).toBe('fresh')
    expect(screen.getByRole('status')).toHaveTextContent(FRESHNESS_COPY.fresh)
  })

  it('ROUTE 1 — after a restore, the strip stops claiming the analysis reflects the model', () => {
    // `reconcileAppliedGraph` fires exactly this store action on every restore
    // (`mergeAppliedGraph.ts:717`); calling it binds this case to the chokepoint
    // the restore path uses rather than to a re-creation of its effect.
    render(<AnalysisFreshnessNotice />)
    expect(noticeFreshness()).toBe('fresh')

    act(() => {
      useCanvasStore.getState().markGraphStructurallyEdited()
    })
    // Precondition of the route, pinned: the restore really did dirty the
    // overlay and really did leave the wire verdict standing.
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current')

    expect(noticeFreshness()).toBe('unknown')
    expect(screen.getByRole('status')).toHaveTextContent(FRESHNESS_COPY.unknown)
    expect(screen.getByRole('status')).not.toHaveTextContent(FRESHNESS_COPY.fresh)
  })

  it('ROUTE 2 — after "add a baseline", the strip stops claiming the analysis reflects the model', () => {
    render(<AnalysisFreshnessNotice />)
    expect(noticeFreshness()).toBe('fresh')

    // The REAL hook, not a re-creation of what it does.
    const { result } = renderHook(() => useAddBaseline())
    act(() => {
      expect(result.current.addBaseline()).toBe(true)
    })

    // Preconditions of the route, pinned in-test: this is the null-ready window
    // (`useAddBaseline.ts:123`), the overlay is set, and the wire verdict
    // survived it — which is exactly why the strip could lie here.
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current')

    expect(noticeFreshness()).toBe('unknown')
    expect(screen.getByRole('status')).toHaveTextContent(FRESHNESS_COPY.unknown)
    expect(screen.getByRole('status')).not.toHaveTextContent(FRESHNESS_COPY.fresh)
  })

  it('POSITIVE CONTROL — with no edit, the strip still says the analysis reflects the model', () => {
    render(<AnalysisFreshnessNotice />)
    expect(noticeFreshness()).toBe('fresh')
    expect(screen.getByRole('status')).toHaveTextContent(FRESHNESS_COPY.fresh)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})

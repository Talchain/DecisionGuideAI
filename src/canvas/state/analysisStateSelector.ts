/**
 * analysisStateSelector — THE ONE selector over `AnalysisStateV1`.
 *
 * Analysis-state authority migration, STEP 5 (UI consumer side). The contract
 * is `@talchain/schemas/boundary`'s `AnalysisStateV1` (0.46.0); CEE emits ONE
 * `analysis_state` per turn on the turn envelope beside `analysis_ready`.
 *
 * WHAT THIS EXISTS TO CLOSE
 * -------------------------
 * The UI answered "what is the state of the analysis, and what may I say about
 * it" in SIX different vocabularies, each derived from a different subset of
 * the payload, none gating any other:
 *
 *   1. `store/analysisFreshness.ts`        — the CEE freshness verdict + the local dirty overlay
 *   2. `hooks/useAnalysisTrust.ts`         — freshness × orphan × run-status
 *   3. `hooks/useAnalysisStateSource.ts`   — where did the visible result come from
 *   4. `utils/deriveAnalysisDisplayState.ts` — the hero/banner copy state
 *   5. `lib/derivePipelineStatus.ts`       — the debug bundle's scoped status
 *   6. `components/resultsTabFreshness.ts` — the Results-tab glyph
 *
 * They disagreed on reachable states — the estate has shipped a confirmation
 * withholding a leader while the sentence beneath it named one (trap 21). A
 * verdict composed ONCE by the producer is the structural fix: every surface
 * reads the same fields, so two surfaces CANNOT disagree about a fact neither
 * of them derives.
 *
 * THE PRECEDENCE RULE, AND IT IS THE POINT OF THIS MODULE
 * -------------------------------------------------------
 * FEATURE-DETECTED, not flagged. When the wire carries `analysis_state`, it is
 * the AUTHORITY and beats every local derivation — including when the local
 * derivation is present, confident, and says something else. When it is absent
 * (old payloads, replayed captures, every existing fixture) the legacy
 * derivations answer, WRAPPED rather than duplicated: this module calls
 * `classifyFreshnessForDisplay`, `computeAnalysisTrust` and
 * `deriveAnalysisDisplayState` rather than restating their rules, so there is
 * no second copy to drift.
 *
 * That wrapping is why this train is a NO-VISUAL-CHANGE train. Every fixture in
 * the suite predates 0.46.0 and therefore carries no `analysis_state`, so every
 * one of them takes the `derived` branch and renders byte-identically. The wire
 * branch changes behaviour only for payloads that did not previously exist.
 *
 * WHAT THIS MODULE MUST NEVER DO
 * ------------------------------
 * Re-derive a producer-computed field. `requires_rerun`, the three usability
 * booleans and `blocked_unusable` are carried on the wire precisely because a
 * consumer recomputing them re-opens the divergence this shape exists to close.
 * Where the wire is silent this module reports NOT-STATED (`null`) rather than
 * a default — an absent verdict and a negative verdict are different facts, and
 * collapsing them is how an absence becomes a fabricated finding.
 */
import { useMemo } from 'react'
import type {
  AnalysisStateV1,
  AnalysisRunStateKind,
  AnalysisBlocker,
} from '@talchain/schemas/boundary'

import { useCanvasStore } from '../store'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
  type FreshnessDisplaySemantic,
} from '../store/analysisFreshness'
import {
  useAnalysisStateSource,
  type AnalysisStateSource,
} from '../hooks/useAnalysisStateSource'
import {
  deriveAnalysisDisplayState,
  type AnalysisDisplayStateView,
} from '../utils/deriveAnalysisDisplayState'
import {
  deriveResultsTabFreshness,
  type ResultsTabFreshnessIndicator,
} from '../components/resultsTabFreshness'

/** The results-slice statuses that mean "an analysis is in flight right now". */
const RUNNING_STATUSES: ReadonlySet<string> = new Set(['preparing', 'connecting', 'streaming'])

// ─────────────────────────────────────────────────────────────────────────────
// The TRUST CORE, relocated here from `hooks/useAnalysisTrust.ts`.
//
// It moved so the dependency runs ONE WAY (`useAnalysisTrust` → this module).
// Left where it was, the hook would import the selector while the selector
// imported the hook's pure core — a cycle that ES modules happen to tolerate
// for hoisted declarations and that would break silently the first time either
// side gained a module-level initialiser. `hooks/useAnalysisTrust.ts` re-exports
// every symbol below, so all existing import paths keep working unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The composed trust answer — the shape `useAnalysisTrust()` has always
 * returned, kept field-for-field so its eleven consumers need no edit.
 */
export interface AnalysisTrust {
  /** current | changed | cannot_confirm | none — the one display semantic. */
  semantic: FreshnessDisplaySemantic
  /** Results exist but no live run fact backs them (recovered session /
   *  hydrated report). Renders as the cannot-confirm variant WITH the Run
   *  action — never as a second stacked banner. */
  orphaned: boolean
  /** An analysis is in flight right now. */
  isRunning: boolean
  /**
   * Wall-clock ms when the current/most recent run started. F9: reused
   * run-state banners narrate from THIS clock so a mid-run mount reports the
   * age of the RUN, never the age of the component.
   */
  runStartedAt?: number
  /** Technical reason code (debug/telemetry; never user copy). */
  reason?: string
}

/** Reason code carried by the synthesised orphan state — debug only, never user copy. */
export const ORPHANED_RESULT = 'orphaned_result'

/**
 * The F11 fold's ONE precedence rule, shared by the trust core and the freshness
 * strip so they cannot diverge (they previously did: the strip synthesised
 * cannot-confirm for orphan-with-no-verdict while the hook said 'none').
 *
 * An orphaned result (results exist with no live run fact) with NO verdict — or
 * with a held 'none' verdict, which claims "no analysis yet" over a visible
 * results body — renders as the cannot-confirm variant WITH the one Rerun
 * action. A held fresh/stale/unknown verdict always wins over the orphan
 * fallback (one banner, verdict precedence).
 */
export function resolveTrustEffectiveState(
  state: AnalysisFreshnessState | null,
  orphaned: boolean,
): { state: AnalysisFreshnessState | null; orphanSynthesised: boolean } {
  if (orphaned && (state === null || state.freshness === 'none')) {
    return {
      state: { freshness: 'unknown', freshnessReason: ORPHANED_RESULT },
      orphanSynthesised: true,
    }
  }
  return { state, orphanSynthesised: false }
}

/**
 * The LEGACY trust derivation, unchanged. It is the `'derived'` branch's
 * implementation and is called by `composeAnalysisState` rather than restated —
 * there is deliberately no second copy of these rules anywhere.
 */
export function computeAnalysisTrust(input: {
  freshness: AnalysisFreshnessState | null
  dirty: boolean
  source: AnalysisStateSource | null | undefined
  resultsStatus: string | null | undefined
  resultsStartedAt?: number
  /** Interim 2.467 — canvas graph is an unregistered import; see
   *  classifyFreshnessForDisplay's `importHold`. REQUIRED for the same reason
   *  it is required there: an optional flag is one a call site can forget. */
  importHold: boolean
}): AnalysisTrust {
  const { freshness, dirty, source, resultsStatus, resultsStartedAt, importHold } = input
  const orphaned = source === 'orphaned_plot_result'
  const { state: effective } = resolveTrustEffectiveState(freshness, orphaned)
  return {
    semantic: classifyFreshnessForDisplay(effective, dirty, importHold),
    orphaned,
    isRunning: RUNNING_STATUSES.has(resultsStatus ?? ''),
    runStartedAt: resultsStartedAt,
    reason: effective?.freshnessReason,
  }
}

/**
 * Which authority answered. `'wire'` means this turn carried a parsed
 * `AnalysisStateV1` and every producer-computed member below is CEE's own
 * verdict; `'derived'` means the wire was silent and the legacy derivations
 * answered.
 *
 * Deliberately exposed rather than hidden: a surface that needs to know whether
 * it is looking at a producer verdict or a client inference can ask, and the
 * debug bundle records which branch a session took. It is NOT a flag — nothing
 * selects it, the payload does.
 */
export type AnalysisStateAuthority = 'wire' | 'derived'

/**
 * The composed verdict every analysis-truth surface reads.
 *
 * Members fall into two classes and the distinction is load-bearing:
 *   · COMPOSED — always answerable, because the legacy derivations can answer
 *     them too (`semantic`, `trust`, `displayState`, `resultsTab`, `runStateKind`).
 *   · PRODUCER-ONLY — `null` when the wire is silent, because no honest client
 *     derivation exists and a default would be a fabrication.
 */
export interface ComposedAnalysisState {
  /** Which authority answered — see AnalysisStateAuthority. */
  readonly authority: AnalysisStateAuthority
  /**
   * The verbatim parsed wire verdict, or null when this turn carried none.
   * NEVER synthesised: a caller that needs to know what CEE actually said reads
   * this, and `null` means CEE said nothing, not that CEE said "nothing".
   */
  readonly wire: AnalysisStateV1 | null
  /**
   * The run-state verdict. Under `'wire'` this is CEE's own `run_state.kind`.
   * Under `'derived'` it is the closest honest classification the legacy
   * signals support — and it is deliberately CONSERVATIVE: the derived branch
   * never returns `'refused'` or a `cause`-bearing kind, because no legacy
   * signal distinguishes those, and inventing one would be exactly the
   * fabrication this contract exists to stop.
   */
  readonly runStateKind: AnalysisRunStateKind
  /**
   * The ONE display semantic — the value every freshness/trust surface renders
   * from. Under `'wire'` it is mapped from `run_state.kind` by the ratified
   * composition table; under `'derived'` it is `classifyFreshnessForDisplay`'s
   * answer, unchanged.
   */
  readonly semantic: FreshnessDisplaySemantic
  /** The composed trust answer — the shape `useAnalysisTrust()` has always returned. */
  readonly trust: AnalysisTrust
  /** The hero/banner copy state — the shape `useAnalysisDisplayState()` returns. */
  readonly displayState: AnalysisDisplayStateView
  /** The Results-tab glyph decision, composed from the same one semantic. */
  readonly resultsTab: ResultsTabFreshnessIndicator
  /** Where the visible result came from (unchanged classifier). */
  readonly source: AnalysisStateSource
  /**
   * Whether a ranked leader / ordinal / "best option" may render.
   *
   * The contract's licence is a CONJUNCTION and it is applied HERE, once:
   * `leader_claim.permitted` AND `run_state.kind === 'complete_current'`. A
   * permitted claim about a stale run is still a claim about a run that no
   * longer describes the model.
   *
   * `null` = NOT STATED (no wire verdict this turn). A consumer must not read
   * null as `true`. Withholding drops the DESIGNATION and keeps the DATA: win
   * probabilities remain showable when this is false.
   */
  readonly leaderClaimPermitted: boolean | null
  /** Producer's reason for withholding, or null. Never fabricated. */
  readonly leaderWithheldReason: string | null
  /** Producer's separation statement, or null. Absence is NOT "no separation". */
  readonly leaderSeparation: string | null
  /**
   * SCOPE: THE RESULT AS A WHOLE. Null when not computed — never "not robust".
   */
  readonly robustnessAggregateLevel: string | null
  /**
   * SCOPE: INDIVIDUAL FACTORS. `null` means the flip analysis was NOT COMPUTED;
   * `[]` means it WAS computed and no single factor flips the leader. These are
   * different findings and this type keeps them different.
   */
  readonly factorsThatFlipLeader: readonly string[] | null
  /** Producer readiness status code, or null when not stated. */
  readonly readinessStatus: string | null
  /** Producer readiness blockers, or null when not stated (NOT the same as []). */
  readonly readinessBlockers: readonly AnalysisBlocker[] | null
  /** Producer-computed. Null when not stated — never re-derived from run state. */
  readonly usableForProse: boolean | null
  /** Producer-computed. Null when not stated. Never inferred from the prose flag. */
  readonly usableForChips: boolean | null
  /** Producer-computed. Null when not stated. */
  readonly usableForFollowup: boolean | null
  /**
   * Whether a rerun is what would move the user forward. Under `'wire'` this is
   * the producer's own verdict; under `'derived'` it is the affordance rule the
   * UI has always applied (a not-confirmably-current result offers a rerun), so
   * the rerun affordance does not vanish on a legacy payload.
   */
  readonly requiresRerun: boolean
  /** Producer-computed "show nothing derived from this". Null when not stated. */
  readonly blockedUnusable: boolean | null
  /**
   * The producer's OWN self-report of disagreements it detected. `null` = not
   * stated; `[]` = the producer found none. An empty list is NOT a consistency
   * guarantee and must never be presented as one.
   */
  readonly contradictions: readonly string[] | null
}

/**
 * The ratified composition table, as a total function.
 *
 * Derived from the component brief's state × surface matrix — NOT invented
 * here. `blocked` maps to `'none'` because that row renders no freshness
 * banner at all (its surface is the blocker list); `refused` and
 * `unknown_degraded` both map to cannot-confirm because both decline to vouch
 * for a visible result, for different reasons the copy layer distinguishes via
 * `runStateKind`.
 *
 * `running` is the one kind whose semantic depends on context: with a prior
 * result on screen the honest reading is cannot-confirm (the contract requires
 * it be marked superseded-pending, never presented as this run's outcome);
 * with nothing on screen there is no claim to qualify.
 */
export function mapRunStateKindToSemantic(
  kind: AnalysisRunStateKind,
  hasVisibleResult: boolean,
): FreshnessDisplaySemantic {
  switch (kind) {
    case 'never_run':
      return 'none'
    case 'running':
      return hasVisibleResult ? 'cannot_confirm' : 'none'
    case 'blocked':
      return 'none'
    case 'refused':
      return 'cannot_confirm'
    case 'complete_current':
      return 'current'
    case 'complete_stale':
      return 'changed'
    case 'unknown_degraded':
      return 'cannot_confirm'
  }
}

/**
 * Classify the legacy signals into a run-state kind, for the `'derived'` branch.
 *
 * CONSERVATIVE BY CONSTRUCTION. It returns only the four kinds the legacy
 * signals can actually support. It NEVER returns `'refused'` (no legacy signal
 * distinguishes a refusal from a block) and never claims `complete_stale`'s
 * `cause`. Where the legacy signals cannot tell, it says `unknown_degraded`,
 * which is the contract's own instruction: emit the honest absence of a verdict
 * in preference to guessing one.
 */
function deriveRunStateKindFromLegacy(input: {
  semantic: FreshnessDisplaySemantic
  hasReport: boolean
  isRunning: boolean
}): AnalysisRunStateKind {
  const { semantic, hasReport, isRunning } = input
  if (isRunning) return 'running'
  if (!hasReport) return 'never_run'
  switch (semantic) {
    case 'current':
      return 'complete_current'
    case 'changed':
      return 'complete_stale'
    case 'cannot_confirm':
      return 'unknown_degraded'
    case 'none':
      // A report is on screen with no verdict attached to it at all. That is
      // precisely "cannot determine", not "never run" — the report disproves
      // never_run and nothing supports a completion claim.
      return 'unknown_degraded'
  }
}

export interface ComposeAnalysisStateInput {
  /**
   * The parsed wire verdict for THIS turn, or null/undefined when the turn
   * carried none. This is the feature-detection input and the ONLY thing that
   * selects the `'wire'` branch.
   */
  analysisState: AnalysisStateV1 | null | undefined
  /** Legacy: the CEE freshness slice. */
  freshness: AnalysisFreshnessState | null
  /** Legacy: the local dirty overlay. */
  dirty: boolean
  /** Legacy: where the visible result came from. */
  source: AnalysisStateSource | null | undefined
  /** Legacy: the run status enum from the results slice. */
  resultsStatus: string | null | undefined
  /** Legacy: when the current/most recent run started. */
  resultsStartedAt?: number
  /** Legacy: interim 2.467 import hold — see classifyFreshnessForDisplay. */
  importHold: boolean
  /** Legacy: whether a populated report is on screen. */
  hasReport: boolean
  /** Legacy: `ceeAnalysisReady.status`, for the hero/banner copy state. */
  ceeAnalysisReadyStatus: string | undefined
  /** Legacy: whether the aiPanelV2 surface is enabled (Results-tab glyph gate). */
  aiPanelV2On: boolean
}

/**
 * Pure core. Selectors, tests and non-React callers use this; `useAnalysisState`
 * is only the store binding.
 */
export function composeAnalysisState(
  input: ComposeAnalysisStateInput,
): ComposedAnalysisState {
  const {
    analysisState,
    freshness,
    dirty,
    source,
    resultsStatus,
    resultsStartedAt,
    importHold,
    hasReport,
    ceeAnalysisReadyStatus,
    aiPanelV2On,
  } = input

  // ── The legacy answer, computed by WRAPPING the existing derivations. ──────
  // Always computed: it is the fallback, and under the wire branch it is still
  // the source of `orphaned` / `runStartedAt`, which the wire does not carry.
  const legacyTrust = computeAnalysisTrust({
    freshness,
    dirty,
    source,
    resultsStatus,
    resultsStartedAt,
    importHold,
  })

  // ── FEATURE DETECTION. The payload selects the branch; nothing else does. ──
  const wire = analysisState ?? null
  const authority: AnalysisStateAuthority = wire === null ? 'derived' : 'wire'

  const isRunning =
    wire !== null
      ? wire.run_state.kind === 'running'
      : RUNNING_STATUSES.has(resultsStatus ?? '')

  const runStateKind: AnalysisRunStateKind =
    wire !== null
      ? wire.run_state.kind
      : deriveRunStateKindFromLegacy({
          semantic: legacyTrust.semantic,
          hasReport,
          isRunning,
        })

  // THE PRECEDENCE RULE. When the wire is present its verdict wins outright —
  // the legacy semantic is not consulted, not blended, and not used as a
  // tie-break. `classifyFreshnessForDisplay` is still the derived branch's
  // implementation (wrapped above), which is why there is no second copy of it.
  const semantic: FreshnessDisplaySemantic =
    wire !== null
      ? mapRunStateKindToSemantic(wire.run_state.kind, hasReport)
      : legacyTrust.semantic

  // The trust shape every existing consumer reads, with the composed semantic
  // substituted in.
  //
  // `orphaned` stays legacy-sourced because the wire carries NO provenance for a
  // result already on screen, and dropping it would silently remove the orphan
  // affordance from surfaces that have always had it.
  //
  // `runStartedAt` also stays legacy-sourced, and that is a DELIBERATE NARROWING
  // rather than an absence — do not "fix" it by reading the wire. The `running`
  // branch DOES carry `started_at`, but as an ISO timestamp for the run CEE has
  // in flight, whereas this field is the local wall-clock ms the results slice
  // stamped. They are different clocks; swapping one for the other would move
  // every "running for Ns" readout onto a different time base for no stated
  // benefit. Adopting it is its own change, with its own reason.
  const trust: AnalysisTrust = {
    ...legacyTrust,
    semantic,
    isRunning,
  }

  // Hero/banner copy: reuse the existing mapper rather than restating its copy
  // table, feeding it WIRE-DERIVED inputs under the wire branch so the same copy
  // machinery lands on the right row of the ratified composition table.
  //
  // ⚠ `analysisChanged` IS NOT SIMPLY `semantic === 'changed'`, and getting that
  // wrong is a user-visible honesty defect, not a cosmetic one. `refused` and
  // `unknown_degraded` both map to cannot-confirm, and the legacy mapper
  // DELIBERATELY treats cannot-confirm as the neutral completion fact — so
  // feeding it the semantic alone renders a green "Analysis complete" over a
  // turn that explicitly declined to vouch for the result. The composition
  // table gives those rows a DIMMED prior result and a rerun CTA, which is what
  // `results_stale` renders.
  //
  // The legacy treatment stays CORRECT for the derived branch — a CEE 'unknown'
  // really does mean only "cannot confirm", with no refusal behind it — so this
  // forcing is scoped to the wire branch and must not leak into the other.
  const wireKind = wire?.run_state.kind ?? null
  const wireForcesStale =
    wireKind === 'refused' || wireKind === 'complete_stale' || wireKind === 'unknown_degraded'
  const displayState: AnalysisDisplayStateView = deriveAnalysisDisplayState({
    // Readiness under the wire branch is the PRODUCER's own readiness, not the
    // legacy `ceeAnalysisReady` slice — same producer, one less derivation.
    // `blocked` is stated by `run_state`, not by the readiness code, so it is
    // forced across rather than hoped for.
    ceeAnalysisReadyStatus:
      wire === null
        ? ceeAnalysisReadyStatus
        : wireKind === 'blocked'
          ? 'blocked'
          : wire.readiness.status,
    hasReport,
    // The orphan OR is preserved from useAnalysisDisplayState's own rule (RCA-D1).
    analysisChanged: wireForcesStale || semantic === 'changed' || trust.orphaned,
  })

  const resultsTab: ResultsTabFreshnessIndicator = deriveResultsTabFreshness(
    aiPanelV2On,
    semantic === 'changed' ? 'stale' : semantic === 'cannot_confirm' ? 'unknown' : null,
  )

  // ── Producer-only members. NULL means NOT STATED — never a default. ────────
  const leaderClaimPermitted =
    wire === null
      ? null
      : // The contract's conjunction, applied once, here.
        wire.leader_claim.permitted && wire.run_state.kind === 'complete_current'

  return {
    authority,
    wire,
    runStateKind,
    semantic,
    trust,
    displayState,
    resultsTab,
    source: source ?? 'none',
    leaderClaimPermitted,
    leaderWithheldReason: wire?.leader_claim.withheld_reason ?? null,
    leaderSeparation: wire?.leader_claim.separation ?? null,
    robustnessAggregateLevel: wire?.robustness.aggregate_level ?? null,
    factorsThatFlipLeader: wire?.robustness.factors_that_flip_leader ?? null,
    readinessStatus: wire?.readiness.status ?? null,
    readinessBlockers: wire?.readiness.blockers ?? null,
    usableForProse: wire?.usable_for_prose ?? null,
    usableForChips: wire?.usable_for_chips ?? null,
    usableForFollowup: wire?.usable_for_followup ?? null,
    // The one producer-computed member with an honest derived fallback: the
    // rerun AFFORDANCE has always rendered for a not-confirmably-current
    // result, and withdrawing it on legacy payloads would be a regression
    // dressed up as caution.
    requiresRerun:
      wire !== null
        ? wire.requires_rerun
        : semantic === 'changed' || semantic === 'cannot_confirm',
    blockedUnusable: wire?.blocked_unusable ?? null,
    contradictions: wire?.contradictions ?? null,
  }
}

/**
 * THE selector. Every analysis-truth surface reads this — never the slices,
 * never a private re-derivation.
 */
export function useAnalysisState(): ComposedAnalysisState {
  const analysisState = useCanvasStore((s) => s.analysisStateV1)
  const freshness = useCanvasStore((s) => s.analysisFreshness)
  const dirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const resultsStatus = useCanvasStore((s) => s.results?.status)
  const resultsStartedAt = useCanvasStore((s) => s.results?.startedAt)
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  const hasReport = useCanvasStore((s) => s.results?.report != null)
  const ceeAnalysisReadyStatus = useCanvasStore((s) => s.ceeAnalysisReady?.status)
  const { source } = useAnalysisStateSource()

  return useMemo(
    () =>
      composeAnalysisState({
        analysisState,
        freshness,
        dirty,
        source,
        resultsStatus,
        resultsStartedAt,
        importHold,
        hasReport,
        ceeAnalysisReadyStatus,
        // The Results-tab glyph is the only member gated on the aiPanelV2
        // surface, and its existing gate lives at the OutputsDock call site.
        // Composed here as ON so the selector's value is the surface-agnostic
        // one; the tab's own gate still applies at its mount.
        aiPanelV2On: true,
      }),
    [
      analysisState,
      freshness,
      dirty,
      source,
      resultsStatus,
      resultsStartedAt,
      importHold,
      hasReport,
      ceeAnalysisReadyStatus,
    ],
  )
}

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
import type { AnalysisReadinessAuthority } from '../utils/canRunAnalysis'
import {
  classifyFreshnessForDisplay,
  resolveDisplayedFreshness,
  type AnalysisFreshnessState,
  type AnalysisFreshnessValue,
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
import { ANALYSIS_READY_STATUS_UNSUPPLIED } from '../../adapters/cee/types'

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
   * The run-state verdict — CEE's own `run_state.kind` under `'wire'`, and
   * **`null` under `'derived'`**.
   *
   * ⭐ `null` IS THE ANSWER, NOT A MISSING ONE. This selector has no legacy
   * authority over the run-state kind. It previously returned a conservative
   * legacy classification here, but that value reached no product surface — its
   * one consumer (`useAnalysisRunState`) only reads this when the wire spoke,
   * because the legacy classification never minted `'refused'` and had no
   * errored-rerun arm, so the consumer had to keep its own limbs anyway. The
   * derivation was deleted as the migration's final step; see the note where it
   * used to live.
   *
   * INVARIANT, pinned in this module's spec: `authority === 'wire'` ⟺
   * `runStateKind !== null`. A consumer may rely on that, and the type now makes
   * the old footgun — passing this straight through on a legacy turn — a
   * COMPILE-TIME error rather than a silent re-darking of the refusal notice.
   */
  readonly runStateKind: AnalysisRunStateKind | null
  /**
   * The ONE display semantic — the value every freshness/trust surface renders
   * from. Under `'wire'` it is mapped from `run_state.kind` by the ratified
   * composition table; under `'derived'` it is `classifyFreshnessForDisplay`'s
   * answer, unchanged.
   */
  readonly semantic: FreshnessDisplaySemantic
  /**
   * The displayed freshness VALUE — the `AnalysisFreshnessValue | null` that
   * `resolveDisplayedFreshness` has always returned, and the thing the
   * remaining raw call sites (the freshness strip, the Results tab, the
   * edit-confirmation chip) actually consume.
   *
   * ⚠ IT IS NOT DERIVED FROM `semantic`, AND MUST NOT BE. The semantic is a
   * LOSSY projection: `'changed'` is reachable both from a CEE-stated `'stale'`
   * AND from `'unknown' + dirty`, so mapping `'changed'` back to a value would
   * render `'stale'` for a verdict CEE never stated — the exact "never fabricate
   * stale" rule `resolveDisplayedFreshness` exists to enforce. Under the derived
   * branch this is `resolveDisplayedFreshness`'s own output, unchanged; under
   * the wire branch it is mapped straight from `run_state.kind`.
   */
  readonly displayedFreshness: AnalysisFreshnessValue | null
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
    default: {
      // ⚠ RUNTIME FLOOR (ROADMAP 2.1258). Unreachable through a validated
      // payload today — the envelope's discriminated union rejects an unknown
      // `kind` before this function sees it. But that guarantee lives in the
      // SCHEMA PIN, not in this file, and a newer CEE emitting a kind this pin
      // does not know is exactly the case the pin cannot cover. Without this,
      // the switch falls through to `undefined` and every consumer reads it as
      // "no verdict".
      //
      // It degrades to CANNOT-CONFIRM and never to a completion claim: an
      // unrecognised state is precisely the situation in which the product has
      // least right to vouch for a result.
      //
      // The `never` binding keeps the COMPILE-TIME check as well: add a member
      // to `ANALYSIS_RUN_STATE_KINDS` without handling it above and `kind` stops
      // being `never` here, so this line fails to typecheck. Runtime floor and
      // compile-time exhaustiveness are both required — the floor alone would
      // let a new kind be silently swallowed at the next pin bump.
      const unhandled: never = kind
      void unhandled
      return 'cannot_confirm'
    }
  }
}

/**
 * Map a wire run-state kind to the displayed freshness VALUE.
 *
 * Straight from the contract, never via `semantic` — see the
 * `displayedFreshness` field doc for why the round-trip is unsafe. Note that
 * `'stale'` is produced ONLY by `complete_stale`, i.e. only when CEE actually
 * stated the result is out of date; every uncertainty kind lands on `'unknown'`
 * (cannot-confirm), which is what keeps "never fabricate stale" true on the
 * wire branch as well as the derived one.
 */
export function mapRunStateKindToDisplayedFreshness(
  kind: AnalysisRunStateKind,
  hasVisibleResult: boolean,
): AnalysisFreshnessValue | null {
  switch (kind) {
    case 'never_run':
    case 'blocked':
      return 'none'
    case 'running':
      return hasVisibleResult ? 'unknown' : 'none'
    case 'refused':
    case 'unknown_degraded':
      return 'unknown'
    case 'complete_current':
      return 'fresh'
    case 'complete_stale':
      return 'stale'
    default: {
      // ⚠ RUNTIME FLOOR (ROADMAP 2.1258) — see the twin in
      // `mapRunStateKindToSemantic` for the full argument. `'unknown'` is the
      // cannot-confirm VALUE; note it is deliberately not `'stale'`, which would
      // fabricate a "model changed" claim CEE never made, and not `'fresh'`,
      // which would vouch for a result under an unrecognised state.
      const unhandled: never = kind
      void unhandled
      return 'unknown'
    }
  }
}

/*
 * ⭐⭐ `deriveRunStateKindFromLegacy` WAS DELETED HERE — the migration's final step.
 *
 * It classified the legacy signals into a run-state kind for the `'derived'`
 * branch. Once `useAnalysisRunState` consumed this selector as a UNION, its
 * output stopped reaching any product surface: `runStateKind` has exactly ONE
 * product consumer, and that consumer only ever reads it when the wire spoke.
 * The legacy branch therefore computed a value nothing rendered.
 *
 * It is DELETED rather than left dormant because a superseded derivation that
 * still compiles is the estate's most reliable source of future confusion — the
 * next reader cannot tell a live fallback from a dead one, and the type said
 * `AnalysisRunStateKind` (non-null) which actively invited a consumer to trust
 * it. `runStateKind` is now `AnalysisRunStateKind | null`, and `null` on the
 * derived branch is the honest answer: this selector has no legacy authority
 * over the run-state KIND. It never really did — it declined to mint `'refused'`
 * and had no error arm, which is precisely why the consumer had to keep its own
 * limbs.
 *
 * Nothing else moved: `semantic`, `displayedFreshness`, `trust` and
 * `displayState` all still answer on the derived branch exactly as before. This
 * removal is scoped to the ONE member that had no reader.
 */

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

  // ── THE RUN PAIR: `isRunning` and `runStartedAt` come from ONE authority ────
  //
  // ⚠ THIS WAS SPLIT AND IT PRODUCED TWO REAL DEFECTS. `isRunning` was
  // wire-authoritative while `runStartedAt` stayed legacy, so:
  //   · wire `running` with no local run → `isRunning` true, `runStartedAt`
  //     undefined → every reused run-state banner narrates from its own
  //     `mountedAtRef` and reports the age of the COMPONENT, not the run. That
  //     is the F9 regression, re-opened by splitting the pair.
  //   · local streaming with a wire verdict of `complete_current` → `isRunning`
  //     false → the run cover is torn down MID-RUN.
  //
  // Two rules fix it. FIRST, running is a DISJUNCTION, because the two sources
  // know different things: the wire describes the turn CEE composed it for,
  // while the results slice knows about a run dispatched since. Neither can
  // veto the other's knowledge of a run in flight, and being wrong toward
  // "still running" costs a moment of extra chrome, whereas being wrong toward
  // "finished" tears down a live run.
  //
  // SECOND, whichever source asserts the run also supplies its clock — so
  // `runStartedAt` is never an orphan, and the two values can never describe
  // different runs. The local slice wins when both assert, because it is the
  // more immediate observation of the run actually on screen.
  const localRunning = RUNNING_STATUSES.has(resultsStatus ?? '')
  const wireRunning = wire !== null && wire.run_state.kind === 'running'
  // `.datetime()` on the contract makes an unparseable value unreachable
  // through a validated payload; the guard is here so that if it ever IS
  // reachable the pair degrades to the local clock rather than to `undefined`,
  // which is the F9 defect wearing a different hat.
  const wireStartedAt =
    wire !== null && wire.run_state.kind === 'running'
      ? Date.parse(wire.run_state.started_at)
      : Number.NaN
  const runPair: { isRunning: boolean; runStartedAt?: number } = localRunning
    ? { isRunning: true, runStartedAt: resultsStartedAt }
    : wireRunning
      ? {
          isRunning: true,
          runStartedAt: Number.isFinite(wireStartedAt) ? wireStartedAt : resultsStartedAt,
        }
      : { isRunning: false, runStartedAt: resultsStartedAt }

  // NULL ON THE DERIVED BRANCH — this selector has no legacy authority over the
  // run-state KIND, and says so rather than inventing one. See the long note
  // where `deriveRunStateKindFromLegacy` used to live.
  //
  // (The local `const isRunning` that fed that derivation was deleted with it.
  // `trust` below reads `runPair.isRunning` directly and always did; leaving the
  // alias behind would have failed the typecheck gate on TS6133, which is how a
  // three-edit version of this deletion passed 118 tests and still failed the
  // gate.)
  const runStateKind: AnalysisRunStateKind | null =
    wire !== null ? wire.run_state.kind : null

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
  // `isRunning`/`runStartedAt` come from the run pair above, as ONE unit — see
  // the long note there for the two defects that splitting them caused.
  const trust: AnalysisTrust = {
    ...legacyTrust,
    semantic,
    isRunning: runPair.isRunning,
    runStartedAt: runPair.runStartedAt,
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
  // ⚠ FAIL-CLOSED BY CONSTRUCTION, and this is the THIRD runtime floor
  // (ROADMAP 2.1258 addendum). This was written as an ALLOW-list of the three
  // kinds known to need forcing — `refused`, `complete_stale`,
  // `unknown_degraded` — which meant any kind NOT on it, including a future one
  // this pin has never heard of, fell through to `analysisChanged: false` and
  // rendered a green "Analysis complete". A completion claim is the single
  // worst default for an unrecognised state, and an allow-list of things to
  // distrust always produces exactly that.
  //
  // Inverted: everything forces the dimmed/rerun row EXCEPT the two kinds that
  // have earned something else — `complete_current` (the only kind entitled to
  // a completion claim at all) and `blocked` (routed to not_ready just below,
  // because a blocked model has no result body to dim).
  const wireForcesStale =
    wire !== null && wireKind !== 'complete_current' && wireKind !== 'blocked'
  const displayState: AnalysisDisplayStateView = deriveAnalysisDisplayState({
    // Readiness under the wire branch is the PRODUCER's own readiness, not the
    // legacy `ceeAnalysisReady` slice — same producer, one less derivation.
    // `blocked` is stated by `run_state`, not by the readiness code, so it is
    // forced across rather than hoped for.
    //
    // ⚠ EXCEPT THE UNSUPPLIED SENTINEL, WHICH IS AN ABSENCE AND NOT A VERDICT.
    // CEE emits `analysis_state` on all 22 exits, and 12 of them supply no
    // readiness payload — `clarify_v2`, the mainline conversational turn, among
    // them. On those `composeAnalysisStateV1` sets `readiness.status` to its
    // `READINESS_STATUS_UNSUPPLIED` sentinel, whose own producer docstring says:
    // "It is NOT a synonym for `blocked`, and a consumer must not treat it as
    // one." Overriding a retained `ready` with it told a user with a fully
    // drafted, CEE-ready model that their model was not set up and REMOVED THE
    // RUN CTA, on every clarifying question asked before the first analysis.
    //
    // So the sentinel FALLS BACK to the last known verdict; it never replaces
    // one. Every real producer status still wins — pinned by an
    // opposite-direction twin in `analysisStateSelector.unsuppliedReadiness.spec.ts`
    // so this cannot widen into "the wire never wins".
    //
    // ⭐ THIS IS THE SAME SHAPE #1004's review round 2 fixed one field up (a
    // per-turn composed value silently degrading a retained known-good verdict,
    // fixed there by threading `exitFreshness`). Fixing one instance of a shape
    // is not fixing the shape — this is the second instance.
    ceeAnalysisReadyStatus:
      wire === null
        ? ceeAnalysisReadyStatus
        : wireKind === 'blocked'
          ? 'blocked'
          : wire.readiness.status === ANALYSIS_READY_STATUS_UNSUPPLIED
            ? ceeAnalysisReadyStatus
            : wire.readiness.status,
    hasReport,
    // The orphan OR is preserved from useAnalysisDisplayState's own rule (RCA-D1).
    analysisChanged: wireForcesStale || semantic === 'changed' || trust.orphaned,
  })

  // The orphan fold applies on the derived branch exactly as the freshness
  // strip has always applied it, so a recovered-session result keeps reading
  // cannot-confirm rather than reverting to "no verdict".
  const { state: effectiveForValue } = resolveTrustEffectiveState(
    freshness,
    legacyTrust.orphaned,
  )
  const displayedFreshness: AnalysisFreshnessValue | null =
    wire !== null
      ? mapRunStateKindToDisplayedFreshness(wire.run_state.kind, hasReport)
      : resolveDisplayedFreshness(effectiveForValue, dirty)

  // ⚠ This used to pass `semantic === 'changed' ? 'stale' : ...` — the very
  // lossy round-trip the `displayedFreshness` doc warns against, written into
  // this file by the same hand that wrote the warning. On the derived branch
  // `'changed'` is reachable from `'unknown' + dirty`, so it would have shown
  // the Results tab the STALE glyph for a verdict CEE never stated, which is
  // precisely what `resultsTabFreshness.ts`'s own header forbids. It reads the
  // value now, not the projection.
  const resultsTab: ResultsTabFreshnessIndicator = deriveResultsTabFreshness(
    aiPanelV2On,
    displayedFreshness,
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
    displayedFreshness,
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

// ─────────────────────────────────────────────────────────────────────────────
// THE RUN GATE'S READ OF THE PRODUCER'S READINESS (19 Aug 2026).
//
// `useAnalysisState()` above already exposes this as `readinessStatus` /
// `readinessBlockers`, and until this date NOTHING IN THE PRODUCT READ EITHER —
// a canonical verdict computed by CEE, carried on every turn, parsed, stored,
// and unconsumed, while the Analyse control was gated by a side-car assessment
// that could and did disagree with it.
//
// This narrower accessor exists so the gate reads the authority WITHOUT paying
// for the full composition (the run gate is evaluated on every canvas render,
// including drag frames) and, more importantly, so no surface reads
// `s.analysisStateV1.readiness` directly. It DERIVES NOTHING: it reshapes two
// producer fields and stops. Anything that decides something about them belongs
// in `canRunAnalysis`, which is where the one predicate lives.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The producer's readiness verdict for the run gate, or `null` when the wire
 * stated none.
 *
 * ⚠ `null` MEANS NOT STATED, and that is a third state, not a negative one. A
 * consumer must not read it as "nothing is blocking" (that is `blockers: []`)
 * nor as "something is". `canRunAnalysis` is the only place entitled to decide
 * what to do about it, and it falls back to the side-car verdict — the
 * pre-0.46 behaviour, byte-for-byte.
 */
/**
 * CEE's `READINESS_STATUS_UNSUPPLIED` (`orchestrator-v5/compose/analysis-state-v1.ts:106`).
 *
 * Restated here rather than imported because CEE is a separate service with no
 * shared export for it — the contract package types `status` as a plain string.
 * That makes this a hand-maintained mirror (trap 12), so it is named ONCE, at
 * the single seam that reads it, with the producer path in the comment above;
 * the guard below fails loud in the only way that matters — a rename at CEE
 * makes the sentinel arrive as a stated status, and the `unknown`-behaves-like-
 * absence test REDs.
 */
const READINESS_STATUS_UNSUPPLIED = 'unknown'

export function selectAnalysisReadinessAuthority(
  analysisState: AnalysisStateV1 | null,
): AnalysisReadinessAuthority | null {
  if (analysisState === null) return null

  // ⭐ THE UNSUPPLIED SENTINEL IS AN ABSENCE WEARING A STATUS CODE.
  //
  // Derived at the producer, not from the contract's prose (trap 13c — the
  // `describe()` text calls `status` a producer-owned code and says nothing
  // about this):
  //
  //   CEE `orchestrator-v5/compose/analysis-state-v1.ts:106`
  //     export const READINESS_STATUS_UNSUPPLIED = 'unknown'
  //   …substituted at `:314` whenever `canonical.status` is not a non-empty
  //   string — and the FULL `analysis_state` is still emitted around it, with
  //   `mapWireBlockers` returning `[]` for an absent list (`:180`). So
  //   `{ status: 'unknown', blockers: [] }` is a routinely reachable payload.
  //
  // CEE's own comment beside the constant is explicit: it "says exactly what is
  // true: no readiness verdict was supplied on this turn. It is NOT a synonym
  // for `blocked`, and a consumer must not treat it as one." Read as a stated
  // verdict, its empty blocker list would be a POSITIVE claim that nothing is
  // blocking — so this consumer would treat it as a synonym for READY, which is
  // worse than the reading CEE forbids, and it would discard a side-car verdict
  // that may correctly be refusing.
  //
  // ⚠ NOTE WHAT 'unknown' IS NOT. The stated vocabulary is the FIVE-member
  // `ANALYSIS_READY_STATUSES` at `orchestrator-v5/context/canonical-analysis-state.ts:137-145`
  // — `ready | needs_user_mapping | needs_encoding | needs_user_input | blocked`.
  // `'unknown'` is not a member of it; it is the sentinel substituted when
  // `coerceReadyStatus` returns null, and it is minted in a different file.
  // Folding it into that allowlist as a sixth value is the same conflation this
  // guard exists to undo.
  //
  // So it collapses to the state this module already has a name for: NOT
  // STATED. Same value, same downstream behaviour, one concept.
  if (analysisState.readiness.status === READINESS_STATUS_UNSUPPLIED) return null

  return {
    status: analysisState.readiness.status,
    blockers: analysisState.readiness.blockers,
  }
}

/** Hook form. Memoised on the store slice, so it is stable across renders. */
export function useAnalysisReadinessAuthority(): AnalysisReadinessAuthority | null {
  const analysisState = useCanvasStore((s) => s.analysisStateV1)
  return useMemo(() => selectAnalysisReadinessAuthority(analysisState), [analysisState])
}

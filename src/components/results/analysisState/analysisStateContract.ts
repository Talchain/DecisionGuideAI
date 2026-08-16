/**
 * The analysis-state COMPOSITION CONTRACT — step 6 of
 * `olumi-docs/feedback-2026-08-16/ANALYSIS-STATE-AUTHORITY-BRIEF.md`.
 *
 * ⚠ WHAT THIS MODULE IS, AND WHAT IT IS NOT
 * -----------------------------------------
 * It is NOT a seventh truth derivation. It derives no freshness, no readiness,
 * no leader entitlement and no run outcome. It answers exactly ONE question
 * that today has no owner anywhere in the estate:
 *
 *     given the run state, WHAT MAY THIS SURFACE RENDER?
 *
 * The brief's composition table is the spec, and this file is that table as
 * executable code. The truth VALUES still come from the existing producers
 * (and, once the migration lane lands, from `AnalysisStateV1` on the wire —
 * see `useAnalysisRunState.ts` for the single swap line).
 *
 * WHY IT EXISTS (the measured defect it closes)
 * ---------------------------------------------
 * L-36 / screenshot S06: "This analysis did not run — it stopped before it
 * ran" and "Cannot confirm whether this analysis is current." rendered ONE
 * ABOVE THE OTHER, directly above a fully rendered result. Three truth claims
 * at once, two of which contradict each other: the first says no run happened,
 * the second says a run happened but its currency is unproven.
 *
 * The mechanism was that `OutputsDock` mounted seven independently-sourced
 * truth-state children and none gated any other. Each component was correct in
 * isolation — which is precisely why no component-level fix works, and why
 * this is a LAYOUT-LEVEL region rather than a neighbour check inside a banner.
 *
 * THE SCOPE OF "TRUTH-STATE BANNER", STATED PRECISELY (trap 21)
 * ------------------------------------------------------------
 * Two banners answer "did the analysis run, and are these numbers current?":
 *   · `AnalysisRefusalNotice`   — it did not run, and why (CEE blocked_reason)
 *   · `AnalysisFreshnessNotice` — it ran; fresh / stale / cannot-confirm
 * These are mutually exclusive by construction here: AT MOST ONE mounts.
 *
 * Deliberately NOT in scope, because they answer a DIFFERENT question and
 * folding them in would be the "two questions under one name" defect this
 * estate keeps paying for:
 *   · `ValidationPanel` / `DegradedStateBanner` / `WarningBanner` /
 *     `InferenceWarningStrip` — "is this RESULT complete and sound?"
 *   · `AnalysisRunningBanner` — staged progress narration for a live turn.
 *   · `stale-results-banner` (ROADMAP 2.1127) — "WHOSE numbers are on screen?"
 *     It is a provenance attribution about the BODY, not a claim about the
 *     run's state, so this region renders it INSIDE the body slot. Its full
 *     reachable-cell matrix stays pinned by `OutputsDock.failedRunHonesty`.
 *
 * DEVIATION FROM THE BRIEF'S TABLE, DELIBERATE AND DISCLOSED
 * ---------------------------------------------------------
 * The brief writes "✓ dimmed prior" for the retained-result rows. Dimming was
 * RETIRED by Paul's Ruling 3 (ROADMAP 2.651): "out-of-date results are
 * labelled, not withheld … No dimming, no aria-disabled lockout." The ratified
 * in-repo doctrine wins over the table's shorthand, so `prior` here means
 * MARKED (a data attribute + the 2.1127 attribution line), never dimmed.
 *
 * The `ranked leader` column of the table is step 7 of the brief and is NOT
 * implemented here — no leader-claim gating semantics are touched by this
 * module, and none should be added to it without that step's contract.
 */

/**
 * The run states of `AnalysisStateV1.run_state`, verbatim from the brief.
 *
 * `blocked` and `refused` are distinct in the contract (blocked = the model
 * cannot be analysed; refused = the engine declined this run) but today's wire
 * carries only ONE signal for both (`analysis_ready.blocked_reason`). The
 * fallback derivation therefore cannot separate them and never mints
 * `blocked`; see `useAnalysisRunState.ts`. They share a composition row, so
 * nothing user-visible depends on the distinction until the wire carries it.
 */
export type AnalysisRunStateKind =
  | 'never_run'
  | 'running'
  | 'blocked'
  | 'refused'
  | 'complete_current'
  | 'complete_stale'
  | 'unknown_degraded'

/** Which single truth-state banner this state entitles the surface to show. */
export type TruthBannerKind = 'none' | 'refusal' | 'freshness'

/** How the result body is presented — never `dimmed`; see the header. */
export type BodyPresentation = 'hidden' | 'current' | 'prior'

/**
 * THE COMPOSITION TABLE, as data.
 *
 * Written as an exhaustive `Record` on purpose: adding a state to
 * `AnalysisRunStateKind` without deciding its banner is a TYPE ERROR, not a
 * silent fall-through to a default. A default arm is how a new state would
 * quietly inherit somebody else's banner.
 */
export const TRUTH_BANNER_BY_RUN_STATE: Record<AnalysisRunStateKind, TruthBannerKind> = {
  // Nothing has run. Saying "no analysis yet" in a banner, on a tab whose
  // whole pre-run surface already says so, is the L-13 stacking defect.
  never_run: 'none',
  // The freshness strip owns the in-flight line ("Rerunning the analysis with
  // the current model…"), so `running` is a freshness row, not a fourth surface.
  running: 'freshness',
  // A model that cannot be analysed, and a run the engine declined, both get
  // the refusal notice — and NOT the freshness notice. This single cell is
  // what makes S06's contradiction unreachable: "it did not run" can no longer
  // be accompanied by "cannot confirm whether it is current".
  blocked: 'refusal',
  refused: 'refusal',
  complete_current: 'freshness',
  complete_stale: 'freshness',
  unknown_degraded: 'freshness',
}

/**
 * The ONE banner this state may render.
 *
 * Total over the enum, and the ONLY selector the region consults — so a second
 * banner cannot be added by a neighbouring component without deleting the
 * region, which REDs `AnalysisStateRegion.singleTruthBanner.spec.tsx`.
 */
export function selectTruthBanner(kind: AnalysisRunStateKind): TruthBannerKind {
  return TRUTH_BANNER_BY_RUN_STATE[kind]
}

/**
 * How the result body renders.
 *
 * @param hasReport whether there is a result to present AT ALL. Passed in
 *   rather than derived, because "is there a report" is the caller's existing
 *   gate (`!isPreRun && hasInlineSummary && resultsSectionData`) and
 *   re-deriving it here would be a second authority for the same question.
 *
 * ⚠ `running` deliberately does NOT hide a retained body. The brief's table
 * writes ✗ for the running row, which is right for a FIRST run (there is
 * nothing to show) and wrong for a rerun: blanking the previous numbers
 * mid-run contradicts the ratified "run-in-flight is MARKED, not blanked"
 * doctrine and would take content away from the user at the moment they are
 * comparing. `hasReport` distinguishes the two cases exactly.
 */
export function selectBodyPresentation(
  kind: AnalysisRunStateKind,
  hasReport: boolean,
): BodyPresentation {
  if (!hasReport) return 'hidden'
  if (kind === 'never_run') return 'hidden'
  return kind === 'complete_current' ? 'current' : 'prior'
}

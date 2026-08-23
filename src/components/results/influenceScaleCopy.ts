/**
 * influenceScaleCopy — the ONE home for influence-scale disclosure wording
 * (lane C4), shared by every surface that renders the display model's
 * influence number: the results Drivers panel (DriversSection header tooltip,
 * ranking explainer, visible caption) and the canvas surfaces (MetricPills
 * "I: NN%" pill, FactorNode detailed-view Influence row). Centralised so the
 * surfaces cannot drift ("keep in step" comments are not a mechanism) and so
 * the copy-hygiene spec has one import to police.
 *
 * Basis semantics (driverDisplayModel): 'normalised_elasticity' is the
 * set-relative fallback (top driver shows 100% by construction) and MUST be
 * disclosed; 'influence_score' is the producer's absolute causal influence
 * score; no provenance (legacy fixtures / cached payloads) fails closed to
 * the generic wording, never claiming a basis the pipeline did not stamp.
 *
 * Copy hygiene (influenceScaleCopy.copyHygiene.spec.ts): sentence case,
 * en-GB, no internal analytical vocabulary, and NO em dashes (DS ban) in any
 * user-facing string exported here.
 */
import type { DriverDisplayProvenance } from './driverDisplayModel'

/** Header tooltip / pill title — no basis stamped (fail-closed). */
export const INFLUENCE_EXPLANATION_GENERIC =
  'Influence: how much this factor affects the outcome'

/** Header tooltip / pill title — set-relative fallback basis. */
export const INFLUENCE_EXPLANATION_RELATIVE =
  'Influence: how much this factor affects the outcome, relative to the strongest. The top driver always shows 100%.'

/** Header tooltip / pill title — absolute producer basis. */
export const INFLUENCE_EXPLANATION_ABSOLUTE =
  'Influence: how much this factor affects the outcome, as an absolute causal influence score from the analysis.'

/** Drivers panel ranking explainer — generic (absolute or unstamped basis). */
export const INFLUENCE_RANKING_EXPLAINER_GENERIC =
  'Ranked by how much each factor affects the outcome'

/** Drivers panel ranking explainer — set-relative fallback basis. */
export const INFLUENCE_RANKING_EXPLAINER_RELATIVE =
  'Ranked by how much each factor affects the outcome, relative to the strongest factor'

/** Drivers panel always-visible caption — set-relative fallback basis only. */
export const INFLUENCE_SCALE_CAPTION =
  'Influence is relative to the strongest factor. The top driver always shows 100%.'

/**
 * Basis-aware explanation for tooltips / native titles. Fail-closed: an
 * absent provenance yields the generic wording.
 */
export function influenceExplanation(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  return provenance === 'normalised_elasticity'
    ? INFLUENCE_EXPLANATION_RELATIVE
    : provenance === 'influence_score'
      ? INFLUENCE_EXPLANATION_ABSOLUTE
      : INFLUENCE_EXPLANATION_GENERIC
}

/**
 * Accessible name for the "I: NN%" pill. The pill's visible text is cryptic,
 * so the name carries both the number and the basis.
 */
export function influencePillAriaLabel(
  pct: number,
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  return provenance === 'normalised_elasticity'
    ? `Influence ${pct}%, relative to the strongest factor. The top driver always shows 100%`
    : provenance === 'influence_score'
      ? `Influence ${pct}%, an absolute causal influence score from the analysis`
      : `Influence ${pct}%`
}

/**
 * Accessible name for the detailed-view Influence DataBar. The value is
 * announced separately via aria-valuenow, so the name carries the basis only.
 */
export function influenceBarAriaLabel(
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  return provenance === 'normalised_elasticity'
    ? 'Influence, relative to the strongest factor. The top driver always shows 100%'
    : provenance === 'influence_score'
      ? 'Influence, an absolute causal influence score from the analysis'
      : 'Influence'
}

// ── The absolute-share claim ────────────────────────────────────────────────

/**
 * ⭐⭐ THE ONE OWNER OF "WHAT NUMBER MAY BACK AN ABSOLUTE CAUSAL SHARE CLAIM"
 * (2026-08-23). The answer is NONE OF THEM, and that is why this returns a
 * MAGNITUDE claim rather than a SHARE claim.
 *
 * ⚠ WHY. "drives NN% of the outcome" is a SHARE claim: it asserts the factor
 * accounts for NN% of the outcome, which implies the factors' shares
 * partition 100%. Neither basis `driverDisplayModel` can resolve partitions:
 *
 *   • 'normalised_elasticity' is |elasticity| / max|elasticity|. The top
 *     factor is 1.0 BY CONSTRUCTION and the values are per-set. Never a share.
 *   • 'influence_score' is the producer's ABSOLUTE CAUSAL INFLUENCE SCORE —
 *     this module's own INFLUENCE_EXPLANATION_ABSOLUTE says exactly that.
 *     An absolute SCALE is not a PARTITION: every factor may score high at
 *     once. Measured at the bytes on the repo's golden staging capture
 *     (`src/test/fixtures/golden-path-staging-2026-04-05.json`), seven
 *     `influence_score` values read 1.0 / 0.8494 / 0.7304 / 0.6694 / 0.6562 /
 *     0.3730 / 0.2238 and SUM TO 4.5022 — 450% of one outcome.
 *
 * So the witnessed defect (a nudge reading "drives 100% of the outcome"
 * beside rows reading 75% and 68%, summing to 243%) cannot be repaired by
 * adjusting the number or by tightening the gate. THE CLAIM IS WHAT IS
 * WRONG. Both surfaces that made it — the T1 dominance nudge
 * (`TriageActionCardsBody`) and the `TriageCard` influence-bar tooltip —
 * render from here, and their local "of the outcome" templates are gone.
 *
 * The number itself is retained and is honest: it is the influence value on
 * a disclosed basis. Only the partition framing is removed.
 *
 * Fail-closed on an unstamped basis: state the number, claim no basis.
 */
function influenceMagnitudeCore(
  pct: number,
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  return provenance === 'influence_score'
    ? `influence score of ${pct}%`
    : provenance === 'normalised_elasticity'
      ? `influence of ${pct}%, relative to the strongest factor`
      : `influence of ${pct}%`
}

/**
 * Predicate slot: reads after a subject, e.g. "{factor} has an influence
 * score of 95%." Used by the T1 dominance nudge.
 */
export function influenceMagnitudePredicate(
  pct: number,
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  return `has an ${influenceMagnitudeCore(pct, provenance)}`
}

/**
 * Standalone slot: a native `title` / tooltip on its own. Same claim, same
 * decision, sentence case. Used by the TriageCard influence bar.
 */
export function influenceMagnitudeTitle(
  pct: number,
  provenance: DriverDisplayProvenance | null | undefined,
): string {
  const core = influenceMagnitudeCore(pct, provenance)
  return core.charAt(0).toUpperCase() + core.slice(1)
}

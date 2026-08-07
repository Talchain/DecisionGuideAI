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

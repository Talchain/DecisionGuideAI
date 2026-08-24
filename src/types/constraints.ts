/**
 * Multi-constraint analysis types.
 *
 * ISL computes constraint_analysis per option when goal_constraints[]
 * is provided in the /v2/run request. Each option gets individual
 * constraint satisfaction probabilities and a joint probability.
 */

/** A single constraint result from ISL analysis */
export interface ConstraintItem {
  /** Node ID of the constrained variable */
  node_id: string
  /** Comparison operator (ASCII — UI renders as unicode ≥/≤) */
  operator: string
  /** Threshold value in user units */
  threshold: number
  /** Display label (e.g. "Churn rate", "MRR") */
  label: string
  /** Probability of satisfying this constraint (0-1) */
  prob_satisfied: number
  /** Median shortfall when constraint is missed */
  failure_margin_median: number
  /** Fraction of scenarios that miss by a small margin (0-1) */
  near_miss_fraction: number
  /** True when this is the tightest / most likely to fail constraint */
  binding: boolean
}

/** Per-option constraint analysis from ISL */
export interface ConstraintAnalysis {
  /** Individual constraint results */
  constraints: ConstraintItem[]
  /** Probability of meeting ALL constraints simultaneously (0-1) */
  joint_probability: number
}

/** Pairwise conditional probability between constraints (from PLoT) */
export interface ConditionalProbability {
  /** ID of the conditioning constraint */
  constraint_a_id: string
  /** Label of the conditioning constraint */
  constraint_a_label: string
  /** ID of the dependent constraint */
  constraint_b_id: string
  /** Label of the dependent constraint */
  constraint_b_label: string
  /** P(B | A met) — probability of B given A is satisfied */
  conditional_probability: number
  /** P(B) — marginal probability for comparison */
  marginal_probability: number
}

/**
 * UI-SEM-010: Constraint confidence colour thresholds.
 * Maps constraint satisfaction probability to colour encoding for display.
 * Thresholds documented here; applied by constraintConfidenceColour() below.
 * Classification: legitimate display formatting — probability→colour mapping.
 *
 * Confidence colour encoding thresholds for constraint probabilities.
 * - >= 0.70: success (green) — likely to meet
 * - 0.40–0.69: info (blue) — uncertain
 * - < 0.40: danger (orange) — likely to miss
 */
export const CONSTRAINT_CONFIDENCE_THRESHOLDS = {
  HIGH: 0.70,
  LOW: 0.40,
} as const

/** Get the Tailwind text colour class for a constraint probability */
export function constraintConfidenceColour(probability: number): string {
  if (probability >= CONSTRAINT_CONFIDENCE_THRESHOLDS.HIGH) return 'text-success'
  if (probability >= CONSTRAINT_CONFIDENCE_THRESHOLDS.LOW) return 'text-info'
  return 'text-danger'
}

/** Get the display label for joint probability */
export function jointProbabilityLabel(probability: number): string {
  if (probability >= CONSTRAINT_CONFIDENCE_THRESHOLDS.LOW) return 'Meets all targets'
  return 'May miss targets'
}

/**
 * UI-SEM-010b: constraint satisfaction BAND — the honest classification of
 * `prob_satisfied` for machine consumers.
 *
 * WHY THIS EXISTS
 * ---------------
 * `assembleAnalysisInputsSummary` used to emit `satisfied: c.prob_satisfied >= 0.5`
 * into the analysis summary. Two things were wrong with that line:
 *
 *  1. `null >= 0.5` and `undefined >= 0.5` are both `false`, so a constraint the
 *     science never evaluated was asserted to be BREACHED. The adjacent line
 *     already guarded `probability` against null — which made it worse, not
 *     better: the unevaluated row shipped as a bare `{satisfied:false}` with no
 *     probability at all, a MORE absolute claim than a genuine miss.
 *
 *  2. It minted a 0.5 threshold that exists nowhere else in this estate. The
 *     bands immediately above (CONSTRAINT_CONFIDENCE_THRESHOLDS, 0.40/0.70) are
 *     what `SuccessTargetRow` and `TargetProbabilityBars` already show the user.
 *     So a constraint at 0.45 was rendered "uncertain" blue on screen while the
 *     summary asserted a flat breach. Producer and screen disagreed inside one
 *     product.
 *
 * This banding therefore REUSES CONSTRAINT_CONFIDENCE_THRESHOLDS rather than
 * introducing a fourth threshold: the number a consumer is told and the colour
 * the user sees now come from one source.
 *
 * ⚠ NAMING — deliberately `'unevaluated'`, NOT `'not_evaluated'`.
 * `olumi-schemas` already owns this concept's word in
 * `ConstraintVerdictStateSchema` (`src/orchestrator/handler-results.ts`), whose
 * own docstring states the principle this type implements: *there is no correct
 * BOOLEAN here — "we could not tell" is a third answer, and collapsing it either
 * way states something false.* That state set is BLOCK-level (the whole
 * constraint set) and this one is PER-CONSTRAINT, so they are not the same type
 * — but they must not be differently-spelled twins of one idea either. Swept
 * 2026-08-24: `'not_evaluated'` appears in neither repo; `'unevaluated'` is the
 * estate's existing spelling.
 */
export type ConstraintSatisfactionBand =
  | 'likely_met'
  | 'uncertain'
  | 'likely_missed'
  | 'unevaluated'

/**
 * Classify a constraint's satisfaction probability into a band.
 *
 * Returns `'unevaluated'` for anything that is not a finite number — null,
 * undefined, NaN, or a non-numeric wire value. The V2 wire admits all of these
 * even though `ConstraintItem.prob_satisfied` is declared `number`, which is
 * precisely why the shipped code guarded `probability` against null.
 *
 * ⚠ An exact `0` is a MEASURED breach, not an absence, and bands as
 * `'likely_missed'`. Guarding with a truthiness test instead of
 * `Number.isFinite` would silently reclassify it as unknown — the mirror of the
 * defect this function exists to fix.
 */
export function getConstraintSatisfactionBand(
  probability: number | null | undefined,
): ConstraintSatisfactionBand {
  if (typeof probability !== 'number' || !Number.isFinite(probability)) return 'unevaluated'
  if (probability >= CONSTRAINT_CONFIDENCE_THRESHOLDS.HIGH) return 'likely_met'
  if (probability >= CONSTRAINT_CONFIDENCE_THRESHOLDS.LOW) return 'uncertain'
  return 'likely_missed'
}

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

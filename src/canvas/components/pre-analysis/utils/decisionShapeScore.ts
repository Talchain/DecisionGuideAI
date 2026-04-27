/**
 * decisionShapeScore — Pure score for the Decision shape readiness dimension (D11).
 *
 * Returns 0–1. Sums to 1.0 across four sub-scores:
 *
 *   options (30%) — most important: a decision needs ≥2 alternatives to compare.
 *                   Saturates at 2 (further options add detail, not shape).
 *   goal     (25%) — required for analysis: without a goal/outcome, no objective
 *                   to optimise. Binary check (present or not).
 *   factors  (25%) — evidence base: 3 factors give meaningful sensitivity. Below
 *                   that the model is too thin to drive a recommendation.
 *   edges    (20%) — causal structure: 4 edges typically reflect a connected
 *                   graph for a 3-factor model. Lowest weight because edges
 *                   without factors do not help; edges saturate fastest.
 *
 * Weights chosen to penalise missing options/goal hardest (hard prerequisites
 * for analysis) while letting partial factor/edge models still earn meaningful
 * progress. Caller MUST exclude constraint edges before passing edgeCount —
 * constraint edges are structural scaffolding, not causal links.
 */
export function decisionShapeScore({
  optionCount,
  outcomeCount,
  factorCount,
  edgeCount,
}: {
  optionCount: number
  outcomeCount: number
  factorCount: number
  edgeCount: number
}): number {
  const optionScore = Math.min(optionCount / 2, 1)
  const outcomeScore = outcomeCount > 0 ? 1 : 0
  const factorScore = Math.min(factorCount / 3, 1)
  const connectionScore = Math.min(edgeCount / 4, 1)
  return (
    Math.round(
      (optionScore * 0.30 + outcomeScore * 0.25 + factorScore * 0.25 + connectionScore * 0.20) * 100,
    ) / 100
  )
}

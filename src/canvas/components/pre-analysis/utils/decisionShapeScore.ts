/**
 * decisionShapeScore — Pure score for the Decision shape readiness dimension (D11).
 *
 * Returns 0–1. Weights: options (30%) goal/outcome (25%) factors (25%) edges (20%).
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

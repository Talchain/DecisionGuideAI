import type { CritiqueRunContext } from './humaniseCritique'

/** Display context from facts already computed by useResultsSectionData. */
export function critiqueRunContext(winSharesAreWithheld: boolean, rankedComparisonPopulation: number): CritiqueRunContext {
  return { hasRankedOptions: !winSharesAreWithheld && rankedComparisonPopulation > 0 }
}

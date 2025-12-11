/**
 * Goal Conflict Detection Utilities
 *
 * Task 5.3: Detect conflicting goals from graph structure and CEE analysis
 *
 * Conflict indicators:
 * 1. Negative correlation between goal outcomes
 * 2. Goals connected to same factors with opposing effects
 * 3. CEE analysis flags trade-off between goals
 */

export interface GoalNode {
  id: string
  label: string
  type: 'goal' | 'outcome'
}

export interface GoalCorrelation {
  goal1Id: string
  goal2Id: string
  correlation: number // -1 to 1
  isConflicting: boolean
  conflictStrength: 'strong' | 'moderate' | 'weak' | 'none'
}

export interface ConflictAnalysis {
  hasConflicts: boolean
  conflictingPairs: GoalCorrelation[]
  alignedPairs: GoalCorrelation[]
  recommendations: string[]
}

/**
 * Threshold for considering goals as conflicting
 */
const CONFLICT_THRESHOLD = -0.3
const STRONG_CONFLICT_THRESHOLD = -0.7
const MODERATE_CONFLICT_THRESHOLD = -0.5

/**
 * Determine conflict strength from correlation
 */
function getConflictStrength(correlation: number): GoalCorrelation['conflictStrength'] {
  if (correlation <= STRONG_CONFLICT_THRESHOLD) return 'strong'
  if (correlation <= MODERATE_CONFLICT_THRESHOLD) return 'moderate'
  if (correlation <= CONFLICT_THRESHOLD) return 'weak'
  return 'none'
}

/**
 * Detect conflicting goals from option scores
 *
 * Uses correlation analysis between goal scores across options
 * to identify trade-offs
 */
export function detectGoalConflicts(
  goals: string[],
  optionScores: Array<{ optionId: string; scores: Record<string, number> }>
): ConflictAnalysis {
  if (goals.length < 2 || optionScores.length < 3) {
    return {
      hasConflicts: false,
      conflictingPairs: [],
      alignedPairs: [],
      recommendations: [],
    }
  }

  const correlations: GoalCorrelation[] = []

  // Calculate pairwise correlations between goals
  for (let i = 0; i < goals.length; i++) {
    for (let j = i + 1; j < goals.length; j++) {
      const goal1 = goals[i]
      const goal2 = goals[j]

      const scores1 = optionScores.map((o) => o.scores[goal1] ?? 0)
      const scores2 = optionScores.map((o) => o.scores[goal2] ?? 0)

      const correlation = calculateCorrelation(scores1, scores2)
      const conflictStrength = getConflictStrength(correlation)

      correlations.push({
        goal1Id: goal1,
        goal2Id: goal2,
        correlation,
        isConflicting: correlation < CONFLICT_THRESHOLD,
        conflictStrength,
      })
    }
  }

  const conflictingPairs = correlations.filter((c) => c.isConflicting)
  const alignedPairs = correlations.filter((c) => c.correlation > 0.3)

  // Generate recommendations based on conflicts
  const recommendations: string[] = []

  if (conflictingPairs.length > 0) {
    const strongConflicts = conflictingPairs.filter((c) => c.conflictStrength === 'strong')

    if (strongConflicts.length > 0) {
      recommendations.push(
        'Strong trade-offs detected. You may need to prioritize which goals matter most.'
      )
    }

    recommendations.push(
      'Use the Pareto frontier to identify options that balance conflicting goals.'
    )

    if (conflictingPairs.length >= goals.length - 1) {
      recommendations.push(
        'Most goals are in conflict. Consider whether all goals are truly necessary.'
      )
    }
  }

  return {
    hasConflicts: conflictingPairs.length > 0,
    conflictingPairs,
    alignedPairs,
    recommendations,
  }
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0)
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0)
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )

  if (denominator === 0) return 0
  return numerator / denominator
}

/**
 * Apply priority weights to option scores
 *
 * Returns weighted composite score for each option
 */
export function applyWeights(
  optionScores: Array<{ optionId: string; label: string; scores: Record<string, number> }>,
  weights: Record<string, number>
): Array<{ optionId: string; label: string; weightedScore: number; originalScores: Record<string, number> }> {
  // Normalize weights to sum to 1
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  const normalizedWeights: Record<string, number> = {}

  for (const [key, weight] of Object.entries(weights)) {
    normalizedWeights[key] = weight / totalWeight
  }

  return optionScores.map((option) => {
    let weightedScore = 0

    for (const [criterion, weight] of Object.entries(normalizedWeights)) {
      const score = option.scores[criterion] ?? 0
      weightedScore += score * weight
    }

    return {
      optionId: option.optionId,
      label: option.label,
      weightedScore,
      originalScores: option.scores,
    }
  })
}

/**
 * Get default equal weights for criteria
 */
export function getDefaultWeights(criteria: string[]): Record<string, number> {
  const weight = 1 / criteria.length
  const weights: Record<string, number> = {}

  for (const criterion of criteria) {
    weights[criterion] = weight
  }

  return weights
}

/**
 * Format conflict strength for display
 */
export function formatConflictStrength(strength: GoalCorrelation['conflictStrength']): string {
  switch (strength) {
    case 'strong':
      return 'Strong conflict'
    case 'moderate':
      return 'Moderate trade-off'
    case 'weak':
      return 'Slight tension'
    case 'none':
      return 'No conflict'
  }
}

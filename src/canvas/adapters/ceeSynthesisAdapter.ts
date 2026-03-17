/**
 * CEE Synthesis Adapter
 *
 * Brief F Task 3C: Transform ISL robustness response to CEE synthesis request format
 *
 * CEE expects a structured payload with:
 * - sensitivity: Factor sensitivity analysis results
 * - voi: Value of Information suggestions
 * - tipping_points: Threshold analysis from robustness bounds
 * - robustness: Overall robustness classification
 * - goal_label: The goal being optimised for
 */

import type { RobustnessResult } from '../components/RecommendationCard/types'

// =============================================================================
// CEE Synthesis Request Types
// =============================================================================

export interface CEESensitivityItem {
  factor_id: string
  factor_label?: string
  sensitivity: number
  direction?: string
  impact_description?: string
}

export interface CEEVoiItem {
  factor_id: string
  factor_label?: string
  voi: number
  recommended_research?: string
}

export interface CEETippingPoint {
  factor_id: string
  factor_label?: string
  threshold_value: number
  current_value?: number
  optimal_before?: string
  optimal_after?: string
}

export interface CEERobustnessItem {
  recommendation_id: string
  recommendation_label?: string
  robustness_score: number
}

export interface CEESynthesisRequest {
  sensitivity?: CEESensitivityItem[]
  voi?: CEEVoiItem[]
  tipping_points?: CEETippingPoint[]
  robustness?: CEERobustnessItem[]
  goal_label?: string
  recommendation_label?: string
}

// =============================================================================
// Transformation Functions
// =============================================================================

/**
 * Map direction from ISL format ('positive'/'negative') to CEE format ('+'/'-')
 */
function mapDirection(direction: string | undefined): string {
  if (direction === 'positive') return '+'
  if (direction === 'negative') return '-'
  return direction || 'neutral'
}

/**
 * Convert robustness label to numeric score
 */
function robustnessLabelToScore(label: string): number {
  const scoreMap: Record<string, number> = {
    robust: 0.9,
    moderate: 0.5,
    fragile: 0.2,
  }
  return scoreMap[label.toLowerCase()] ?? 0.5
}

/**
 * Transform ISL robustness result to CEE synthesis request format
 *
 * Maps:
 * - ISL sensitivity → CEE sensitivity
 * - ISL value_of_information → CEE voi
 * - ISL bounds/tipping_points → CEE tipping_points
 * - ISL robustness_label → CEE robustness[].robustness_score
 */
export function transformISLToCEESynthesis(
  robustnessResult: RobustnessResult | null,
  goalLabel?: string
): CEESynthesisRequest {
  if (!robustnessResult) {
    return {
      goal_label: goalLabel,
    }
  }

  const request: CEESynthesisRequest = {
    goal_label: goalLabel,
  }

  // Transform sensitivity data
  if (robustnessResult.sensitivity && robustnessResult.sensitivity.length > 0) {
    request.sensitivity = robustnessResult.sensitivity.map(s => ({
      factor_id: s.parameter,
      factor_label: s.parameter, // ISL uses parameter as both ID and label
      sensitivity: s.sensitivity_score,
      direction: mapDirection(s.direction),
      impact_description: s.flip_threshold
        ? `Flips recommendation at ${s.flip_threshold.toFixed(2)}`
        : undefined,
    }))
  }

  // Transform VoI data
  if (robustnessResult.voi && robustnessResult.voi.length > 0) {
    request.voi = robustnessResult.voi.map(v => ({
      factor_id: v.parameter,
      factor_label: v.parameter,
      voi: v.voi_score,
      recommended_research: v.recommendation,
    }))
  }

  // Transform bounds to tipping points
  // ISL bounds represent scenarios with lower/upper bounds
  // We convert these to tipping point format for CEE
  if (robustnessResult.bounds && robustnessResult.bounds.length > 0) {
    request.tipping_points = robustnessResult.bounds.map(b => ({
      factor_id: b.scenario,
      factor_label: b.scenario,
      threshold_value: (b.lower + b.upper) / 2, // Midpoint as threshold
      current_value: b.lower,
      optimal_before: b.lower.toFixed(2),
      optimal_after: b.upper.toFixed(2),
    }))
  }

  // Transform robustness label to array format
  if (robustnessResult.label) {
    request.robustness = [{
      recommendation_id: 'primary',
      recommendation_label: 'Current recommendation',
      robustness_score: robustnessLabelToScore(robustnessResult.label),
    }]
    request.recommendation_label = robustnessResult.label
  }

  return request
}

/**
 * Create an empty synthesis request for when robustness data is unavailable
 */
export function createEmptySynthesisRequest(goalLabel?: string): CEESynthesisRequest {
  return {
    goal_label: goalLabel,
    sensitivity: [],
    voi: [],
    tipping_points: [],
    robustness: [],
  }
}

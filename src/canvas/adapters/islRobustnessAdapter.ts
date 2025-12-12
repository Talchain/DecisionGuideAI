/**
 * ISL Robustness Response Adapter
 *
 * Brief 12.3: Transform ISL API response to UI RobustnessResult format
 *
 * ISL returns snake_case fields that need mapping to our TypeScript interfaces.
 * This adapter handles:
 * - Field name normalization (snake_case → camelCase where needed)
 * - Default value fallbacks for optional fields
 * - Confidence derivation from utility distribution spread
 * - Robustness label inference from sensitivity magnitude
 */

import type {
  RobustnessResult,
  RobustnessLabel,
  SensitiveParameter,
  ValueOfInformation,
  RobustnessBound,
  RankedOptionWithRobustness,
  ParetoResult,
} from '../components/RecommendationCard/types'
import type { ConfidenceLevel } from '../../adapters/plot/types'

// =============================================================================
// ISL Raw Response Types (as returned by the API)
// =============================================================================

interface ISLSensitivityParameter {
  parameter_id?: string
  node_id?: string
  name?: string
  label?: string
  value?: number
  current_value?: number
  threshold?: number
  flip_threshold?: number
  direction?: 'increase' | 'decrease'
  magnitude?: number
  sensitivity?: number
  explanation?: string
}

interface ISLValueOfInfo {
  parameter_id?: string
  node_id?: string
  name?: string
  label?: string
  expected_value?: number
  evpi?: number
  worth_investigating?: boolean
  action?: string
  suggested_action?: string
  resolution_cost?: number
  confidence?: 'high' | 'medium' | 'low'
}

interface ISLRobustnessBound {
  scenario?: string
  label?: string
  lower?: number
  upper?: number
  lower_bound?: number
  upper_bound?: number
  varied_parameters?: string[]
  parameters?: string[]
}

interface ISLOptionRanking {
  option_id: string
  option_label?: string
  label?: string
  rank: number
  expected_value?: number
  ev?: number
  confidence?: ConfidenceLevel
  robust_winner?: boolean
  is_robust?: boolean
  loses_in_scenarios?: string[]
}

interface ISLPareto {
  frontier?: string[]
  frontier_options?: string[]
  dominated?: string[]
  dominated_options?: string[]
  narrative?: string
  tradeoff_narrative?: string
  criteria?: string[]
  objectives?: string[]
}

interface ISLRecommendation {
  option_id: string
  confidence?: ConfidenceLevel
  status?: 'clear' | 'close_call' | 'uncertain'
  recommendation_status?: 'clear' | 'close_call' | 'uncertain'
}

export interface ISLRobustnessResponse {
  option_rankings?: ISLOptionRanking[]
  rankings?: ISLOptionRanking[]
  recommendation?: ISLRecommendation
  sensitivity?: ISLSensitivityParameter[]
  sensitive_parameters?: ISLSensitivityParameter[]
  robustness_label?: RobustnessLabel
  robustness?: RobustnessLabel
  robustness_bounds?: ISLRobustnessBound[]
  bounds?: ISLRobustnessBound[]
  value_of_information?: ISLValueOfInfo[]
  voi?: ISLValueOfInfo[]
  narrative?: string
  summary?: string
  pareto?: ISLPareto
  pareto_analysis?: ISLPareto
}

// =============================================================================
// Adapter Functions
// =============================================================================

/**
 * Derive confidence level from utility distribution spread
 * Brief 12.3: High confidence if p90-p10 spread is narrow
 */
export function deriveConfidenceFromSpread(
  p10?: number,
  p50?: number,
  p90?: number
): ConfidenceLevel {
  if (p10 === undefined || p90 === undefined || p50 === undefined) {
    return 'medium'
  }

  const spread = Math.abs(p90 - p10)
  const normalizedSpread = p50 !== 0 ? spread / Math.abs(p50) : spread

  if (normalizedSpread < 0.2) return 'high'
  if (normalizedSpread < 0.5) return 'medium'
  return 'low'
}

/**
 * Infer robustness label from sensitivity parameters
 * Brief 12.3: Fragile if any parameter has high sensitivity near flip threshold
 */
export function inferRobustnessLabel(
  sensitivity: SensitiveParameter[]
): RobustnessLabel {
  if (sensitivity.length === 0) return 'moderate'

  const maxSensitivity = Math.max(...sensitivity.map((s) => s.sensitivity))
  const hasNearFlip = sensitivity.some((s) => {
    const distanceToFlip = Math.abs(s.flip_threshold - s.current_value)
    return distanceToFlip < 0.1 && s.sensitivity > 0.5
  })

  if (hasNearFlip || maxSensitivity > 0.8) return 'fragile'
  if (maxSensitivity > 0.4) return 'moderate'
  return 'robust'
}

/**
 * Adapt ISL sensitive parameter to UI format
 */
function adaptSensitiveParameter(raw: ISLSensitivityParameter): SensitiveParameter {
  return {
    node_id: raw.node_id || raw.parameter_id || '',
    label: raw.label || raw.name || 'Unknown parameter',
    current_value: raw.current_value ?? raw.value ?? 0.5,
    flip_threshold: raw.flip_threshold ?? raw.threshold ?? 0.5,
    direction: raw.direction || 'increase',
    sensitivity: raw.sensitivity ?? raw.magnitude ?? 0.5,
    explanation: raw.explanation,
  }
}

/**
 * Adapt ISL value of information to UI format
 */
function adaptValueOfInformation(raw: ISLValueOfInfo): ValueOfInformation {
  const evpi = raw.evpi ?? raw.expected_value ?? 0
  return {
    node_id: raw.node_id || raw.parameter_id || '',
    label: raw.label || raw.name || 'Unknown parameter',
    evpi,
    worth_investigating: raw.worth_investigating ?? evpi > 0.05,
    suggested_action: raw.suggested_action || raw.action,
    resolution_cost: raw.resolution_cost,
    confidence: raw.confidence,
  }
}

/**
 * Adapt ISL robustness bound to UI format
 */
function adaptRobustnessBound(raw: ISLRobustnessBound): RobustnessBound {
  return {
    scenario: raw.scenario || raw.label || 'Scenario',
    lower: raw.lower ?? raw.lower_bound ?? 0,
    upper: raw.upper ?? raw.upper_bound ?? 0,
    varied_parameters: raw.varied_parameters || raw.parameters || [],
  }
}

/**
 * Adapt ISL option ranking to UI format
 */
function adaptOptionRanking(raw: ISLOptionRanking): RankedOptionWithRobustness {
  return {
    option_id: raw.option_id,
    option_label: raw.option_label || raw.label || raw.option_id,
    rank: raw.rank,
    expected_value: raw.expected_value ?? raw.ev ?? 0,
    confidence: raw.confidence || 'medium',
    robust_winner: raw.robust_winner ?? raw.is_robust ?? false,
    loses_in_scenarios: raw.loses_in_scenarios,
  }
}

/**
 * Adapt ISL Pareto result to UI format
 */
function adaptPareto(raw: ISLPareto): ParetoResult {
  return {
    frontier: raw.frontier || raw.frontier_options || [],
    dominated: raw.dominated || raw.dominated_options || [],
    tradeoff_narrative: raw.tradeoff_narrative || raw.narrative,
    criteria: raw.criteria || raw.objectives || [],
  }
}

/**
 * Main adapter: Transform ISL response to UI RobustnessResult
 */
export function adaptISLRobustnessResponse(
  raw: ISLRobustnessResponse
): RobustnessResult {
  // Adapt sensitivity parameters
  const sensitivityRaw = raw.sensitivity || raw.sensitive_parameters || []
  const sensitivity = sensitivityRaw.map(adaptSensitiveParameter)

  // Adapt value of information
  const voiRaw = raw.value_of_information || raw.voi || []
  const valueOfInformation = voiRaw.map(adaptValueOfInformation)

  // Adapt robustness bounds
  const boundsRaw = raw.robustness_bounds || raw.bounds || []
  const robustnessBounds = boundsRaw.map(adaptRobustnessBound)

  // Adapt option rankings
  const rankingsRaw = raw.option_rankings || raw.rankings || []
  const optionRankings = rankingsRaw.map(adaptOptionRanking)

  // Determine robustness label (use API value or infer from sensitivity)
  const robustnessLabel: RobustnessLabel =
    raw.robustness_label || raw.robustness || inferRobustnessLabel(sensitivity)

  // Adapt recommendation
  const recRaw = raw.recommendation
  const recommendation = {
    option_id: recRaw?.option_id || optionRankings[0]?.option_id || '',
    confidence: recRaw?.confidence || 'medium' as ConfidenceLevel,
    recommendation_status:
      recRaw?.recommendation_status ||
      recRaw?.status ||
      ('uncertain' as const),
  }

  // Adapt Pareto if present
  const paretoRaw = raw.pareto || raw.pareto_analysis
  const pareto = paretoRaw ? adaptPareto(paretoRaw) : undefined

  return {
    option_rankings: optionRankings,
    recommendation,
    sensitivity,
    robustness_label: robustnessLabel,
    robustness_bounds: robustnessBounds,
    value_of_information: valueOfInformation,
    narrative: raw.narrative || raw.summary || '',
    pareto,
  }
}

/**
 * Generate fallback robustness result when ISL is unavailable
 */
export function generateFallbackRobustness(): RobustnessResult {
  return {
    option_rankings: [],
    recommendation: {
      option_id: '',
      confidence: 'medium',
      recommendation_status: 'uncertain',
    },
    sensitivity: [],
    robustness_label: 'moderate',
    robustness_bounds: [],
    value_of_information: [],
    narrative:
      'Robustness analysis is based on default assumptions. Run sensitivity analysis for more accurate results.',
  }
}

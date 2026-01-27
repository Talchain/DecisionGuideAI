/**
 * Graph Display Calculations for Decision Graph Display v2
 * British English: visualisation, colour
 *
 * Pure functions for calculating visual properties:
 * - Edge importance (thickness scaling)
 * - Risk severity banding
 * - Existence certainty (line style)
 */

import type { RiskImpact } from '../domain/nodes'

/**
 * Edge importance formula from Decision Graph Display v2 spec
 *
 * importance = belief × |strength.mean| × goal_sensitivity(v)
 *
 * Where:
 * - belief = edge.exists_probability
 * - strength.mean = edge.strength.mean
 * - goal_sensitivity(node_id) = factor_sensitivity[node_id].elasticity
 *
 * @param belief - Edge exists_probability (0-1), defaults to 1.0 if undefined
 * @param strength - Edge strength.mean, defaults to 1.0 if undefined
 * @param goalSensitivity - Factor elasticity from factor_sensitivity[], defaults to 1.0 for non-factor edges
 * @returns Importance score (unbounded, will be scaled for visual thickness)
 */
export function calculateEdgeImportance(
  belief: number | undefined,
  strength: number | undefined,
  goalSensitivity: number | undefined
): number {
  const beliefValue = belief ?? 1.0
  const strengthValue = Math.abs(strength ?? 1.0)
  // Issue #2 fix: Use 1.0 fallback for non-factor edges (aligns with StyledEdge)
  const sensitivityValue = goalSensitivity ?? 1.0

  return beliefValue * strengthValue * sensitivityValue
}

/**
 * Map importance score to stroke width
 * Scales importance to visual thickness (1-8px range)
 *
 * @param importance - Raw importance score from calculateEdgeImportance
 * @param maxImportance - Maximum importance in the graph for normalization
 * @returns Stroke width in pixels (1-8px)
 */
export function importanceToStrokeWidth(
  importance: number,
  maxImportance: number
): number {
  if (maxImportance === 0) return 2 // Default if no importance data

  const normalized = importance / maxImportance
  const minWidth = 1
  const maxWidth = 8

  return minWidth + normalized * (maxWidth - minWidth)
}

/**
 * Risk severity banding from Decision Graph Display v2 spec
 *
 * score = impact_weight[impact] × probability
 *
 * Thresholds:
 * - <0.5: Low (yellow)
 * - 0.5-1.5: Medium (orange)
 * - 1.5-3: High (red-orange)
 * - >3: Critical (red)
 *
 * @param probability - Risk probability (0-1), optional
 * @param impact - Risk impact level, optional
 * @returns Severity band or null if inputs missing
 */
export function calculateRiskSeverity(
  probability: number | undefined,
  impact: RiskImpact | undefined
): 'low' | 'medium' | 'high' | 'critical' | null {
  if (probability === undefined || impact === undefined) {
    return null
  }

  const impactWeights: Record<RiskImpact, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }

  const score = impactWeights[impact] * probability

  if (score < 0.5) return 'low'
  if (score < 1.5) return 'medium'
  if (score < 3) return 'high'
  return 'critical'
}

/**
 * Map existence certainty to SVG dasharray for line style
 * From Decision Graph Display v2 spec:
 * - Solid: >70%
 * - Dashed: 30-70%
 * - Dotted: <30%
 *
 * @param existsProbability - edge.exists_probability (0-1)
 * @returns SVG dasharray string or undefined for solid
 */
export function existenceCertaintyToLineStyle(
  existsProbability: number | undefined
): string | undefined {
  if (existsProbability === undefined || existsProbability > 0.7) {
    return undefined // Solid (default)
  }

  if (existsProbability >= 0.3) {
    return '8,4' // Dashed
  }

  return '2,2' // Dotted
}

/**
 * Get risk severity color classes for visual heat display
 * Returns Tailwind classes for background and border
 *
 * @param severity - Severity band from calculateRiskSeverity
 * @returns Object with bg and border color classes
 */
export function getRiskSeverityColors(
  severity: 'low' | 'medium' | 'high' | 'critical' | null
): { bg: string; border: string; text: string } {
  switch (severity) {
    case 'low':
      return {
        bg: 'bg-yellow-100',
        border: 'border-yellow-400',
        text: 'text-yellow-900',
      }
    case 'medium':
      return {
        bg: 'bg-orange-100',
        border: 'border-orange-400',
        text: 'text-orange-900',
      }
    case 'high':
      return {
        bg: 'bg-red-100',
        border: 'border-red-500',
        text: 'text-red-900',
      }
    case 'critical':
      return {
        bg: 'bg-red-200',
        border: 'border-red-600',
        text: 'text-red-950',
      }
    default:
      return {
        bg: 'bg-gray-100',
        border: 'border-gray-300',
        text: 'text-gray-700',
      }
  }
}

/**
 * Get controllability border style class
 * From Decision Graph Display v2 spec Task 6:
 * - solid: controllable
 * - dashed: partial
 * - dotted: external
 *
 * @param controllability - Factor controllability level
 * @returns Tailwind border style class
 */
export function getControllabilityBorderStyle(
  controllability: 'controllable' | 'partial' | 'external' | undefined
): string {
  switch (controllability) {
    case 'controllable':
      return 'border-solid'
    case 'partial':
      return 'border-dashed'
    case 'external':
      return 'border-dotted'
    default:
      return 'border-solid' // Default
  }
}

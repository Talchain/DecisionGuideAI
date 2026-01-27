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
 * P1 Hotfix: 'unknown' now returns solid (same as default) — we don't visually
 * distinguish unknown because we have no information to display
 *
 * - solid: controllable (directly intervened)
 * - dashed: partial (downstream of intervention)
 * - solid: unknown (no data — don't claim anything)
 *
 * @param controllability - Factor controllability level
 * @returns Tailwind border style class
 */
export function getControllabilityBorderStyle(
  controllability: Controllability | undefined
): string {
  switch (controllability) {
    case 'controllable':
      return 'border-solid'
    case 'partial':
      return 'border-dashed'
    case 'unknown':
      return 'border-solid' // P1 Hotfix: Don't visually distinguish unknown
    default:
      return 'border-solid' // Default
  }
}

/**
 * Controllability type for factor nodes
 * P1 Hotfix: Changed 'external' to 'unknown' — we can't claim a factor is external
 * when we simply don't have controllability data for it
 */
export type Controllability = 'controllable' | 'partial' | 'unknown'

/**
 * Option with interventions for controllability derivation
 */
interface OptionWithInterventions {
  id: string
  interventions?: Record<string, number | { value: number }>
}

/**
 * Edge for controllability derivation
 */
interface EdgeForControllability {
  source: string
  target: string
}

/**
 * Build reachability set using BFS from intervention targets
 * P1 Hotfix: Multi-hop traversal — all nodes reachable from interventions are 'partial'
 *
 * @param directlyControlled - Set of factor IDs directly targeted by interventions
 * @param edges - Canvas edges for graph traversal
 * @returns Set of all node IDs reachable from intervention targets (excluding directly controlled)
 */
function buildReachableSet(
  directlyControlled: Set<string>,
  edges: EdgeForControllability[] | undefined
): Set<string> {
  const reachable = new Set<string>()

  if (!edges || edges.length === 0) {
    return reachable
  }

  // Build adjacency list for BFS (source -> targets)
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge.target)
  }

  // BFS from all directly controlled nodes
  const queue = [...directlyControlled]
  const visited = new Set<string>(directlyControlled)

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adjacency.get(current) || []

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
        // Only add to reachable if not directly controlled
        if (!directlyControlled.has(neighbor)) {
          reachable.add(neighbor)
        }
      }
    }
  }

  return reachable
}

/**
 * Derive controllability from graph structure
 * P1 Hotfix: Multi-hop BFS traversal for partial controllability
 *
 * Logic:
 * 1. Factor has option intervention targeting it? → controllable (solid border)
 * 2. Factor is reachable from any controllable factor via BFS? → partial (dashed border)
 * 3. Otherwise → unknown (solid border, default — we don't claim anything)
 *
 * @param nodeId - The factor node ID to check
 * @param options - CEE analysis options with interventions
 * @param edges - Canvas edges for graph traversal
 * @returns Controllability level
 */
/**
 * Format a numeric value for display
 * Task 4: Better value display formatting
 *
 * Rules:
 * - Max 2 decimal places for non-currency values
 * - Thousands separator (comma) for large numbers
 * - Handles negative numbers correctly
 * - Returns original value if not a valid number
 *
 * @param value - The numeric value to format
 * @param unit - Optional unit (if 'currency' or starts with '$', uses locale currency formatting)
 * @returns Formatted string
 */
export function formatDisplayValue(
  value: number | undefined | null,
  unit?: string
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '—'
  }

  // Check if currency unit
  const isCurrency = unit === 'currency' || unit?.startsWith('$') || unit?.startsWith('£') || unit?.startsWith('€')

  if (isCurrency) {
    // Use locale currency formatting with 2 decimals
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Non-currency: max 2 decimal places, thousands separator
  // Check if the value needs decimal places
  const hasDecimals = value % 1 !== 0

  if (hasDecimals) {
    // Round to max 2 decimal places
    const rounded = Math.round(value * 100) / 100
    return rounded.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  // Integer: just add thousands separator
  return value.toLocaleString('en-US')
}

export function deriveControllability(
  nodeId: string,
  options: OptionWithInterventions[] | undefined,
  edges: EdgeForControllability[] | undefined
): Controllability {
  if (!options || options.length === 0) {
    return 'unknown'
  }

  // Step 1: Build set of directly controlled factor IDs (factors targeted by interventions)
  const directlyControlled = new Set<string>()
  for (const option of options) {
    if (option.interventions && typeof option.interventions === 'object') {
      for (const factorId of Object.keys(option.interventions)) {
        directlyControlled.add(factorId)
      }
    }
  }

  // Check if this factor is directly controlled
  if (directlyControlled.has(nodeId)) {
    return 'controllable'
  }

  // Step 2: P1 Hotfix — BFS traversal for multi-hop reachability
  // All factors reachable from intervention targets are 'partial'
  const reachable = buildReachableSet(directlyControlled, edges)
  if (reachable.has(nodeId)) {
    return 'partial'
  }

  // Step 3: Otherwise, unknown — we don't have controllability data
  return 'unknown'
}

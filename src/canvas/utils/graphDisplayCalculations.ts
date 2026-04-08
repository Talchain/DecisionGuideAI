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
  const strengthValue = Math.abs(strength ?? 0.5) // Aligned with DEFAULT_EDGE_DATA.weight
  // Issue #2 fix: Use 1.0 fallback for non-factor edges
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
 * Map existence certainty to SVG dasharray for line style.
 * Graph v1.1 Task 7 / wireframe v4: edges with `exists_probability < 0.7`
 * render dashed; `>= 0.7` is solid. The boundary at exactly 0.7 is solid.
 *
 * @param existsProbability - edge.exists_probability (0-1)
 * @returns SVG dasharray string or undefined for solid
 */
export function existenceCertaintyToLineStyle(
  existsProbability: number | undefined
): string | undefined {
  if (existsProbability === undefined || existsProbability >= 0.7) {
    return undefined // Solid (default)
  }
  return '6,4'
}

/**
 * Map weight magnitude to stroke width.
 * Graph v1.1 Task 7 wireframe v4 thresholds:
 *   |mean| >= 0.7 → 3px
 *   |mean| >= 0.4 → 2px
 *   |mean| <  0.4 → 1.5px
 * Calls Math.abs internally — pass the signed mean directly.
 */
export function weightMagnitudeToStrokeWidth(signedMean: number): number {
  const magnitude = Math.abs(signedMean)
  if (magnitude >= 0.7) return 3
  if (magnitude >= 0.4) return 2
  return 1.5
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
        bg: 'bg-panel',
        border: 'border-danger',
        text: 'text-danger',
      }
    case 'critical':
      return {
        bg: 'bg-panel',
        border: 'border-danger',
        text: 'text-danger',
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
    case 'observable':
      return 'border-dashed' // Known baseline, not changed by options
    case 'external':
      return 'border-dotted' // Outside user control (market, regulations)
    case 'partial':
      return 'border-dashed' // Legacy: indirectly affected by interventions
    case 'unknown':
      return 'border-solid' // P1 Hotfix: Don't visually distinguish unknown
    default:
      return 'border-solid' // Default
  }
}

/**
 * Controllability/category type for factor nodes
 * CEE V12.4: Now supports explicit category field from CEE
 * - controllable: Options directly set this factor (solid border)
 * - observable: Known baseline, not changed by options (dashed border)
 * - external: Outside user control - market, regulations (dotted border)
 * - partial: Legacy - indirectly affected by interventions (dashed border)
 * - unknown: No controllability data available (solid border, no visual distinction)
 */
export type Controllability = 'controllable' | 'observable' | 'external' | 'partial' | 'unknown'

/**
 * CEE factor category values (maps to Controllability)
 */
export type FactorCategory = 'controllable' | 'observable' | 'external'

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
 * UI Polish: Percentage formatting fix
 *
 * Rules:
 * - Max 2 decimal places for non-currency values
 * - Thousands separator (comma) for large numbers
 * - Handles negative numbers correctly
 * - Returns original value if not a valid number
 * - Percentage: If unit is '%' and value is in [0,1], multiply by 100 and append '%'
 *
 * @param value - The numeric value to format
 * @param unit - Optional unit (if 'currency' or starts with '$', uses locale currency formatting)
 * @param label - Optional label to help detect 0-1 scale (e.g., "proportion", "fraction")
 * @returns Formatted string (includes unit suffix for %)
 */
export function formatDisplayValue(
  value: number | undefined | null,
  unit?: string,
  label?: string
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '—'
  }

  // Check if currency unit
  const isCurrency = unit === 'currency' || unit?.startsWith('$') || unit?.startsWith('£') || unit?.startsWith('€')

  if (isCurrency) {
    // Use locale currency formatting with 2 decimals
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    // P1 Fix: Strip .00 for whole numbers (e.g., £100,000.00 → £100,000)
    return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted
  }

  // UI Polish Task 1: Handle percentage formatting
  // If unit is '%' and value appears to be in 0-1 scale, multiply by 100
  if (unit === '%') {
    // Value in [-1,1] range → assume 0-1 scale, multiply by 100
    // |value| > 1 → assume already a percentage, don't multiply
    // Fix: Handle negative values (e.g., -0.2 → -20%)
    const isZeroOneScale = Math.abs(value) <= 1
    const displayValue = isZeroOneScale ? Math.round(value * 100) : Math.round(value)
    return `${displayValue}%`
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

/**
 * UI Polish Task 4: Strip technical annotations from labels
 * Removes common technical suffixes that shouldn't be user-facing.
 *
 * @param label - The raw label string
 * @returns Cleaned label without technical annotations
 */
export function cleanDisplayLabel(label: string | undefined): string {
  if (!label) return ''

  // Strip common technical annotations
  return label
    .replace(/\s*\(higher\s*=\s*worse\)/gi, '')
    .replace(/\s*\(lower\s*=\s*worse\)/gi, '')
    .replace(/\s*\(higher\s*=\s*better\)/gi, '')
    .replace(/\s*\(lower\s*=\s*better\)/gi, '')
    .trim()
}

export function deriveControllability(
  nodeId: string,
  options: OptionWithInterventions[] | undefined,
  edges: EdgeForControllability[] | undefined,
  category?: FactorCategory | string
): Controllability {
  // CEE V12.4: If explicit category is provided, use it directly
  // This takes precedence over BFS derivation
  // P1 Hotfix: Normalize category to handle LLM output inconsistencies
  // (e.g., "External", "external ", "CONTROLLABLE")
  if (category) {
    const normalizedCategory = category.trim().toLowerCase()
    const validCategories: FactorCategory[] = ['controllable', 'observable', 'external']
    if (validCategories.includes(normalizedCategory as FactorCategory)) {
      return normalizedCategory as Controllability
    }
  }

  // Fallback: BFS-based derivation for backward compatibility
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

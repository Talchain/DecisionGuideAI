/**
 * Layout policy for semantic node placement
 */

export type LayerPlacement = number | 'first' | 'middle' | 'last'
export type RiskPlacement = 'adjacent' | 'sameColumn' | 'auto'

export interface LayoutPolicy {
  direction: 'LR' | 'TB'
  grid: number
  spacing: { x: number; y: number }
  respectLocked: boolean
  layers: {
    goal: LayerPlacement
    decision: LayerPlacement
    option: LayerPlacement
    outcome: LayerPlacement
    risk: RiskPlacement
  }
  weights: {
    crossings: number
    backEdges: number
    verticalJumps: number
    layerViolations: number
    riskDistance: number
  }
}

export const DEFAULT_LAYOUT_POLICY: LayoutPolicy = {
  direction: 'LR',
  grid: 24,
  spacing: { x: 120, y: 96 },
  respectLocked: true,
  layers: {
    goal: 'first',
    decision: 'middle',
    option: 'middle',
    outcome: 'last',
    risk: 'adjacent'
  },
  weights: {
    crossings: 6,
    backEdges: 5,
    verticalJumps: 3,
    layerViolations: 8,
    riskDistance: 2
  }
}

/**
 * Merge partial policy with defaults
 */
export function mergePolicy(partial?: Partial<LayoutPolicy>): LayoutPolicy {
  if (!partial) return DEFAULT_LAYOUT_POLICY
  
  return {
    ...DEFAULT_LAYOUT_POLICY,
    ...partial,
    spacing: { ...DEFAULT_LAYOUT_POLICY.spacing, ...partial.spacing },
    layers: { ...DEFAULT_LAYOUT_POLICY.layers, ...partial.layers },
    weights: { ...DEFAULT_LAYOUT_POLICY.weights, ...partial.weights }
  }
}

/**
 * Snap position to grid
 */
export function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid
}

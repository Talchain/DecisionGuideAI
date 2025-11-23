import type { GraphHealth } from '../validation/types'
import type { LimitsStatusResult } from './limitsStatus'

export type RunBlockReason = 'ok' | 'empty' | 'validation' | 'health' | 'limits' | 'unknown'

export interface RunEligibilityOptions {
  nodeCount: number
  edgeCount: number
  hasValidationErrors: boolean
  graphHealth: GraphHealth | null
  limitsStatus: LimitsStatusResult | null
}

export interface RunEligibilityResult {
  canRun: boolean
  reason: RunBlockReason
  /**
   * Calm, user-facing explanation for why Run is blocked.
   * Empty string when canRun is true.
   */
  message: string
}

/**
 * Derive whether a run is currently eligible based on graph structure,
 * validation status, graph health, and engine limits.
 *
 * This helper is intentionally pure so that toolbar, keyboard, and
 * Results panel can all share the same gating logic and copy.
 */
export function deriveRunEligibility(options: RunEligibilityOptions): RunEligibilityResult {
  const { nodeCount, hasValidationErrors, graphHealth, limitsStatus } = options

  // Empty graph
  if (nodeCount === 0) {
    return {
      canRun: false,
      reason: 'empty',
      message: 'Add at least one node and connection before running.'
    }
  }

  // Basic sanity: graph with nodes but no edges may still be valid in some
  // flows, so we do not block purely on edgeCount === 0.

  // Validation errors
  if (hasValidationErrors) {
    return {
      canRun: false,
      reason: 'validation',
      message: 'Fix validation issues before running this decision.'
    }
  }

  // Graph health errors (cycle, dangling edges, etc.)
  if (graphHealth && graphHealth.status === 'errors') {
    const errorCount = graphHealth.issues.filter(i => i.severity === 'error').length
    const suffix = errorCount === 1 ? 'graph error' : 'graph errors'

    return {
      canRun: false,
      reason: 'health',
      message: `Resolve ${errorCount} ${suffix} in the Issues panel before running.`
    }
  }

  // Engine limits (too big / at recommended maximum)
  if (limitsStatus && limitsStatus.zone === 'at_limit') {
    return {
      canRun: false,
      reason: 'limits',
      message: 'Simplify this graph to stay within the engine\'s limits before running.'
    }
  }

  // Default: eligible
  return {
    canRun: true,
    reason: 'ok',
    message: ''
  }
}

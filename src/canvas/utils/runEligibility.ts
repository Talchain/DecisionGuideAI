// ============================================================================
// BASIC RUN ELIGIBILITY CHECK
// ============================================================================
//
// PURPOSE: Lower-level eligibility check based on graph structure and limits.
// Use this when CEE readiness is NOT available (e.g., early in rendering).
//
// PREFER canRunAnalysis.ts when:
//   - You have CEE readiness from useGraphReadiness
//   - You need unified action blockers
//   - You need tooltip/aria-label helpers
//
// USE THIS when:
//   - CEE hasn't responded yet (loading state)
//   - Testing basic graph validity before CEE call
//   - Components that render before hooks are ready
//
// See also: canRunAnalysis.ts (primary gating helper)
// ============================================================================

import type { GraphHealth } from '../validation/types'
import { engineLimitOverage, type LimitsStatusResult } from './limitsStatus'

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

  // ⭐⭐ THE ENGINE'S LIMIT, NOT A BAND THE UI CHOSE.
  //
  // This read `limitsStatus.zone === 'at_limit'`, which is a UI band at 90% of
  // the producer's maximum (`limitsStatus.ts`). `/v1/limits` states `nodes.max`
  // and `edges.max` and nothing else, so at 90% the graph IS within the
  // engine's limits — and the refusal said the engine had refused it. With the
  // shipped fallback (`{ nodes: 50, edges: 100 }`) that withheld analysis from
  // a 90-edge model while the engine had ten to spare.
  //
  // `exceedsEngineLimit` compares a live count with a figure the producer
  // stated; the UI picks neither side of it. See its docblock for why the two
  // questions are named apart rather than reconciled.
  const overage = limitsStatus ? engineLimitOverage(limitsStatus) : []
  if (overage.length > 0) {
    const parts = overage.map(o => `${o.current} ${o.axis} and the engine will take ${o.max}`)
    return {
      canRun: false,
      reason: 'limits',
      message: `This graph has ${parts.join(', and ')}. Remove ${overage.map(o => `${o.over} ${o.axis}`).join(' and ')} to run.`
    }
  }

  // Default: eligible
  return {
    canRun: true,
    reason: 'ok',
    message: ''
  }
}

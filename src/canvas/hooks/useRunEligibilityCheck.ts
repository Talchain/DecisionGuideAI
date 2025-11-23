import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useLimitsStore } from '../../stores/limitsStore'
import { useToast } from '../ToastContext'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import { deriveRunEligibility, type RunEligibilityResult } from '../utils/runEligibility'
import { trackRunAttempt } from '../utils/sandboxTelemetry'
import { hasValidationErrors } from '../store'
import type { LimitsV1 } from '../../adapters/plot/types'

/**
 * Hook to check run eligibility with consistent gating logic.
 * Returns a function that checks eligibility, shows appropriate toast if blocked, and returns the result.
 * This consolidates the duplicate gating logic from CanvasToolbar, ReactFlowGraph, and ResultsPanel.
 */
export function useRunEligibilityCheck() {
  const limits = useLimitsStore(state => state.limits)
  const { showToast } = useToast()

  return useCallback((): RunEligibilityResult => {
    const state = useCanvasStore.getState()

    // Normalize V1LimitsResponse from the limits store into a LimitsV1 shape
    const normalizedLimits: LimitsV1 | null = limits
      ? {
          nodes: { max: limits.max_nodes },
          edges: { max: limits.max_edges },
          body_kb: { max: limits.max_body_kb },
          engine_p95_ms_budget: limits.engine_p95_ms_budget,
        }
      : null

    const limitsStatus = normalizedLimits
      ? deriveLimitsStatus(normalizedLimits, state.nodes.length, state.edges.length)
      : null

    const eligibility = deriveRunEligibility({
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length,
      hasValidationErrors: hasValidationErrors(state),
      graphHealth: state.graphHealth,
      limitsStatus,
    })

    trackRunAttempt(eligibility)

    if (!eligibility.canRun) {
      const variant =
        eligibility.reason === 'validation' ? 'warning' :
        eligibility.reason === 'health' ? 'error' :
        eligibility.reason === 'limits' ? 'warning' :
        'info'

      if (eligibility.message) {
        showToast(eligibility.message, variant)
      }
    }

    return eligibility
  }, [limits, showToast])
}

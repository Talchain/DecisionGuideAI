import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useLimitsStore } from '../../stores/limitsStore'
import { useToast } from '../ToastContext'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import { deriveRunEligibility, type RunEligibilityResult } from '../utils/runEligibility'
import { trackRunAttempt } from '../utils/sandboxTelemetry'
import { hasValidationErrors } from '../store'
import type { LimitsV1 } from '../../adapters/plot/types'
import { useEngineLimits } from './useEngineLimits'

/**
 * Hook to check run eligibility with consistent gating logic.
 * Returns a function that checks eligibility, shows appropriate toast if blocked, and returns the result.
 * This consolidates the duplicate gating logic from CanvasToolbar, ReactFlowGraph, and ResultsPanel.
 */
export function useRunEligibilityCheck() {
  const storeLimits = useLimitsStore(state => state.limits)
  const { limits: engineLimits } = useEngineLimits()
  const { showToast } = useToast()

  return useCallback((): RunEligibilityResult => {
    const state = useCanvasStore.getState()

    // Prefer live LimitsV1 from useEngineLimits (shared with CanvasToolbar/ReactFlowGraph)
    // Fall back to V1LimitsResponse from limits store when engine limits are not available.
    const normalizedLimits: LimitsV1 | null = engineLimits
      ? engineLimits
      : storeLimits
      ? {
          nodes: { max: storeLimits.max_nodes },
          edges: { max: storeLimits.max_edges },
          body_kb: { max: storeLimits.max_body_kb },
          engine_p95_ms_budget: storeLimits.engine_p95_ms_budget,
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
  }, [engineLimits, storeLimits, showToast])
}

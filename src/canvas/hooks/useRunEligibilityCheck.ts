import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { useToast } from '../ToastContext'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import { deriveRunEligibility, type RunEligibilityResult } from '../utils/runEligibility'
import { trackRunAttempt } from '../utils/sandboxTelemetry'
import { hasValidationErrors } from '../store'

/**
 * Hook to check run eligibility with consistent gating logic.
 * Returns a function that checks eligibility, shows appropriate toast if blocked, and returns the result.
 * This consolidates the duplicate gating logic from CanvasToolbar, ReactFlowGraph, and ResultsPanel.
 */
export function useRunEligibilityCheck() {
  const { showToast } = useToast()

  return useCallback((): RunEligibilityResult => {
    const state = useCanvasStore.getState()

    // The UI no longer fetches engine limits (inventory U1); a slice someone seeded is still honoured.
    const limitsStatus = state.engineLimits
      ? deriveLimitsStatus(state.engineLimits, state.nodes.length, state.edges.length)
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
  }, [showToast])
}

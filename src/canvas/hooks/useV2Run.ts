/**
 * V2 Run Hook (P0-UI Integration)
 *
 * Replaces useResultsRun for V2 adapter integration.
 * Calls /v2/run and maps response to store format.
 */

import { useCallback, useState } from 'react'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'
import {
  executeV2RunWithAnalysisReady,
  isBlockedResponse,
  isFailedAnalysis,
  isSuccessfulAnalysis,
  type V2AdapterConfig,
  type V2RunError,
  type V2RunResponse,
} from '../../adapters/plot/v2'
import { mapV2ResponseToReportV1, createErrorReport } from '../../adapters/plot/v2/responseMapper'
import { trackRunCompleted, trackRunFailed } from '../../lib/resultsInstrumentation'
import { generateRequestId } from '../../types/requestId'
import type { CEEAnalysisReady } from '../../adapters/cee/types'

/**
 * Check if ceeAnalysisReady is stale (graph has changed since it was stored).
 *
 * Returns true if stale (should not use analysis_ready).
 * Checks:
 * - goal_node_id still exists in current nodes
 * - All intervention target node IDs still exist in current nodes
 */
function isAnalysisReadyStale(
  analysisReady: CEEAnalysisReady,
  currentNodeIds: Set<string>,
  storedNodeIds: string[] | null
): { isStale: boolean; reason?: string } {
  // Check if stored node IDs are available for comparison
  if (!storedNodeIds) {
    // No stored IDs - can't validate, assume valid (backwards compatibility)
    return { isStale: false }
  }

  // Check if any nodes were deleted
  const storedSet = new Set(storedNodeIds)
  const deletedNodeIds = storedNodeIds.filter((id) => !currentNodeIds.has(id))

  if (deletedNodeIds.length > 0) {
    // Check if deleted nodes include goal or intervention targets
    const goalDeleted = !currentNodeIds.has(analysisReady.goal_node_id)
    const affectedOptions: string[] = []

    for (const option of analysisReady.options) {
      const targetIds = Object.keys(option.interventions)
      const deletedTargets = targetIds.filter((id) => deletedNodeIds.includes(id))
      if (deletedTargets.length > 0) {
        affectedOptions.push(option.label)
      }
    }

    if (goalDeleted || affectedOptions.length > 0) {
      const reasons: string[] = []
      if (goalDeleted) reasons.push('goal node deleted')
      if (affectedOptions.length > 0) {
        reasons.push(`intervention targets deleted for: ${affectedOptions.join(', ')}`)
      }
      return { isStale: true, reason: reasons.join('; ') }
    }
  }

  // Check if goal node was deleted (even if no storedNodeIds changed - belt and suspenders)
  if (!currentNodeIds.has(analysisReady.goal_node_id)) {
    return { isStale: true, reason: 'goal node no longer exists' }
  }

  // Check if any intervention targets no longer exist
  for (const option of analysisReady.options) {
    for (const targetId of Object.keys(option.interventions)) {
      if (!currentNodeIds.has(targetId)) {
        return { isStale: true, reason: `intervention target "${targetId}" no longer exists` }
      }
    }
  }

  return { isStale: false }
}

interface UseV2RunReturn {
  runV2Analysis: () => Promise<void>
  isRunning: boolean
  error: string | null
}

/**
 * Hook for running V2 analysis.
 *
 * Uses executeV2Run and maps response to store format.
 */
export function useV2Run(): UseV2RunReturn {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store selectors
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const framing = useCanvasStore((s) => s.currentScenarioFraming)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const ceeAnalysisReadyNodeIds = useCanvasStore((s) => s.ceeAnalysisReadyNodeIds)

  // Store actions
  const resultsStart = useCanvasStore((s) => s.resultsStart)
  const resultsComplete = useCanvasStore((s) => s.resultsComplete)
  const resultsError = useCanvasStore((s) => s.resultsError)
  const setRunMeta = useCanvasStore((s) => s.setRunMeta)
  const setCeeAnalysisReady = useCanvasStore((s) => s.setCeeAnalysisReady)

  const runV2Analysis = useCallback(async () => {
    // Validate goal is selected
    if (!outcomeNodeId) {
      setError('No goal node selected')
      return
    }

    setIsRunning(true)
    setError(null)

    const seed = framing?.seed ?? 42
    const startTime = Date.now()

    // Generate request ID for tracing
    const requestId = generateRequestId()

    if (import.meta.env.DEV) {
      console.log('[useV2Run] Request ID:', requestId)
    }

    // Signal run start
    resultsStart({ seed })

    // Reset run metadata
    setRunMeta({
      diagnostics: undefined,
      correlationIdHeader: undefined,
      degraded: undefined,
      ceeReview: null,
      ceeTrace: null,
      ceeError: null,
      ceeReviewV1: null,
      ceeTraceV1: null,
      ceeErrorV1: null,
    })

    try {
      // Get V2 adapter config
      const config: V2AdapterConfig = {
        baseUrl: import.meta.env.VITE_PLOT_PROXY_BASE || '/bff/engine',
        timeout: 120000,
      }

      // Check if ceeAnalysisReady is stale (graph changed since draft was applied)
      let effectiveAnalysisReady = ceeAnalysisReady
      const currentNodeIds = new Set(nodes.map((n) => n.id))

      if (ceeAnalysisReady) {
        const staleCheck = isAnalysisReadyStale(
          ceeAnalysisReady,
          currentNodeIds,
          ceeAnalysisReadyNodeIds
        )

        if (staleCheck.isStale) {
          if (import.meta.env.DEV) {
            console.warn('[useV2Run] Stale analysis_ready detected, falling back to node extraction', {
              reason: staleCheck.reason,
            })
          }
          // Clear stale analysis_ready from store
          setCeeAnalysisReady(null)
          effectiveAnalysisReady = null
        }
      }

      if (import.meta.env.DEV) {
        console.log('[useV2Run] Starting V2 analysis', {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          goalNodeId: outcomeNodeId,
          usingAnalysisReady: !!effectiveAnalysisReady,
        })
      }

      // Execute V2 run with analysisReady (or fallback to node extraction)
      const result = await executeV2RunWithAnalysisReady(
        config,
        nodes,
        edges,
        effectiveAnalysisReady,
        outcomeNodeId,
        requestId
      )

      const elapsed_ms = Date.now() - startTime

      // Handle blocked response (422)
      if (isBlockedResponse(result)) {
        const errorResult = result as V2RunError
        if (import.meta.env.DEV) {
          console.log('[useV2Run] Analysis blocked', {
            requestId,
            serverRequestId: errorResult.request_id,
            reason: errorResult.status_reason,
          })
        }

        trackRunFailed({
          error_code: 'VALIDATION_BLOCKED',
          error_message: errorResult.status_reason,
          duration_ms: elapsed_ms,
          request_id: requestId,
        })

        resultsError({
          code: 'VALIDATION_BLOCKED',
          message: errorResult.status_reason,
          request_id: requestId,
          canRetry: false, // User needs to fix model first
        })

        setError(errorResult.status_reason)
        setIsRunning(false)
        return
      }

      // Handle failed analysis (200 but failed)
      if (isFailedAnalysis(result)) {
        const failedResult = result as V2RunResponse
        if (import.meta.env.DEV) {
          console.log('[useV2Run] Analysis failed', {
            requestId,
            serverRequestId: failedResult.request_id,
          })
        }

        trackRunFailed({
          error_code: 'ANALYSIS_FAILED',
          error_message: 'Analysis could not complete',
          duration_ms: elapsed_ms,
          request_id: requestId,
        })

        // Create error report with critiques
        const errorReport = createErrorReport(
          'Analysis could not complete. The model may have numerical instability.',
          failedResult.critiques ?? [],
          { seed }
        )

        resultsComplete({
          report: errorReport,
          hash: failedResult.response_hash,
        })

        setError('Analysis could not complete')
        setIsRunning(false)
        return
      }

      // Success - map V2 response to ReportV1
      if (isSuccessfulAnalysis(result)) {
        const successResult = result as V2RunResponse
        if (import.meta.env.DEV) {
          console.log('[useV2Run] Analysis complete', {
            requestId,
            serverRequestId: successResult.request_id,
            status: successResult.analysis_status,
            responseHash: successResult.response_hash,
          })
        }

        const report = mapV2ResponseToReportV1(successResult, {
          seed,
          elapsed_ms,
        })

        trackRunCompleted({
          duration_ms: elapsed_ms,
          option_count: successResult.options.length,
          has_drivers: (successResult.drivers?.length ?? 0) > 0,
          request_id: requestId,
        })

        resultsComplete({
          report,
          hash: successResult.response_hash,
          requestId,
        })

        // Show partial warning if applicable
        if (result.analysis_status === 'partial') {
          console.warn('[useV2Run] Partial results returned')
        }

        setIsRunning(false)
        return
      }

      // Unexpected state
      console.error('[useV2Run] Unexpected result state', result)
      resultsError({
        code: 'UNEXPECTED_STATE',
        message: 'Received unexpected response format',
        request_id: requestId,
        canRetry: true, // Might be transient
      })
      setError('Unexpected response format')
    } catch (err) {
      const elapsed_ms = Date.now() - startTime
      const message = err instanceof Error ? err.message : 'Unknown error'

      if (import.meta.env.DEV) {
        console.error('[useV2Run] Error', { requestId, error: err })
      }

      trackRunFailed({
        error_code: 'NETWORK_ERROR',
        error_message: message,
        duration_ms: elapsed_ms,
        request_id: requestId,
      })

      resultsError({
        code: 'NETWORK_ERROR',
        message,
        request_id: requestId,
        canRetry: true, // Network errors are retryable
      })

      setError(message)
    } finally {
      setIsRunning(false)
    }
  }, [
    nodes,
    edges,
    outcomeNodeId,
    framing,
    ceeAnalysisReady,
    ceeAnalysisReadyNodeIds,
    setCeeAnalysisReady,
    resultsStart,
    resultsComplete,
    resultsError,
    setRunMeta,
  ])

  return {
    runV2Analysis,
    isRunning,
    error,
  }
}

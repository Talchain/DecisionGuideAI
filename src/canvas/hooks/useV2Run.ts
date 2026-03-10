/**
 * V2 Run Hook (P0-UI Integration)
 *
 * Replaces useResultsRun for V2 adapter integration.
 * Calls /v2/run and maps response to store format.
 */

import { useCallback, useRef, useState } from 'react'
import { useCanvasStore } from '../store'
import { useResultsStore } from '../stores/resultsStore'
import type { Node, Edge } from '@xyflow/react'
import { getEdgeKey } from '../domain/edgeUtils'
import {
  executeV2RunWithAnalysisReady,
  isBlockedResponse,
  isFailedAnalysis,
  isSuccessfulAnalysis,
  validateV2RunResponseFull,
  sanitizeV2RunResponse,
  type V2AdapterConfig,
  type V2RunError,
  type V2RunResponse,
} from '../../adapters/plot/v2'
import {
  mapV2ResponseToReportV1,
  createErrorReport,
  createEnrichmentFromV2Response,
  detectComputedButEmpty,
  synthesizeCeeReviewFromV2,
  synthesizeCeeTraceFromV2,
} from '../../adapters/plot/v2/responseMapper'
import { trackRunCompleted, trackRunFailed, trackEmptyComputedResults } from '../../lib/resultsInstrumentation'
import { generateGraphHash } from '../store/runHistory'
import { trackTypedError } from '../../lib/telemetry'
import { ApiError, NetworkError, ProcessingError, isApiError } from '../../lib/api-errors'
import { generateRequestId } from '../../types/requestId'
import type { CEEAnalysisReady } from '../../adapters/cee/types'
import type { M1Review, M1Coaching } from '../../types/cee'
import { useGateStore, updateRobustnessGate, updateRobustnessGateFromV2 } from '../../lib/gate-state'
import { buildRawErrorData, hashStackTrace } from '../../utils/payloadRedaction'
import { extractM1ReviewFromV2, extractM1CoachingFromV2 } from '../../hooks/hydrateAnalysis'
import { assembleAnalysisInputsSummary } from '../analysis/assembleAnalysisInputsSummary'

/**
 * P0 Fix: Derive a stable numeric seed from a string.
 * Uses simple FNV-1a hash to convert string to number.
 */
function deriveNumericSeedFromString(input: string): number {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619) // FNV prime
  }
  // Convert to positive number in reasonable seed range (0 - 999999)
  return Math.abs(hash) % 1000000
}

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

/** Optional Supabase persistence callbacks injected by the calling component. */
export interface V2RunPersistence {
  setAnalysisRunning: () => Promise<void>
  persistAnalysisSuccess: (
    analysis: unknown,
    graphHash: string,
    seedUsed: number,
    responseHash: string,
    details?: Record<string, unknown>,
  ) => Promise<void>
  persistAnalysisFailure: (
    errorPayload: { code: string; message: string },
  ) => Promise<void>
  /** Reset analysis_status to 'none' — called on user-initiated cancel. */
  resetAnalysisStatus?: () => Promise<void>
}

interface UseV2RunReturn {
  runV2Analysis: () => Promise<void>
  cancelRun: () => void
  isRunning: boolean
  error: string | null
}

/**
 * Hook for running V2 analysis.
 *
 * Uses executeV2Run and maps response to store format.
 * Accepts optional Supabase persistence callbacks (C.1b Task 6).
 */
export function useV2Run(persistence?: V2RunPersistence): UseV2RunReturn {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Store selectors
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const goalThreshold = useCanvasStore((s) => s.goalThreshold)
  const framing = useCanvasStore((s) => s.currentScenarioFraming)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const ceeAnalysisReadyNodeIds = useCanvasStore((s) => s.ceeAnalysisReadyNodeIds)
  const goalConstraints = useCanvasStore((s) => s.goalConstraints)
  const lastDraftDescription = useCanvasStore((s) => s.lastDraftDescription)

  // Store actions
  const resultsStart = useCanvasStore((s) => s.resultsStart)
  const resultsComplete = useCanvasStore((s) => s.resultsComplete)
  const resultsError = useCanvasStore((s) => s.resultsError)
  const resultsCancelled = useCanvasStore((s) => s.resultsCancelled)
  const setRunMeta = useCanvasStore((s) => s.setRunMeta)
  const setCeeAnalysisReady = useCanvasStore((s) => s.setCeeAnalysisReady)
  const setGoalConstraints = useCanvasStore((s) => s.setGoalConstraints)
  const captureErrorDetail = useCanvasStore((s) => s.captureErrorDetail)

  const runV2Analysis = useCallback(async () => {
    // Validate goal is selected
    if (!outcomeNodeId) {
      setError('No goal node selected')
      return
    }

    // Create a fresh AbortController for this run so the user can cancel
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsRunning(true)
    setError(null)

    // P0 Fix: Seed precedence (no hardcoded "42" default)
    // 1. Explicit seed from framing (user input or dev/test)
    // 2. Derived from scenario_id if available (stable per scenario)
    // 3. Derived from graph hash (stable per graph structure)
    // 4. Let backend generate (omit seed from request)
    let seed: number | undefined = framing?.seed

    if (seed === undefined && framing?.scenario_id) {
      // Derive stable seed from scenario_id hash
      seed = deriveNumericSeedFromString(framing.scenario_id)
    }

    if (seed === undefined && nodes.length > 0) {
      // Derive stable seed from graph structure hash
      const graphKey = nodes.map(n => n.id).sort().join('|') + '::' + edges.map(e => getEdgeKey(e)).sort().join('|')
      seed = deriveNumericSeedFromString(graphKey)
    }

    // If still undefined, let backend generate (don't use hardcoded 42)
    // Use a timestamp-based seed as last resort for reproducibility tracking
    if (seed === undefined) {
      seed = Math.floor(Date.now() / 1000) % 1000000 // Use Unix timestamp modulo for reasonable range
    }

    const startTime = Date.now()

    // Generate request ID for tracing
    const requestId = generateRequestId()

    if (import.meta.env.DEV) {
      console.warn('[useV2Run] Request ID:', requestId)
    }

    // C.1b: Mark analysis as running in Supabase (fire-and-forget, non-blocking)
    if (persistence) {
      persistence.setAnalysisRunning().catch(() => {
        // Non-critical — UI already shows running state
      })
    }

    // Signal run start
    resultsStart({ seed })
    useResultsStore.getState().setAnalysisSummary(null)

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
        signal: controller.signal,
      }

      // Check if ceeAnalysisReady is stale (graph changed since draft was applied)
      let effectiveAnalysisReady = ceeAnalysisReady
      let effectiveGoalConstraints = goalConstraints
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
          // Clear stale analysis_ready and goal_constraints from store
          setCeeAnalysisReady(null)
          setGoalConstraints(null)
          effectiveAnalysisReady = null
          effectiveGoalConstraints = null
        }
      }

      if (import.meta.env.DEV) {
        console.warn('[useV2Run] Starting V2 analysis', {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          goalNodeId: outcomeNodeId,
          goalThreshold,
          usingAnalysisReady: !!effectiveAnalysisReady,
        })
      }

      // Execute V2 run with analysisReady (or fallback to node extraction)
      // P0 Fix: Pass computed seed to avoid hardcoded "42" default
      // P0 Fix: Include framing for contextualised CEE responses
      // P0 Fix: Include brief for PLoT context
      const result = await executeV2RunWithAnalysisReady(
        config,
        nodes,
        edges,
        effectiveAnalysisReady,
        outcomeNodeId,
        requestId,
        goalThreshold ?? undefined,
        seed,
        framing ? {
          title: framing.title,
          goal: framing.goal,
          constraints: framing.constraints,
        } : undefined,
        lastDraftDescription || undefined,
        effectiveGoalConstraints
      )

      const elapsed_ms = Date.now() - startTime

      // Handle blocked response (422)
      if (isBlockedResponse(result)) {
        const errorResult = result as V2RunError
        if (import.meta.env.DEV) {
          console.warn('[useV2Run] Analysis blocked', {
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

        // C.1b: Persist failure to Supabase (non-blocking)
        if (persistence) {
          persistence.persistAnalysisFailure({
            code: 'VALIDATION_BLOCKED',
            message: errorResult.status_reason,
          }).catch(() => { /* non-critical */ })
        }

        setError(errorResult.status_reason)
        setIsRunning(false)
        return
      }

      // Handle failed analysis (200 but failed)
      if (isFailedAnalysis(result)) {
        const failedResult = result as V2RunResponse
        if (import.meta.env.DEV) {
          console.warn('[useV2Run] Analysis failed', {
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

        // C.1b: Persist failure to Supabase (non-blocking)
        if (persistence) {
          persistence.persistAnalysisFailure({
            code: 'ANALYSIS_FAILED',
            message: 'Analysis could not complete',
          }).catch(() => { /* non-critical */ })
        }

        setError('Analysis could not complete')
        setIsRunning(false)
        return
      }

      // Success - map V2 response to ReportV1
      if (isSuccessfulAnalysis(result)) {
        const rawSuccessResult = result as V2RunResponse

        // Validate and sanitize before mapping to catch malformed responses
        const validationResult = validateV2RunResponseFull(rawSuccessResult)
        if (validationResult.softWarnings.length > 0 && import.meta.env.DEV) {
          console.warn('[useV2Run] Soft validation warnings (will sanitize):', {
            requestId,
            warnings: validationResult.softWarnings,
          })
        }

        // Sanitize to fix soft anomalies (e.g., object instead of array)
        const successResult = sanitizeV2RunResponse(rawSuccessResult)

        if (import.meta.env.DEV) {
          console.warn('[useV2Run] Analysis complete', {
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

        // Create enrichment from V2 response for gate-state and useRobustness
        const enrichment = createEnrichmentFromV2Response(successResult)

        // Synthesize CEE V1 data from V2 response for Decision Review panel
        // This provides useful AI-generated review content when using V2 endpoint
        const ceeReviewV1 = synthesizeCeeReviewFromV2(successResult)
        const ceeTraceV1 = synthesizeCeeTraceFromV2(successResult, requestId, elapsed_ms)

        // Debug: Log raw M1 fields from V2 response before extraction
        if (import.meta.env.DEV) {
          console.warn('[useV2Run] Raw M1 Review fields from V2 response:', {
            cee_status: successResult.cee_status,
            has_decision_quality: !!successResult.decision_quality,
            insights_count: successResult.insights?.length ?? 'missing',
            guidance_count: successResult.improvement_guidance?.length ?? 'missing',
            has_rationale: !!successResult.rationale,
            rationale_summary: successResult.rationale?.summary?.slice(0, 80),
            has_robustness: !!successResult.robustness_synthesis,
            cee_trace: successResult.cee_trace ? {
              request_id: successResult.cee_trace.request_id,
              latency_ms: successResult.cee_trace.latency_ms,
              degraded: successResult.cee_trace.degraded,
            } : 'missing',
          })
        }

        // Extract M1 Review data (rationale, robustness synthesis, etc.)
        const m1Review = extractM1ReviewFromV2(successResult)

        // Extract M1 Coaching data (deterministic coaching fields)
        const m1Coaching = extractM1CoachingFromV2(successResult)

        // Extract M1 Review assumptions (key_assumptions + pre_mortem from PLoT)
        const m1ReviewAssumptions = successResult.m1_review ?? null

        if (import.meta.env.DEV) {
          console.warn('[useV2Run] Extracted M1 Review:', {
            hasCeeReview: !!ceeReviewV1,
            blockCount: ceeReviewV1?.blocks?.length ?? 0,
            readinessLevel: ceeReviewV1?.readiness?.level,
            hasM1Review: !!m1Review,
            m1CeeStatus: m1Review?.cee_status,
            hasRationale: !!m1Review?.rationale,
            hasRobustnessSynthesis: !!m1Review?.robustness_synthesis,
            insightsCount: m1Review?.insights?.length ?? 0,
            guidanceCount: m1Review?.improvement_guidance?.length ?? 0,
          })
          console.warn('[useV2Run] Extracted M1 Coaching:', {
            hasM1Coaching: !!m1Coaching,
            hasHeadline: !!m1Coaching?.executive_summary?.headline,
            readiness: m1Coaching?.readiness,
            storyHeadlinesCount: Object.keys(m1Coaching?.story_headlines ?? {}).length,
            evidenceGapsCount: m1Coaching?.evidence_gaps?.length ?? 0,
            nextActionsCount: m1Coaching?.next_actions?.length ?? 0,
            dominantFactor: m1Coaching?.key_drivers?.dominant_factor,
          })
        }

        // Detect computed-but-empty anomalies (backend bug detection)
        const anomalies = detectComputedButEmpty(successResult)
        if (anomalies.length > 0) {
          // Track the anomaly for debugging
          trackEmptyComputedResults({
            request_id: requestId,
            anomalies: anomalies.map(a => ({
              field: a.field,
              status: a.status,
              message: a.message,
            })),
          })

          if (import.meta.env.DEV) {
            console.warn('[useV2Run] Detected computed-but-empty anomalies', {
              requestId,
              anomalies,
            })
          }
        }

        trackRunCompleted({
          duration_ms: elapsed_ms,
          option_count: successResult.option_comparison?.length ?? 0,
          // Check edge_sensitivity since that's what PLoT actually returns
          has_drivers: (successResult.edge_sensitivity?.length ?? successResult.drivers?.length ?? 0) > 0,
          request_id: requestId,
        })

        // Pass synthesized CEE V1 data to store so Decision Review panel can display content
        resultsComplete({
          report,
          hash: successResult.response_hash,
          requestId,
          enrichment,
          ceeReviewV1,
          ceeTraceV1,
        })

        try {
          useResultsStore.getState().setAnalysisSummary(assembleAnalysisInputsSummary(successResult))
        } catch {
          useResultsStore.getState().setAnalysisSummary(null)
        }

        // C.1b: Persist analysis results to Supabase (non-blocking)
        if (persistence) {
          const seedUsed = successResult.meta?.seed_used
            ? (parseInt(successResult.meta.seed_used, 10) || 0)
            : (seed ?? 0)
          const graphHash = generateGraphHash(nodes, edges, seedUsed)
          persistence.persistAnalysisSuccess(
            successResult,
            graphHash,
            seedUsed,
            successResult.response_hash,
            {
              option_count: successResult.option_comparison?.length ?? 0,
              analysis_status: successResult.analysis_status,
            },
          ).catch((err) => {
            if (import.meta.env.DEV) {
              console.warn('[useV2Run] Supabase analysis persistence failed', err)
            }
          })
        }

        // Update run metadata with CEE data for debugging/display
        setRunMeta({
          ceeReviewV1,
          ceeTraceV1,
          ceeErrorV1: null, // No error - synthesis succeeded
          m1Review, // M1 Review enrichment (rationale, robustness synthesis, etc.)
          m1Coaching, // M1 Coaching (deterministic, not LLM-generated)
          m1ReviewAssumptions, // M1 Review assumptions + pre-mortem from PLoT
          reviewStatus: successResult.review_status, // V12: M2 gate
        })

        // Update gates after successful analysis
        // BUT: If there are anomalies, set gate to 'warn' instead of 'pass'
        const hasRobustnessAnomaly = anomalies.some(a => a.field === 'robustness')
        const hasOptionAnomaly = anomalies.some(a => a.field === 'option_comparison')

        if (hasOptionAnomaly) {
          // Option comparison claimed "computed" but was empty - this is a serious issue
          useGateStore.getState().setGate('run', 'warn', {
            requestId,
            message: 'Analysis completed but option results are missing',
            service: 'plot-v2',
          })
        } else {
          useGateStore.getState().setGate('run', 'pass', {
            requestId,
            message: 'Analysis completed successfully',
            service: 'plot-v2',
          })
        }

        // Update robustness gate from V2 response directly
        // The new function handles robustness_status and robustness data properly
        // Special case: hasRobustnessAnomaly means computed but empty (backend bug)
        if (hasRobustnessAnomaly) {
          useGateStore.getState().setGate('robustness', 'warn', {
            requestId,
            message: 'Robustness computed but results are empty',
            service: 'plot-v2',
          })
        } else {
          // Use the new V2-aware gate function that accepts robustness_status directly
          updateRobustnessGateFromV2(
            successResult.robustness_status,
            successResult.robustness
          )
        }

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
      // Distinguish user-initiated cancellation from other abort errors
      if (controller.signal.aborted && err instanceof Error && err.name === 'AbortError') {
        resultsCancelled()
        setIsRunning(false)
        // Reset Supabase analysis_status back to 'none' (fire-and-forget)
        persistence?.resetAnalysisStatus?.().catch(() => {})
        return
      }

      const elapsed_ms = Date.now() - startTime
      const message = err instanceof Error ? err.message : 'Unknown error'

      if (import.meta.env.DEV) {
        console.error('[useV2Run] Error', { requestId, error: err })
      }

      // Convert to typed error for consistent handling
      let typedError: ApiError
      if (isApiError(err)) {
        // Already a typed error (e.g., MalformedApiResponseError from adapter)
        typedError = err
      } else if (err instanceof Error && (
        err.name === 'AbortError' ||
        err.name === 'TypeError' && message.includes('fetch') ||
        message.includes('NetworkError') ||
        message.includes('Failed to fetch') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('Connection refused')
      )) {
        // Network-related error
        typedError = NetworkError.fromFetchError(err, { requestId, endpoint: '/v2/run' })
      } else {
        // Processing/mapping error
        typedError = ProcessingError.wrap(err, { requestId, endpoint: '/v2/run' })
      }

      const errorCode = typedError.code

      // Track typed error for observability
      trackTypedError(typedError)

      trackRunFailed({
        error_code: errorCode,
        error_message: message,
        duration_ms: elapsed_ms,
        request_id: requestId,
      })

      resultsError({
        code: errorCode,
        message,
        request_id: requestId,
        canRetry: typedError.retryable,
      })

      // C.1b: Persist failure to Supabase (non-blocking)
      if (persistence) {
        persistence.persistAnalysisFailure({
          code: errorCode,
          message,
        }).catch(() => { /* non-critical */ })
      }

      // Capture error detail for debug drawer expansion
      captureErrorDetail({
        timestamp: new Date().toISOString(),
        service: 'PLoT',
        httpStatus: (typedError as NetworkError).status,
        errorCode: typedError.code,
        message,
        requestId,
        endpoint: '/v2/run',
        retryable: typedError.retryable,
        rawBody: typedError.context.rawPayload
          ? JSON.stringify(typedError.context.rawPayload).slice(0, 2000)
          : undefined,
      })

      // Capture raw error data for debugging in the debug panel
      // Uses redaction utility to protect privacy and enforce size limits
      let rawErrorPayload: unknown = undefined
      let validationErrors: string[] | undefined

      // If this is a MalformedApiResponseError, capture validation details
      if (err && typeof err === 'object' && 'validationErrors' in err) {
        const malformedErr = err as {
          validationErrors?: Array<{ field: string; expected: string; received: string }>
          rawPayload?: unknown
        }
        rawErrorPayload = malformedErr.rawPayload
        validationErrors = malformedErr.validationErrors?.map(
          e => `${e.field}: expected ${e.expected}, got ${e.received}`
        )
      }

      // Build redacted error data (respects dev/staging gating and size limits)
      const rawErrorData = buildRawErrorData({
        payload: rawErrorPayload,
        expectedShape: 'V2RunResponse | V2RunError',
        validationErrors,
      })

      // Store raw error data for debug panel access
      setRunMeta({ rawErrorData })

      setError(message)
    } finally {
      abortControllerRef.current = null
      setIsRunning(false)
    }
  }, [
    nodes,
    edges,
    outcomeNodeId,
    framing,
    ceeAnalysisReady,
    ceeAnalysisReadyNodeIds,
    goalConstraints,
    lastDraftDescription,
    setCeeAnalysisReady,
    setGoalConstraints,
    resultsStart,
    resultsComplete,
    resultsError,
    resultsCancelled,
    setRunMeta,
    captureErrorDetail,
    persistence,
  ])

  const cancelRun = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    runV2Analysis,
    cancelRun,
    isRunning,
    error,
  }
}

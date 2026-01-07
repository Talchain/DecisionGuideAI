/**
 * useISLConformal - Hook for ISL conformal predictions
 *
 * Brief 30: Updated to use correct ISL endpoint and schema
 * POST /api/v1/causal/counterfactual/conformal
 *
 * P0 Fix: Added global dedup to prevent duplicate requests across component instances
 * P0 Fix: Added optional interventions parameter for option-specific predictions
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { ISLClient, ISLError } from '../adapters/isl/client'
import type { ISLConformalResponse, ISLRunRequest, ISLConformalRequest } from '../adapters/isl/types'
import { buildISLConformalRequest, type UINode, type UIEdge } from '../canvas/adapters/islRequestAdapter'

/**
 * Brief 35 Task 1: Status for when conformal call is skipped
 */
type ConformalStatus = 'idle' | 'loading' | 'success' | 'error' | 'not_applicable'

interface UseISLConformalState {
  data: ISLConformalResponse | null
  loading: boolean
  error: ISLError | null
  /** Brief 35: Status including 'not_applicable' when no factors */
  status: ConformalStatus
  /** Brief 35: Reason when status is 'not_applicable' */
  skipReason: string | null
}

/**
 * Legacy request format (for backward compatibility with existing call sites)
 */
interface LegacyConformalInput {
  graph: {
    nodes: Array<{ id: string; label: string; type: string; value?: any }>
    edges: Array<{ from: string; to: string; weight?: number }>
  }
  options?: {
    enable_conformal?: boolean
    confidence_level?: number
    /** P0 Fix: Optional explicit interventions (for option-specific predictions) */
    interventions?: Record<string, number>
  }
}

// =============================================================================
// P0 Fix: Global dedup state (shared across all hook instances)
// =============================================================================

/** In-flight requests by payload hash - prevents duplicate concurrent requests */
const inFlightRequests = new Map<string, Promise<ISLConformalResponse>>()

/** Cached responses by payload hash - prevents re-fetching same data */
const responseCache = new Map<string, ISLConformalResponse>()

/** Maximum cache entries before cleanup */
const MAX_CACHE_SIZE = 10

/**
 * Clean up old cache entries when cache is full
 */
function pruneCache(): void {
  if (responseCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries (first inserted)
    const keysToDelete = Array.from(responseCache.keys()).slice(0, responseCache.size - MAX_CACHE_SIZE)
    for (const key of keysToDelete) {
      responseCache.delete(key)
    }
  }
}

export function useISLConformal() {
  const [state, setState] = useState<UseISLConformalState>({
    data: null,
    loading: false,
    error: null,
    status: 'idle',
    skipReason: null,
  })

  // Memoize client to prevent recreation on every render
  const client = useMemo(() => new ISLClient(), [])

  // Brief 35 Task 2: Track last payload hash to prevent duplicate requests (per-instance)
  const lastPayloadHashRef = useRef<string | null>(null)

  /**
   * Predict using new ISL conformal endpoint
   * Accepts legacy format and transforms to new schema
   */
  const predict = useCallback(
    async (request: LegacyConformalInput | ISLRunRequest) => {
      setState({ data: null, loading: true, error: null, status: 'loading', skipReason: null })

      try {
        // Transform legacy request to new ISL format
        const graph = 'graph' in request ? request.graph : null
        if (!graph) {
          throw new ISLError('Graph data required for conformal predictions', 400)
        }

        // Convert legacy graph format to UI nodes/edges
        const uiNodes: UINode[] = graph.nodes.map(n => ({
          id: n.id,
          type: n.type,
          data: { label: n.label, value: n.value },
        }))

        const uiEdges: UIEdge[] = graph.edges.map((e, i) => ({
          id: `edge-${i}`,
          source: e.from,
          target: e.to,
          data: { weight: e.weight },
        }))

        // P0 Fix: Support explicit interventions (for option-specific predictions)
        // When interventions are provided in options, use those instead of extracting from nodes
        //
        // Brief 33 Fix + Brief 33b Design Decision (when no explicit interventions):
        // Build intervention from FACTOR values only (NOT options)
        //
        // DESIGN RATIONALE:
        // - Conformal prediction provides confidence intervals for outcome predictions
        //   given the current model state (factor values as inputs)
        // - Options are SCENARIOS to compare, not variables in the causal model
        // - Including multiple options (e.g., {"Option A": 1, "Option B": 1}) causes
        //   ISL 422 error because they represent conflicting treatments
        //
        // P0 ENHANCEMENT:
        // - When comparing options, each option has specific interventions
        // - Callers can pass interventions explicitly via options.interventions
        // - This enables option-specific conformal predictions
        let intervention: Record<string, number>

        if ('options' in request && request.options?.interventions) {
          // P0 Fix: Use explicit interventions from caller
          intervention = { ...request.options.interventions }
          console.log('[useISLConformal] Using explicit interventions:', intervention)
        } else {
          // Default behavior: extract from factor node values
          intervention = {}
          for (const node of graph.nodes) {
            if (node.type === 'factor' && typeof node.value === 'number') {
              // Use node ID (not label) - ISL requires variable names matching ^[a-zA-Z_][a-zA-Z0-9_]*$
              intervention[node.id] = node.value
            }
          }
        }

        // Brief 35 Task 1: Guard - skip conformal call when no factors exist
        // Confidence intervals require quantitative factors as intervention targets
        if (Object.keys(intervention).length === 0) {
          console.log('[useISLConformal] Skipping conformal: no intervention targets (no factor nodes with values)')
          const skipResult = {
            data: null,
            loading: false,
            error: null,
            status: 'not_applicable' as const,
            skipReason: 'no_factors',
          }
          setState(skipResult)
          return skipResult
        }

        // P0 Fix: Enhanced dedup with global cache across hook instances
        // Hash includes node IDs, edges, and intervention values
        const interventionHash = Object.entries(intervention).map(([k, v]) => `${k}:${v}`).sort().join('|')
        const payloadHash = `${graph.nodes.length}-${graph.edges.length}-${graph.nodes.map(n => n.id).join(',')}-${graph.edges.map(e => `${e.from}-${e.to}`).join(',')}-${interventionHash}`

        // Check 1: Same payload as this instance's last request
        if (payloadHash === lastPayloadHashRef.current) {
          console.log('[useISLConformal] Skipping duplicate request (same payload hash - instance)')
          setState(prev => ({ ...prev, loading: false, status: prev.data ? 'success' : 'idle' }))
          return state.data
        }

        // Check 2: Response already in global cache
        const cachedResponse = responseCache.get(payloadHash)
        if (cachedResponse) {
          console.log('[useISLConformal] Using cached response for payload hash:', payloadHash.slice(0, 20))
          lastPayloadHashRef.current = payloadHash
          setState({ data: cachedResponse, loading: false, error: null, status: 'success', skipReason: null })
          return cachedResponse
        }

        // Check 3: Request already in-flight (from another hook instance)
        const inFlightPromise = inFlightRequests.get(payloadHash)
        if (inFlightPromise) {
          console.log('[useISLConformal] Waiting for in-flight request:', payloadHash.slice(0, 20))
          try {
            const data = await inFlightPromise
            lastPayloadHashRef.current = payloadHash
            setState({ data, loading: false, error: null, status: 'success', skipReason: null })
            return data
          } catch (error) {
            // In-flight request failed, let this instance try its own request
            console.log('[useISLConformal] In-flight request failed, will retry')
          }
        }

        lastPayloadHashRef.current = payloadHash

        // Build the new ISL conformal request
        const islRequest = buildISLConformalRequest(
          uiNodes,
          uiEdges,
          intervention,
          [] // calibration_data - empty for now, would come from historical data
        )

        // Override confidence level if provided in options
        if ('options' in request && request.options?.confidence_level) {
          islRequest.confidence_level = request.options.confidence_level
        }

        // DEBUG: Log ISL request payload
        console.log('[useISLConformal] ISL request payload:', JSON.stringify(islRequest, null, 2))

        // P0 Fix: Register in-flight request to prevent duplicate calls from other instances
        const requestPromise = client.conformalPredict(islRequest)
        inFlightRequests.set(payloadHash, requestPromise)

        try {
          // Use new conformalPredict method with correct endpoint
          const data = await requestPromise

          // P0 Fix: Cache successful response
          responseCache.set(payloadHash, data)
          pruneCache()

          setState({ data, loading: false, error: null, status: 'success', skipReason: null })
          return data
        } finally {
          // Always clean up in-flight tracking
          inFlightRequests.delete(payloadHash)
        }
      } catch (error) {
        // DEBUG: Log error
        console.error('[useISLConformal] Error:', error)

        const islError = error instanceof ISLError ? error : new ISLError(
          (error as Error).message || 'Conformal prediction failed',
          500
        )
        setState({ data: null, loading: false, error: islError, status: 'error', skipReason: null })
        throw islError
      }
    },
    [client]
  )

  return {
    ...state,
    predict,
  }
}

/**
 * useISLConformal - Hook for ISL conformal predictions
 *
 * Brief 30: Updated to use correct ISL endpoint and schema
 * POST /api/v1/causal/counterfactual/conformal
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

  // Brief 35 Task 2: Track last payload hash to prevent duplicate requests
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

        // Brief 33 Fix + Brief 33b Design Decision:
        // Build intervention from FACTOR values only (NOT options)
        //
        // DESIGN RATIONALE:
        // - Conformal prediction provides confidence intervals for outcome predictions
        //   given the current model state (factor values as inputs)
        // - Options are SCENARIOS to compare, not variables in the causal model
        // - Including multiple options (e.g., {"Option A": 1, "Option B": 1}) causes
        //   ISL 422 error because they represent conflicting treatments
        //
        // ALTERNATIVES CONSIDERED (Brief 33b):
        // - "Selected option" concept: Not applicable - conformal prediction isn't
        //   about choosing between options, it's about confidence in predictions
        // - If option comparison is needed: Run full analysis twice (once per option)
        //   and compare results, don't use conformal endpoint
        //
        // CURRENT BEHAVIOR:
        // - Only factor nodes with numeric values are included in intervention
        // - Option/Decision/Outcome/Risk nodes are excluded
        const intervention: Record<string, number> = {}
        for (const node of graph.nodes) {
          if (node.type === 'factor' && typeof node.value === 'number') {
            intervention[node.label] = node.value
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

        // Brief 35 Task 2: Skip duplicate requests by comparing payload hash
        // Hash includes node IDs, edges, and intervention values
        const interventionHash = Object.entries(intervention).map(([k, v]) => `${k}:${v}`).sort().join('|')
        const payloadHash = `${graph.nodes.length}-${graph.edges.length}-${graph.nodes.map(n => n.id).join(',')}-${graph.edges.map(e => `${e.from}-${e.to}`).join(',')}-${interventionHash}`

        if (payloadHash === lastPayloadHashRef.current) {
          console.log('[useISLConformal] Skipping duplicate request (same payload hash)')
          // Reset loading state since we're not making a request
          setState(prev => ({ ...prev, loading: false, status: prev.data ? 'success' : 'idle' }))
          return state.data
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

        // Use new conformalPredict method with correct endpoint
        const data = await client.conformalPredict(islRequest)
        setState({ data, loading: false, error: null, status: 'success', skipReason: null })
        return data
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

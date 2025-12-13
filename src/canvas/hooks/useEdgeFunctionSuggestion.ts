/**
 * useEdgeFunctionSuggestion - Fetches CEE suggestions for edge function types
 *
 * Calls PLoT /bff/engine/v1/suggest/edge-function endpoint to get AI-powered
 * suggestions for the appropriate edge function type based on node context.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import type { EdgeFunctionType, EdgeFunctionParams } from '../domain/edges'

export interface EdgeFunctionSuggestion {
  /** Suggested function type */
  function_type: EdgeFunctionType
  /** Confidence in the suggestion */
  confidence: 'high' | 'medium' | 'low'
  /** Explanation for the suggestion */
  rationale: string
  /** Suggested parameters for the function */
  suggested_params?: EdgeFunctionParams
  /** Source attribution */
  provenance: 'cee'
}

interface UseEdgeFunctionSuggestionOptions {
  /** Edge ID to get suggestion for */
  edgeId: string | null | undefined
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
}

interface UseEdgeFunctionSuggestionResult {
  /** The suggestion if available */
  suggestion: EdgeFunctionSuggestion | null
  /** Loading state */
  loading: boolean
  /** Error message if request failed */
  error: string | null
  /** Manual refresh function */
  refetch: () => Promise<void>
}

// Simple in-memory cache for suggestions (keyed by edge_id)
const suggestionCache = new Map<string, EdgeFunctionSuggestion>()

export function useEdgeFunctionSuggestion({
  edgeId,
  autoFetch = true,
}: UseEdgeFunctionSuggestionOptions): UseEdgeFunctionSuggestionResult {
  const [suggestion, setSuggestion] = useState<EdgeFunctionSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get edge and node info from store
  const edges = useCanvasStore((s) => s.edges)
  const nodes = useCanvasStore((s) => s.nodes)

  // Track last fetched edge to prevent duplicate fetches
  const lastFetchedEdgeRef = useRef<string | null>(null)

  const fetchSuggestion = useCallback(async () => {
    if (!edgeId) {
      setSuggestion(null)
      setError(null)
      return
    }

    // Check cache first
    const cached = suggestionCache.get(edgeId)
    if (cached) {
      setSuggestion(cached)
      return
    }

    // Prevent duplicate fetches for same edge
    if (loading || edgeId === lastFetchedEdgeRef.current) {
      return
    }

    const edge = edges.find((e) => e.id === edgeId)
    if (!edge) {
      setError('Edge not found')
      return
    }

    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)

    if (!sourceNode || !targetNode) {
      setError('Source or target node not found')
      return
    }

    lastFetchedEdgeRef.current = edgeId
    setLoading(true)
    setError(null)

    try {
      // Build request payload
      const payload = {
        edge_id: edgeId,
        source_kind: sourceNode.type || 'unknown',
        target_kind: targetNode.type || 'unknown',
        context: {
          source_label: (sourceNode.data as any)?.label || sourceNode.id,
          target_label: (targetNode.data as any)?.label || targetNode.id,
        },
      }

      // Call the suggest endpoint
      const response = await fetch('/bff/engine/v1/suggest/edge-function', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        // Non-200 response - gracefully degrade
        if (response.status === 404) {
          // Endpoint not available - use fallback
          const fallback = generateFallbackSuggestion(sourceNode, targetNode)
          suggestionCache.set(edgeId, fallback)
          setSuggestion(fallback)
          return
        }
        throw new Error(`Failed to fetch suggestion: ${response.status}`)
      }

      const data = await response.json()

      // Map response to suggestion type
      const result: EdgeFunctionSuggestion = {
        function_type: data.function_type || 'linear',
        confidence: data.confidence || 'medium',
        rationale: data.rationale || 'Based on node types and labels',
        suggested_params: data.suggested_params,
        provenance: 'cee',
      }

      // Cache the result
      suggestionCache.set(edgeId, result)
      setSuggestion(result)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch edge function suggestion'
      setError(errorMessage)

      // Generate fallback suggestion on error
      const sourceNode = nodes.find((n) => n.id === edge?.source)
      const targetNode = nodes.find((n) => n.id === edge?.target)
      if (sourceNode && targetNode) {
        const fallback = generateFallbackSuggestion(sourceNode, targetNode)
        setSuggestion(fallback)
      }

      if (import.meta.env.DEV) {
        console.warn('[useEdgeFunctionSuggestion] Failed to fetch:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [edgeId, edges, nodes, loading])

  // Auto-fetch when edgeId changes
  useEffect(() => {
    if (autoFetch && edgeId && edgeId !== lastFetchedEdgeRef.current) {
      fetchSuggestion()
    }
  }, [autoFetch, edgeId, fetchSuggestion])

  return {
    suggestion,
    loading,
    error,
    refetch: fetchSuggestion,
  }
}

// =============================================================================
// Brief 6.1: Node Type Inference
// =============================================================================

/**
 * Infer semantic node type from label keywords.
 * Used to improve function type suggestions.
 */
type InferredNodeType =
  | 'cause'       // Independent causes/factors
  | 'effect'      // Dependent outcomes/results
  | 'mediator'    // Intermediate variables
  | 'moderator'   // Variables that modify relationships
  | 'risk'        // Risk factors
  | 'resource'    // Resources/inputs that can be depleted
  | 'threshold'   // Pass/fail gates
  | 'adoption'    // Adoption/growth curves
  | 'unknown'

function inferNodeType(label: string, nodeType: string): InferredNodeType {
  const lowerLabel = label.toLowerCase()

  // Risk-related keywords
  if (nodeType === 'risk' || /\b(risk|threat|hazard|danger|failure)\b/.test(lowerLabel)) {
    return 'risk'
  }

  // Threshold/gate keywords
  if (/\b(compliance|regulatory|approval|certification|pass|fail|qualify|threshold)\b/.test(lowerLabel)) {
    return 'threshold'
  }

  // Adoption/growth keywords
  if (/\b(adoption|penetration|diffusion|growth|market.?share|uptake)\b/.test(lowerLabel)) {
    return 'adoption'
  }

  // Resource/investment keywords
  if (/\b(budget|spend|investment|cost|resource|capacity|marketing|advertising)\b/.test(lowerLabel)) {
    return 'resource'
  }

  // Outcome keywords
  if (nodeType === 'outcome' || /\b(outcome|result|revenue|profit|success|achievement)\b/.test(lowerLabel)) {
    return 'effect'
  }

  // Factor keywords suggest causes
  if (nodeType === 'factor' || /\b(factor|driver|influence|cause|input)\b/.test(lowerLabel)) {
    return 'cause'
  }

  return 'unknown'
}

// =============================================================================
// Brief 6.2-5: Form Recommendations, Confidence, Validation
// =============================================================================

/**
 * Generate a fallback suggestion based on node types and labels
 * Used when CEE endpoint is unavailable or errors
 *
 * Brief 6.1-6.5: Enhanced heuristics with node type inference,
 * confidence levels, and support for noisy_or/logistic forms.
 */
function generateFallbackSuggestion(
  sourceNode: any,
  targetNode: any
): EdgeFunctionSuggestion {
  const sourceLabel = ((sourceNode.data as any)?.label || '').toLowerCase()
  const targetLabel = ((targetNode.data as any)?.label || '').toLowerCase()
  const sourceType = sourceNode.type || ''
  const targetType = targetNode.type || ''

  // Brief 6.1: Infer semantic types
  const inferredSource = inferNodeType(sourceLabel, sourceType)
  const inferredTarget = inferNodeType(targetLabel, targetType)

  // ==========================================================================
  // Brief 6.4: Noisy-OR suggestions
  // Multiple independent causes combining to produce effect (OR-like)
  // ==========================================================================
  if (
    inferredSource === 'risk' &&
    (inferredTarget === 'effect' || targetType === 'outcome')
  ) {
    return {
      function_type: 'noisy_or',
      confidence: 'medium',
      rationale: 'Multiple risk factors combine via Noisy-OR: each independently contributes to failure probability',
      suggested_params: { noisyOrStrength: 0.7, noisyOrLeak: 0.05 },
      provenance: 'cee',
    }
  }

  // Multiple causes leading to same outcome suggest noisy-OR
  if (
    inferredSource === 'cause' &&
    inferredTarget === 'effect'
  ) {
    return {
      function_type: 'noisy_or',
      confidence: 'low',
      rationale: 'Independent causes may combine via Noisy-OR when any can trigger the effect',
      suggested_params: { noisyOrStrength: 0.6, noisyOrLeak: 0.1 },
      provenance: 'cee',
    }
  }

  // ==========================================================================
  // Diminishing returns for resources/investments
  // ==========================================================================
  if (inferredSource === 'resource') {
    return {
      function_type: 'diminishing_returns',
      confidence: 'medium',
      rationale: 'Resource investments typically show diminishing marginal returns',
      suggested_params: { curvature: 0.5 },
      provenance: 'cee',
    }
  }

  // ==========================================================================
  // S-curve / Logistic for adoption and growth
  // ==========================================================================
  if (inferredTarget === 'adoption') {
    return {
      function_type: 's_curve',
      confidence: 'medium',
      rationale: 'Market adoption typically follows an S-curve (slow start, rapid growth, saturation)',
      suggested_params: { midpoint: 0.5, steepness: 5 },
      provenance: 'cee',
    }
  }

  // Brief 6.5: Logistic for saturation effects in outcomes
  if (
    inferredTarget === 'effect' &&
    /\b(saturat|diminish|limit|cap|ceiling|maximum)\b/.test(targetLabel)
  ) {
    return {
      function_type: 'logistic',
      confidence: 'medium',
      rationale: 'Outcome shows saturation characteristics - logistic models the asymptotic limit',
      suggested_params: { logisticBias: 0, logisticScale: 4 },
      provenance: 'cee',
    }
  }

  // ==========================================================================
  // Threshold behaviour for gates/compliance
  // ==========================================================================
  if (inferredSource === 'threshold' || inferredTarget === 'threshold') {
    return {
      function_type: 'threshold',
      confidence: 'medium',
      rationale: 'Compliance and regulatory requirements exhibit threshold (pass/fail) behaviour',
      suggested_params: { threshold: 0.7 },
      provenance: 'cee',
    }
  }

  // Risk nodes with threshold behaviour
  if (inferredSource === 'risk' || inferredTarget === 'risk') {
    return {
      function_type: 'threshold',
      confidence: 'low',
      rationale: 'Risk factors often exhibit threshold behaviour (safe below threshold, dangerous above)',
      suggested_params: { threshold: 0.5 },
      provenance: 'cee',
    }
  }

  // ==========================================================================
  // Default to linear for unknown relationships
  // ==========================================================================
  return {
    function_type: 'linear',
    confidence: 'low',
    rationale: 'Linear relationship is the default when context is unclear. Consider adjusting based on domain knowledge.',
    provenance: 'cee',
  }
}

/**
 * Brief 6.3: Validate that suggested function type is appropriate
 * Returns warning message if function type may be inappropriate
 */
export function validateFunctionSuggestion(
  suggestion: EdgeFunctionSuggestion,
  sourceNodeType: string,
  targetNodeType: string
): string | null {
  // Noisy-OR should connect causes to effects
  if (suggestion.function_type === 'noisy_or') {
    if (targetNodeType === 'decision' || targetNodeType === 'option') {
      return 'Noisy-OR is typically used for combining causes into effects, not for decision branches'
    }
  }

  // Threshold typically not appropriate for decision → outcome
  if (suggestion.function_type === 'threshold') {
    if (sourceNodeType === 'decision' && targetNodeType === 'outcome') {
      return 'Threshold functions are typically used for pass/fail gates, not decision outcomes'
    }
  }

  // S-curve/logistic typically not appropriate for factor → factor
  if (suggestion.function_type === 's_curve' || suggestion.function_type === 'logistic') {
    if (sourceNodeType === 'factor' && targetNodeType === 'factor') {
      return 'S-curve/logistic are typically used for saturation effects, not factor-to-factor relationships'
    }
  }

  return null
}

/**
 * Clear the suggestion cache (useful for testing)
 */
export function clearEdgeFunctionSuggestionCache(): void {
  suggestionCache.clear()
}

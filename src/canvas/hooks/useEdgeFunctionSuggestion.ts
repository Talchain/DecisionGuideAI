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

/**
 * Generate a fallback suggestion based on node types and labels
 * Used when CEE endpoint is unavailable or errors
 */
function generateFallbackSuggestion(
  sourceNode: any,
  targetNode: any
): EdgeFunctionSuggestion {
  const sourceLabel = ((sourceNode.data as any)?.label || '').toLowerCase()
  const targetLabel = ((targetNode.data as any)?.label || '').toLowerCase()
  const sourceType = sourceNode.type || ''
  const targetType = targetNode.type || ''

  // Heuristic-based suggestions
  // Marketing/advertising typically has diminishing returns
  if (
    sourceLabel.includes('marketing') ||
    sourceLabel.includes('advertising') ||
    sourceLabel.includes('spend')
  ) {
    return {
      function_type: 'diminishing_returns',
      confidence: 'medium',
      rationale: 'Marketing and advertising spend typically show diminishing returns',
      suggested_params: { curvature: 0.5 },
      provenance: 'cee',
    }
  }

  // Adoption/market penetration often follows S-curve
  if (
    targetLabel.includes('adoption') ||
    targetLabel.includes('penetration') ||
    targetLabel.includes('market share')
  ) {
    return {
      function_type: 's_curve',
      confidence: 'medium',
      rationale: 'Market adoption typically follows an S-curve pattern',
      suggested_params: { midpoint: 0.5, steepness: 5 },
      provenance: 'cee',
    }
  }

  // Compliance/regulatory often has threshold behaviour
  if (
    sourceLabel.includes('compliance') ||
    sourceLabel.includes('regulatory') ||
    targetLabel.includes('approval')
  ) {
    return {
      function_type: 'threshold',
      confidence: 'medium',
      rationale: 'Regulatory compliance typically has a threshold effect',
      suggested_params: { threshold: 0.7 },
      provenance: 'cee',
    }
  }

  // Risk nodes often connect with threshold behaviour
  if (sourceType === 'risk' || targetType === 'risk') {
    return {
      function_type: 'threshold',
      confidence: 'low',
      rationale: 'Risk factors often exhibit threshold behaviour',
      suggested_params: { threshold: 0.5 },
      provenance: 'cee',
    }
  }

  // Default to linear
  return {
    function_type: 'linear',
    confidence: 'low',
    rationale: 'Linear relationship is a reasonable default',
    provenance: 'cee',
  }
}

/**
 * Clear the suggestion cache (useful for testing)
 */
export function clearEdgeFunctionSuggestionCache(): void {
  suggestionCache.clear()
}

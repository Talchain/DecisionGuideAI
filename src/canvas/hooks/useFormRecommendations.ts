/**
 * useFormRecommendations - Fetches CEE form recommendations for all edges
 *
 * Brief 11.1: Confidence-driven UI behaviour for functional forms
 * Brief 12: Updated to call CEE directly via /bff/cee proxy
 *
 * - High confidence: Auto-apply form, show callout for review
 * - Medium confidence: Show subtle suggestion badge
 * - Low confidence: Default to linear, no UI mention
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useCanvasStore } from '../store'
import type { EdgeFunctionType, FormProvenance } from '../domain/edges'
import type { EdgeFormRecommendation, UseFormRecommendationsResult } from '../components/FunctionalForm/types'
import {
  adaptCEEFormResponse,
  generateFallbackFormRecommendation,
} from '../adapters/ceeFormAdapter'

// Local storage key for dismissed suggestions
const DISMISSED_SUGGESTIONS_KEY = 'canvas.formSuggestions.dismissed.v1'

// Cache for form recommendations
const recommendationsCache = new Map<string, EdgeFormRecommendation[]>()

interface UseFormRecommendationsOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
  /** Auto-apply high-confidence forms (default: true) */
  autoApply?: boolean
}

/**
 * Hook to fetch and manage CEE form recommendations for all edges
 */
export function useFormRecommendations({
  autoFetch = true,
  autoApply = true,
}: UseFormRecommendationsOptions = {}): UseFormRecommendationsResult {
  const [recommendations, setRecommendations] = useState<EdgeFormRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_SUGGESTIONS_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Get edges and nodes from store
  const edges = useCanvasStore((s) => s.edges)
  const nodes = useCanvasStore((s) => s.nodes)
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData)

  // Track last fetched hash to prevent duplicate fetches
  const lastFetchHashRef = useRef<string | null>(null)

  /**
   * Generate a hash of edge IDs to detect when edges change
   */
  const edgeHash = useMemo(() => {
    return edges.map((e) => e.id).sort().join(',')
  }, [edges])

  /**
   * Fetch form recommendations from CEE
   */
  const refetch = useCallback(async () => {
    if (edges.length === 0) {
      setRecommendations([])
      return
    }

    // Check cache first
    const cached = recommendationsCache.get(edgeHash)
    if (cached) {
      setRecommendations(cached)
      return
    }

    // Prevent duplicate fetches
    if (loading || edgeHash === lastFetchHashRef.current) {
      return
    }

    lastFetchHashRef.current = edgeHash
    setLoading(true)
    setError(null)

    try {
      // Build request payload with all edges
      const edgeContexts = edges.map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source)
        const targetNode = nodes.find((n) => n.id === edge.target)

        return {
          edge_id: edge.id,
          source_kind: sourceNode?.type || 'unknown',
          target_kind: targetNode?.type || 'unknown',
          current_form: (edge.data as any)?.functionType || 'linear',
          context: {
            source_label: (sourceNode?.data as any)?.label || sourceNode?.id || 'Unknown',
            target_label: (targetNode?.data as any)?.label || targetNode?.id || 'Unknown',
          },
        }
      })

      const response = await fetch('/bff/cee/suggest-edge-function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edges: edgeContexts }),
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint not available - use fallback
          const fallbackRecs = generateFallbackRecommendations(edges, nodes)
          recommendationsCache.set(edgeHash, fallbackRecs)
          setRecommendations(fallbackRecs)
          return
        }
        throw new Error(`Failed to fetch recommendations: ${response.status}`)
      }

      const data = await response.json()

      // Use adapter to transform CEE response to UI format
      const recs = adaptCEEFormResponse(data)

      recommendationsCache.set(edgeHash, recs)
      setRecommendations(recs)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch form recommendations'
      setError(errorMessage)

      // Generate fallback recommendations on error
      const fallbackRecs = generateFallbackRecommendations(edges, nodes)
      setRecommendations(fallbackRecs)

      if (import.meta.env.DEV) {
        console.warn('[useFormRecommendations] Failed to fetch:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [edges, nodes, edgeHash, loading])

  /**
   * Auto-apply high-confidence forms
   */
  useEffect(() => {
    if (!autoApply || recommendations.length === 0) return

    const highConfidenceRecs = recommendations.filter(
      (rec) =>
        rec.form_confidence === 'high' &&
        rec.recommended_form !== rec.current_form &&
        !rec.auto_applied
    )

    if (highConfidenceRecs.length === 0) return

    // Apply high-confidence forms and mark as auto-applied
    highConfidenceRecs.forEach((rec) => {
      updateEdgeData(rec.edge_id, {
        functionType: rec.recommended_form,
        formConfidence: 'high',
        formProvenance: 'cee_recommended',
        formRationale: rec.rationale,
      })
    })

    // Mark as auto-applied in local state
    setRecommendations((prev) =>
      prev.map((rec) =>
        highConfidenceRecs.some((hr) => hr.edge_id === rec.edge_id)
          ? { ...rec, auto_applied: true }
          : rec
      )
    )
  }, [autoApply, recommendations, updateEdgeData])

  /**
   * Auto-fetch when edges change
   */
  useEffect(() => {
    if (autoFetch && edgeHash !== lastFetchHashRef.current) {
      refetch()
    }
  }, [autoFetch, edgeHash, refetch])

  /**
   * Persist dismissed suggestions to localStorage
   */
  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify([...dismissedIds]))
    } catch {
      // Ignore localStorage errors
    }
  }, [dismissedIds])

  /**
   * Confirm a form recommendation (user accepts the auto-applied form)
   */
  const confirmForm = useCallback(
    (edgeId: string) => {
      updateEdgeData(edgeId, {
        formProvenance: 'user_selected' as FormProvenance,
      })
      setRecommendations((prev) =>
        prev.filter((rec) => rec.edge_id !== edgeId)
      )
    },
    [updateEdgeData]
  )

  /**
   * Change a form (user wants to override the recommendation)
   */
  const changeForm = useCallback(
    (edgeId: string, form: EdgeFunctionType) => {
      updateEdgeData(edgeId, {
        functionType: form,
        formProvenance: 'user_selected' as FormProvenance,
        formConfidence: undefined, // Clear CEE confidence
        formRationale: undefined, // Clear CEE rationale
      })
      setRecommendations((prev) =>
        prev.filter((rec) => rec.edge_id !== edgeId)
      )
    },
    [updateEdgeData]
  )

  /**
   * Dismiss a suggestion (user doesn't want to see it)
   */
  const dismissSuggestion = useCallback((edgeId: string) => {
    setDismissedIds((prev) => new Set([...prev, edgeId]))
    setRecommendations((prev) =>
      prev.filter((rec) => rec.edge_id !== edgeId)
    )
  }, [])

  /**
   * Filter recommendations by confidence
   */
  const appliedForms = useMemo(
    () =>
      recommendations.filter(
        (rec) => rec.form_confidence === 'high' && rec.auto_applied
      ),
    [recommendations]
  )

  const suggestions = useMemo(
    () =>
      recommendations.filter(
        (rec) =>
          rec.form_confidence === 'medium' &&
          !dismissedIds.has(rec.edge_id) &&
          rec.recommended_form !== rec.current_form
      ),
    [recommendations, dismissedIds]
  )

  return {
    recommendations,
    appliedForms,
    suggestions,
    loading,
    error,
    refetch,
    confirmForm,
    changeForm,
    dismissSuggestion,
  }
}

// =============================================================================
// Fallback recommendation generation
// =============================================================================

/**
 * Generate fallback recommendations when CEE endpoint is unavailable
 * Uses adapter's heuristic-based inference
 */
function generateFallbackRecommendations(
  edges: any[],
  nodes: any[]
): EdgeFormRecommendation[] {
  return edges
    .map((edge) => {
      const sourceNode = nodes.find((n: any) => n.id === edge.source)
      const targetNode = nodes.find((n: any) => n.id === edge.target)

      if (!sourceNode || !targetNode) return null

      const sourceLabel = (sourceNode.data as any)?.label || sourceNode.id
      const targetLabel = (targetNode.data as any)?.label || targetNode.id
      const sourceType = sourceNode.type || 'unknown'
      const targetType = targetNode.type || 'unknown'
      const currentForm = (edge.data as any)?.functionType || 'linear'

      // Use adapter's fallback generation
      return generateFallbackFormRecommendation(
        edge.id,
        sourceLabel,
        targetLabel,
        sourceType,
        targetType,
        currentForm
      )
    })
    .filter((rec): rec is EdgeFormRecommendation => rec !== null)
}

/**
 * Clear the recommendations cache (useful for testing)
 */
export function clearFormRecommendationsCache(): void {
  recommendationsCache.clear()
}

/**
 * useFormRecommendations - Fetches CEE form recommendations for all edges
 *
 * Brief 11.1: Confidence-driven UI behaviour for functional forms
 * Brief 12: Updated to call CEE via PLoT proxy (routes through /v1/cee)
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

/**
 * ⚠ THE BASE IS A LITERAL (ROADMAP 2.710). The former comment ("routes
 * through PLoT which handles auth") described the env-resolved base — which
 * pointed this CREDENTIAL-LESS call at PLoT's bearer-authenticated origin,
 * where /suggest-edge-function is not even registered (404, measured
 * 2026-08-03). CEE serves /assist/v1/suggest-edge-function behind the
 * same-origin `/bff/cee` edge seam, which injects `X-Olumi-Assist-Key`
 * server-side. Guarded by ceeSeamBinding.spec.ts.
 */
const CEE_BASE_URL = '/bff/cee'

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
  // ROADMAP 1.44: latest-ref for `loading`, read inside refetch's dedup
  // guard without needing `loading` in refetch's dependency array (which
  // would otherwise recreate refetch — and re-fire the auto-fetch effect
  // below — every time loading toggles).
  const loadingRef = useRef(false)

  /**
   * Generate a hash of edge IDs to detect when edges change
   */
  const edgeHash = useMemo(() => {
    return edges.map((e) => e.id).sort().join(',')
  }, [edges])

  // ROADMAP 1.44 — "latest ref" pattern: refetch reads edges/nodes via these
  // refs (kept fresh every render) instead of closing over the raw arrays
  // directly. That keeps refetch's identity keyed ONLY on edgeHash (a
  // content-based primitive), so an unmemoized caller/selector that returns
  // a new edges/nodes array reference on every render (same values, new
  // reference) no longer forces a new refetch identity — and therefore no
  // longer re-fires the auto-fetch effect below on every render.
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  /**
   * Fetch form recommendations from CEE
   */
  const refetch = useCallback(async () => {
    const edges = edgesRef.current
    const nodes = nodesRef.current

    if (edges.length === 0) {
      setRecommendations([])
      // Latch the hash even on early return — otherwise an unmemoized
      // edges/nodes reference (new array, same content, every render) keeps
      // this guard permanently unsatisfied: every render recreates refetch,
      // the auto-fetch effect re-fires, this branch re-runs, and the fresh
      // `[]` literal above (never `===` the previous one) triggers another
      // render — an infinite loop with no network calls involved at all.
      lastFetchHashRef.current = edgeHash
      return
    }

    // Check cache first
    const cached = recommendationsCache.get(edgeHash)
    if (cached) {
      setRecommendations(cached)
      lastFetchHashRef.current = edgeHash
      return
    }

    // Prevent duplicate fetches
    if (loadingRef.current || edgeHash === lastFetchHashRef.current) {
      return
    }

    lastFetchHashRef.current = edgeHash
    loadingRef.current = true
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

      const response = await fetch(`${CEE_BASE_URL}/suggest-edge-function`, {
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
      loadingRef.current = false
      setLoading(false)
    }
    // ROADMAP 1.44: deps are edgeHash ONLY (a content-based primitive) — NOT
    // the raw edges/nodes arrays and NOT `loading`. edges/nodes are read via
    // edgesRef/nodesRef and `loading` via loadingRef (all above) so this
    // callback's identity is stable whenever edgeHash is unchanged, even if
    // the caller/selector returns a new array reference on every render.
  }, [edgeHash])

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

/**
 * useGraphReadiness Hook
 * Fetches pre-analysis health assessment from CEE /graph-readiness endpoint
 *
 * Returns quality tier, improvements list, and analysis eligibility
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'

// Debounce delay for graph changes (ms)
const DEBOUNCE_DELAY = 800

// Maximum retry attempts for failed requests
const MAX_RETRY_ATTEMPTS = 3

// HTTP status codes that should not be retried
const NON_RETRYABLE_STATUSES = [401, 403, 404]

export type ReadinessLevel = 'needs_work' | 'fair' | 'strong'
export type ImprovementPriority = 'high' | 'medium' | 'low'

export type SuggestedNodeType = 'risk' | 'outcome' | 'option' | 'factor' | 'evidence' | 'goal' | 'decision'

export interface GraphImprovement {
  category: string
  action: string
  current_gap: string
  quality_impact: number
  /** Target quality score after implementing this improvement */
  target_quality: number
  priority: ImprovementPriority
  effort_minutes: number
  /** Node IDs that need attention for this improvement */
  affected_nodes?: string[]
  /** Edge IDs that need attention for this improvement */
  affected_edges?: string[]
  /** Suggested node type to add (e.g., 'risk', 'factor', 'evidence') */
  suggested_node_type?: SuggestedNodeType
  /** Current score for this quality factor (0-100) */
  current_score?: number
}

export interface GraphReadiness {
  readiness_score: number // 0-100
  readiness_level: ReadinessLevel
  can_run_analysis: boolean
  confidence_explanation: string
  improvements: GraphImprovement[]
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * Calculate fallback readiness from local graph health
 */
function calculateFallbackReadiness(
  nodes: Node[],
  edges: Edge[],
  graphHealth: { issues?: Array<{ severity: string }> } | null
): GraphReadiness {
  let score = 50

  // Boost for having nodes
  if (nodes.length > 0) score += 10
  if (nodes.length >= 3) score += 10
  if (nodes.length >= 5) score += 5

  // Boost for having connections
  if (edges.length > 0) score += 10
  if (edges.length >= nodes.length - 1) score += 5

  // Penalties for issues
  const issues = graphHealth?.issues || []
  const blockers = issues.filter(i => i.severity === 'error' || i.severity === 'blocker')
  const warnings = issues.filter(i => i.severity === 'warning')

  score -= blockers.length * 15
  score -= warnings.length * 5

  score = Math.max(0, Math.min(100, score))

  let level: ReadinessLevel = 'fair'
  if (score < 40) level = 'needs_work'
  else if (score >= 70) level = 'strong'

  return {
    readiness_score: score,
    readiness_level: level,
    can_run_analysis: blockers.length === 0,
    confidence_explanation: level === 'strong'
      ? 'Your model has good structure and connections'
      : level === 'fair'
        ? 'Analysis available - consider improvements for better results'
        : 'Address critical issues before running analysis',
    improvements: [],
  }
}

export function useGraphReadiness() {
  const [readiness, setReadiness] = useState<GraphReadiness | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [endpointAvailable, setEndpointAvailable] = useState(true)

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
  const lastGraphHashRef = useRef<string>('')

  // Store selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const graphHealth = useCanvasStore(s => s.graphHealth)

  // Use ref for graphHealth to avoid dependency churn
  const graphHealthRef = useRef(graphHealth)
  graphHealthRef.current = graphHealth

  const fetchReadiness = useCallback(async () => {
    // Don't fetch if no nodes
    if (nodes.length === 0) {
      setReadiness({
        readiness_score: 0,
        readiness_level: 'needs_work',
        can_run_analysis: false,
        confidence_explanation: 'Add some nodes to get started',
        improvements: [],
      })
      return
    }

    // Calculate graph hash to detect actual changes
    const graphHash = `${nodes.length}-${edges.length}-${nodes.map(n => n.id).join(',')}`

    // Don't refetch if endpoint unavailable and graph hasn't changed
    if (!endpointAvailable && graphHash === lastGraphHashRef.current) {
      return
    }

    // Check retry limit (reset on new graph)
    if (graphHash === lastGraphHashRef.current && retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      console.warn('[useGraphReadiness] Max retries reached, using fallback')
      return
    }

    // Reset retry count on graph change
    if (graphHash !== lastGraphHashRef.current) {
      retryCountRef.current = 0
      lastGraphHashRef.current = graphHash
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    const correlationId = generateCorrelationId()

    try {
      // Build request payload - CEE expects { graph: { nodes: [{id, label, kind?}], edges: [{id, source, target}] }}
      const requestBody = {
        graph: {
          nodes: nodes.map(n => ({
            id: n.id,
            label: (n.data as any)?.label || n.id,
            kind: n.type, // CEE expects 'kind' not 'type'
          })),
          edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
          })),
        },
      }

      // Debug logging for 400 errors
      if (import.meta.env.DEV) {
        const bodyString = JSON.stringify(requestBody)
        console.log('[useGraphReadiness] Request body:', JSON.stringify(requestBody, null, 2))
        console.log('[useGraphReadiness] Content-Type: application/json')
        console.log('[useGraphReadiness] Body type:', typeof bodyString)
        console.log('[useGraphReadiness] Body length:', bodyString.length)
        console.log('[useGraphReadiness] URL:', `${CEE_BASE_URL}/graph-readiness`)
      }

      const response = await fetch(`${CEE_BASE_URL}/graph-readiness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': correlationId,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!response.ok) {
        // Debug: Log full error details for any non-2xx response
        if (import.meta.env.DEV) {
          try {
            const errorBody = await response.clone().json()
            console.error(`[useGraphReadiness] HTTP ${response.status} - response:`, JSON.stringify(errorBody, null, 2))
            // Check for specific validation error fields
            if (errorBody.details || errorBody.fields || errorBody.errors) {
              console.error('[useGraphReadiness] Validation errors:', errorBody.details || errorBody.fields || errorBody.errors)
            }
          } catch {
            const errorText = await response.clone().text()
            console.error(`[useGraphReadiness] HTTP ${response.status} - response:`, errorText)
          }
        }

        // Handle non-retryable errors
        if (NON_RETRYABLE_STATUSES.includes(response.status)) {
          if (response.status === 404) {
            console.warn('[useGraphReadiness] Endpoint not available (404), using fallback')
            setEndpointAvailable(false)
          } else {
            console.warn(`[useGraphReadiness] Non-retryable error (${response.status}), using fallback`)
          }
          // Use fallback without retry
          const fallback = calculateFallbackReadiness(nodes, edges, graphHealthRef.current)
          setReadiness(fallback)
          setLoading(false)
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      // Validate and normalize response
      const normalized: GraphReadiness = {
        readiness_score: typeof data.readiness_score === 'number'
          ? Math.max(0, Math.min(100, data.readiness_score))
          : 50,
        readiness_level: ['needs_work', 'fair', 'strong'].includes(data.readiness_level)
          ? data.readiness_level
          : 'fair',
        can_run_analysis: typeof data.can_run_analysis === 'boolean'
          ? data.can_run_analysis
          : true,
        confidence_explanation: typeof data.confidence_explanation === 'string'
          ? data.confidence_explanation
          : 'Analysis available',
        improvements: Array.isArray(data.improvements)
          ? data.improvements.map((imp: any) => ({
              category: imp.category || 'general',
              action: imp.action || imp.recommendation || 'Review this area',
              current_gap: imp.current_gap || '',
              quality_impact: typeof imp.quality_impact === 'number' ? imp.quality_impact : (typeof imp.potential_improvement === 'number' ? imp.potential_improvement : 5),
              target_quality: typeof imp.target_quality === 'number' ? imp.target_quality : (typeof imp.target_score === 'number' ? imp.target_score : 70),
              priority: ['high', 'medium', 'low'].includes(imp.priority) ? imp.priority : (imp.impact || 'medium'),
              effort_minutes: typeof imp.effort_minutes === 'number' ? imp.effort_minutes : 5,
              affected_nodes: Array.isArray(imp.affected_nodes) ? imp.affected_nodes : (Array.isArray(imp.affected_node_ids) ? imp.affected_node_ids : undefined),
              affected_edges: Array.isArray(imp.affected_edges) ? imp.affected_edges : (Array.isArray(imp.affected_edge_ids) ? imp.affected_edge_ids : undefined),
              suggested_node_type: imp.suggested_node_type || undefined,
              current_score: typeof imp.current_score === 'number' ? imp.current_score : undefined,
            }))
          : [],
      }

      setReadiness(normalized)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }

      // Increment retry count for next attempt
      retryCountRef.current++
      console.warn(`[useGraphReadiness] Fetch failed (attempt ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS}):`, err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Use fallback based on local graph health (use ref to avoid dependency)
      const fallback = calculateFallbackReadiness(nodes, edges, graphHealthRef.current)
      setReadiness(fallback)
    } finally {
      setLoading(false)
    }
  }, [nodes, edges, endpointAvailable]) // Note: graphHealth removed, using ref

  // Debounced fetch on graph changes
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchReadiness()
    }, DEBOUNCE_DELAY)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [fetchReadiness])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchReadiness()
  }, [fetchReadiness])

  return {
    readiness,
    loading,
    error,
    refresh,
  }
}

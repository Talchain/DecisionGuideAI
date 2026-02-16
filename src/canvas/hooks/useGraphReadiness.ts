/**
 * useGraphReadiness Hook
 * Fetches pre-analysis health assessment from CEE /graph-readiness endpoint
 *
 * Returns quality tier, improvements list, and analysis eligibility.
 * Falls back to local graph analysis if CEE is unavailable.
 *
 * Optimized for stability:
 * - Uses fingerprint-based change detection to prevent excessive requests
 * - Reads store state inside callback to maintain stable callback reference
 * - Debounces changes effectively (callback doesn't recreate on every render)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { useShallow } from 'zustand/shallow'
import type { Node, Edge } from '@xyflow/react'

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'

// Debounce delay for graph changes (ms)
const DEBOUNCE_DELAY = 500

// Rate limit handling
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const BACKOFF_MULTIPLIER = 2

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

/**
 * Create a stable fingerprint for graph state.
 * Only changes when graph content actually changes.
 */
function createGraphFingerprint(
  nodes: Node[],
  edges: Edge[],
  ceeAnalysisReady: { options?: { id: string }[] } | null
): string {
  // Node fingerprint: id, type, and value (for factors)
  const nodeFingerprint = nodes
    .map((n) => {
      const value = (n.data as any)?.value
      return `${n.id}:${n.type}:${typeof value === 'number' ? value.toFixed(3) : 'x'}`
    })
    .sort()
    .join(',')

  // Edge fingerprint: source, target, confidence
  const edgeFingerprint = edges
    .map((e) => {
      const conf = (e.data as any)?.confidence
      return `${e.source}->${e.target}:${conf !== undefined ? conf.toFixed(3) : 'x'}`
    })
    .sort()
    .join(',')

  // CEE fingerprint: options count
  const ceeFingerprint = ceeAnalysisReady?.options?.length ?? 0

  return `n${nodes.length}|e${edges.length}|${nodeFingerprint}|${edgeFingerprint}|ar${ceeFingerprint}`
}

export function useGraphReadiness() {
  const [readiness, setReadiness] = useState<GraphReadiness | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Track last payload hash to prevent duplicate requests
  const lastPayloadHashRef = useRef<string | null>(null)
  // Guard against concurrent in-flight requests (React StrictMode double-mount)
  const fetchInFlightRef = useRef(false)
  // Track if we've logged recently to reduce noise
  const lastLogTimeRef = useRef<number>(0)
  // Rate limit backoff state
  const backoffRef = useRef<{ delay: number; until: number }>({ delay: 0, until: 0 })

  // Use shallow selectors to get stable references
  // These are used for fingerprinting, not as direct dependencies
  const nodes = useCanvasStore(useShallow((s) => s.nodes))
  const edges = useCanvasStore(useShallow((s) => s.edges))
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)

  // Create stable fingerprint
  const fingerprint = useMemo(
    () => createGraphFingerprint(nodes, edges, ceeAnalysisReady),
    [nodes, edges, ceeAnalysisReady]
  )

  // Stable callback that reads fresh state inside
  const fetchReadiness = useCallback(async () => {
    // Prevent concurrent in-flight requests (React StrictMode double-mount)
    if (fetchInFlightRef.current) return
    fetchInFlightRef.current = true

    try {
    // Check rate limit backoff
    const now = Date.now()
    if (backoffRef.current.until > now) {
      if (import.meta.env.DEV) {
        console.log(
          `[useGraphReadiness] Rate limited, waiting ${Math.ceil((backoffRef.current.until - now) / 1000)}s`
        )
      }
      return
    }

    // Read fresh state from store
    const {
      nodes: currentNodes,
      edges: currentEdges,
      graphHealth,
      ceeAnalysisReady: currentCeeAnalysisReady,
    } = useCanvasStore.getState()

    // Don't fetch if no nodes
    if (currentNodes.length === 0) {
      setReadiness({
        readiness_score: 0,
        readiness_level: 'needs_work',
        can_run_analysis: false,
        confidence_explanation: 'Add some nodes to get started',
        improvements: [],
      })
      return
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
      // Call CEE /graph-readiness endpoint
      // BFF proxy maps /bff/cee/graph-readiness → /assist/v1/graph-readiness
      // Brief 31 Task 4: CEE expects 'kind' not 'type'
      // Brief I Fix: Sanitize node data - CEE FactorData requires value to be a number
      const payload: Record<string, unknown> = {
        graph: {
          nodes: currentNodes.map((n) => {
            // CEE v2 uses 'type', CEE v3 uses 'kind' - include both for compatibility
            const nodeKind = (n.data as any)?.kind || n.type || 'factor'
            const baseNode = {
              id: n.id,
              type: nodeKind,  // CEEv2Node format
              kind: nodeKind,  // CEEv3 format
              label: (n.data as any)?.label || n.id,
            }
            // Only include data field if it has valid FactorData (value is a number)
            if (typeof (n.data as any)?.value === 'number') {
              return { ...baseNode, data: { value: (n.data as any).value } }
            }
            return baseNode
          }),
          // CEE expects 'from'/'to' not 'source'/'target'
          edges: currentEdges.map((e) => ({
            id: e.id,
            from: e.source,
            to: e.target,
            // Include edge weight/strength data in CEE format
            weight: (e.data as any)?.weight ?? 0.5,
            belief: (e.data as any)?.beliefExists ?? (e.data as any)?.belief ?? 0.7,
            effect_direction: (e.data as any)?.direction ?? 'positive',
          })),
        },
      }

      // V3: Include analysis_ready if present so CEE knows about resolved options
      // Strip model_adjustments — CEE produced them and doesn't need them back;
      // forwarding them can cause 400s if CEE rejects unrecognised adjustment types.
      if (currentCeeAnalysisReady?.options?.length) {
        const { model_adjustments: _strip, ...analysisReadyForPayload } = currentCeeAnalysisReady
        payload.analysis_ready = analysisReadyForPayload
      }

      // Create hash for deduplication
      const edgeDataFingerprint = currentEdges
        .map((e) => {
          const conf = (e.data as any)?.confidence
          return `${e.source}-${e.target}-${conf !== undefined ? conf.toFixed(3) : 'x'}`
        })
        .join(',')
      const analysisReadyFingerprint = currentCeeAnalysisReady?.options?.length ?? 0
      const payloadHash = `${currentNodes.length}-${currentEdges.length}-${currentNodes.map((n) => n.id).join(',')}-${edgeDataFingerprint}-ar${analysisReadyFingerprint}`

      if (payloadHash === lastPayloadHashRef.current) {
        // Same payload, skip request
        setLoading(false)
        return
      }
      lastPayloadHashRef.current = payloadHash

      // Rate-limited logging (max once per 5 seconds)
      const now = Date.now()
      if (import.meta.env.DEV && now - lastLogTimeRef.current > 5000) {
        console.log('[useGraphReadiness] Fetching readiness:', {
          nodes: currentNodes.length,
          edges: currentEdges.length,
          hasAnalysisReady: Boolean(currentCeeAnalysisReady?.options?.length),
        })
        // P0 DIAGNOSTIC: Log full payload structure
        console.log('[useGraphReadiness] Payload being sent:', {
          graphNodes: (payload.graph as any)?.nodes?.length,
          sampleNode: (payload.graph as any)?.nodes?.[0],
          graphEdges: (payload.graph as any)?.edges?.length,
          sampleEdge: (payload.graph as any)?.edges?.[0],
          hasAnalysisReady: 'analysis_ready' in payload,
        })
        lastLogTimeRef.current = now
      }

      const response = await fetch(`${CEE_BASE_URL}/graph-readiness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': correlationId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read response body')

        // Handle rate limiting (429) with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const backoffDelay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(
                backoffRef.current.delay > 0
                  ? backoffRef.current.delay * BACKOFF_MULTIPLIER
                  : INITIAL_BACKOFF_MS,
                MAX_BACKOFF_MS
              )

          backoffRef.current = {
            delay: backoffDelay,
            until: Date.now() + backoffDelay,
          }

          console.warn(
            `[useGraphReadiness] Rate limited (429), backing off for ${backoffDelay / 1000}s`
          )

          // Use fallback instead of throwing
          const fallback = calculateFallbackReadiness(currentNodes, currentEdges, graphHealth)
          setReadiness(fallback)
          setError('Rate limited - using local validation')
          setLoading(false)
          return
        }

        // Handle 404 (endpoint not available) silently - use local fallback
        // This happens when CEE orchestrator is disabled or endpoint doesn't exist
        if (response.status === 404) {
          if (import.meta.env.DEV) {
            console.info('[useGraphReadiness] CEE graph-readiness endpoint not available (404), using local validation')
          }
          const fallback = calculateFallbackReadiness(currentNodes, currentEdges, graphHealth)
          setReadiness(fallback)
          setLoading(false)
          return
        }

        console.error('[useGraphReadiness] CEE error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        })
        throw new Error(`HTTP ${response.status} - ${errorBody}`)
      }

      // Reset backoff on success
      backoffRef.current = { delay: 0, until: 0 }

      const data = await response.json()

      // Validate and normalize response
      const normalized: GraphReadiness = {
        readiness_score:
          typeof data.readiness_score === 'number'
            ? Math.max(0, Math.min(100, data.readiness_score))
            : 50,
        readiness_level: ['needs_work', 'fair', 'strong'].includes(data.readiness_level)
          ? data.readiness_level
          : 'fair',
        can_run_analysis:
          typeof data.can_run_analysis === 'boolean' ? data.can_run_analysis : true,
        confidence_explanation:
          typeof data.confidence_explanation === 'string'
            ? data.confidence_explanation
            : 'Analysis available',
        improvements: Array.isArray(data.improvements)
          ? data.improvements.map((imp: any) => ({
              category: imp.category || 'general',
              action: imp.action || imp.recommendation || 'Review this area',
              current_gap: imp.current_gap || '',
              quality_impact:
                typeof imp.quality_impact === 'number'
                  ? imp.quality_impact
                  : typeof imp.potential_improvement === 'number'
                    ? imp.potential_improvement
                    : 5,
              target_quality:
                typeof imp.target_quality === 'number'
                  ? imp.target_quality
                  : typeof imp.target_score === 'number'
                    ? imp.target_score
                    : 70,
              priority: ['high', 'medium', 'low'].includes(imp.priority)
                ? imp.priority
                : imp.impact || 'medium',
              effort_minutes: typeof imp.effort_minutes === 'number' ? imp.effort_minutes : 5,
              affected_nodes: Array.isArray(imp.affected_nodes)
                ? imp.affected_nodes
                : Array.isArray(imp.affected_node_ids)
                  ? imp.affected_node_ids
                  : undefined,
              affected_edges: Array.isArray(imp.affected_edges)
                ? imp.affected_edges
                : Array.isArray(imp.affected_edge_ids)
                  ? imp.affected_edge_ids
                  : undefined,
              suggested_node_type: imp.suggested_node_type || undefined,
              current_score:
                typeof imp.current_score === 'number' ? imp.current_score : undefined,
            }))
          : [],
      }

      setReadiness(normalized)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }

      console.warn('[useGraphReadiness] Fetch failed, using fallback:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')

      // Use fallback based on local graph health
      const fallback = calculateFallbackReadiness(currentNodes, currentEdges, graphHealth)
      setReadiness(fallback)
    } finally {
      setLoading(false)
    }
    } finally {
      fetchInFlightRef.current = false
    }
  }, []) // No dependencies - reads from store directly

  // Debounced fetch triggered by fingerprint changes
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
  }, [fingerprint, fetchReadiness])

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

  // Manual refresh function (stable reference)
  const refresh = useCallback(() => {
    // Clear hash to force refresh
    lastPayloadHashRef.current = null
    fetchReadiness()
  }, [fetchReadiness])

  return {
    readiness,
    loading,
    error,
    refresh,
  }
}

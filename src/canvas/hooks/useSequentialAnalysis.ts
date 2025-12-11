/**
 * useSequentialAnalysis Hook
 *
 * Detects sequential graphs and fetches stage-by-stage analysis.
 * Provides policy recommendations for multi-stage decisions.
 *
 * Flow:
 * 1. Detect if graph has sequential metadata
 * 2. Fetch sequential analysis from ISL /analysis/sequential
 * 3. Get policy explanation from CEE /explain/policy
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useCanvasStore } from '../store'
import type {
  SequentialMetadata,
  SequentialAnalysisRequest,
  SequentialAnalysisResponse,
  ExplainPolicyRequest,
  ExplainPolicyResponse,
  UseSequentialAnalysisOptions,
  UseSequentialAnalysisResult,
  DecisionStage,
  StageExplanation,
} from '../components/SequentialView/types'

const BFF_BASE_URL = (import.meta as any).env?.VITE_BFF_BASE || '/bff/engine'

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  analysis: SequentialAnalysisResponse
  explanation: ExplainPolicyResponse
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function getCacheKey(graphHash: string): string {
  return `sequential:${graphHash}`
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS
}

/**
 * Detect sequential metadata from graph structure
 */
function detectSequentialMetadata(
  nodes: Array<{ id: string; type?: string; data?: any }>,
  edges: Array<{ id: string; source: string; target: string }>
): SequentialMetadata | null {
  // Find decision nodes
  const decisionNodes = nodes.filter(n => n.type === 'decision')

  // If only one decision or none, not sequential
  if (decisionNodes.length <= 1) {
    return null
  }

  // Check if decisions are connected in a sequence
  // A sequential graph has decisions connected via edges (directly or through intermediaries)
  const stages: DecisionStage[] = []
  const visited = new Set<string>()

  // Build adjacency list
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge.target)
  }

  // Find root decision (no incoming edges from other decisions)
  let rootDecision: string | null = null
  for (const decision of decisionNodes) {
    const hasIncomingFromDecision = edges.some(e =>
      e.target === decision.id &&
      decisionNodes.some(d => d.id === e.source)
    )
    if (!hasIncomingFromDecision) {
      rootDecision = decision.id
      break
    }
  }

  if (!rootDecision) {
    // No clear root, pick first decision
    rootDecision = decisionNodes[0]?.id
  }

  // BFS to find stage order
  const queue: string[] = [rootDecision!]
  let stageIndex = 0

  while (queue.length > 0 && stageIndex < 10) { // Max 10 stages
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const node = nodes.find(n => n.id === current)
    if (node?.type === 'decision') {
      const label = (node.data as any)?.label || `Stage ${stageIndex + 1}`
      stages.push({
        index: stageIndex,
        label,
        decision_node_id: current,
        timing: stageIndex === 0 ? 'now' : stageIndex === 1 ? 'next' : 'later',
      })
      stageIndex++
    }

    // Add neighbors to queue
    const neighbors = adjacency.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor)
      }
    }
  }

  // Need at least 2 stages for sequential view
  if (stages.length < 2) {
    return null
  }

  return {
    is_sequential: true,
    stages,
    stage_count: stages.length,
    current_stage: 0,
  }
}

export function useSequentialAnalysis(
  options: UseSequentialAnalysisOptions = {}
): UseSequentialAnalysisResult {
  const { autoFetch = false, sequentialMetadata: overrideMetadata } = options

  const [analysis, setAnalysis] = useState<SequentialAnalysisResponse | null>(null)
  const [explanation, setExplanation] = useState<ExplainPolicyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchAttemptedRef = useRef(false)

  // Store selectors
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const results = useCanvasStore((s) => s.results)

  // Detect or use override metadata
  const metadata = useMemo(() => {
    if (overrideMetadata) return overrideMetadata
    return detectSequentialMetadata(nodes, edges)
  }, [nodes, edges, overrideMetadata])

  const isSequential = metadata?.is_sequential ?? false

  /**
   * Build graph hash for caching
   */
  const graphHash = useMemo(() => {
    const nodeHash = nodes.map(n => `${n.id}:${n.type}`).join('|')
    const edgeHash = edges.map(e => `${e.source}-${e.target}`).join('|')
    return `${nodeHash}::${edgeHash}`
  }, [nodes, edges])

  /**
   * Fetch sequential analysis from ISL
   */
  const fetchAnalysis = useCallback(async (
    signal: AbortSignal
  ): Promise<SequentialAnalysisResponse | null> => {
    if (!metadata) return null

    const request: SequentialAnalysisRequest = {
      graph: {
        nodes: nodes.map(n => ({
          id: n.id,
          label: (n.data as any)?.label || n.id,
          kind: n.type || 'unknown',
          stage: metadata.stages.findIndex(s => s.decision_node_id === n.id),
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
        sequential_metadata: metadata,
      },
      stages: metadata.stages,
      discount_factor: 0.95,
    }

    try {
      const response = await fetch(`${BFF_BASE_URL}/v1/analysis/sequential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
        },
        body: JSON.stringify(request),
        signal,
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[useSequentialAnalysis] ISL endpoint not available')
          return buildFallbackAnalysis(metadata)
        }
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.json()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      console.warn('[useSequentialAnalysis] Fetch failed, using fallback:', err)
      return buildFallbackAnalysis(metadata)
    }
  }, [nodes, edges, metadata])

  /**
   * Fetch policy explanation from CEE
   */
  const fetchExplanation = useCallback(async (
    analysisData: SequentialAnalysisResponse,
    signal: AbortSignal
  ): Promise<ExplainPolicyResponse | null> => {
    if (!metadata) return null

    const decisionNode = nodes.find(n => n.type === 'decision')
    const goalNode = nodes.find(n => n.type === 'goal' || n.type === 'outcome')

    const request: ExplainPolicyRequest = {
      policy: analysisData.optimal_policy,
      stages: metadata.stages,
      context: {
        decision_label: (decisionNode?.data as any)?.label || 'this decision',
        goal: (goalNode?.data as any)?.label || 'maximize outcome',
      },
    }

    try {
      const response = await fetch(`${BFF_BASE_URL}/v1/explain/policy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
        },
        body: JSON.stringify(request),
        signal,
      })

      if (!response.ok) {
        if (response.status === 404) {
          return buildFallbackExplanation(analysisData, metadata)
        }
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.json()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      return buildFallbackExplanation(analysisData, metadata)
    }
  }, [nodes, metadata])

  /**
   * Build fallback analysis when ISL is unavailable
   */
  const buildFallbackAnalysis = useCallback((
    meta: SequentialMetadata
  ): SequentialAnalysisResponse => {
    return {
      optimal_policy: {
        stages: meta.stages.map((stage, idx) => ({
          stage_index: idx,
          decision_rule: { type: 'unconditional' },
          contingent_on: idx > 0 ? [`Completion of ${meta.stages[idx - 1]?.label}`] : [],
          recommended_option: 'Proceed as planned',
          expected_value: 0,
        })),
        expected_total_value: 0,
      },
      stage_analyses: meta.stages.map((stage, idx) => ({
        stage_index: idx,
        stage_label: stage.label,
        options: [],
        sensitivity: [],
      })),
      value_of_flexibility: 0,
      sensitivity_to_timing: 'medium',
    }
  }, [])

  /**
   * Build fallback explanation when CEE is unavailable
   */
  const buildFallbackExplanation = useCallback((
    analysisData: SequentialAnalysisResponse,
    meta: SequentialMetadata
  ): ExplainPolicyResponse => {
    const stageExplanations: StageExplanation[] = meta.stages.map((stage, idx) => ({
      stage_index: idx,
      stage_label: stage.label,
      what_to_do: analysisData.optimal_policy.stages[idx]?.recommended_option || `Complete ${stage.label}`,
      what_to_observe: idx < meta.stages.length - 1
        ? `Monitor progress before moving to ${meta.stages[idx + 1]?.label}`
        : 'Evaluate final outcome',
      why_this_matters: `Stage ${idx + 1} of ${meta.stage_count} in your decision journey`,
    }))

    return {
      executive_summary: `This is a ${meta.stage_count}-stage decision. Start with ${meta.stages[0]?.label} and proceed based on outcomes.`,
      stage_explanations: stageExplanations,
      key_decision_points: meta.stages.slice(1).map((stage, idx) => ({
        trigger: stage.trigger_condition || `After completing ${meta.stages[idx]?.label}`,
        decision: `Whether to proceed to ${stage.label}`,
        stakes: idx === 0 ? 'high' : 'medium',
      })),
      flexibility_explanation: 'Sequential decisions allow you to adapt based on observed outcomes at each stage.',
    }
  }, [])

  /**
   * Main fetch function
   */
  const fetchSequentialAnalysis = useCallback(async () => {
    if (!isSequential || !metadata) {
      setError('Graph is not sequential')
      return
    }

    // Check cache
    const cacheKey = getCacheKey(graphHash)
    const cached = cache.get(cacheKey)
    if (cached && isCacheValid(cached)) {
      setAnalysis(cached.analysis)
      setExplanation(cached.explanation)
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

    try {
      // Step 1: Fetch analysis from ISL
      const analysisData = await fetchAnalysis(controller.signal)

      if (!analysisData) {
        setLoading(false)
        return
      }

      setAnalysis(analysisData)

      // Step 2: Get explanation from CEE
      const explanationData = await fetchExplanation(analysisData, controller.signal)

      if (explanationData) {
        setExplanation(explanationData)

        // Cache results
        cache.set(cacheKey, {
          analysis: analysisData,
          explanation: explanationData,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      console.error('[useSequentialAnalysis] Fetch failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze sequential decision')
    } finally {
      setLoading(false)
    }
  }, [isSequential, metadata, graphHash, fetchAnalysis, fetchExplanation])

  // Auto-fetch when enabled
  useEffect(() => {
    if (!autoFetch || fetchAttemptedRef.current || !isSequential) return
    if (!results?.report || loading) return

    fetchAttemptedRef.current = true

    const timer = setTimeout(() => {
      fetchSequentialAnalysis()
    }, 1500) // Delay to let other components load first

    return () => clearTimeout(timer)
  }, [autoFetch, isSequential, results?.report, loading, fetchSequentialAnalysis])

  // Reset on graph change
  useEffect(() => {
    fetchAttemptedRef.current = false
  }, [graphHash])

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    analysis,
    explanation,
    isSequential,
    metadata,
    loading,
    error,
    fetch: fetchSequentialAnalysis,
  }
}

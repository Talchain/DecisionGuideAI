/**
 * useGraphReadiness Hook
 * Fetches pre-analysis health assessment from CEE /graph-readiness endpoint
 *
 * Returns quality tier, improvements list, and analysis eligibility
 *
 * CENTRALISED: This hook reads from the Zustand store to prevent duplicate fetches.
 * Multiple components can call this hook and they all share the same state.
 */

import { useEffect, useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'

// Debounce delay for graph changes (ms)
const DEBOUNCE_DELAY = 800

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

export function useGraphReadiness() {
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Store selectors - all consumers share the same state
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const readiness = useCanvasStore(s => s.graphReadinessData)
  const loading = useCanvasStore(s => s.graphReadinessLoading)
  const error = useCanvasStore(s => s.graphReadinessError)
  const fetchGraphReadiness = useCanvasStore(s => s.fetchGraphReadiness)

  // Debounced fetch on graph changes
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchGraphReadiness()
    }, DEBOUNCE_DELAY)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [nodes, edges, fetchGraphReadiness])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Manual refresh function (bypasses debounce)
  const refresh = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    fetchGraphReadiness()
  }, [fetchGraphReadiness])

  return {
    readiness,
    loading,
    error,
    refresh,
  }
}

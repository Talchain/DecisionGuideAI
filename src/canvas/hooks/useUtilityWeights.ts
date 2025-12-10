/**
 * useUtilityWeights - Manage utility weights for outcome nodes
 *
 * Features:
 * - Fetch AI-suggested weights from CEE
 * - Manual weight editing with normalization
 * - Alternative weighting presets
 * - Persist weights to canvas store
 */

import { useState, useCallback, useMemo } from 'react'
import { httpV1Adapter } from '../../adapters/plot/httpV1Adapter'
import type {
  UtilityWeightResponse,
  UtilityWeightSuggestion,
  WeightingPreset,
} from '../../adapters/plot/types'

interface OutcomeNode {
  id: string
  label: string
}

interface WeightEntry {
  node_id: string
  label: string
  weight: number // 0-1, normalized
  reasoning?: string // From AI suggestion
}

interface UseUtilityWeightsOptions {
  /** Outcome nodes to weight */
  outcomeNodes: OutcomeNode[]
  /** Graph context for AI suggestions */
  graph?: {
    nodes: Array<{ id: string; type?: string; label?: string }>
    edges: Array<{ source: string; target: string }>
  }
  /** Optional user goal for context */
  userGoal?: string
  /** Optional scenario name */
  scenarioName?: string
  /** Initial weights (if previously set) */
  initialWeights?: Record<string, number>
  /** Called when weights change */
  onWeightsChange?: (weights: Record<string, number>) => void
}

interface UseUtilityWeightsResult {
  /** Current weight entries */
  weights: WeightEntry[]
  /** Whether weights are loading from AI */
  loading: boolean
  /** Error message if suggestion failed */
  error: string | null
  /** AI suggestion response (when available) */
  suggestion: UtilityWeightResponse | null
  /** Alternative preset weightings */
  alternatives: WeightingPreset[]
  /** Whether weights sum to 100% */
  isNormalized: boolean
  /** Total weight sum (should be 1.0) */
  totalWeight: number
  /** Request AI-suggested weights */
  suggestWeights: () => Promise<void>
  /** Update a single weight */
  updateWeight: (nodeId: string, weight: number) => void
  /** Apply AI suggestions */
  applySuggestions: () => void
  /** Apply a preset weighting */
  applyPreset: (preset: WeightingPreset) => void
  /** Normalize weights to sum to 1.0 */
  normalizeWeights: () => void
  /** Reset to equal weights */
  resetToEqual: () => void
}

export function useUtilityWeights({
  outcomeNodes,
  graph,
  userGoal,
  scenarioName,
  initialWeights,
  onWeightsChange,
}: UseUtilityWeightsOptions): UseUtilityWeightsResult {
  // Initialize with equal weights or provided initial weights
  const [weights, setWeights] = useState<WeightEntry[]>(() => {
    const equalWeight = outcomeNodes.length > 0 ? 1 / outcomeNodes.length : 0
    return outcomeNodes.map(node => ({
      node_id: node.id,
      label: node.label,
      weight: initialWeights?.[node.id] ?? equalWeight,
      reasoning: undefined,
    }))
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<UtilityWeightResponse | null>(null)

  // Calculate total weight and normalization status
  const totalWeight = useMemo(
    () => weights.reduce((sum, w) => sum + w.weight, 0),
    [weights]
  )
  const isNormalized = useMemo(
    () => Math.abs(totalWeight - 1) < 0.01, // Within 1% tolerance
    [totalWeight]
  )

  // Extract alternatives from suggestion
  const alternatives = useMemo(
    () => suggestion?.alternatives ?? [],
    [suggestion?.alternatives]
  )

  // Notify parent of weight changes
  const notifyChange = useCallback((newWeights: WeightEntry[]) => {
    if (onWeightsChange) {
      const weightMap: Record<string, number> = {}
      newWeights.forEach(w => {
        weightMap[w.node_id] = w.weight
      })
      onWeightsChange(weightMap)
    }
  }, [onWeightsChange])

  // Request AI-suggested weights
  const suggestWeights = useCallback(async () => {
    if (!graph || outcomeNodes.length === 0) {
      setError('Cannot suggest weights without graph context')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await httpV1Adapter.suggestUtilityWeights({
        graph,
        outcome_node_ids: outcomeNodes.map(n => n.id),
        user_goal: userGoal,
        scenario_name: scenarioName,
      })

      setSuggestion(response)
    } catch (err: any) {
      const errorMessage = err?.error || err?.message || 'Failed to get weight suggestions'
      setError(errorMessage)
      setSuggestion(null)

      if (import.meta.env.DEV) {
        console.warn('[useUtilityWeights] Failed to suggest weights:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [graph, outcomeNodes, userGoal, scenarioName])

  // Update a single weight
  const updateWeight = useCallback((nodeId: string, weight: number) => {
    setWeights(prev => {
      const updated = prev.map(w =>
        w.node_id === nodeId
          ? { ...w, weight: Math.max(0, Math.min(1, weight)) }
          : w
      )
      notifyChange(updated)
      return updated
    })
    // Clear suggestion when manually editing
    setSuggestion(null)
  }, [notifyChange])

  // Apply AI suggestions
  const applySuggestions = useCallback(() => {
    if (!suggestion?.suggestions) return

    setWeights(prev => {
      const updated = prev.map(w => {
        const suggested = suggestion.suggestions.find(s => s.node_id === w.node_id)
        return suggested
          ? { ...w, weight: suggested.suggested_weight, reasoning: suggested.reasoning }
          : w
      })
      notifyChange(updated)
      return updated
    })
  }, [suggestion, notifyChange])

  // Apply a preset weighting
  const applyPreset = useCallback((preset: WeightingPreset) => {
    setWeights(prev => {
      const updated = prev.map(w => ({
        ...w,
        weight: preset.weights[w.node_id] ?? w.weight,
        reasoning: undefined,
      }))
      notifyChange(updated)
      return updated
    })
    setSuggestion(null)
  }, [notifyChange])

  // Normalize weights to sum to 1.0
  const normalizeWeights = useCallback(() => {
    if (totalWeight === 0) return

    setWeights(prev => {
      const updated = prev.map(w => ({
        ...w,
        weight: w.weight / totalWeight,
      }))
      notifyChange(updated)
      return updated
    })
  }, [totalWeight, notifyChange])

  // Reset to equal weights
  const resetToEqual = useCallback(() => {
    const equalWeight = outcomeNodes.length > 0 ? 1 / outcomeNodes.length : 0
    setWeights(prev => {
      const updated = prev.map(w => ({
        ...w,
        weight: equalWeight,
        reasoning: undefined,
      }))
      notifyChange(updated)
      return updated
    })
    setSuggestion(null)
  }, [outcomeNodes.length, notifyChange])

  return {
    weights,
    loading,
    error,
    suggestion,
    alternatives,
    isNormalized,
    totalWeight,
    suggestWeights,
    updateWeight,
    applySuggestions,
    applyPreset,
    normalizeWeights,
    resetToEqual,
  }
}

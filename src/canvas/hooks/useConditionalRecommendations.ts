/**
 * useConditionalRecommendations Hook
 *
 * Fetches conditional recommendations from ISL and narrates them via CEE.
 * Provides "when to reconsider" guidance for the RecommendationCard.
 *
 * Flow:
 * 1. Fetch conditional recommendations from ISL /analysis/conditional-recommend
 * 2. Narrate conditions via CEE /narrate/conditions
 * 3. Return combined data for display
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../store'
import type {
  ConditionalRecommendRequest,
  ConditionalRecommendResponse,
  NarrateConditionsRequest,
  NarrateConditionsResponse,
  UseConditionalRecommendationsOptions,
  UseConditionalRecommendationsResult,
  RankedOption,
  NarratedCondition,
} from '../components/ConditionalGuidance/types'

const BFF_BASE_URL = (import.meta as any).env?.VITE_BFF_BASE || '/bff/engine'

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  conditions: ConditionalRecommendResponse
  narrated: NarrateConditionsResponse
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function getCacheKey(runId: string, responseHash?: string): string {
  return `conditional:${runId}:${responseHash || 'no-hash'}`
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS
}

export function useConditionalRecommendations(
  options: UseConditionalRecommendationsOptions = {}
): UseConditionalRecommendationsResult {
  const {
    runId,
    responseHash,
    autoFetch = false,
    maxConditions = 5,
  } = options

  const [conditions, setConditions] = useState<ConditionalRecommendResponse | null>(null)
  const [narratedConditions, setNarratedConditions] = useState<NarrateConditionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchAttemptedRef = useRef(false)

  // Store selectors
  const nodes = useCanvasStore((s) => s.nodes)
  const results = useCanvasStore((s) => s.results)
  const comparisonMode = useCanvasStore((s) => s.comparisonMode)

  /**
   * Build ranked options from comparison or current analysis
   */
  const buildRankedOptions = useCallback((): RankedOption[] => {
    if (comparisonMode?.comparison?.ranking) {
      return comparisonMode.comparison.ranking.map((r, idx) => ({
        option_id: r.optionId || `option-${idx}`,
        option_label: r.label || `Option ${idx + 1}`,
        rank: r.rank,
        expected_value: r.expectedValue || 0,
        confidence: r.confidence || 'medium',
      }))
    }

    const optionNodes = nodes.filter((n) => n.type === 'option')
    return optionNodes.map((n, idx) => ({
      option_id: n.id,
      option_label: (n.data as any)?.label || `Option ${idx + 1}`,
      rank: idx + 1,
      expected_value: results?.report?.results?.likely || 0,
      confidence: (results?.report?.confidence?.level || 'medium') as 'high' | 'medium' | 'low',
    }))
  }, [comparisonMode, nodes, results])

  /**
   * Fetch conditional recommendations from ISL
   */
  const fetchConditions = useCallback(async (
    effectiveRunId: string,
    rankedOptions: RankedOption[],
    signal: AbortSignal
  ): Promise<ConditionalRecommendResponse | null> => {
    const request: ConditionalRecommendRequest = {
      run_id: effectiveRunId,
      ranked_options: rankedOptions,
      condition_types: ['threshold', 'dominance', 'risk_profile'],
      max_conditions: maxConditions,
    }

    try {
      const response = await fetch(`${BFF_BASE_URL}/v1/analysis/conditional-recommend`, {
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
          console.warn('[useConditionalRecommendations] ISL endpoint not available')
          return null
        }
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.json()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      throw err
    }
  }, [maxConditions])

  /**
   * Narrate conditions via CEE
   */
  const narrateConditions = useCallback(async (
    conditionsData: ConditionalRecommendResponse,
    signal: AbortSignal
  ): Promise<NarrateConditionsResponse | null> => {
    // Get decision context from graph
    const decisionNode = nodes.find((n) => n.type === 'decision')
    const decisionLabel = (decisionNode?.data as any)?.label || 'this decision'

    const request: NarrateConditionsRequest = {
      conditions: conditionsData.conditional_recommendations,
      context: {
        decision_label: decisionLabel,
        primary_recommendation: conditionsData.primary_recommendation.option_label,
      },
    }

    try {
      const response = await fetch(`${BFF_BASE_URL}/v1/narrate/conditions`, {
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
          // CEE endpoint not available - build fallback narration
          return buildFallbackNarration(conditionsData)
        }
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.json()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      // On error, use fallback
      return buildFallbackNarration(conditionsData)
    }
  }, [nodes])

  /**
   * Build fallback narration when CEE is unavailable
   */
  const buildFallbackNarration = useCallback((
    conditionsData: ConditionalRecommendResponse
  ): NarrateConditionsResponse => {
    const narrated: NarratedCondition[] = conditionsData.conditional_recommendations.map((cond) => {
      const condExpr = cond.condition_expression

      // Build if statement from condition expression
      let ifStatement = condExpr.description || 'If conditions change'
      if (condExpr.type === 'threshold' && condExpr.variable && condExpr.operator && condExpr.value !== undefined) {
        const opText = {
          '<': 'drops below',
          '>': 'rises above',
          '<=': 'is at or below',
          '>=': 'is at or above',
          '=': 'equals',
        }[condExpr.operator] || condExpr.operator
        ifStatement = `If ${condExpr.variable} ${opText} ${condExpr.value}`
      }

      // Build likelihood text
      let likelihood: string | undefined
      if (cond.probability_of_condition !== undefined) {
        const pct = Math.round(cond.probability_of_condition * 100)
        const level = pct >= 50 ? 'High' : pct >= 20 ? 'Moderate' : 'Low'
        likelihood = `${level} likelihood (${pct}%)`
      }

      return {
        if_statement: ifStatement,
        then_statement: `Consider ${cond.triggered_recommendation.option_label} instead`,
        because_statement: 'The relative outcomes would shift',
        likelihood,
        impact: cond.impact_magnitude,
        original_condition: cond,
      }
    })

    // Build robustness statement
    const robustnessLevel = conditionsData.robustness_summary.level
    const robustnessText = {
      high: 'The recommendation is robust and unlikely to change under most scenarios.',
      medium: 'The recommendation is moderately robust. A few scenarios could change the best option.',
      low: 'The recommendation is sensitive to assumptions. Several scenarios could change the outcome.',
    }[robustnessLevel]

    return {
      robustness_statement: robustnessText,
      conditions: narrated,
    }
  }, [])

  /**
   * Main fetch function
   */
  const fetchConditionalRecommendations = useCallback(async () => {
    const effectiveRunId = runId || results?.runId
    if (!effectiveRunId) {
      setError('No run ID available')
      return
    }

    // Check cache
    const cacheKey = getCacheKey(effectiveRunId, responseHash)
    const cached = cache.get(cacheKey)
    if (cached && isCacheValid(cached)) {
      setConditions(cached.conditions)
      setNarratedConditions(cached.narrated)
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
      const rankedOptions = buildRankedOptions()
      if (rankedOptions.length === 0) {
        setError('No options available for analysis')
        setLoading(false)
        return
      }

      // Step 1: Fetch conditions from ISL
      const conditionsData = await fetchConditions(effectiveRunId, rankedOptions, controller.signal)

      if (!conditionsData) {
        // ISL unavailable - use graceful degradation
        setConditions(null)
        setNarratedConditions(null)
        setLoading(false)
        return
      }

      setConditions(conditionsData)

      // Step 2: Narrate via CEE
      const narratedData = await narrateConditions(conditionsData, controller.signal)

      if (narratedData) {
        setNarratedConditions(narratedData)

        // Cache the result
        cache.set(cacheKey, {
          conditions: conditionsData,
          narrated: narratedData,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      console.error('[useConditionalRecommendations] Fetch failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch conditions')
    } finally {
      setLoading(false)
    }
  }, [runId, responseHash, results, buildRankedOptions, fetchConditions, narrateConditions])

  /**
   * Clear cached data
   */
  const clear = useCallback(() => {
    setConditions(null)
    setNarratedConditions(null)
    setError(null)
    fetchAttemptedRef.current = false
  }, [])

  // Auto-fetch when enabled
  useEffect(() => {
    if (!autoFetch || fetchAttemptedRef.current) return
    if (!results?.report || loading) return

    fetchAttemptedRef.current = true

    // Delay to let recommendation card load first
    const timer = setTimeout(() => {
      fetchConditionalRecommendations()
    }, 1000)

    return () => clearTimeout(timer)
  }, [autoFetch, results?.report, loading, fetchConditionalRecommendations])

  // Reset on run change
  useEffect(() => {
    if (runId) {
      fetchAttemptedRef.current = false
    }
  }, [runId])

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    conditions,
    narratedConditions,
    loading,
    error,
    fetch: fetchConditionalRecommendations,
    clear,
  }
}

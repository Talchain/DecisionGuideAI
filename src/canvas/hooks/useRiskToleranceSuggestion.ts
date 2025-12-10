/**
 * useRiskToleranceSuggestion - Fetch CEE suggestion for risk tolerance
 *
 * Calls the CEE elicitation endpoint to get an AI-suggested risk profile
 * based on decision context and graph characteristics.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { httpV1Adapter } from '../../adapters/plot/httpV1Adapter'
import type { RiskProfile, RiskProfilePreset } from '../../adapters/plot/types'

export interface RiskToleranceSuggestion {
  /** Suggested risk profile */
  profile: RiskProfile
  /** Confidence in the suggestion */
  confidence: 'high' | 'medium' | 'low'
  /** Explanation for the suggestion */
  rationale: string
  /** Source attribution */
  provenance: 'cee'
  /** Whether clarification is needed */
  needs_clarification?: boolean
  /** Clarifying question if needed */
  clarifying_question?: string
  /** Options for clarification */
  options?: Array<{ label: string; value: RiskProfilePreset }>
}

interface UseRiskToleranceSuggestionOptions {
  /** Decision context for better calibration */
  context?: {
    decision_domain?: string
    time_horizon?: 'short' | 'medium' | 'long'
    stakes?: 'low' | 'medium' | 'high'
  }
  /** Auto-fetch on mount (default: false) */
  autoFetch?: boolean
  /** Current profile (skip suggestion if already set) */
  currentProfile?: RiskProfile | null
}

interface UseRiskToleranceSuggestionResult {
  /** The suggestion if available */
  suggestion: RiskToleranceSuggestion | null
  /** Loading state */
  loading: boolean
  /** Error message if request failed */
  error: string | null
  /** Manual fetch function */
  fetchSuggestion: () => Promise<void>
  /** Clear current suggestion */
  clearSuggestion: () => void
}

// Simple in-memory cache for suggestions (keyed by context hash)
const suggestionCache = new Map<string, RiskToleranceSuggestion>()

function getContextHash(context?: UseRiskToleranceSuggestionOptions['context']): string {
  if (!context) return 'default'
  return `${context.decision_domain || ''}-${context.time_horizon || ''}-${context.stakes || ''}`
}

export function useRiskToleranceSuggestion({
  context,
  autoFetch = false,
  currentProfile,
}: UseRiskToleranceSuggestionOptions = {}): UseRiskToleranceSuggestionResult {
  const [suggestion, setSuggestion] = useState<RiskToleranceSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track if we've already fetched
  const hasFetchedRef = useRef(false)

  const fetchSuggestion = useCallback(async () => {
    // Don't fetch if profile is already set
    if (currentProfile) {
      return
    }

    // Check cache first
    const cacheKey = getContextHash(context)
    const cached = suggestionCache.get(cacheKey)
    if (cached) {
      setSuggestion(cached)
      return
    }

    // Prevent duplicate fetches
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      // Try to get a suggested profile based on context
      // This uses the questionnaire endpoint in a special "suggest" mode
      const response = await httpV1Adapter.getRiskProfileFromPreset('neutral', context)

      // Build suggestion from response
      const result: RiskToleranceSuggestion = {
        profile: response.profile,
        confidence: response.profile.confidence,
        rationale: response.profile.reasoning || 'Based on decision context analysis',
        provenance: 'cee',
        // Add clarification if confidence is low
        needs_clarification: response.profile.confidence === 'low',
        clarifying_question: response.profile.confidence === 'low'
          ? 'Which best describes your approach to this decision?'
          : undefined,
        options: response.profile.confidence === 'low'
          ? [
              { label: 'Play it safe', value: 'risk_averse' },
              { label: 'Balance risk and reward', value: 'neutral' },
              { label: 'Go for upside', value: 'risk_seeking' },
            ]
          : undefined,
      }

      // Cache the result
      suggestionCache.set(cacheKey, result)
      setSuggestion(result)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch risk tolerance suggestion'
      setError(errorMessage)

      // Generate fallback suggestion
      const fallback = generateFallbackSuggestion(context)
      setSuggestion(fallback)

      if (import.meta.env.DEV) {
        console.warn('[useRiskToleranceSuggestion] Using fallback:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [context, currentProfile, loading])

  const clearSuggestion = useCallback(() => {
    setSuggestion(null)
    setError(null)
    hasFetchedRef.current = false
  }, [])

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && !hasFetchedRef.current && !currentProfile) {
      hasFetchedRef.current = true
      fetchSuggestion()
    }
  }, [autoFetch, fetchSuggestion, currentProfile])

  return {
    suggestion,
    loading,
    error,
    fetchSuggestion,
    clearSuggestion,
  }
}

/**
 * Generate a fallback suggestion based on context
 * Used when CEE endpoint is unavailable or errors
 */
function generateFallbackSuggestion(
  context?: UseRiskToleranceSuggestionOptions['context']
): RiskToleranceSuggestion {
  // Heuristic-based suggestion based on context
  let suggestedPreset: RiskProfilePreset = 'neutral'
  let rationale = 'A balanced approach is recommended for most decisions'

  if (context?.stakes === 'high') {
    suggestedPreset = 'risk_averse'
    rationale = 'High-stakes decisions typically warrant a cautious approach'
  } else if (context?.stakes === 'low' && context.time_horizon === 'long') {
    suggestedPreset = 'risk_seeking'
    rationale = 'Low-stakes decisions with long horizons can afford more risk'
  } else if (context?.time_horizon === 'short') {
    suggestedPreset = 'risk_averse'
    rationale = 'Short time horizons leave less room for recovery from adverse outcomes'
  }

  const PRESET_CONFIG: Record<RiskProfilePreset, { label: string; score: number }> = {
    risk_averse: { label: 'Risk Averse', score: 0.2 },
    neutral: { label: 'Neutral', score: 0.5 },
    risk_seeking: { label: 'Risk Seeking', score: 0.8 },
  }

  const config = PRESET_CONFIG[suggestedPreset]

  return {
    profile: {
      profile: suggestedPreset,
      label: config.label,
      score: config.score,
      confidence: 'low', // Low confidence for fallback
      reasoning: rationale,
    },
    confidence: 'low',
    rationale,
    provenance: 'cee',
    needs_clarification: true,
    clarifying_question: 'Which best describes your approach to this decision?',
    options: [
      { label: 'Play it safe', value: 'risk_averse' },
      { label: 'Balance risk and reward', value: 'neutral' },
      { label: 'Go for upside', value: 'risk_seeking' },
    ],
  }
}

/**
 * Clear the suggestion cache (useful for testing)
 */
export function clearRiskToleranceSuggestionCache(): void {
  suggestionCache.clear()
}

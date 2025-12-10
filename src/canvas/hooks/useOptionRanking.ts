/**
 * useOptionRanking - Extract ranking data from comparison results
 *
 * Provides RankingData for DecisionSummary component when
 * comparison mode is active with API results.
 *
 * Sources ranking from:
 * 1. comparisonMode.apiResponse.recommended_scenario (ISL compare)
 * 2. Calculated from outcome_predictions if no explicit winner
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import type { RankingData } from '../components/DecisionSummary'

interface OutcomePredictions {
  [key: string]: number
}

interface ScenarioData {
  id: string
  name: string
  outcome_predictions: OutcomePredictions
}

/**
 * Hook to compute ranking data from comparison results
 */
export function useOptionRanking(): RankingData | null {
  const comparisonMode = useCanvasStore(s => s.comparisonMode)

  return useMemo(() => {
    // Only compute when comparison mode is active
    if (!comparisonMode.active) {
      return null
    }

    const { apiResponse, scenarioA, scenarioB } = comparisonMode

    // Fallback: If no API response but we're in comparison mode with 2 scenarios,
    // show basic "comparing N options" badge using scenario labels
    if (!apiResponse) {
      // Need at least scenario labels to show anything
      if (!scenarioA?.label || !scenarioB?.label) {
        return null
      }

      return {
        rank: 1, // Assume current is first (displayed scenario)
        totalOptions: 2,
        marginPct: undefined, // No comparison data available
        confidence: 'medium' as const, // Unknown confidence without API
        winnerName: undefined, // Unknown without predictions
        currentOptionName: scenarioA.label,
      }
    }

    const baseScenario = apiResponse.base_scenario as ScenarioData | undefined
    const alternatives = (apiResponse.alternative_scenarios || []) as ScenarioData[]
    const recommendedId = (apiResponse as { recommended_scenario?: string }).recommended_scenario

    // Combine all scenarios for ranking
    const allScenarios: ScenarioData[] = []
    if (baseScenario) {
      allScenarios.push(baseScenario)
    }
    allScenarios.push(...alternatives)

    if (allScenarios.length === 0) {
      // Fallback to basic badge with scenario count
      if (scenarioA?.label && scenarioB?.label) {
        return {
          rank: 1,
          totalOptions: 2,
          marginPct: undefined,
          confidence: 'medium' as const,
          winnerName: undefined,
          currentOptionName: scenarioA.label,
        }
      }
      return null
    }

    // Get the primary outcome prediction for each scenario
    // Use the first outcome prediction as the ranking metric
    const getOutcomeValue = (scenario: ScenarioData): number => {
      const predictions = scenario.outcome_predictions
      if (!predictions) return 0
      const keys = Object.keys(predictions)
      if (keys.length === 0) return 0
      return predictions[keys[0]] ?? 0
    }

    // Sort scenarios by outcome (higher is better)
    const ranked = [...allScenarios]
      .map(s => ({ ...s, value: getOutcomeValue(s) }))
      .sort((a, b) => b.value - a.value)

    const winner = ranked[0]
    const runnerUp = ranked[1]

    // Calculate margin as percentage
    let marginPct: number | undefined
    if (winner && runnerUp && runnerUp.value > 0) {
      marginPct = ((winner.value - runnerUp.value) / runnerUp.value) * 100
    } else if (winner && runnerUp) {
      marginPct = winner.value - runnerUp.value
    }

    // Determine confidence based on margin
    // Close margins = low confidence in ranking
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    if (marginPct !== undefined) {
      if (Math.abs(marginPct) < 5) {
        confidence = 'low' // Very close
      } else if (Math.abs(marginPct) > 15) {
        confidence = 'high' // Clear winner
      }
    }

    // Determine current scenario being viewed (use scenarioA label as default)
    const currentOptionName = scenarioA?.label || baseScenario?.name || 'Current'

    // Determine if current view is the winner
    const currentIsWinner =
      recommendedId === baseScenario?.id ||
      scenarioA?.label === winner.name ||
      currentOptionName === winner.name

    return {
      rank: currentIsWinner ? 1 : 2,
      totalOptions: allScenarios.length,
      marginPct: currentIsWinner ? marginPct : undefined,
      confidence,
      winnerName: winner.name,
      currentOptionName,
    }
  }, [comparisonMode])
}

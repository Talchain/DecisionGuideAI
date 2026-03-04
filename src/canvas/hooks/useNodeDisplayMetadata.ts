/**
 * Hook to provide node display metadata from analysis results
 * Decision Graph Display v2: Tasks 5, 8, 10
 *
 * Returns Results-mode specific display data:
 * - Factor sensitivity rank (#1-3)
 * - Outcome/Goal achievement probability
 * - Win rate
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import type { NodeType } from '../domain/nodes'

interface NodeDisplayMetadata {
  /** Factor sensitivity rank (1-3 for top factors, null otherwise) */
  sensitivityRank: number | null
  /** Factor influence score (0-1, normalized) - Task 3 */
  influence: number | null
  /** Factor confidence score (0-1) - Task 3 */
  confidence: number | null
  /** Whether this factor was found in the sensitivity analysis (false for root nodes like "Value") */
  inSensitivityAnalysis: boolean
  /** Outcome/Goal achievement probability (0-1) */
  achievementProbability: number | null
  /** Recommendation stability (0-1) - fallback for Goal nodes when probability unavailable */
  stabilityPercentage: number | null
  /** Win rate for options (0-1) */
  winRate: number | null
  /** Whether we're in Results mode */
  isResultsMode: boolean
}

/**
 * Get display metadata for a node from analysis results
 * Only returns meaningful data when results.status === 'complete'
 *
 * @param nodeId - Node ID to get metadata for
 * @param nodeType - Node type (for filtering relevant data)
 * @returns Display metadata object
 */
export function useNodeDisplayMetadata(
  nodeId: string,
  nodeType: NodeType
): NodeDisplayMetadata {
  const resultsStatus = useCanvasStore(state => state.results.status)
  const report = useCanvasStore(state => state.results.report)

  const isResultsMode = resultsStatus === 'complete'

  return useMemo(() => {
    if (!isResultsMode || !report) {
      return {
        sensitivityRank: null,
        influence: null,
        confidence: null,
        inSensitivityAnalysis: false,
        achievementProbability: null,
        stabilityPercentage: null,
        winRate: null,
        isResultsMode: false,
      }
    }

    // Task 5 & 3: Factor sensitivity rank (top 3 only) and influence/confidence
    let sensitivityRank: number | null = null
    let influence: number | null = null
    let confidence: number | null = null
    let inSensitivityAnalysis = false
    if (nodeType === 'factor') {
      // Get factor_sensitivity array and rank by elasticity
      const factorSensitivity = report.enrichment?.sensitivity_analysis?.factors ||
                               report.factor_sensitivity ||
                               []

      // Sort by elasticity descending
      const ranked = [...factorSensitivity]
        .map((f: any) => ({
          id: f.factor_id || f.factorId || f.node_id || f.nodeId,
          elasticity: Math.abs(f.elasticity ?? f.sensitivity_score ?? f.importance_score ?? 0),
        }))
        .sort((a, b) => {
          // Sort by elasticity descending
          if (b.elasticity !== a.elasticity) {
            return b.elasticity - a.elasticity
          }
          // Tie-breaker: node_id alphabetically
          return a.id.localeCompare(b.id)
        })

      // Find this node's rank (1-indexed)
      const rank = ranked.findIndex(f => f.id === nodeId) + 1
      sensitivityRank = rank > 0 && rank <= 3 ? rank : null

      // Task 3: Extract influence and confidence for this factor
      const factorData = factorSensitivity.find((f: any) =>
        (f.factor_id || f.factorId || f.node_id || f.nodeId) === nodeId
      )

      if (factorData) {
        // Factor found in sensitivity analysis
        inSensitivityAnalysis = true

        // Influence: Use influence_score if available, otherwise normalize elasticity
        const rawInfluence = factorData.influence_score ??
                            factorData.influenceScore ??
                            factorData.elasticity ??
                            factorData.sensitivity_score ??
                            factorData.importance_score

        if (typeof rawInfluence === 'number') {
          // If already 0-1 (influence_score), use directly; otherwise it's elasticity (needs normalization)
          if (rawInfluence >= 0 && rawInfluence <= 1) {
            influence = rawInfluence
          } else if (ranked.length > 0 && ranked[0].elasticity > 0) {
            // Normalize against max elasticity
            influence = Math.abs(rawInfluence) / ranked[0].elasticity
          }
        }

        // Confidence: Direct extraction (already 0-1)
        // Note: Intentionally NOT using value_of_information as fallback - VOI is semantically
        // different from confidence (it measures value of learning more, not certainty)
        const rawConfidence = factorData.confidence

        if (typeof rawConfidence === 'number' && rawConfidence >= 0 && rawConfidence <= 1) {
          confidence = rawConfidence
        }
      }
    }

    // Task 8 & 10: Outcome/Goal achievement probability
    // Read from option_probabilities (the field the responseMapper actually populates)
    let achievementProbability: number | null = null
    let stabilityPercentage: number | null = null

    if (nodeType === 'outcome' || nodeType === 'goal') {
      const optionProbabilities = report.option_probabilities ?? {}
      // Get the recommended option from robustness
      const recommendedOptionId = report.robustness?.recommended_option_id ??
                                  report.robustness?.recommendedOptionId

      if (recommendedOptionId) {
        const rec = optionProbabilities[recommendedOptionId]
        if (rec) {
          achievementProbability = rec.goal_probability ?? null
        }
      }

      // Task B: Fallback for Goal nodes - use recommendation_stability if probability unavailable
      if (nodeType === 'goal' && achievementProbability === null && report.robustness) {
        const stability = report.robustness.recommendation_stability ??
                         report.robustness.recommendationStability
        if (typeof stability === 'number') {
          stabilityPercentage = stability
        }
      }
    }

    // Task 8: Win rate for options
    // Read from option_probabilities[nodeId].win_probability — that's where the mapper puts it
    let winRate: number | null = null
    if (nodeType === 'option') {
      const optionProbabilities = report.option_probabilities ?? {}
      const optionData = optionProbabilities[nodeId]
      if (optionData) {
        winRate = optionData.win_probability ?? null
      }
    }

    return {
      sensitivityRank,
      influence,
      confidence,
      inSensitivityAnalysis,
      achievementProbability,
      stabilityPercentage,
      winRate,
      isResultsMode: true,
    }
  }, [isResultsMode, report, nodeId, nodeType])
}

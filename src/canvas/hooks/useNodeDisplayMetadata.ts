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
import { selectDriverDisplayModel, compareByDisplayModel } from '../../components/results/driverDisplayModel'

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
  /**
   * Display-honesty (ROADMAP 1.6b follow-up, claim-integrity): true ONLY
   * when `achievementProbability` above IS the joint-goal figure (mirrors
   * the hook's own `hasConstraints && jointProb != null` branch that
   * selects it, exactly as OptionCards' `goalFitIsModelledBasis` mirrors
   * useResultsSectionData.ts's branches) AND the producer marked it as
   * scored from a modelled outcome distribution
   * (`goal_fit_basis.scored_from === 'modelled_outcome_distribution'`).
   * Never inferred, never applied to the unconstrained goal_probability.
   */
  achievementProbabilityIsModelledBasis: boolean
  /** Recommendation stability (0-1) - fallback for Goal nodes when probability unavailable */
  stabilityPercentage: number | null
  /** Win rate for options (0-1) */
  winRate: number | null
  /**
   * Predicted outcome range (post-analysis, outcome nodes only).
   * Currently null — PLoT does not provide per-outcome distributions.
   * Gated on per-node data; re-enable when PLoT adds per-outcome distributions.
   */
  predictedOutcome: { mean: number | null; p10: number | null; p90: number | null } | null
  /** Value of information score (0-1), post-analysis factor nodes only */
  valueOfInformation: number | null
  /** VoI rank (1-3 for top factors by VoI, null otherwise) */
  voiRank: number | null
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
        achievementProbabilityIsModelledBasis: false,
        stabilityPercentage: null,
        winRate: null,
        predictedOutcome: null,
        valueOfInformation: null,
        voiRank: null,
        isResultsMode: false,
      }
    }

    // Task 5 & 3: Factor sensitivity rank (top 3 only) and influence/confidence
    let sensitivityRank: number | null = null
    let influence: number | null = null
    let confidence: number | null = null
    let inSensitivityAnalysis = false
    let valueOfInformation: number | null = null
    let voiRank: number | null = null
    if (nodeType === 'factor') {
      // Codex B2: rank off the CERTIFIED factor_sensitivity array first (the
      // untyped enrichment passthrough is a fallback only — it must never
      // silently drive a different #1 than the panel), and rank by the
      // DISPLAYED influence metric so the badge order matches the "I: NN%"
      // readout beside it. Codex R3-B1: complete-metric-set policy — producer
      // influence_score is used only when EVERY factor in the array carries
      // one; under partial coverage every factor uses per-array-normalised
      // elasticity, so ranks never compare producer scores against fallbacks.
      // Mirrors the identical policy in useResultsSectionData (panel side).
      const factorSensitivity = (report.factor_sensitivity?.length
        ? report.factor_sensitivity
        : report.enrichment?.sensitivity_analysis?.factors) || []

      // Codex R3-B1: display value + rank come from the ONE shared policy
      // (driverDisplayModel), so the badge can never rank or label a factor
      // on a different basis than the results Drivers panel. Producer
      // influence_score only when EVERY factor has one; else per-set
      // normalised |elasticity| for all.
      const displayEntries: Array<{ key: string; influenceScore: number | undefined; rawElasticity: number }> =
        (factorSensitivity as any[]).map((f: any) => ({
          key: (f.factor_id || f.factorId || f.node_id || f.nodeId) as string,
          influenceScore: (f.influence_score ?? f.influenceScore) as number | undefined,
          rawElasticity: (f.elasticity ?? f.sensitivity_score ?? f.importance_score ?? 0) as number,
        }))
      const displayModel = selectDriverDisplayModel(displayEntries)
      const ranked = displayEntries
        .map((e) => ({
          key: e.key,
          elasticity: Math.abs(e.rawElasticity),
          value: displayModel.get(e.key)?.value ?? 0,
        }))
        .sort(compareByDisplayModel)

      // Find this node's rank (1-indexed)
      const rank = ranked.findIndex(f => f.key === nodeId) + 1
      sensitivityRank = rank > 0 && rank <= 3 ? rank : null

      // VoI rank: top-3 factors by value_of_information
      const rankedByVoi = [...factorSensitivity]
        .map((f: any) => ({
          id: (f.factor_id || f.factorId || f.node_id || f.nodeId) as string,
          voi: (f.value_of_information ?? f.valueOfInformation ?? 0) as number,
        }))
        .filter(f => typeof f.voi === 'number' && f.voi > 0)
        .sort((a, b) => b.voi - a.voi)
      const voiPos = rankedByVoi.findIndex(f => f.id === nodeId) + 1
      if (voiPos > 0 && voiPos <= 3) voiRank = voiPos

      // Task 3: Extract influence, confidence, and VoI for this factor
      const factorData = factorSensitivity.find((f: any) =>
        (f.factor_id || f.factorId || f.node_id || f.nodeId) === nodeId
      )

      if (factorData) {
        // Factor found in sensitivity analysis
        inSensitivityAnalysis = true

        // VoI: value_of_information is a direct 0-1 score
        const rawVoi = (factorData.value_of_information ?? factorData.valueOfInformation) as number | undefined
        if (typeof rawVoi === 'number' && rawVoi >= 0 && rawVoi <= 1) {
          valueOfInformation = rawVoi
        }

        // Influence readout: the shared display model already resolved the
        // displayed value under the complete-metric-set policy (Codex R3-B1)
        // — read it back so the "I: NN%" beside the badge is the number the
        // rank used, on the same basis as the panel.
        const modelEntry = displayModel.get(nodeId)
        if (modelEntry && Number.isFinite(modelEntry.value)) {
          influence = modelEntry.value
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
    let achievementProbabilityIsModelledBasis = false
    let stabilityPercentage: number | null = null

    if (nodeType === 'outcome' || nodeType === 'goal') {
      const optionProbabilities = report.option_probabilities ?? {}
      // Get the recommended option from robustness
      const recommendedOptionId = report.robustness?.recommended_option_id ??
                                  report.robustness?.recommendedOptionId

      if (recommendedOptionId) {
        const rec = optionProbabilities[recommendedOptionId] as any
        if (rec) {
          // T6 P0-3: Prefer probability_of_joint_goal (constrained) when available,
          // fall back to goal_probability (unconstrained)
          const jointProb = typeof rec.probability_of_joint_goal === 'number'
            ? rec.probability_of_joint_goal : null
          const hasConstraints = rec.constraint_analysis?.constraints?.length > 0
          const isJoint = hasConstraints && jointProb != null
          achievementProbability = isJoint
            ? jointProb
            : (rec.goal_probability ?? null)
          // Display-honesty (ROADMAP 1.6b follow-up, claim-integrity):
          // mirrors the `isJoint` branch immediately above exactly (rather
          // than comparing resulting numbers, which could false-match on a
          // coincidental equal value) so we know precisely WHEN the
          // achievementProbability just set IS the joint-goal figure the
          // caveat qualifies — never inferred, never applied to the
          // unconstrained goal_probability branch.
          const goalFitBasisScoredFrom =
            typeof rec.goal_fit_basis?.scored_from === 'string'
              ? (rec.goal_fit_basis.scored_from as string)
              : null
          achievementProbabilityIsModelledBasis =
            isJoint && goalFitBasisScoredFrom === 'modelled_outcome_distribution'
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

    // T4 fix: predictedOutcome removed — the previous code read the goal-level
    // distribution (optionProbabilities[recId].outcome) which is the SAME object for
    // every outcome node, causing identical ranges on all outcome/risk nodes.
    // PLoT does not provide per-outcome distributions. When it does, re-enable this
    // code path keyed on the individual outcome node ID.
    const predictedOutcome: { mean: number | null; p10: number | null; p90: number | null } | null = null

    return {
      sensitivityRank,
      influence,
      confidence,
      inSensitivityAnalysis,
      achievementProbability,
      achievementProbabilityIsModelledBasis,
      stabilityPercentage,
      winRate,
      predictedOutcome,
      valueOfInformation,
      voiRank,
      isResultsMode: true,
    }
  }, [isResultsMode, report, nodeId, nodeType])
}

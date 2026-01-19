/**
 * useResultsPanelData - Central data aggregation hook for Results Panel
 *
 * Brief H Task 14: Unified data wiring for four-panel Results structure
 *
 * Aggregates data from:
 * - PLoT run results (option_probabilities, bands, confidence)
 * - ISL robustness analysis (sensitivity, VoI, tipping points)
 * - CEE synthesis narratives (decision, uncertainty, recommendation)
 * - Option ranking (from comparison mode)
 *
 * Provides computed values for all four panels:
 * 1. Recommendation Panel - "What should I do?"
 * 2. Key Drivers Panel - "Why?"
 * 3. Validate & Improve Panel - "Can I trust it?"
 * 4. Next Steps Panel - "What's next?"
 */

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '../canvas/store'
import { useRobustness } from '../canvas/hooks/useRobustness'
import { useISLSynthesis } from '../canvas/hooks/useISLSynthesis'
import { useOptionRanking } from '../canvas/hooks/useOptionRanking'
import { useComparisonDetection } from '../canvas/hooks/useComparisonDetection'
import { mapConfidenceToReadiness } from '../canvas/utils/mapConfidenceToReadiness'
import { computeBaselineComparison } from '../canvas/utils/baselineComparison'
import { getObjectiveText, getGoalDirection } from '../canvas/utils/getObjectiveText'
import type { OutcomeUnits } from '../lib/format'
import type { ConfidenceLevel } from '../adapters/plot/types'
import type { RobustnessResult, SensitiveParameter, ValueOfInformation } from '../canvas/components/RecommendationCard/types'
import type { SynthesisNarratives } from '../canvas/hooks/useISLSynthesis'
import type { RankingData } from '../canvas/components/DecisionSummary'

// =============================================================================
// Types for Results Panel Data
// =============================================================================

/**
 * Goal probability data from PLoT option_probabilities
 */
export interface GoalProbability {
  /** Probability of achieving the goal (0-1) */
  probability: number
  /** Confidence in the estimate (0-1) */
  confidence: number
  /** Goal node label */
  goalLabel: string
  /** Option ID this probability is for */
  optionId: string
  /** Option label */
  optionLabel?: string
}

/**
 * Outcome bands from analysis
 */
export interface OutcomeBands {
  p10: number | null
  p50: number | null
  p90: number | null
  units: OutcomeUnits
  unitSymbol?: string
}

/**
 * Baseline comparison result
 */
export interface BaselineComparison {
  display: string
  isIncrease: boolean
  isPositive: boolean
  absoluteDelta: number
}

/**
 * Panel 1: Recommendation data - "What should I do?"
 */
export interface RecommendationData {
  /** Most likely outcome value (p50) */
  p50: number | null
  /** Outcome bands for confidence range */
  bands: OutcomeBands
  /** Confidence level and explanation */
  confidence: {
    level: ConfidenceLevel
    why?: string
  } | null
  /** Goal probability from option_probabilities */
  goalProbability: GoalProbability | null
  /** Option ranking from comparison */
  ranking: RankingData | null
  /** Baseline comparison display */
  baselineComparison: BaselineComparison | null
  /** Headline from CEE story */
  headline: string | null
  /** Winner option name (when not viewing winner) */
  winnerName?: string
  /** Goal direction for interpretation */
  goalDirection: 'maximize' | 'minimize'
  /** Total options available */
  optionCount: number
  /** Can compare options */
  canCompare: boolean
}

/**
 * Panel 2: Key drivers data - "Why?"
 */
export interface KeyDriversData {
  /** Top drivers from PLoT analysis */
  drivers: Array<{
    label: string
    polarity: 'up' | 'down' | 'neutral'
    strength: 'low' | 'medium' | 'high'
    contribution?: number
    nodeId?: string
    edgeId?: string
  }>
  /** Sensitive parameters with tipping points */
  sensitiveParams: SensitiveParameter[]
  /** Value of information suggestions worth investigating */
  voiSuggestions: ValueOfInformation[]
  /** CEE synthesis narratives */
  synthesis: SynthesisNarratives | null
  /** Loading state */
  loading: {
    robustness: boolean
    synthesis: boolean
  }
}

/**
 * Panel 3: Validate & Improve data - "Can I trust it?"
 */
export interface ValidateData {
  /** Robustness label (robust/moderate/fragile) */
  robustnessLabel: 'robust' | 'moderate' | 'fragile' | null
  /** Robustness bounds for scenarios */
  bounds: Array<{
    scenario: string
    lower: number
    upper: number
  }>
  /** Decision readiness assessment */
  decisionReadiness: {
    ready: boolean
    blockers: string[]
    suggestions: string[]
  } | null
  /** Evidence coverage stats */
  evidenceCoverage: {
    total: number
    evidenced: number
    percentage: number
  }
  /** Full robustness result for detailed display */
  robustness: RobustnessResult | null
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
}

/**
 * Panel 4: Next Steps data - "What's next?"
 */
export interface NextStepsData {
  /** Recommended actions from CEE */
  actions: Array<{
    action: string
    rationale?: string
    priority?: 'high' | 'medium' | 'low'
  }>
  /** Key insight summary */
  keyInsight: string | null
  /** Items requiring validation */
  validationItems: Array<{
    label: string
    nodeId: string
    calibrationQuality?: 'poor' | 'fair' | 'good' | 'excellent'
  }>
}

/**
 * Complete Results Panel data structure
 */
export interface ResultsPanelData {
  /** Is the panel in pre-run state (no results yet) */
  isPreRun: boolean
  /** Is analysis currently running */
  isRunning: boolean
  /** Is in error state */
  isError: boolean
  /** Error message if any */
  error: string | null

  // Panel data
  recommendation: RecommendationData
  keyDrivers: KeyDriversData
  validate: ValidateData
  nextSteps: NextStepsData

  // Metadata
  runId: string | null
  responseHash: string | null
  objectiveText: string
}

// =============================================================================
// Main Hook
// =============================================================================

export function useResultsPanelData(): ResultsPanelData {
  // Get store data with shallow comparison to prevent re-render loops
  const {
    results,
    runMeta,
    nodes,
    edges,
    framing,
    hasCompletedFirstRun,
  } = useCanvasStore(
    useShallow(s => ({
      results: s.results,
      runMeta: s.runMeta,
      nodes: s.nodes,
      edges: s.edges,
      framing: s.currentScenarioFraming,
      hasCompletedFirstRun: s.hasCompletedFirstRun,
    }))
  )

  const report = results?.report
  const resultsStatus = results?.status

  // Derived state
  const isPreRun = !hasCompletedFirstRun
  const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'
  const isError = resultsStatus === 'error'
  const error = results?.error?.message ?? null

  // Run ID and hash for robustness/synthesis calls
  const responseHash = results?.hash ?? null
  const runId = responseHash ? `run-${responseHash.slice(0, 8)}` : null

  // Get robustness data
  const {
    robustness: robustnessData,
    loading: robustnessLoading,
    error: robustnessError,
  } = useRobustness({
    runId: runId ?? undefined,
    responseHash: responseHash ?? undefined,
    autoFetch: !isPreRun && !!responseHash,
  })

  // Synthesis data - DEPRECATED: now comes from ceeReview.blocks in Decision Review
  // useISLSynthesis is a no-op stub retained for backward compatibility
  const {
    synthesis: synthesisData,
    loading: synthesisLoading,
  } = useISLSynthesis()

  // Get option ranking from comparison
  const optionRanking = useOptionRanking()

  // Get comparison detection
  const { canCompare, optionNodes } = useComparisonDetection()

  // Computed values
  const objectiveText = useMemo(
    () => getObjectiveText({ framing, nodes }),
    [framing, nodes]
  )

  const goalDirection = useMemo(
    () => getGoalDirection(framing, nodes),
    [framing, nodes]
  )

  const baselineValue = framing?.baseline ?? 0

  // ==========================================================================
  // Panel 1: Recommendation Data
  // ==========================================================================
  const recommendation = useMemo<RecommendationData>(() => {
    const p50 = report?.results?.likely ?? null
    const units = (report?.results?.units ?? 'percent') as OutcomeUnits
    const unitSymbol = report?.results?.unitSymbol

    const bands: OutcomeBands = {
      p10: report?.results?.conservative ?? null,
      p50,
      p90: report?.results?.optimistic ?? null,
      units,
      unitSymbol,
    }

    // Confidence
    const confidence = report?.confidence
      ? {
          level: (report.confidence.level?.toLowerCase() ?? 'medium') as ConfidenceLevel,
          why: report.confidence.why,
        }
      : null

    // Goal probability from option_probabilities
    let goalProbability: GoalProbability | null = null
    if (report?.option_probabilities && report?.goal_node) {
      const optionNodesLocal = nodes.filter(n => (n.data as any)?.kind === 'option')
      const currentOptionId = optionNodesLocal[0]?.id
      if (currentOptionId && report.option_probabilities[currentOptionId]) {
        const prob = report.option_probabilities[currentOptionId]
        goalProbability = {
          probability: prob.goal_probability,
          confidence: prob.confidence,
          goalLabel: report.goal_node.label || 'your goal',
          optionId: currentOptionId,
          optionLabel: (optionNodesLocal[0]?.data as any)?.label,
        }
      }
    }

    // Baseline comparison
    const baselineResult = p50 !== null
      ? computeBaselineComparison({
          value: p50,
          baseline: baselineValue,
          units,
          goalDirection,
        })
      : null
    const baselineComparison = baselineResult
      ? {
          display: baselineResult.display,
          isIncrease: baselineResult.isIncrease,
          isPositive: baselineResult.isPositive,
          absoluteDelta: baselineResult.delta,
        }
      : null

    // Headline from CEE story or insights
    const story = runMeta?.ceeReview?.story
    const rawHeadline = story?.headline || report?.insights?.summary?.trim() || null
    // Filter out confusing relative percentage changes
    const confusingPattern = /Outcome likely to (increase|decrease) by \d+%/i
    const headline = rawHeadline && confusingPattern.test(rawHeadline) ? null : rawHeadline

    return {
      p50,
      bands,
      confidence,
      goalProbability,
      ranking: optionRanking,
      baselineComparison,
      headline,
      winnerName: optionRanking?.winnerName,
      goalDirection,
      optionCount: optionNodes.length,
      canCompare,
    }
  }, [
    report,
    nodes,
    runMeta,
    baselineValue,
    goalDirection,
    optionRanking,
    optionNodes,
    canCompare,
  ])

  // ==========================================================================
  // Panel 2: Key Drivers Data
  // ==========================================================================
  const keyDrivers = useMemo<KeyDriversData>(() => {
    // Extract drivers from report
    const drivers = (report?.drivers ?? []).map(d => ({
      label: d.label,
      polarity: d.polarity as 'up' | 'down' | 'neutral',
      strength: d.strength as 'low' | 'medium' | 'high',
      contribution: d.contribution,
      nodeId: d.nodeId,
      edgeId: d.edgeId,
    }))

    // Sensitive parameters from robustness
    const sensitiveParams = robustnessData?.sensitivity ?? []

    // VoI suggestions worth investigating
    const voiSuggestions = (robustnessData?.value_of_information ?? []).filter(
      v => v.worth_investigating
    )

    return {
      drivers,
      sensitiveParams,
      voiSuggestions,
      synthesis: synthesisData,
      loading: {
        robustness: robustnessLoading,
        synthesis: synthesisLoading,
      },
    }
  }, [report, robustnessData, synthesisData, robustnessLoading, synthesisLoading])

  // ==========================================================================
  // Panel 3: Validate & Improve Data
  // ==========================================================================
  const validate = useMemo<ValidateData>(() => {
    // Evidence coverage from edges
    const totalEdges = edges.length
    const evidencedEdges = edges.filter(
      e => e.data?.provenance && (e.data.provenance as string).trim() !== ''
    ).length
    const percentage = totalEdges > 0 ? Math.round((evidencedEdges / totalEdges) * 100) : 0

    // Decision readiness from report or derived from confidence
    let decisionReadiness: ValidateData['decisionReadiness'] = null
    const reportReadiness = report?.decision_readiness
    if (reportReadiness) {
      decisionReadiness = {
        ready: reportReadiness.ready,
        blockers: reportReadiness.blockers ?? [],
        suggestions: reportReadiness.warnings ?? [],
      }
    } else if (report?.confidence) {
      const derivedReadiness = mapConfidenceToReadiness(
        {
          level: report.confidence.level.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
          reason: report.confidence.why,
        },
        true // Assume positive verdict
      )
      decisionReadiness = derivedReadiness
        ? {
            ready: derivedReadiness.ready,
            blockers: derivedReadiness.blockers ?? [],
            suggestions: derivedReadiness.warnings ?? [],
          }
        : null
    }

    // Robustness bounds
    const bounds = (robustnessData?.robustness_bounds ?? []).map(b => ({
      scenario: b.scenario,
      lower: b.lower,
      upper: b.upper,
    }))

    const robustnessLabel = robustnessData?.robustness_label
    const normalizedLabel = robustnessLabel === 'robust' || robustnessLabel === 'moderate' || robustnessLabel === 'fragile'
      ? robustnessLabel
      : null

    return {
      robustnessLabel: normalizedLabel,
      bounds,
      decisionReadiness,
      evidenceCoverage: {
        total: totalEdges,
        evidenced: evidencedEdges,
        percentage,
      },
      robustness: robustnessData,
      loading: robustnessLoading,
      error: robustnessError ?? null,
    }
  }, [edges, report, robustnessData, robustnessLoading, robustnessError])

  // ==========================================================================
  // Panel 4: Next Steps Data
  // Brief I Task 6: Context-aware next steps based on actual analysis results
  // ==========================================================================
  const nextSteps = useMemo<NextStepsData>(() => {
    const actions: NextStepsData['actions'] = []

    // 1. VoI-based recommendations (high priority)
    const voiSuggestions = robustnessData?.value_of_information ?? []
    const worthInvestigating = voiSuggestions.filter(v => v.worth_investigating)

    if (worthInvestigating.length > 0) {
      const topVoi = worthInvestigating[0]
      actions.push({
        action: `Investigate "${topVoi.label}" - highest value of information`,
        rationale: `Gathering more data here could significantly improve decision quality.`,
        priority: 'high',
      })
    }

    // 2. Sensitivity-based recommendations (high priority for tipping points)
    const sensitivityItems = robustnessData?.sensitivity ?? []
    const tippingPoints = sensitivityItems.filter(s => (s as any).tipping_point !== undefined)

    if (tippingPoints.length > 0) {
      const topTipping = tippingPoints[0]
      actions.push({
        action: `Monitor "${topTipping.label}" closely - near tipping point`,
        rationale: `Small changes here could flip the recommended choice.`,
        priority: 'high',
      })
    } else if (sensitivityItems.length > 0) {
      // Just high sensitivity, not a tipping point
      const topSensitive = sensitivityItems[0]
      actions.push({
        action: `Validate assumptions about "${topSensitive.label}"`,
        rationale: `This factor has high impact on your outcome.`,
        priority: 'medium',
      })
    }

    // 3. Robustness-based recommendations
    if (robustnessData?.robustness_label === 'fragile') {
      actions.push({
        action: 'Consider adding mitigation strategies',
        rationale: 'Your recommendation is sensitive to small changes in assumptions.',
        priority: 'high',
      })
    } else if (robustnessData?.robustness_label === 'moderate') {
      actions.push({
        action: 'Review edge cases before finalizing',
        rationale: 'Some scenarios could change the optimal choice.',
        priority: 'medium',
      })
    }

    // 4. Evidence-based recommendations
    const totalEdges = edges.length
    const evidencedEdges = edges.filter(
      e => e.data?.provenance && (e.data.provenance as string).trim() !== ''
    ).length
    const coveragePercent = totalEdges > 0 ? Math.round((evidencedEdges / totalEdges) * 100) : 0

    if (coveragePercent < 50 && totalEdges > 2) {
      actions.push({
        action: 'Add evidence sources to strengthen key relationships',
        rationale: `Only ${coveragePercent}% of your model has supporting evidence.`,
        priority: 'medium',
      })
    }

    // 5. CEE next actions (lower priority, as they may be generic)
    const ceeActions = runMeta?.ceeReview?.story?.next_actions ?? []
    for (const ceeAction of ceeActions.slice(0, 2)) {
      // Only add if not already covered by context-aware actions
      const actionLabel = typeof ceeAction === 'string' ? ceeAction : ceeAction?.label
      const isDuplicate = typeof actionLabel === 'string'
        ? actions.some(a =>
            a.action.toLowerCase().includes(actionLabel.toLowerCase().split(' ').slice(0, 3).join(' '))
          )
        : false
      if (!isDuplicate && typeof actionLabel === 'string') {
        actions.push({
          action: actionLabel,
          rationale: typeof ceeAction === 'string' ? undefined : ceeAction?.why,
          priority: 'low',
        })
      }
    }

    // 6. If no actions generated, add contextual default action
    if (actions.length === 0 && !isPreRun) {
      const critiques = (report as any)?.run?.critique ?? []
      const errorCritique = critiques.find((c: any) =>
        typeof c?.severity === 'string' && c.severity.toLowerCase() === 'error'
      )
      const fragileEdges = (report as any)?.robustness?.fragile_edges
      const hasFragileEdges = (Array.isArray(fragileEdges) && fragileEdges.length > 0)
        || (robustnessData?.fragile_edge_count ?? 0) > 0

      if (errorCritique) {
        actions.push({
          action: errorCritique.suggested_fix || errorCritique.message || 'Resolve critical model issues',
          rationale: errorCritique.message || undefined,
          priority: 'high',
        })
      } else if (hasFragileEdges) {
        actions.push({
          action: 'Validate key assumptions in your model',
          rationale: 'Fragile assumptions could flip the recommendation.',
          priority: 'medium',
        })
      } else {
        actions.push({
          action: 'Share results with your team',
          rationale: 'Align stakeholders on the current recommendation.',
          priority: 'low',
        })
      }
    }

    // Key insight from synthesis (prefer recommendation) or report
    const keyInsight = (synthesisData as SynthesisNarratives | null)?.recommendation
      ?? report?.insights?.summary
      ?? null

    // Validation items from VoI (map all worth investigating)
    const validationItems = worthInvestigating.map(v => ({
      label: v.label,
      nodeId: v.node_id,
    }))

    return {
      actions: actions.slice(0, 5), // Limit to top 5 actions
      keyInsight,
      validationItems,
    }
  }, [runMeta, synthesisData, report, robustnessData, edges, isPreRun])

  // ==========================================================================
  // Return complete data structure
  // ==========================================================================
  return {
    isPreRun,
    isRunning,
    isError,
    error,
    recommendation,
    keyDrivers,
    validate,
    nextSteps,
    runId,
    responseHash,
    objectiveText,
  }
}

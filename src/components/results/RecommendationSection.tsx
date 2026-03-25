/**
 * RecommendationSection Component
 *
 * Displays the recommended option with outcome range.
 * Part of the Results Panel redesign - "coaching over gates" approach.
 *
 * Features:
 * - Best estimate with natural language description
 * - Visual range bar (p10 - p50 - p90)
 * - Option comparison list (when multiple options)
 * - Single option: outcome only with coaching CTA
 * - Click-to-focus on option nodes
 */

import { useMemo } from 'react'
import type { RecommendationSectionData, DriverItem, DecisionState, HingeInfo, NextActionItem } from './types'
import { EMPTY_STATES } from './emptyStates'
import { typography } from '../../styles/typography'
import { HeroSection, type OptionWinShare, type OptionGoalProbability } from './HeroSection'

/** Top fragile edge data for HeroSection */
export interface TopFragileEdge {
  fromId: string
  fromLabel: string
  toId: string
  toLabel: string
  alternativeWinnerLabel: string
  alternativeWinnerId?: string
  switchProbability?: number
  /** Task C: Whether labels were successfully resolved (true) or fell back to "Unknown" (false) */
  labelsResolved?: boolean
}

interface RecommendationSectionProps {
  data: RecommendationSectionData
  onFocusNode?: (nodeId: string) => void
  /** Callback to navigate to Structure tab (for needs_framing CTA) */
  onNavigateToStructure?: () => void
  onAddStatusQuoBaseline?: () => void
  /** Response hash for coaching card dismissal persistence */
  responseHash?: string
  /** Top drivers from DriversSection (for HeroSection bullet 2) */
  topDrivers?: DriverItem[]
  /** Top fragile edge from ConfidenceSection (for HeroSection bullet 3) */
  topFragileEdge?: TopFragileEdge
  /** Number of simulation samples (for "Learn more" expand) */
  nSamples?: number
  /** Random seed used (for "Learn more" expand) */
  seedUsed?: number
  /** Count of fragile edges (for "Learn more" expand) */
  fragileEdgeCount?: number
  /** Count of robust edges (for "Learn more" expand) */
  robustEdgeCount?: number
  // P2 Task 1: Success target affordance props
  /** Callback when threshold is changed and user clicks "Apply & re-run" */
  onApplyThreshold?: (threshold: number | null) => void
  /** Whether an analysis is currently running */
  isRunning?: boolean
  // C1: Baseline toggle — mutates draft only, no rerun
  /** Callback to add baseline to decision draft (does NOT trigger rerun) */
  onAddBaseline?: () => void
  /** Callback to set a specific option as baseline by ID (does NOT trigger rerun) */
  onSetBaseline?: (optionId: string) => void
  /** V9.2 Phase 2.3: Cross-highlight — flash an option card when a GraphLink references it */
  onFlashOption?: (optionId: string) => void
  /** V11: Tri-state decision classification */
  decisionState?: DecisionState
  /** V11: Deterministic hinge for coaching copy */
  hinge?: HingeInfo | null
  /** V12: Identifiability tag from model card */
  identifiabilityTag?: string | null
  /** V14: Top next action from M1 coaching (for hero coaching line) */
  topNextAction?: NextActionItem
  /** V16: Count of factors using default estimates */
  defaultEstimateCount?: number
  /** V16: Total factor count */
  totalFactorCount?: number
}

export function RecommendationSection({
  data,
  onFocusNode,
  onNavigateToStructure,
  onAddStatusQuoBaseline,
  responseHash,
  topDrivers,
  topFragileEdge,
  nSamples,
  seedUsed,
  fragileEdgeCount,
  robustEdgeCount,
  // P2 props
  onApplyThreshold,
  isRunning = false,
  onAddBaseline,
  onSetBaseline,
  onFlashOption,
  decisionState,
  hinge,
  identifiabilityTag,
  topNextAction,
  defaultEstimateCount,
  totalFactorCount,
}: RecommendationSectionProps) {
  const {
    recommendedOption,
    allOptions,
    isSingleOption,
    analysisStatus,
    statusReason,
    // Issue 5 fix: Extract unit for proper outcome formatting
    outcomeUnit,
    outcomeUnitSymbol,
    recommendationStability,
    goalLabel,
    goalNodeId,
    // Task 1.3: Win probability
    winProbability,
    // Task 1.5: Robustness level and label
    robustnessLevel,
    robustnessLabel,
    // Task 1.7: Goal text
    goalText,
    // Near-tie detection
    nearTie,
    // M1 Coaching fields (Task 2)
    coachingHeadline,
    coachingReadiness,
    coachingReadinessScore,
    storyHeadlines,
    // M1 Coaching: Dominant factor warning
    dominantFactorId,
    dominantFactorLabel,
    // Task 6: Ready + warnings consistency
    hasWarnings,
    goalThreshold,
    // v7: Whether outcome values are normalised model scores
    isNormalised,
  } = data

  // Error state
  if (analysisStatus === 'failed' || analysisStatus === 'blocked') {
    return (
      <div className="p-4 bg-panel border border-danger/30 rounded-lg">
        <div className={`flex items-center gap-2 ${typography.panelBody} text-danger mb-2`}>
          <span>Analysis could not complete</span>
        </div>
        {statusReason && (
          <p className={`${typography.panelBody} text-danger`}>{statusReason}</p>
        )}
      </div>
    )
  }

  // No recommendation available
  if (!recommendedOption) {
    return (
      <div className="p-4 bg-panel border border-panel-border rounded-lg">
        <p className={`${typography.panelBody} text-text-body`}>
          {EMPTY_STATES.recommendation}
        </p>
      </div>
    )
  }

  // Task 1.4: Use outcome.mean (expected) consistently - NOT p50 (median)
  const expectedValue = recommendedOption.expected
  const hasGoalProbability = typeof recommendedOption.goalProbability === 'number'
  const showGoalProbabilityHeadline = goalThreshold != null && hasGoalProbability

  const hasBaseline = allOptions.some(o => o.isBaseline)
  const optionCount = allOptions.length

  // Build win shares for WinGauge
  const optionWinShares = useMemo<OptionWinShare[]>(() => {
    const shares = allOptions
      .filter(o => typeof o.winProbability === 'number')
      .map(o => ({
        id: o.id,
        label: o.label,
        winProbability: o.winProbability!,
        isWinner: o.isRecommended,
      }))
    return shares
  }, [allOptions])

  // A3: Build goal-achievement probabilities for all options
  const allOptionGoalProbabilities = useMemo<OptionGoalProbability[]>(() => {
    return allOptions
      .filter(o => typeof o.goalProbability === 'number' && o.goalProbability != null)
      .map(o => ({
        id: o.id,
        label: o.label,
        goalProbability: o.goalProbability!,
      }))
  }, [allOptions])

  // V12.2 Fix 1: Runner-up is highest by win_probability excluding winner
  const runnerUp = useMemo(() => {
    if (allOptions.length < 2) return null
    // Filter out winner, sort by win_probability descending, take first
    const sorted = [...allOptions]
      .filter(o => o.id !== recommendedOption.id)
      .sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))
    return sorted[0] ?? null
  }, [allOptions, recommendedOption.id])

  // P2: Coaching cards now use their own internal state management

  return (
    <div className="space-y-4">
      {/* v7.8 T1: SuccessTarget moved inline into HeroSection */}

      {/* Task 1.7: Goal context - displayed when present */}
      {goalText && (
        <div className={`${typography.panelBody} text-text-body`}>
          <span>Goal:</span> {goalText}
        </div>
      )}

      {/* HeroSection: Replaces old hero with M1 templates + M2 slots */}
      <HeroSection
        winnerLabel={recommendedOption.label}
        winnerId={recommendedOption.id}
        winnerGoalProbability={recommendedOption.goalProbability}
        winnerWinProbability={recommendedOption.winProbability}
        runnerUpLabel={runnerUp?.label}
        runnerUpId={runnerUp?.id}
        runnerUpGoalProbability={runnerUp?.goalProbability}
        runnerUpWinProbability={runnerUp?.winProbability}
        optionCount={optionCount}
        hasBaseline={hasBaseline}
        recommendationStability={recommendationStability}
        analysisStatus={analysisStatus}
        topDrivers={topDrivers?.map(d => ({
          id: d.factorKey,
          label: d.factorLabel,
          direction: d.direction,
        }))}
        topFragileEdge={topFragileEdge}
        nSamples={nSamples}
        fragileEdgeCount={fragileEdgeCount}
        goalLabel={goalLabel}
        goalThreshold={goalThreshold}
        expectedOutcome={expectedValue}
        outcomeUnit={outcomeUnit}
        outcomeUnitSymbol={outcomeUnitSymbol}
        isNormalised={isNormalised}
        optionWinShares={optionWinShares}
        allOptionGoalProbabilities={allOptionGoalProbabilities.length > 0 ? allOptionGoalProbabilities : undefined}
        coachingReadiness={coachingReadiness}
        coachingReadinessScore={coachingReadinessScore}
        coachingHeadline={coachingHeadline}
        coachingParagraph={data.coachingParagraph}
        coachingKeyQualifier={data.coachingKeyQualifier}
        m2NarrativeSummary={data.m2NarrativeSummary}
        coachingReadinessDimensions={data.coachingReadinessDimensions}
        identifiabilityTag={identifiabilityTag}
        onFocusNode={onFocusNode}
        onFlashOption={onFlashOption}
        isRunning={isRunning}
        onAddBaseline={onAddBaseline}
        onSetBaseline={onSetBaseline}
        baselineOptions={allOptions.map(o => ({ id: o.id, label: o.label }))}
        baselineLabel={allOptions.find(o => o.isBaseline)?.label}
        decisionState={decisionState}
        hinge={hinge}
        robustEdgeCount={robustEdgeCount}
        nearTie={nearTie}
        topNextAction={topNextAction}
        goalNodeId={goalNodeId}
        robustnessLevel={robustnessLevel}
        defaultEstimateCount={defaultEstimateCount}
        totalFactorCount={totalFactorCount}
        winnerConstraintAnalysis={recommendedOption.constraintAnalysis}
      />

      {/* Single option CTA */}
      {isSingleOption && (
        <div className="p-3 bg-panel border border-panel-border rounded-lg">
          <p className={`${typography.panelBody} text-text-body`}>
            Add another option to compare alternatives.
          </p>
        </div>
      )}
      {/* Note: "View on canvas" link removed - already in Objective section */}
    </div>
  )
}

export default RecommendationSection

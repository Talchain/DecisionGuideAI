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
import type { RecommendationSectionData, DriverItem } from './types'
import { EMPTY_STATES } from './emptyStates'
import { typography } from '../../styles/typography'
import { HeroSection, type OptionWinShare } from './HeroSection'
import { LimitedOptionsCard } from './LimitedOptionsCard'

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
  /** Whether the threshold was extracted by CEE from the brief */
  isThresholdFromBrief?: boolean
  // C1: Baseline toggle — mutates draft only, no rerun
  /** Callback to add baseline to decision draft (does NOT trigger rerun) */
  onAddBaseline?: () => void
  /** Callback to set a specific option as baseline by ID (does NOT trigger rerun) */
  onSetBaseline?: (optionId: string) => void
  /** V9.2 Phase 2.3: Cross-highlight — flash an option card when a GraphLink references it */
  onFlashOption?: (optionId: string) => void
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
  isThresholdFromBrief = false,
  onAddBaseline,
  onSetBaseline,
  onFlashOption,
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
      <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
        <div className={`flex items-center gap-2 ${typography.panelBody} text-danger-800 mb-2`}>
          <span>Analysis could not complete</span>
        </div>
        {statusReason && (
          <p className={`${typography.panelBody} text-danger-700`}>{statusReason}</p>
        )}
      </div>
    )
  }

  // No recommendation available
  if (!recommendedOption) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
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

  // Compute runner-up for HeroSection (second-best option by rank)
  const runnerUp = useMemo(() => {
    if (allOptions.length < 2) return null
    // Find second-ranked option (rank 2) or first non-recommended option
    const byRank = allOptions.find(o => o.rank === 2)
    if (byRank) return byRank
    // Fallback: first non-recommended option
    return allOptions.find(o => !o.isRecommended) ?? null
  }, [allOptions])

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
        coachingReadiness={coachingReadiness}
        coachingReadinessScore={coachingReadinessScore}
        coachingHeadline={coachingHeadline}
        coachingParagraph={data.coachingParagraph}
        onFocusNode={onFocusNode}
        onFlashOption={onFlashOption}
        isRunning={isRunning}
        onAddBaseline={onAddBaseline}
        onSetBaseline={onSetBaseline}
        baselineOptions={allOptions.map(o => ({ id: o.id, label: o.label }))}
        baselineLabel={allOptions.find(o => o.isBaseline)?.label}
      />

      {/* P2 Task 3: Limited options coaching card (moved below hero) */}
      {/* v7.3: GATED — "You're comparing 2 options" banner not in prototype. Remove after v7 stable. */}
      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && (
        <LimitedOptionsCard
          optionCount={optionCount}
          hasBaseline={hasBaseline}
          responseHash={responseHash}
        />
      )}

      {/* Single option CTA */}
      {isSingleOption && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
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

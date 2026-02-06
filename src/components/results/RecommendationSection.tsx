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

import { useCallback, useMemo } from 'react'
import type { RecommendationSectionData, OptionResult, OutcomeUnitType, DriverItem, GoalConstraint } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { EMPTY_STATES } from './emptyStates'
import { formatOutcomeValue, type OutcomeUnits } from '../../lib/format'
import { typography } from '../../styles/typography'
import { BASELINE_DELTA_EPSILON } from './constants'
import { COPY } from '../../lib/mappers/constants'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { HeroSection } from './HeroSection'
import { SuccessTarget } from './SuccessTarget'
import { BaselineToggleCard } from './BaselineToggleCard'
import { LimitedOptionsCard } from './LimitedOptionsCard'
import { RangeVisualization } from './RangeVisualization'
import { TippingPoints } from './TippingPoints'

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
}

/**
 * Format a probability (0-1 range) as a percentage.
 * Multiplies by 100 for display. Use for win_probability, goal_probability, confidence.
 * Shows one decimal for small values (< 1%) to avoid rounding -0.3% to 0%.
 */
function formatPercent(value: number): string {
  const percent = value * 100
  // For values < 1% absolute, show one decimal to preserve small negatives
  if (Math.abs(percent) < 1 && percent !== 0) {
    return `${percent.toFixed(1)}%`
  }
  return `${Math.round(percent)}%`
}

/**
 * Format an outcome value for display based on the goal's unit type.
 * Issue 5 fix: Uses formatOutcomeValue from lib/format for proper unit handling.
 *
 * Smart rounding:
 * - Small display values (<1): 1 decimal to preserve precision (e.g., "0.5%")
 * - Larger display values: 0 decimals for cleaner display (e.g., "58%")
 *
 * For percent unit with probability input (0-1), the display value is multiplied by 100,
 * so we calculate decimals based on the POST-multiplication value.
 *
 * @param value - Outcome value (meaning depends on unit type)
 * @param unit - Unit type: 'currency', 'percent', or 'count' (default: 'percent')
 * @param symbol - Currency symbol for currency units (e.g., '$', '£')
 * @returns Formatted string with appropriate suffix/prefix
 */
function formatOutcome(
  value: number | null | undefined,
  unit?: OutcomeUnitType,
  symbol?: string
): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }

  // Task 2.5: Only show "%" when unit is explicitly 'percent'
  // When unit is unknown/undefined, show plain number
  const isPercent = unit === 'percent'

  // Calculate the final display value to determine decimals
  // For percent: values in probability form (typically -2 to +2 range) are multiplied by 100
  // Values like 1.8 = 180% improvement should be treated as probability form
  // FIX: Use threshold of 2 instead of 1 to catch >100% improvements
  const isProbability = isPercent && Math.abs(value) <= 2
  const displayValue = isProbability ? value * 100 : value

  // Smart decimals: 1 for small display values, 0 for larger ones
  const decimals = Math.abs(displayValue) < 1 && displayValue !== 0 ? 1 : 0

  // Pass pre-converted value to avoid double-conversion in formatOutcomeValue
  // Use the calculated display value directly with 'count' unit to skip formatOutcomeValue's probability detection
  if (isPercent) {
    return `${displayValue.toFixed(decimals)}%`
  }

  // For other units or unknown, use formatOutcomeValue (no % suffix)
  if (unit) {
    return formatOutcomeValue(value, unit as OutcomeUnits, symbol, { decimals })
  }

  // Unknown unit: plain number
  return displayValue.toFixed(decimals)
}


/**
 * Task 2.2: Format delta from baseline as "+X" or "-X" with "vs baseline" suffix.
 * Uses absolute point delta (not percent-of-baseline).
 * Bug 3 fix: Show "Same as baseline" for near-zero deltas (|delta| < EPSILON).
 * Prevents display of "+0.0" or "-0.0".
 */
function formatDelta(
  delta: number | null | undefined,
  unit?: OutcomeUnitType,
  symbol?: string
): string | null {
  if (delta == null) return null
  // Bug 3 fix: Use epsilon for near-zero comparison
  if (Math.abs(delta) < BASELINE_DELTA_EPSILON) return 'Same as baseline'
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${formatOutcome(delta, unit, symbol)} vs baseline`
}

/**
 * Task 3: Compact horizontal option row.
 * Single row layout: icon · name · badge · probability/rank · delta tooltip
 * Entire row is clickable to focus on node in canvas.
 */
function OptionRow({
  option,
  onFocus,
  outcomeUnit,
  outcomeUnitSymbol,
  goalThreshold,
  showBadge,
  isCloseCall,
}: {
  option: OptionResult
  onFocus?: (nodeId: string) => void
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
  goalThreshold?: number | null
  /** P2 Task 4: Whether to show "Strongest performer" badge (winner only, not in close-call) */
  showBadge?: boolean
  /** P2 Task 4: Close-call scenario - win probability diff < 2% */
  isCloseCall?: boolean
}) {
  const handleClick = useCallback(() => {
    if (onFocus) {
      onFocus(option.id)
    } else {
      focusNodeById(option.id)
    }
  }, [option.id, onFocus])

  // Fix A: Only show goalProbability when both threshold AND probability are present
  const showGoalProbability = goalThreshold != null && option.goalProbability != null

  // Task 3: Delta from baseline for tooltip (compact - no inline display)
  const deltaText = !option.isBaseline
    ? formatDelta(option.deltaFromBaseline, outcomeUnit, outcomeUnitSymbol)
    : null

  // Compact probability/rank display
  const { display, tooltip, isRankBased } = useMemo(() => {
    // Priority 1: Goal probability if threshold is set
    if (showGoalProbability && option.goalProbability != null) {
      const pct = `${Math.round(option.goalProbability * 100)}%`
      // Use approved copy: avoid "probability" in user-facing text
      const tip = deltaText ? `${pct} chance of achieving your goal. ${deltaText}` : `${pct} chance of achieving your goal`
      return { display: pct, tooltip: tip, isRankBased: false }
    }
    // Priority 2: Win probability
    if (option.winProbability != null) {
      const pct = `${Math.round(option.winProbability * 100)}%`
      // Use approved "simulations" language per banned-strings policy
      const tip = deltaText ? `Wins in ${pct} of simulations. ${deltaText}` : `Wins in ${pct} of simulations`
      return { display: pct, tooltip: tip, isRankBased: false }
    }
    // Priority 3: Rank-based label (Fix A compatibility)
    const rank = option.rank
    if (rank != null) {
      const labels: Record<number, string> = { 1: 'Strongest performer', 2: 'Second strongest', 3: 'Third strongest' }
      const label = labels[rank] || `${rank}th strongest`
      return { display: label, tooltip: deltaText || label, isRankBased: true }
    }
    // Priority 4: Show delta text directly if nothing else available
    if (deltaText) {
      return { display: deltaText, tooltip: deltaText, isRankBased: true }
    }
    return { display: null, tooltip: null, isRankBased: false }
  }, [showGoalProbability, option.goalProbability, option.winProbability, option.rank, deltaText])

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      className={`
        w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer
        flex items-center gap-3
        bg-panel border border-panel-border hover:bg-panel-hover
        focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1
        ${showBadge ? 'border-l-4 border-l-success' : ''}
      `}
      aria-label={`Focus on ${option.label} in model`}
    >
      {/* Icon: Option color indicator */}
      <span
        className="w-3 h-3 rounded-full bg-option flex-shrink-0"
        aria-hidden="true"
      />

      {/* Name */}
      <span className="text-sm text-text-body hover:underline flex-1 truncate">
        {stripEncodingNotation(option.label)}
      </span>

      {/* Badges (inline) */}
      {showBadge && !isCloseCall && (
        <span className="text-xs bg-success-light text-success px-1.5 py-0.5 rounded flex-shrink-0">
          Strongest
        </span>
      )}
      {option.isBaseline && (
        <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
          Baseline
        </span>
      )}

      {/* Probability/Rank display (compact) */}
      {display && (
        <span
          className={`text-sm flex-shrink-0 ${isRankBased ? 'text-text-light' : 'font-medium text-text-body tabular-nums'}`}
          title={tooltip || undefined}
        >
          {display}
        </span>
      )}
    </div>
  )
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
    // Task 6: Flip thresholds for tipping points
    flipThresholds,
  } = data

  // P1: Story headlines removed from option cards - banned language risk
  // storyHeadlines data is still available for debug/coaching but not rendered

  // Error state
  if (analysisStatus === 'failed' || analysisStatus === 'blocked') {
    return (
      <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
        <div className={`flex items-center gap-2 ${typography.body} text-danger-800 font-medium mb-2`}>
          <span>Analysis could not complete</span>
        </div>
        {statusReason && (
          <p className={`${typography.body} text-danger-700`}>{statusReason}</p>
        )}
      </div>
    )
  }

  // No recommendation available
  if (!recommendedOption) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className={`${typography.body} text-text-body`}>
          {EMPTY_STATES.recommendation}
        </p>
      </div>
    )
  }

  // Task 1.4: Use outcome.mean (expected) consistently - NOT p50 (median)
  const expectedValue = recommendedOption.expected
  const hasGoalProbability = typeof recommendedOption.goalProbability === 'number'
  const showGoalProbabilityHeadline = goalThreshold != null && hasGoalProbability

  // Task 5: Near-tie explanatory text
  // FIX: Require numeric expected values - don't show tie explanation when outcomes are missing
  // Use expected ?? outcome.mean as fallback, filter out nulls before comparing
  const numericOutcomes = allOptions
    .map(o => o.expected ?? o.outcome?.mean)
    .filter((v): v is number => typeof v === 'number')

  // Only compute tie if ALL options have numeric outcomes
  const allHaveOutcomes = numericOutcomes.length === allOptions.length && allOptions.length > 0
  const formattedOutcomes = allHaveOutcomes
    ? numericOutcomes.map(v => formatOutcome(v, outcomeUnit, outcomeUnitSymbol))
    : []
  const outcomesAppearTied = formattedOutcomes.length > 1 &&
    formattedOutcomes.every(v => v === formattedOutcomes[0])

  const winProbs = allOptions
    .map(o => o.winProbability)
    .filter((v): v is number => v != null)  // Preserves 0, filters null/undefined

  const winSpread = winProbs.length > 1
    ? Math.max(...winProbs) - Math.min(...winProbs)
    : 0

  const showTieExplanation = outcomesAppearTied && winSpread > 0.1

  const hasBaseline = allOptions.some(o => o.isBaseline)
  const optionCount = allOptions.length

  // Build GoalConstraint[] from existing flat props for SuccessTarget
  const goalConstraints: GoalConstraint[] = useMemo(() => {
    if (goalThreshold == null) return []
    return [{
      id: 'primary',
      label: goalLabel || 'Target',
      operator: '>=' as const,
      value: goalThreshold,
      probability: recommendedOption?.goalProbability ?? null,
    }]
  }, [goalThreshold, goalLabel, recommendedOption?.goalProbability])

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
      {/* Success target — inline-editable, multi-target ready */}
      <SuccessTarget
        goalConstraints={goalConstraints}
        isFromBrief={isThresholdFromBrief}
        isRunning={isRunning}
        onApplyThreshold={onApplyThreshold}
      />

      {/* P2 Task 2: Baseline toggle card (shows when no baseline) */}
      <BaselineToggleCard
        show={!hasBaseline && !isSingleOption}
        isRunning={isRunning}
        onAddBaseline={onAddBaseline}
      />

      {/* P2 Task 3: Limited options coaching card (shows when <= 2 options AND baseline exists) */}
      <LimitedOptionsCard
        optionCount={optionCount}
        hasBaseline={hasBaseline}
        responseHash={responseHash}
      />

      {/* Task 1.7: Goal context - displayed when present */}
      {goalText && (
        <div className={`${typography.body} text-text-body`}>
          <span className="font-medium">Goal:</span> {goalText}
        </div>
      )}

      {/* HeroSection: Replaces old hero with M1 templates + M2 slots */}
      <HeroSection
        winnerLabel={recommendedOption.label}
        winnerId={recommendedOption.id}
        winnerGoalProbability={recommendedOption.goalProbability}
        runnerUpLabel={runnerUp?.label}
        runnerUpId={runnerUp?.id}
        runnerUpGoalProbability={runnerUp?.goalProbability}
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
        seedUsed={seedUsed}
        responseHash={responseHash}
        fragileEdgeCount={fragileEdgeCount}
        robustEdgeCount={robustEdgeCount}
        goalLabel={goalLabel}
        goalThreshold={goalThreshold}
        coachingReadiness={coachingReadiness}
        coachingReadinessScore={coachingReadinessScore}
        onFocusNode={onFocusNode}
      />

      {/* P3 Task 3: Range visualization - outcome distribution bars */}
      {!isSingleOption && allOptions.length > 1 && (
        <RangeVisualization
          options={allOptions}
          goalThreshold={goalThreshold}
          winnerId={recommendedOption?.id}
          outcomeUnit={outcomeUnit}
          outcomeUnitSymbol={outcomeUnitSymbol}
          topDriverLabel={topDrivers?.[0]?.factorLabel}
          topDriverDirection={topDrivers?.[0]?.direction}
          winnerP10={recommendedOption?.outcome?.p10 ?? null}
        />
      )}

      {/* Task 6: Tipping points — flip thresholds or driver strength fallback */}
      {!isSingleOption && (
        <TippingPoints
          flipThresholds={flipThresholds}
          drivers={topDrivers}
          outcomeUnit={outcomeUnit}
          outcomeUnitSymbol={outcomeUnitSymbol}
        />
      )}

      {/* Option comparison (multiple options) */}
      {!isSingleOption && allOptions.length > 1 && (
        <div className="space-y-2">
          {(() => {
            // P2 Task 4: Sort by win_probability descending, determine winner and close-call
            // Tiebreaker: isRecommended (backend-determined winner) for stable sort when wpA === wpB
            const sortedOptions = [...allOptions].sort((a, b) => {
              const wpA = a.winProbability ?? 0
              const wpB = b.winProbability ?? 0
              if (wpB !== wpA) return wpB - wpA // Descending by win probability
              // Tiebreaker: recommended option first
              if (a.isRecommended && !b.isRecommended) return -1
              if (b.isRecommended && !a.isRecommended) return 1
              return 0
            })

            // Determine winner (highest winProbability)
            const winnerWp = sortedOptions[0]?.winProbability ?? 0
            const secondWp = sortedOptions[1]?.winProbability ?? 0
            const winnerId = sortedOptions[0]?.id

            // Close-call: win probability diff < 2% (only when both have actual win probabilities)
            // Don't trigger close-call when win probabilities are missing - fallback to badge display
            const hasActualWinProbs = sortedOptions[0]?.winProbability != null && sortedOptions[1]?.winProbability != null
            const isCloseCall = hasActualWinProbs && Math.abs(winnerWp - secondWp) < 0.02

            return sortedOptions.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                onFocus={onFocusNode}
                outcomeUnit={outcomeUnit}
                outcomeUnitSymbol={outcomeUnitSymbol}
                goalThreshold={goalThreshold}
                showBadge={option.id === winnerId && (recommendationStability == null || recommendationStability >= 0.55)}
                isCloseCall={isCloseCall}
              />
            ))
          })()}

          {/* Task 5: Similar outcomes explanation with win probability */}
          {showTieExplanation && (
            <p className="text-xs text-slate-500 mt-2 italic">
              {(() => {
                // Guard: only show win probability message if value is valid (0-1 range)
                const wp = recommendedOption?.winProbability
                const isValidWinProb = typeof wp === 'number' && wp >= 0 && wp <= 1
                if (isValidWinProb && recommendedOption?.label) {
                  return COPY.SIMILAR_OUTCOMES_WITH_WINNER(
                    recommendedOption.label,
                    Math.round(wp * 100)
                  )
                }
                return 'Expected outcomes are similar. The analysis indicates which option performs better most consistently.'
              })()}
            </p>
          )}
        </div>
      )}

      {/* Single option CTA */}
      {isSingleOption && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className={`${typography.body} text-text-body`}>
            Add another option to compare alternatives.
          </p>
        </div>
      )}
      {/* Note: "View on canvas" link removed - already in Objective section */}
    </div>
  )
}

export default RecommendationSection

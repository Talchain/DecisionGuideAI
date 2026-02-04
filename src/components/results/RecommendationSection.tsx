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

import { useCallback, useMemo, useState, useEffect } from 'react'
import { CheckCircle, Scale, Search, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RecommendationSectionData, OptionResult, OutcomeUnitType, WinnerDeterminedBy, RobustnessLevel, RobustnessLabel, M1CoachingReadiness, DriverItem } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { EMPTY_STATES } from './emptyStates'
import { formatOutcomeValue, type OutcomeUnits } from '../../lib/format'
import { typography } from '../../styles/typography'
import { BASELINE_DELTA_EPSILON } from './constants'
import { COPY, THRESHOLDS } from '../../lib/mappers/constants'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { HeroSection } from './HeroSection'

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
 * P0 Results Brief: Get recommendation label based on stability.
 * - stability >= 70%: "Strongest performer"
 * - stability 55-69%: "Current front-runner"
 * - stability < 55%: null (use "No clear front-runner" chip at section level)
 */
function getRecommendationLabel(stability: number | undefined): string | null {
  if (stability == null) return 'Strongest performer' // Fallback to default if no stability data
  if (stability >= 0.70) return 'Strongest performer'
  if (stability >= 0.55) return 'Current front-runner'
  return null // Low stability - show "No clear front-runner" at section level instead
}

/**
 * P0 Results Brief Task 5: Get stability label based on thresholds.
 * - stability >= 0.85 → "Stable result"
 * - stability >= 0.70 && < 0.85 → "Mostly stable"
 * - stability >= 0.55 && < 0.70 → "Sensitive to assumptions"
 * - stability < 0.55 → "Highly sensitive"
 */
function getStabilityLabel(stability: number | undefined): string {
  if (stability == null) return 'Stable result' // Fallback
  if (stability >= 0.85) return 'Stable result'
  if (stability >= 0.70) return 'Mostly stable'
  if (stability >= 0.55) return 'Sensitive to assumptions'
  return 'Highly sensitive'
}

/**
 * Get stability tier color for badge styling.
 */
function getStabilityColor(stability: number | undefined): { bg: string; text: string; dot: string } {
  if (stability == null || stability >= 0.70) {
    return { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500' }
  }
  if (stability >= 0.55) {
    return { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' }
  }
  return { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500' }
}

/**
 * Task 1.4: Get winner label based on how the winner was determined.
 * - win_probability present → "Most likely to be best"
 * - Only expected/p50 → "Highest expected outcome"
 * - Neither → "Unable to determine best option"
 */
function getWinnerLabel(determinedBy: WinnerDeterminedBy | undefined): string {
  switch (determinedBy) {
    case 'win_probability':
      return 'Most likely to be best'
    case 'expected_outcome':
      return 'Highest expected outcome'
    default:
      return 'Unable to determine best option'
  }
}

/**
 * M1 Coaching: Decision Readiness chip with tooltip.
 * Maps readiness level to display text and styling.
 */
const READINESS_CONFIG: Record<M1CoachingReadiness, {
  label: string
  tooltip: string
  bgColor: string
  textColor: string
  borderColor: string
  icon: LucideIcon
  iconColor: string
}> = {
  ready: {
    label: 'Decision Ready',
    tooltip: 'Actionability — evidence quality and model structure support confident action',
    bgColor: 'bg-success-100',
    textColor: 'text-success-700',
    borderColor: 'border-success-300',
    icon: CheckCircle,
    iconColor: 'text-mint-500',
  },
  close_call: {
    label: 'Close Call',
    tooltip: 'Actionability — options are similar, consider other factors',
    bgColor: 'bg-warning-100',
    textColor: 'text-warning-700',
    borderColor: 'border-warning-300',
    icon: Scale,
    iconColor: 'text-sun-500',
  },
  needs_evidence: {
    label: 'Needs Evidence',
    tooltip: 'Actionability — key assumptions lack supporting data',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    icon: Search,
    iconColor: 'text-carrot-500',
  },
  needs_framing: {
    label: 'Needs Framing',
    tooltip: 'Actionability — the decision structure may need refinement',
    bgColor: 'bg-sky-100',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-300',
    icon: AlertTriangle,
    iconColor: 'text-carrot-500',
  },
}

function DecisionReadinessChip({
  readiness,
  score,
  onNavigateToStructure,
  hasWarnings,
}: {
  readiness: M1CoachingReadiness
  score?: number
  /** Callback to navigate to Structure tab (for needs_framing CTA) */
  onNavigateToStructure?: () => void
  /** Whether there are warnings that need attention (for Ready + warnings consistency) */
  hasWarnings?: boolean
}) {
  // Task 6: Don't show "Needs Framing" badge - it contradicts positive analysis results
  // The coaching card handles this case instead
  if (readiness === 'needs_framing') return null

  const config = READINESS_CONFIG[readiness]
  if (!config) return null

  const IconComponent = config.icon
  // Task 2: Round score to integer for cleaner display
  const displayScore = score != null ? Math.round(score) : null

  // Task 6: Ready + warnings consistency - show modified label when ready but warnings exist
  const isReadyWithWarnings = readiness === 'ready' && hasWarnings
  const displayLabel = isReadyWithWarnings ? 'Ready — Needs attention' : config.label
  const displayTooltip = isReadyWithWarnings
    ? 'Analysis is ready but there are items that need attention. Review the warnings below.'
    : config.tooltip

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`${typography.caption} inline-flex items-center gap-1 px-2 py-0.5 rounded border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
        title={displayTooltip}
        aria-label={`Decision readiness: ${displayLabel}. ${displayTooltip}`}
      >
        <IconComponent className={`h-3.5 w-3.5 ${config.iconColor}`} aria-hidden="true" />
        {displayLabel}
        {displayScore != null && (
          <span className="ml-1 opacity-75">({displayScore}%)</span>
        )}
      </span>
    </div>
  )
}

/**
 * Task 5: Stability badge component with tiered plain language.
 * Shows label only - percentage is behind progressive disclosure (tooltip).
 * - >= 0.85 → "Stable result" (green)
 * - >= 0.70 → "Mostly stable" (green)
 * - >= 0.55 → "Sensitive to assumptions" (amber)
 * - < 0.55 → "Highly sensitive" (red)
 */
function StabilityBadge({
  stability,
}: {
  /** Stability score (0-1) */
  stability?: number
}) {
  if (stability == null) return null

  const stabilityLabel = getStabilityLabel(stability)
  const colors = getStabilityColor(stability)
  const stabilityPct = Math.round(stability * 100)

  return (
    <span
      className={`${typography.caption} inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}
      title={`Result stability: ${stabilityPct}% — percentage of simulations where this option stays the winner`}
      aria-label={`${stabilityLabel}. ${stabilityPct}% stable in simulations.`}
    >
      <span className={`w-2 h-2 rounded-full ${colors.dot}`} aria-hidden="true" />
      {stabilityLabel}
    </span>
  )
}

/**
 * Task 1.3: Format outcome description in natural language.
 * Data-bound copy based on actual worse/better bounds.
 *
 * Logic for crossing-zero ranges (worse < 0, better > 0):
 * - If better <= 0: outcomes are consistently negative
 * - If better is small positive (< 10% of |expected|): near break-even
 * - If better is meaningfully positive: strong improvement possible
 *
 * Logic for all-positive ranges:
 * - Uses percentage thresholds (50% = strong, 20% = moderate)
 * - Handles probability form (0.5) vs percentage form (50) via heuristic
 */
function formatOutcomeDescription(worse: number, expected: number, better: number): string {
  // Heuristic to convert from probability form (0-2 range) to percentage form
  // Values like 0.93 become 93, values like 1.8 become 180, values like 35 stay 35
  const toPercentage = (v: number): number => Math.abs(v) <= 2 ? v * 100 : v

  const worsePct = toPercentage(worse)
  const expectedPct = toPercentage(expected)
  const betterPct = toPercentage(better)

  // Check if range crosses zero (worse negative, better positive)
  const crossesZero = worsePct < 0 && betterPct > 0

  // Case 1: Best case is negative - consistently bad outcomes
  if (betterPct <= 0) {
    return COPY.OUTCOME_RANGE_NEGATIVE
  }

  // Case 2: Range crosses zero - data-bound logic based on better bound
  if (crossesZero) {
    // Calculate threshold: "small" = better is < 10% of |expected| magnitude
    const expectedMagnitude = Math.abs(expectedPct)
    const smallThreshold = expectedMagnitude * 0.1

    // Small positive upside (< 10% of expected magnitude) = near break-even
    if (betterPct < smallThreshold) {
      return COPY.OUTCOME_RANGE_NEAR_BREAKEVEN
    }
    // Meaningful positive upside = could go either way with strong improvement
    return COPY.OUTCOME_RANGE_WIDE
  }

  // Case 3: All positive outcomes (worse >= 0)
  if (worsePct >= 0) {
    const rangeWidth = Math.abs(betterPct - worsePct)
    if (rangeWidth > 50) {
      return 'Likely positive, but with wide uncertainty.'
    }
    if (expectedPct > 50) {
      return 'Likely a strong positive outcome'
    }
    if (expectedPct > 20) {
      return 'Likely a moderate positive outcome'
    }
    return 'Likely a small positive outcome'
  }

  // Fallback for edge cases
  return COPY.OUTCOME_RANGE_FALLBACK
}

/**
 * Task 1.4: Validate range values for display.
 * Uses expected (mean) value for center marker, NOT p50 (median).
 *
 * NOTE: Percentile ordering (p10 <= expected <= p90) is enforced in the data layer
 * (useResultsSectionData.normalizePercentiles). This function only handles
 * presentation-level fallbacks (missing values, unavailable state).
 *
 * If ordering is still violated at this point, we display as-is rather than
 * silently fixing it - this helps surface upstream data bugs.
 */
function validateRange(
  p10: number | null | undefined,
  expectedMean: number | null | undefined,
  p90: number | null | undefined
): {
  worse: number
  expected: number
  better: number
  showExpectedOnly?: boolean
  unavailable?: boolean
} {
  // Case 1: No data at all
  if (expectedMean == null) {
    return { worse: 0, expected: 0, better: 0, unavailable: true }
  }

  // Case 2: Missing p10 or p90 — show expected only
  if (p10 == null || p90 == null) {
    return { worse: 0, expected: expectedMean, better: 0, showExpectedOnly: true }
  }

  // Case 3: All values present - trust data layer ordering, display as-is
  // (Data layer handles reordering in useResultsSectionData.normalizePercentiles)
  return { worse: p10, expected: expectedMean, better: p90 }
}

/**
 * Task 1.4: Range bar component showing p10, expected (mean), p90 distribution.
 * Uses outcome.mean for expected value (NOT p50/median).
 * Handles negative values, >100% values, and dynamic domain.
 */
function RangeBar({
  p10,
  expectedValue,
  p90,
  outcomeUnit,
  outcomeUnitSymbol,
}: {
  p10: number | null
  /** Expected value (outcome.mean) - NOT p50/median */
  expectedValue: number | null
  p90: number | null
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
}) {
  // Validate and fix range values (using expected/mean, not p50)
  const rangeData = validateRange(p10, expectedValue, p90)

  // Handle unavailable state
  if (rangeData.unavailable) {
    return (
      <div className="mt-4 p-3 bg-slate-100 border border-sand-200 rounded-lg">
        <p className="text-xs text-slate-500 text-center">{EMPTY_STATES.rangeData}</p>
      </div>
    )
  }

  // Handle expected-only state (missing bounds)
  if (rangeData.showExpectedOnly) {
    return (
      <div className="mt-4">
        <div className="flex justify-center">
          <div className="text-center">
            <span className="text-xs text-slate-500">Expected</span>
            <span className="block text-xl font-semibold text-success-700">
              {formatOutcome(rangeData.expected, outcomeUnit, outcomeUnitSymbol)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const { worse, expected, better } = rangeData

  // Dynamic domain based on ACTUAL values (Fix 3)
  // Don't hardcode 0 or 1 as bounds - use actual min/max
  const minVal = Math.min(worse, expected, better)
  const maxVal = Math.max(worse, expected, better)
  const range = maxVal - minVal

  // Calculate positions as percentage of dynamic range
  // If range is 0 (all values equal), center everything
  const worsePos = range > 0 ? ((worse - minVal) / range) * 100 : 0
  const expectedPos = range > 0 ? ((expected - minVal) / range) * 100 : 50
  const betterPos = range > 0 ? ((better - minVal) / range) * 100 : 100

  return (
    <div className="relative mt-4">
      {/* Labels */}
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Worse</span>
        <span>Expected</span>
        <span>Better</span>
      </div>

      {/* Bar track */}
      <div className="relative h-2 bg-sand-200 rounded-full">
        {/* Range fill */}
        <div
          className="absolute h-full bg-success-200 rounded-full"
          style={{
            left: `${worsePos}%`,
            width: `${Math.max(0, betterPos - worsePos)}%`,
          }}
        />
        {/* Expected (outcome.mean) marker - NOT p50/median */}
        <div
          className="absolute w-3 h-3 bg-success-600 rounded-full -translate-x-1/2 -translate-y-0.5"
          style={{ left: `${expectedPos}%` }}
        />
      </div>

      {/* Value labels */}
      <div className="flex justify-between text-xs font-mono text-slate-600 mt-2">
        <span>{formatOutcome(worse, outcomeUnit, outcomeUnitSymbol)}</span>
        <span className="font-semibold text-success-700">{formatOutcome(expected, outcomeUnit, outcomeUnitSymbol)}</span>
        <span>{formatOutcome(better, outcomeUnit, outcomeUnitSymbol)}</span>
      </div>
    </div>
  )
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

function OptionRow({
  option,
  onFocus,
  outcomeUnit,
  outcomeUnitSymbol,
  goalThreshold,
  recommendationLabel,
}: {
  option: OptionResult
  onFocus?: (nodeId: string) => void
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
  goalThreshold?: number | null
  /** P0 Results Brief: Stability-based recommendation label (null = suppress) */
  recommendationLabel?: string | null
}) {
  const handleClick = useCallback(() => {
    if (onFocus) {
      onFocus(option.id)
    } else {
      focusNodeById(option.id)
    }
  }, [option.id, onFocus])

  // Fix A: Only show goalProbability when both threshold AND probability are present
  // When probability_of_goal is absent, show rank-based labels instead of "X expected"
  const showGoalProbability = goalThreshold != null && option.goalProbability != null

  // Task 2.2: Format delta from baseline (only for non-baseline options)
  const deltaText = !option.isBaseline
    ? formatDelta(option.deltaFromBaseline, outcomeUnit, outcomeUnitSymbol)
    : null

  // Fix A: Rank-based labels for ALL options when probability is absent
  // rank 1 = "Strongest performer", rank 2 = "Second strongest", etc.
  const getRankLabel = (rank: number | undefined): string => {
    if (rank == null) return '—'
    if (rank === 1) return 'Strongest performer'
    if (rank === 2) return 'Second strongest'
    if (rank === 3) return 'Third strongest'
    return `${rank}th strongest`
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      className={`
        w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer
        bg-panel border border-panel-border hover:bg-panel-hover
        focus:outline-none focus:ring-2 focus:ring-info-500 focus:ring-offset-1
        ${option.isRecommended ? 'border-l-4 border-l-success' : ''}
      `}
      aria-label={`Focus on ${option.label} in model`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-sm text-text-body hover:underline"
          >
            {option.label}
          </span>
          {/* Task 3: Stability-based recommendation label (not "Recommended") */}
          {option.isRecommended && recommendationLabel && (
            <span className="text-xs bg-success-light text-success px-1.5 py-0.5 rounded">
              {recommendationLabel}
            </span>
          )}
          {option.isBaseline && (
            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
              Baseline
            </span>
          )}
        </div>
        {/* P1: Story headlines removed from all option cards - banned language risk */}
        {/* Winner shows badge only, non-winners show rank-based labels in right column */}
      </div>
      <div className="flex flex-col items-end">
        {/* Fix A: Show goal probability when available, otherwise rank-based labels */}
        <span className="text-sm text-text-body">
          {showGoalProbability && option.goalProbability != null
            ? `${formatPercent(option.goalProbability)} chance of achieving your goal`
            : getRankLabel(option.rank)}
        </span>
        {deltaText && (
          <span className="text-xs text-text-light">
            {deltaText}
          </span>
        )}
      </div>
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
    // Task 1.4: How winner was determined
    determinedBy,
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
        <p className="text-sm text-slate-600">
          {EMPTY_STATES.recommendation}
        </p>
      </div>
    )
  }

  // Task 1.4: Use outcome.mean (expected) consistently - NOT p50 (median)
  const expectedValue = recommendedOption.expected
  const hasGoalProbability = typeof recommendedOption.goalProbability === 'number'
  const showGoalProbabilityHeadline = goalThreshold != null && hasGoalProbability
  const shouldShowOutcomeDescription =
    typeof recommendedOption.outcome.p10 === 'number' &&
    typeof expectedValue === 'number' &&
    typeof recommendedOption.outcome.p90 === 'number'
  const outcomeDescription = shouldShowOutcomeDescription
    ? formatOutcomeDescription(
        recommendedOption.outcome.p10 as number,
        expectedValue as number,
        recommendedOption.outcome.p90 as number
      )
    : null

  // Task 1.4: Get winner label based on determination method
  const winnerLabel = getWinnerLabel(determinedBy)

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

  // Compute runner-up for HeroSection (second-best option by rank)
  const runnerUp = useMemo(() => {
    if (allOptions.length < 2) return null
    // Find second-ranked option (rank 2) or first non-recommended option
    const byRank = allOptions.find(o => o.rank === 2)
    if (byRank) return byRank
    // Fallback: first non-recommended option
    return allOptions.find(o => !o.isRecommended) ?? null
  }, [allOptions])

  // Task 6: Coaching card dismissal persistence per response_hash
  const coachingDismissalKey = responseHash ? `coaching-dismissed-${responseHash}` : null
  const [coachingDismissed, setCoachingDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined' || !coachingDismissalKey) return false
    return sessionStorage.getItem(coachingDismissalKey) === 'true'
  })

  // Reset dismissal when response_hash changes
  useEffect(() => {
    if (coachingDismissalKey) {
      const wasDismissed = sessionStorage.getItem(coachingDismissalKey) === 'true'
      setCoachingDismissed(wasDismissed)
    } else {
      setCoachingDismissed(false)
    }
  }, [coachingDismissalKey])

  const handleDismissCoaching = useCallback(() => {
    setCoachingDismissed(true)
    if (coachingDismissalKey && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(coachingDismissalKey, 'true')
    }
  }, [coachingDismissalKey])

  // Task 6: Show coaching card when baseline absent OR option count <= 2
  const showCoachingCard = !coachingDismissed && (!hasBaseline || optionCount <= 2) && !isSingleOption

  return (
    <div className="space-y-4">
      {/* Task 6: Coaching card for framing improvements (replaces "Needs Framing" badge) */}
      {showCoachingCard && (
        <div className="p-3 bg-panel border border-info rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-text-body">
              You're comparing {optionCount} option{optionCount !== 1 ? 's' : ''} {!hasBaseline ? 'with no baseline' : ''}.
              Adding a 'do nothing' option or additional alternatives would strengthen the analysis.
            </p>
            <button
              onClick={handleDismissCoaching}
              className="text-xs text-text-light hover:text-text-body flex-shrink-0"
              aria-label="Dismiss coaching suggestion"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Task 1.7: Goal context - displayed when present */}
      {goalText && (
        <div className="text-sm text-slate-600">
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
        onFocusNode={onFocusNode}
      />

      {/* Option comparison (multiple options) */}
      {!isSingleOption && allOptions.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-sm text-slate-600">How this compares:</h4>
          <div className="space-y-2">
            {allOptions.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                onFocus={onFocusNode}
                outcomeUnit={outcomeUnit}
                outcomeUnitSymbol={outcomeUnitSymbol}
                goalThreshold={goalThreshold}
                recommendationLabel={getRecommendationLabel(recommendationStability)}
              />
            ))}
          </div>

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
          <p className="text-sm text-slate-600">
            Add another option to compare alternatives.
          </p>
        </div>
      )}
      {/* Note: "View on canvas" link removed - already in Objective section */}
    </div>
  )
}

export default RecommendationSection

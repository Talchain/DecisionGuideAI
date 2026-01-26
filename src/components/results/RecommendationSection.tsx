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

import { useCallback } from 'react'
import type { RecommendationSectionData, OptionResult, OutcomeUnitType, StabilityLevel, WinnerDeterminedBy, RobustnessLevel, RobustnessLabel } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { EMPTY_STATES } from './emptyStates'
import { formatOutcomeValue, type OutcomeUnits } from '../../lib/format'
import { typography } from '../../styles/typography'

interface RecommendationSectionProps {
  data: RecommendationSectionData
  onFocusNode?: (nodeId: string) => void
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
 * Derive stability level from recommendation_stability score.
 * High (≥80%), Medium (50-79%), Low (<50%)
 */
function getStabilityLevel(stability: number): StabilityLevel {
  if (stability >= 0.8) return 'high'
  if (stability >= 0.5) return 'medium'
  return 'low'
}

/**
 * Task 1.6: Stability chip component showing recommendation stability level.
 * Updated text: "Stays best in X% of scenarios tested"
 */
function StabilityChip({ stability }: { stability: number }) {
  const level = getStabilityLevel(stability)
  const percentage = Math.round(stability * 100)

  const config = {
    high: {
      bgColor: 'bg-success-100',
      textColor: 'text-success-700',
      borderColor: 'border-success-300',
    },
    medium: {
      bgColor: 'bg-warning-100',
      textColor: 'text-warning-700',
      borderColor: 'border-warning-300',
    },
    low: {
      bgColor: 'bg-danger-100',
      textColor: 'text-danger-700',
      borderColor: 'border-danger-300',
    },
  }[level]

  return (
    <span
      className={`${typography.caption} inline-flex items-center px-2 py-0.5 rounded border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      title={`How often the recommendation stays winner under uncertainty`}
    >
      Stays best in {percentage}% of scenarios tested
    </span>
  )
}

/**
 * Task 1.4: Get winner label based on how the winner was determined.
 * - win_probability present → "MOST LIKELY TO BE BEST"
 * - Only expected/p50 → "HIGHEST EXPECTED OUTCOME"
 * - Neither → "UNABLE TO DETERMINE BEST OPTION"
 */
function getWinnerLabel(determinedBy: WinnerDeterminedBy | undefined): string {
  switch (determinedBy) {
    case 'win_probability':
      return 'MOST LIKELY TO BE BEST'
    case 'expected_outcome':
      return 'HIGHEST EXPECTED OUTCOME'
    default:
      return 'UNABLE TO DETERMINE BEST OPTION'
  }
}

/**
 * Task 1.5: Robustness badge component.
 * Maps level (high/medium/low/very_low) or label (robust/moderate/fragile) to display.
 * Handles normalisation: uppercase, trim, replace('-', '_')
 */
const BADGE_CONFIG: Record<string, { dotColor: string; text: string; bgColor: string; textColor: string }> = {
  high: { dotColor: 'bg-success-500', text: 'Robust', bgColor: 'bg-success-50', textColor: 'text-success-700' },
  robust: { dotColor: 'bg-success-500', text: 'Robust', bgColor: 'bg-success-50', textColor: 'text-success-700' },
  medium: { dotColor: 'bg-warning-500', text: 'Moderate', bgColor: 'bg-warning-50', textColor: 'text-warning-700' },
  moderate: { dotColor: 'bg-warning-500', text: 'Moderate', bgColor: 'bg-warning-50', textColor: 'text-warning-700' },
  low: { dotColor: 'bg-orange-500', text: 'Fragile', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  fragile: { dotColor: 'bg-orange-500', text: 'Fragile', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  very_low: { dotColor: 'bg-danger-500', text: 'Very Fragile', bgColor: 'bg-danger-50', textColor: 'text-danger-700' },
}

function RobustnessBadge({
  level,
  label
}: {
  level?: RobustnessLevel
  label?: RobustnessLabel
}) {
  // Normalise: level takes precedence, then label as fallback
  // Handle uppercase, trim whitespace, replace hyphens with underscores
  const badgeSource = level ?? label
  if (!badgeSource) return null

  const badgeKey = badgeSource.toLowerCase().trim().replace(/-/g, '_')
  const config = BADGE_CONFIG[badgeKey]

  if (!config) return null

  const { dotColor, text, bgColor, textColor } = config

  return (
    <span
      className={`${typography.caption} inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${bgColor} ${textColor}`}
      title="How stable the recommendation is under uncertainty"
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
      {text}
    </span>
  )
}

/**
 * Task 1.3: Format outcome description in natural language.
 * Note: Values are in probability form (e.g., 0.5 = 50%, 0.93 = 93%).
 * FIX: Convert to percentage for threshold comparison.
 * Uses polarity-correct language: positive = improvement, negative = decline.
 * Updated rules to handle wide/zero-crossing ranges accurately.
 */
function formatOutcomeDescription(p10: number, expectedMean: number, p90: number): string {
  // Convert from probability form (0-2 range) to percentage form for comparison
  // Values like 0.93 become 93, values like 1.8 become 180
  const p10Pct = Math.abs(p10) <= 2 ? p10 * 100 : p10
  const expectedPct = Math.abs(expectedMean) <= 2 ? expectedMean * 100 : expectedMean
  const p90Pct = Math.abs(p90) <= 2 ? p90 * 100 : p90

  // Calculate range width
  const rangeWidth = Math.abs(p90Pct - p10Pct)

  // Check if range crosses zero
  const crossesZero = p10Pct < 0 && p90Pct > 0

  // Task 1.3: Apply new rules for range interpretation
  if (crossesZero && rangeWidth > 100) {
    return 'Could go either way — from significant decline to strong improvement. Consider strengthening key assumptions.'
  }

  if (crossesZero && rangeWidth <= 100) {
    return 'Could go either way — outcomes range from decline to improvement.'
  }

  // All positive outcomes
  if (p10Pct >= 0) {
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

  // All negative outcomes
  if (p90Pct <= 0) {
    return 'Likely negative outcome under current assumptions.'
  }

  // Fallback for edge cases
  return 'Outcome uncertain — review key assumptions.'
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

function OptionRow({
  option,
  onFocus,
  outcomeUnit,
  outcomeUnitSymbol,
}: {
  option: OptionResult
  onFocus?: (nodeId: string) => void
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
}) {
  const handleClick = useCallback(() => {
    if (onFocus) {
      onFocus(option.id)
    } else {
      focusNodeById(option.id)
    }
  }, [option.id, onFocus])

  // Task 1.4: Use outcome.mean (expected) consistently
  const displayValue = option.expected ?? option.goalProbability
  const displaySuffix = option.goalProbability != null && option.expected == null
    ? 'chance'
    : 'expected'

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between
        ${option.isRecommended
          ? 'bg-success-50 border border-success-200 hover:bg-success-100'
          : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
        }
      `}
      title={`Click to focus ${option.label} on canvas`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-sm ${
            option.isRecommended ? 'text-success-900' : 'text-slate-700'
          }`}
        >
          {option.label}
        </span>
        {option.isRecommended && (
          <span className="text-xs bg-success-100 text-success-700 px-1.5 py-0.5 rounded">
            Recommended
          </span>
        )}
      </div>
      <span
        className={`text-sm ${
          option.isRecommended ? 'text-success-700' : 'text-slate-600'
        }`}
      >
        {displayValue == null
          ? '—'
          : displaySuffix === 'chance'
            ? `${formatPercent(displayValue)} ${displaySuffix}`
            : `${formatOutcome(displayValue, outcomeUnit, outcomeUnitSymbol)} ${displaySuffix}`}
      </span>
    </button>
  )
}

export function RecommendationSection({
  data,
  onFocusNode,
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
    // Task 1.3: Win probability
    winProbability,
    // Task 1.4: How winner was determined
    determinedBy,
    // Task 1.5: Robustness level and label
    robustnessLevel,
    robustnessLabel,
    // Task 1.7: Goal text
    goalText,
  } = data

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

  return (
    <div className="space-y-4">
      {/* Task 1.7: Goal context - displayed when present */}
      {goalText && (
        <div className="text-sm text-slate-600">
          <span className="font-medium">Goal:</span> {goalText}
        </div>
      )}

      {/* Task 1.4: Winner label */}
      <div className="text-xs font-semibold text-slate-500 tracking-wide">
        {winnerLabel}
      </div>

      {/* Main Recommendation */}
      <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
        {/* Best estimate headline */}
        <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs text-success-700">Best estimate:</span>
            <span className="text-xl font-semibold text-success-900 ml-2">
              {expectedValue != null
                ? `~${formatOutcome(Math.abs(expectedValue), outcomeUnit, outcomeUnitSymbol)} ${expectedValue >= 0 ? 'improvement' : 'decline'}`
                : hasGoalProbability
                  ? `${formatPercent(recommendedOption.goalProbability as number)} chance of reaching goal`
                  : EMPTY_STATES.rangeData}
            </span>
          </div>
          {/* Task 1.5: Robustness badge */}
          <RobustnessBadge level={robustnessLevel} label={robustnessLabel} />
        </div>

        {/* Task 3: Conditional Stability/Win Display
            - Always show stability line if hasStability
            - Only show win line if showWinSeparately (both exist AND differ by > 0.05)
            - If only hasWin (no stability), show win line alone
            CRITICAL: No fake defaults (?? 0) */}
        {(() => {
          const hasStability = recommendationStability != null
          const hasWin = winProbability != null
          const bothExist = hasStability && hasWin
          const showWinSeparately = bothExist &&
            Math.abs((recommendationStability as number) - (winProbability as number)) > 0.05
          const showWinAlone = hasWin && !hasStability

          return (
            <>
              {/* Always show stability if available */}
              {hasStability && (
                <div className="mt-2">
                  <StabilityChip stability={recommendationStability as number} />
                </div>
              )}
              {/* Show win probability only when different from stability OR when stability missing */}
              {/* FIX: Use formatPercent for consistency and to avoid "0%" for small non-zero values */}
              {(showWinSeparately || showWinAlone) && (winProbability as number) > 0 && (
                <p className="text-sm text-success-700 mt-2">
                  Wins in {formatPercent(winProbability as number)} of scenarios tested
                </p>
              )}
            </>
          )
        })()}

        {/* Natural language description */}
        {outcomeDescription && (
          <p className="text-sm text-success-700">
            {outcomeDescription}
          </p>
        )}

        {/* Range bar - Task 1.4: Use outcome.mean for expected value */}
        {expectedValue != null && (
          <RangeBar
            p10={recommendedOption.outcome.p10}
            expectedValue={expectedValue}
            p90={recommendedOption.outcome.p90}
            outcomeUnit={outcomeUnit}
            outcomeUnitSymbol={outcomeUnitSymbol}
          />
        )}
      </div>

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
              />
            ))}
          </div>

          {/* Task 5: Near-tie explanatory text */}
          {showTieExplanation && (
            <p className="text-xs text-slate-500 mt-2 italic">
              Expected outcomes are similar. The recommendation is based on which option wins more consistently across scenarios tested.
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

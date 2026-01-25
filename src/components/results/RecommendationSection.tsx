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
import type { RecommendationSectionData, OptionResult, OutcomeUnitType, StabilityLevel } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { EMPTY_STATES } from './emptyStates'
import { formatOutcomeValue, type OutcomeUnits } from '../../lib/format'

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
  unit: OutcomeUnitType = 'percent',
  symbol?: string
): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }

  // Calculate the final display value to determine decimals
  // For percent: values in probability form (typically -2 to +2 range) are multiplied by 100
  // Values like 1.8 = 180% improvement should be treated as probability form
  // FIX: Use threshold of 2 instead of 1 to catch >100% improvements
  const isProbability = unit === 'percent' && Math.abs(value) <= 2
  const displayValue = isProbability ? value * 100 : value

  // Smart decimals: 1 for small display values, 0 for larger ones
  const decimals = Math.abs(displayValue) < 1 && displayValue !== 0 ? 1 : 0

  // Pass pre-converted value to avoid double-conversion in formatOutcomeValue
  // Use the calculated display value directly with 'count' unit to skip formatOutcomeValue's probability detection
  if (unit === 'percent') {
    return `${displayValue.toFixed(decimals)}%`
  }

  return formatOutcomeValue(value, unit as OutcomeUnits, symbol, { decimals })
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
 * Stability chip component showing recommendation stability level.
 */
function StabilityChip({ stability }: { stability: number }) {
  const level = getStabilityLevel(stability)
  const percentage = Math.round(stability * 100)

  const config = {
    high: {
      label: 'High',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-300',
    },
    medium: {
      label: 'Medium',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-300',
    },
    low: {
      label: 'Low',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      borderColor: 'border-red-300',
    },
  }[level]

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      title={`Recommendation stays winner ${percentage}% of the time under uncertainty`}
    >
      {config.label} stability ({percentage}%)
    </span>
  )
}

/**
 * Format outcome description in natural language.
 * Note: Values are in probability form (e.g., 0.5 = 50%, 0.93 = 93%).
 * FIX: Convert to percentage for threshold comparison.
 * Uses polarity-correct language: positive = improvement, negative = decline.
 */
function formatOutcomeDescription(p10: number, p50: number, p90: number): string {
  // Convert from probability form (0-2 range) to percentage form for comparison
  // Values like 0.93 become 93, values like 1.8 become 180
  const p10Pct = Math.abs(p10) <= 2 ? p10 * 100 : p10
  const p50Pct = Math.abs(p50) <= 2 ? p50 * 100 : p50
  const p90Pct = Math.abs(p90) <= 2 ? p90 * 100 : p90

  // Determine the direction and magnitude using percentage thresholds
  if (p50Pct >= 0) {
    if (p10Pct < 0 && p90Pct > 0) {
      return 'Could range from slight decline to strong improvement'
    }
    if (p50Pct > 50) {
      return 'Likely a strong positive outcome'
    }
    if (p50Pct > 20) {
      return 'Likely a moderate positive outcome'
    }
    return 'Likely a small positive outcome'
  } else {
    // Negative expected outcome
    if (Math.abs(p50Pct) > 50) {
      return 'Likely a significant negative impact'
    }
    if (Math.abs(p50Pct) > 20) {
      return 'Likely a moderate negative impact'
    }
    return 'May have a small negative impact'
  }
}

/**
 * Validate range values for display.
 *
 * NOTE: Percentile ordering (p10 <= p50 <= p90) is enforced in the data layer
 * (useResultsSectionData.normalizePercentiles). This function only handles
 * presentation-level fallbacks (missing values, unavailable state).
 *
 * If ordering is still violated at this point, we display as-is rather than
 * silently fixing it - this helps surface upstream data bugs.
 */
function validateRange(
  p10: number | null | undefined,
  p50: number | null | undefined,
  p90: number | null | undefined
): {
  worse: number
  expected: number
  better: number
  showExpectedOnly?: boolean
  unavailable?: boolean
} {
  // Case 1: No data at all
  if (p50 == null) {
    return { worse: 0, expected: 0, better: 0, unavailable: true }
  }

  // Case 2: Missing p10 or p90 — show expected only
  if (p10 == null || p90 == null) {
    return { worse: 0, expected: p50, better: 0, showExpectedOnly: true }
  }

  // Case 3: All values present - trust data layer ordering, display as-is
  // (Data layer handles reordering in useResultsSectionData.normalizePercentiles)
  return { worse: p10, expected: p50, better: p90 }
}

/**
 * Range bar component showing p10, p50, p90 distribution.
 * Handles negative values, >100% values, and dynamic domain.
 */
function RangeBar({
  p10,
  p50,
  p90,
  outcomeUnit = 'percent',
  outcomeUnitSymbol,
}: {
  p10: number | null
  p50: number | null
  p90: number | null
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
}) {
  // Validate and fix range values
  const rangeData = validateRange(p10, p50, p90)

  // Handle unavailable state
  if (rangeData.unavailable) {
    return (
      <div className="mt-4 p-3 bg-slate-100 border border-slate-200 rounded-lg">
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
            <span className="block text-lg font-semibold text-emerald-700">
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
      <div className="relative h-2 bg-slate-200 rounded-full">
        {/* Range fill */}
        <div
          className="absolute h-full bg-emerald-200 rounded-full"
          style={{
            left: `${worsePos}%`,
            width: `${Math.max(0, betterPos - worsePos)}%`,
          }}
        />
        {/* Expected (p50) marker */}
        <div
          className="absolute w-3 h-3 bg-emerald-600 rounded-full -translate-x-1/2 -translate-y-0.5"
          style={{ left: `${expectedPos}%` }}
        />
      </div>

      {/* Value labels */}
      <div className="flex justify-between text-xs text-slate-600 mt-2 font-mono">
        <span>{formatOutcome(worse, outcomeUnit, outcomeUnitSymbol)}</span>
        <span className="font-semibold text-emerald-700">{formatOutcome(expected, outcomeUnit, outcomeUnitSymbol)}</span>
        <span>{formatOutcome(better, outcomeUnit, outcomeUnitSymbol)}</span>
      </div>
    </div>
  )
}

function OptionRow({
  option,
  onFocus,
  outcomeUnit = 'percent',
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

  const displayValue = option.p50 ?? option.expected ?? option.goalProbability
  const displaySuffix = option.goalProbability != null && option.p50 == null && option.expected == null
    ? 'chance'
    : 'expected'

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between
        ${option.isRecommended
          ? 'bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
          : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
        }
      `}
      title={`Click to focus ${option.label} on canvas`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`font-medium text-sm ${
            option.isRecommended ? 'text-emerald-900' : 'text-slate-700'
          }`}
        >
          {option.label}
        </span>
        {option.isRecommended && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
            Recommended
          </span>
        )}
      </div>
      <span
        className={`font-semibold text-sm ${
          option.isRecommended ? 'text-emerald-700' : 'text-slate-600'
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
    outcomeUnit = 'percent',
    outcomeUnitSymbol,
    recommendationStability,
  } = data

  // Error state
  if (analysisStatus === 'failed' || analysisStatus === 'blocked') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
          <span>Analysis could not complete</span>
        </div>
        {statusReason && (
          <p className="text-sm text-red-700">{statusReason}</p>
        )}
      </div>
    )
  }

  // No recommendation available
  if (!recommendedOption) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600 flex items-start gap-2">
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.recommendation}
        </p>
      </div>
    )
  }

  const expectedValue = recommendedOption.expected ?? recommendedOption.p50
  const hasGoalProbability = typeof recommendedOption.goalProbability === 'number'
  const shouldShowOutcomeDescription =
    typeof recommendedOption.p10 === 'number' &&
    typeof recommendedOption.p50 === 'number' &&
    typeof recommendedOption.p90 === 'number'
  const outcomeDescription = shouldShowOutcomeDescription
    ? formatOutcomeDescription(
        recommendedOption.p10 as number,
        recommendedOption.p50 as number,
        recommendedOption.p90 as number
      )
    : null

  return (
    <div className="space-y-4">
      {/* Main Recommendation */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
        {/* Best estimate headline - goal is shown in Objective section */}
        <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-sm text-emerald-700">Best estimate:</span>
            <span className="text-lg font-semibold text-emerald-900 ml-2">
              {expectedValue != null
                ? `~${formatOutcome(Math.abs(expectedValue), outcomeUnit, outcomeUnitSymbol)} ${expectedValue >= 0 ? 'improvement' : 'decline'}`
                : hasGoalProbability
                  ? `${formatPercent(recommendedOption.goalProbability as number)} chance of reaching goal`
                  : EMPTY_STATES.rangeData}
            </span>
          </div>
          {/* Recommendation stability chip */}
          {typeof recommendationStability === 'number' && (
            <StabilityChip stability={recommendationStability} />
          )}
        </div>

        {/* Natural language description */}
        {outcomeDescription && (
          <p className="text-sm text-emerald-700">
            {outcomeDescription}
          </p>
        )}

        {/* Range bar */}
        {expectedValue != null && (
          <RangeBar
            p10={recommendedOption.p10}
            p50={recommendedOption.p50}
            p90={recommendedOption.p90}
            outcomeUnit={outcomeUnit}
            outcomeUnitSymbol={outcomeUnitSymbol}
          />
        )}
      </div>

      {/* Option comparison (multiple options) */}
      {!isSingleOption && allOptions.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-600">How this compares:</h4>
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

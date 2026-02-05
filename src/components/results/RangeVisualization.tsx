/**
 * RangeVisualization Component (P3 Task 3-6)
 *
 * Displays stacked option range bars showing outcome distributions.
 * Shows p10-p90 range with p50 marker for each option.
 *
 * Features:
 * - Top 3 options by win_probability, sorted descending
 * - Winner bar: success/mint-500 color
 * - Other bars: info/sky-200 color
 * - Optional goal_threshold target line (sun-500)
 * - Optional probability_of_goal percentage display
 * - Conditional driver sentence (Task 5)
 * - Graceful degradation when data missing
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import type { OptionResult, OutcomeUnitType } from './types'

export interface RangeVisualizationProps {
  /** All options with outcome data */
  options: OptionResult[]
  /** Goal threshold for target line (optional) */
  goalThreshold?: number | null
  /** Winner option ID (for color differentiation) */
  winnerId?: string
  /** Outcome unit for formatting threshold label */
  outcomeUnit?: OutcomeUnitType
  /** Currency symbol if outcomeUnit is 'currency' */
  outcomeUnitSymbol?: string
  /** P3 Task 5: Top driver label for conditional sentence (from factor_sensitivity[0]) */
  topDriverLabel?: string
  /** P3 Task 5: M2 override - rich scenario contexts (future use) */
  scenarioContexts?: string[]
}

/**
 * Format threshold value for display.
 */
function formatThreshold(
  value: number,
  unit?: OutcomeUnitType,
  symbol?: string
): string {
  if (unit === 'currency' && symbol) {
    return `${symbol}${value.toLocaleString()}`
  }
  if (unit === 'percent') {
    return `${value}%`
  }
  return value.toLocaleString()
}

/**
 * Single option range bar with label and optional probability of goal.
 */
function OptionRangeBar({
  option,
  isWinner,
  minValue,
  maxValue,
  goalThreshold,
  outcomeUnit,
  outcomeUnitSymbol,
}: {
  option: OptionResult
  isWinner: boolean
  minValue: number
  maxValue: number
  goalThreshold?: number | null
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
}) {
  const { p10, p50, p90 } = option.outcome || {}

  // Skip if no outcome data
  if (p10 == null || p50 == null || p90 == null) {
    return null
  }

  const range = maxValue - minValue
  if (range <= 0) return null

  // Calculate positions as percentages
  const p10Pct = ((p10 - minValue) / range) * 100
  const p50Pct = ((p50 - minValue) / range) * 100
  const p90Pct = ((p90 - minValue) / range) * 100
  const barWidth = p90Pct - p10Pct

  // Calculate threshold position if set
  const thresholdPct = goalThreshold != null
    ? ((goalThreshold - minValue) / range) * 100
    : null

  // Bar colors based on winner status
  const barColor = isWinner ? 'bg-success' : 'bg-info/30'
  const markerColor = isWinner ? 'bg-success-light' : 'bg-info'

  return (
    <div className="space-y-1">
      {/* Option label */}
      <div className="flex items-center justify-between">
        <span className={`${typography.label} text-text-body truncate`}>
          {option.label}
        </span>
        {/* Probability of goal (if available) */}
        {option.goalProbability != null && goalThreshold != null && (
          <span className={`${typography.label} text-text-light ml-2 flex-shrink-0`}>
            {Math.round(option.goalProbability * 100)}%
          </span>
        )}
      </div>

      {/* Range bar container */}
      <div className="relative h-2 bg-slate-100 rounded-full overflow-visible">
        {/* The p10-p90 range bar */}
        <div
          className={`absolute h-2 rounded-full ${barColor}`}
          style={{
            left: `${p10Pct}%`,
            width: `${barWidth}%`,
          }}
        />

        {/* p50 marker (vertical line) */}
        <div
          className={`absolute w-0.5 h-3 -top-0.5 ${markerColor} rounded-full`}
          style={{ left: `${p50Pct}%`, transform: 'translateX(-50%)' }}
          title={`Median: ${p50}`}
        />

        {/* Goal threshold target line (if set) */}
        {thresholdPct != null && thresholdPct >= 0 && thresholdPct <= 100 && (
          <>
            <div
              className="absolute w-0.5 h-4 -top-1 bg-goal border-dashed"
              style={{
                left: `${thresholdPct}%`,
                transform: 'translateX(-50%)',
                borderLeft: '1px dashed',
              }}
              title={`Target: ${formatThreshold(goalThreshold!, outcomeUnit, outcomeUnitSymbol)}`}
            />
            {/* Threshold label (small, above line) - clamp position at edges */}
            <div
              className="absolute -top-5 text-[10px] text-goal font-medium whitespace-nowrap"
              style={{
                left: `${Math.max(5, Math.min(95, thresholdPct))}%`,
                transform: thresholdPct < 15 ? 'translateX(0)' : thresholdPct > 85 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {formatThreshold(goalThreshold!, outcomeUnit, outcomeUnitSymbol)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * RangeVisualization - Stacked option range bars.
 */
export function RangeVisualization({
  options,
  goalThreshold,
  winnerId,
  outcomeUnit,
  outcomeUnitSymbol,
  topDriverLabel,
  scenarioContexts,
}: RangeVisualizationProps) {
  const [showAll, setShowAll] = useState(false)

  // Filter to options with valid outcome data and sort by win probability
  // Tiebreaker: recommended option (winnerId) first to ensure it's always in top 3
  const validOptions = useMemo(() => {
    return options
      .filter(opt =>
        opt.outcome?.p10 != null &&
        opt.outcome?.p50 != null &&
        opt.outcome?.p90 != null
      )
      .sort((a, b) => {
        const wpA = a.winProbability ?? 0
        const wpB = b.winProbability ?? 0
        if (wpB !== wpA) return wpB - wpA // Descending by win probability
        // Tiebreaker: winner first
        if (a.id === winnerId) return -1
        if (b.id === winnerId) return 1
        return 0
      })
  }, [options, winnerId])

  // Calculate global min/max for consistent axis scaling
  const { minValue, maxValue } = useMemo(() => {
    let min = Infinity
    let max = -Infinity

    validOptions.forEach(opt => {
      if (opt.outcome?.p10 != null) min = Math.min(min, opt.outcome.p10)
      if (opt.outcome?.p90 != null) max = Math.max(max, opt.outcome.p90)
    })

    // Include threshold in range if set
    if (goalThreshold != null) {
      min = Math.min(min, goalThreshold)
      max = Math.max(max, goalThreshold)
    }

    // Add 5% padding on each side
    const padding = (max - min) * 0.05
    return {
      minValue: min - padding,
      maxValue: max + padding,
    }
  }, [validOptions, goalThreshold])

  // Don't render if no valid options
  if (validOptions.length === 0) {
    return null
  }

  // Show top 3 or all
  const displayOptions = showAll ? validOptions : validOptions.slice(0, 3)
  const hiddenCount = validOptions.length - 3

  return (
    <div className="space-y-3 p-3 bg-panel border border-panel-border rounded-lg">
      {/* Range bars */}
      <div className="space-y-3">
        {displayOptions.map(option => (
          <OptionRangeBar
            key={option.id}
            option={option}
            isWinner={option.id === winnerId}
            minValue={minValue}
            maxValue={maxValue}
            goalThreshold={goalThreshold}
            outcomeUnit={outcomeUnit}
            outcomeUnitSymbol={outcomeUnitSymbol}
          />
        ))}
      </div>

      {/* Show more/less toggle */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-xs text-info hover:text-info-hover transition-colors"
        >
          {showAll ? (
            <>
              <ChevronDown className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              +{hiddenCount} more option{hiddenCount > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}

      {/* P3 Task 5: Conditional driver sentence */}
      {(() => {
        // M2 override: use rich scenario contexts if provided
        if (scenarioContexts && scenarioContexts.length > 0) {
          return (
            <p className={`${typography.label} text-text-light italic`}>
              {scenarioContexts[0]}
            </p>
          )
        }

        // M1 template: use top driver label
        if (topDriverLabel) {
          // Task 6: Clean encoding notation from label
          const cleanLabel = stripEncodingNotation(topDriverLabel)
          return (
            <p className={`${typography.label} text-text-light italic`}>
              If {cleanLabel} is unfavourable, expect closer to the lower bound
            </p>
          )
        }

        return null
      })()}
    </div>
  )
}

export default RangeVisualization

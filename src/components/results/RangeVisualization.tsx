/**
 * RangeVisualization Component (Upgraded)
 *
 * Displays stacked option range bars showing outcome distributions.
 * Shows p10-p90 range with p50 marker for each option.
 *
 * Upgrades:
 * - Target line: single dashed vertical at goal_threshold, label at section bottom
 * - Per-option probability: "{pog}% hit target" or "Wins {wp}%" next to label
 * - User units: tick labels at axis ends using goal node's unit
 * - Top 3 cap with show more/less toggle
 * - Direction-aware driver sentence
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import type { OptionResult, OutcomeUnitType } from './types'

export interface RangeVisualizationProps {
  options: OptionResult[]
  goalThreshold?: number | null
  winnerId?: string
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
  /** Top driver label for conditional sentence */
  topDriverLabel?: string
  /** Top driver direction for direction-aware sentence */
  topDriverDirection?: 'positive' | 'negative'
  /** Winner's p10 value for driver sentence formatting */
  winnerP10?: number | null
  /** M2 override — rich scenario contexts */
  scenarioContexts?: string[]
  /** v7.1: When true, values are normalised model scores */
  isNormalised?: boolean
  /** v7.6 T1: Whether an explicit baseline option exists — controls axis label wording */
  hasBaseline?: boolean
}

/**
 * Format threshold/tick value for display.
 * When isNormalised=true, shows value as % shift (0.13 → "+13%").
 * Otherwise formats in user units (currency, percent, count).
 */
export function formatThreshold(
  value: number,
  unit?: OutcomeUnitType,
  symbol?: string,
  isNormalised?: boolean
): string {
  // v7.1: Normalised model scores — reframe as % shift from baseline
  // 0.13 → "+13%", -0.17 → "-17%"
  if (isNormalised) {
    return formatPct(value, { fromDecimal: true, sign: true })
  }
  if (unit === 'currency' && symbol) {
    return `${symbol}${Math.round(value).toLocaleString()}`
  }
  if (unit === 'percent') {
    // Auto-detect probability form (0-2 range) vs percentage form
    const displayValue = Math.abs(value) <= 2 ? value * 100 : value
    return formatPct(displayValue)
  }
  // Count or unknown: show with commas, smart rounding
  if (Math.abs(value) >= 10) {
    return Math.round(value).toLocaleString()
  }
  // Small values: 1 decimal for precision
  return value.toFixed(1)
}

/**
 * Single option range bar with label and probability text.
 * Target line rendering moved to parent (single instance).
 */
function OptionRangeBar({
  option,
  isWinner,
  minValue,
  maxValue,
  goalThreshold,
  outcomeUnit,
  outcomeUnitSymbol,
  isNormalised,
}: {
  option: OptionResult
  isWinner: boolean
  minValue: number
  maxValue: number
  goalThreshold?: number | null
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
  isNormalised?: boolean
}) {
  const { p10, p50, p90 } = option.outcome || {}

  if (p10 == null || p50 == null || p90 == null) {
    return null
  }

  const range = maxValue - minValue
  if (range <= 0) return null

  const p10Pct = ((p10 - minValue) / range) * 100
  const p50Pct = ((p50 - minValue) / range) * 100
  const p90Pct = ((p90 - minValue) / range) * 100
  const barWidth = p90Pct - p10Pct

  const barColor = isWinner ? 'bg-success' : 'bg-option'
  const markerColor = isWinner ? 'bg-panel' : 'bg-panel'

  // C10: Per-option probability text with fallback
  const probabilityText = (() => {
    if (option.goalProbability != null && goalThreshold != null) {
      return `${formatPct(option.goalProbability, { fromDecimal: true })} hit target`
    }
    if (option.winProbability != null) {
      return `Wins ${formatPct(option.winProbability, { fromDecimal: true })}`
    }
    // C10: Omit suffix entirely when both missing
    return null
  })()

  return (
    <div className="space-y-1">
      {/* Option label + probability */}
      <div className="flex items-center justify-between">
        <span className={`${typography.panelHeader} text-text-body truncate`}>
          {stripEncodingNotation(option.label)}
        </span>
        {probabilityText && (
          <span className={`${typography.panelBody} text-text-light ml-2 flex-shrink-0`}>
            {probabilityText}
          </span>
        )}
      </div>

      {/* Range bar container */}
      <div className="relative h-2 bg-panel-border/30 rounded-full overflow-visible">
        {/* p10-p90 range bar */}
        <div
          className={`absolute h-2 rounded-full ${barColor}`}
          style={{
            left: `${p10Pct}%`,
            width: `${barWidth}%`,
          }}
        />

        {/* p50 marker */}
        <div
          className={`absolute w-0.5 h-3 -top-0.5 ${markerColor} rounded-full`}
          style={{ left: `${p50Pct}%`, transform: 'translateX(-50%)' }}
          title={`Median: ${formatThreshold(p50, outcomeUnit, outcomeUnitSymbol, isNormalised)}`}
        />
      </div>
    </div>
  )
}

export function RangeVisualization({
  options,
  goalThreshold,
  winnerId,
  outcomeUnit,
  outcomeUnitSymbol,
  topDriverLabel,
  topDriverDirection,
  winnerP10,
  scenarioContexts,
  isNormalised,
  hasBaseline,
}: RangeVisualizationProps) {
  const [showAll, setShowAll] = useState(false)

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
        if (wpB !== wpA) return wpB - wpA
        if (a.id === winnerId) return -1
        if (b.id === winnerId) return 1
        return 0
      })
  }, [options, winnerId])

  const { minValue, maxValue } = useMemo(() => {
    let min = Infinity
    let max = -Infinity

    validOptions.forEach(opt => {
      if (opt.outcome?.p10 != null) min = Math.min(min, opt.outcome.p10)
      if (opt.outcome?.p90 != null) max = Math.max(max, opt.outcome.p90)
    })

    if (goalThreshold != null) {
      min = Math.min(min, goalThreshold)
      max = Math.max(max, goalThreshold)
    }

    const padding = (max - min) * 0.05
    return {
      minValue: min - padding,
      maxValue: max + padding,
    }
  }, [validOptions, goalThreshold])

  if (validOptions.length === 0) {
    return null
  }

  const displayOptions = showAll ? validOptions : validOptions.slice(0, 3)
  const hiddenCount = validOptions.length - 3
  const totalRange = maxValue - minValue

  // Target line position
  const thresholdPct = goalThreshold != null && totalRange > 0
    ? ((goalThreshold - minValue) / totalRange) * 100
    : null

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
            isNormalised={isNormalised}
          />
        ))}
      </div>

      {/* Target line — single instance at section bottom */}
      {thresholdPct != null && thresholdPct >= 0 && thresholdPct <= 100 && (
        <div className="relative h-4">
          <div
            className="absolute w-px h-4 bg-primary"
            style={{
              left: `${thresholdPct}%`,
              transform: 'translateX(-50%)',
            }}
          />
          <span
            className={`absolute top-0 ${typography.panelMeta} text-primary whitespace-nowrap`}
            style={{
              left: `${Math.max(5, Math.min(95, thresholdPct))}%`,
              transform: thresholdPct < 15 ? 'translateX(0)' : thresholdPct > 85 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            Target: {formatThreshold(goalThreshold!, outcomeUnit, outcomeUnitSymbol, isNormalised)}
          </span>
        </div>
      )}

      {/* v7.6 T1: Axis label — wording depends on hasBaseline */}
      <div className={`flex justify-between ${typography.panelMeta} text-text-light`}>
        {isNormalised && (
          <span
            className="text-text-light italic"
            title={hasBaseline
              ? 'These values show percentage change from your baseline. Add a success target to see results in your goal\u2019s units.'
              : 'These values show relative percentage difference. Add a success target to see results in your goal\u2019s units.'}
          >
            {hasBaseline ? '% shift from baseline:' : 'Relative % difference:'}&nbsp;
          </span>
        )}
        <span>{formatThreshold(minValue, outcomeUnit, outcomeUnitSymbol, isNormalised)}</span>
        <span>{formatThreshold(maxValue, outcomeUnit, outcomeUnitSymbol, isNormalised)}</span>
      </div>

      {/* Show more/less toggle */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`flex items-center gap-1 ${typography.panelBody} text-info hover:text-info-hover transition-colors`}
        >
          {showAll ? (
            <>
              <ChevronDown className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              + {hiddenCount} more
            </>
          )}
        </button>
      )}

      {/* Driver sentence — direction-aware */}
      {(() => {
        if (scenarioContexts && scenarioContexts.length > 0) {
          return (
            <p className={`${typography.panelBody} text-text-light italic`}>
              {scenarioContexts[0]}
            </p>
          )
        }

        if (topDriverLabel) {
          const cleanLabel = stripEncodingNotation(topDriverLabel)
          // Direction word: positive elasticity → "lower", negative → "higher"
          const directionWord = topDriverDirection === 'positive' ? 'lower'
            : topDriverDirection === 'negative' ? 'higher'
            : 'unfavourable'

          // Format the p10 value if available, otherwise use generic text
          const boundText = winnerP10 != null
            ? formatThreshold(winnerP10, outcomeUnit, outcomeUnitSymbol, isNormalised)
            : 'the pessimistic end'

          return (
            <p className={`${typography.panelBody} text-text-light italic`}>
              If {cleanLabel} is {directionWord} than estimated, expect closer to {boundText}
            </p>
          )
        }

        return null
      })()}
    </div>
  )
}

export default RangeVisualization

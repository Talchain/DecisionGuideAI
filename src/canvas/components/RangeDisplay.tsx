/**
 * RangeDisplay Component
 *
 * Visual display for outcome ranges (p10/p50/p90) with progress bar visualization.
 * Shows a large primary outcome value with visual range bar and user-friendly labels.
 */

import { typography } from '../../styles/typography'
import { computeDelta } from '../utils/interpretOutcome'
import { formatOutcomeValue, formatOutcomeValueCompact, type OutcomeUnits } from '../../lib/format'

type Units = OutcomeUnits

interface RangeDisplayProps {
  p10: number | null
  p50: number | null
  p90: number | null
  units?: Units
  unitSymbol?: string
  baseline?: number | null
  goalDirection: 'maximize' | 'minimize'
}

function formatValue(value: number | null, units: Units, unitSymbol?: string): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    // Smart formatting for large numbers
    if (Math.abs(value) >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(1)}K`
    }
    return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'count') {
    // Auto-detect if value is in 0-1 probability form
    // Values in 0-1 range with decimals or boundary values (0, 1) suggest probability format
    if (value >= 0 && value <= 1 && (value !== Math.floor(value) || value === 0 || value === 1)) {
      return `${(value * 100).toFixed(1)}%`
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }

  // Default (percent): auto-detect if value is in 0-1 probability form
  // Values in 0-1 range (inclusive) are treated as probabilities: 0.5 → 50%, 1 → 100%
  const isProbability = value >= 0 && value <= 1
  const displayValue = isProbability ? value * 100 : value
  return `${displayValue.toFixed(1)}%`
}

function formatValueCompact(value: number | null, units: Units, unitSymbol?: string): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    if (Math.abs(value) >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toFixed(0)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(0)}K`
    }
    return `${symbol}${Math.round(value)}`
  }

  // Default (percent)
  const isProbability = value >= 0 && value <= 1
  const displayValue = isProbability ? value * 100 : value
  return `${Math.round(displayValue)}%`
}

function getRangeWidthLabel(p10: number | null, p50: number | null, p90: number | null): string | null {
  if (p10 === null || p90 === null || Number.isNaN(p10) || Number.isNaN(p90)) {
    return null
  }

  const span = p90 - p10
  if (span <= 0) {
    return 'Outcomes are tightly clustered around a single value.'
  }

  const center = p50 !== null && !Number.isNaN(p50) ? p50 : (p10 + p90) / 2
  const denom = Math.max(Math.abs(center), 1)
  const relSpan = span / denom

  if (relSpan < 0.5) {
    return 'Most outcomes cluster close to the most likely value.'
  }
  if (relSpan < 1.5) {
    return 'Outcomes vary within a moderate band.'
  }
  return 'Outcomes could vary widely; treat with extra caution.'
}

function getBaselineMessage(
  p50: number | null,
  baseline: number | null,
  goalDirection: 'maximize' | 'minimize'
): string | null {
  if (p50 === null || Number.isNaN(p50) || baseline === null || Number.isNaN(baseline)) {
    return null
  }

  const delta = computeDelta({ currentValue: p50, baselineValue: baseline, goalDirection })

  if (delta.direction === 'similar') {
    return 'Similar to baseline'
  }

  const directionWord = delta.direction === 'better' ? 'better' : 'worse'
  const magnitudeWord = delta.magnitude
  const percentText =
    delta.deltaPercent === null
      ? ''
      : ` (${delta.deltaPercent > 0 ? '+' : ''}${delta.deltaPercent.toFixed(1)}%)`

  return `${magnitudeWord.charAt(0).toUpperCase() + magnitudeWord.slice(1)} ${directionWord} than baseline${percentText}`
}

export function RangeDisplay({
  p10,
  p50,
  p90,
  units = 'percent',
  unitSymbol,
  baseline,
  goalDirection,
}: RangeDisplayProps) {
  const hasAnyValue =
    (p10 !== null && !Number.isNaN(p10)) ||
    (p50 !== null && !Number.isNaN(p50)) ||
    (p90 !== null && !Number.isNaN(p90))

  if (!hasAnyValue) {
    return (
      <div className={`${typography.caption} text-ink-900/70`} data-testid="range-display">
        Range is not available for this run.
      </div>
    )
  }

  const safeUnits: Units = units || 'percent'
  const rangeWidthMessage = getRangeWidthLabel(p10, p50, p90)
  const baselineMessage = getBaselineMessage(p50, baseline ?? null, goalDirection)

  // Calculate p50 position on the bar (as percentage from p10 to p90)
  let p50Position = 50 // Default to middle if can't calculate
  if (p10 !== null && p50 !== null && p90 !== null && !Number.isNaN(p10) && !Number.isNaN(p50) && !Number.isNaN(p90)) {
    const range = p90 - p10
    if (range > 0) {
      p50Position = ((p50 - p10) / range) * 100
    }
  }

  return (
    <div className="space-y-4" data-testid="range-display">
      {/* Large primary outcome value */}
      {p50 !== null && !Number.isNaN(p50) && (
        <div>
          <div className="text-4xl font-bold text-ink-900 tabular-nums">
            {formatValue(p50, safeUnits, unitSymbol)}
          </div>
          <div className={`${typography.caption} text-ink-500 mt-1`}>
            Most likely outcome
          </div>
        </div>
      )}

      {/* Visual range bar */}
      {p10 !== null && p90 !== null && !Number.isNaN(p10) && !Number.isNaN(p90) && (
        <div className="space-y-2">
          {/* Range header */}
          <div className={`${typography.caption} font-medium text-ink-700`}>Range</div>

          {/* Bar container */}
          <div className="relative">
            {/* Background bar */}
            <div className="h-2 bg-sand-200 rounded-full">
              {/* Filled range bar */}
              <div className="h-full bg-sky-400 rounded-full" />
            </div>

            {/* p50 marker */}
            {p50 !== null && !Number.isNaN(p50) && (
              <div
                className="absolute top-0 w-0.5 h-4 bg-ink-800 -translate-y-1"
                style={{ left: `${p50Position}%` }}
              />
            )}
          </div>

          {/* Range labels */}
          <div className="flex justify-between items-start">
            <div>
              <div className={`${typography.caption} font-medium text-ink-700 tabular-nums`}>
                {formatValueCompact(p10, safeUnits, unitSymbol)}
              </div>
              <div className={`${typography.caption} text-ink-500`}>
                Worst case
              </div>
            </div>
            <div className="text-right">
              <div className={`${typography.caption} font-medium text-ink-700 tabular-nums`}>
                {formatValueCompact(p90, safeUnits, unitSymbol)}
              </div>
              <div className={`${typography.caption} text-ink-500`}>
                Best case
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interpretation messages */}
      {(rangeWidthMessage || baselineMessage) && (
        <div className="space-y-1">
          {rangeWidthMessage && (
            <p className={`${typography.caption} text-ink-600 leading-relaxed`}>
              {rangeWidthMessage}
            </p>
          )}
          {baselineMessage && (
            <p className={`${typography.caption} text-ink-600 leading-relaxed`}>
              {baselineMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

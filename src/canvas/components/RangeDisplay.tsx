/**
 * RangeDisplay Component
 *
 * Structured two-column display for outcome ranges (p10/p50/p90).
 * Shows band labels on the left, values on the right, with optional
 * baseline comparison and range width interpretation.
 */

import { typography } from '../../styles/typography'
import { computeDelta } from '../utils/interpretOutcome'

type Units = 'currency' | 'percent' | 'count'

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

/**
 * Row component for the range grid
 */
function RangeRow({
  label,
  value,
  tooltip,
  isHighlighted = false,
}: {
  label: string
  value: string
  tooltip?: string
  isHighlighted?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-4 py-1.5 ${isHighlighted ? 'bg-sky-50 -mx-2 px-2 rounded' : ''}`}
      title={tooltip}
    >
      <span className={`${typography.caption} text-ink-600`}>{label}</span>
      <span className={`${typography.caption} font-medium text-ink-900 text-right tabular-nums`}>
        {value}
      </span>
    </div>
  )
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

  // Format values
  const conservativeValue = formatValue(p10, safeUnits, unitSymbol)
  const mostLikelyValue = formatValue(p50, safeUnits, unitSymbol)
  const optimisticValue = formatValue(p90, safeUnits, unitSymbol)

  return (
    <div className="space-y-2" data-testid="range-display">
      {/* Structured grid layout */}
      <div className="divide-y divide-sand-100">
        {p10 !== null && !Number.isNaN(p10) && (
          <RangeRow
            label="Conservative (p10)"
            value={conservativeValue}
            tooltip="10th percentile: 90% of outcomes expected to be better than this"
          />
        )}
        {p50 !== null && !Number.isNaN(p50) && (
          <RangeRow
            label="Most likely (p50)"
            value={mostLikelyValue}
            tooltip="50th percentile: median expected outcome"
            isHighlighted
          />
        )}
        {p90 !== null && !Number.isNaN(p90) && (
          <RangeRow
            label="Optimistic (p90)"
            value={optimisticValue}
            tooltip="90th percentile: only 10% of outcomes expected to exceed this"
          />
        )}
      </div>

      {/* Interpretation messages */}
      {(rangeWidthMessage || baselineMessage) && (
        <div className="pt-1 space-y-0.5">
          {rangeWidthMessage && (
            <div className={`${typography.caption} text-ink-500`}>
              {rangeWidthMessage}
            </div>
          )}
          {baselineMessage && (
            <div className={`${typography.caption} text-ink-500`}>
              {baselineMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Range Chips Component
 *
 * Displays the three-point estimate with standardized terminology.
 * Compact strip with hover tooltips for additional context.
 *
 * Quick Win #3: Hides meaningless range when values are identical/similar (<5% spread).
 * Shows "High certainty" message instead.
 */

import { CheckCircle2 } from 'lucide-react'
import { RANGE_TERMINOLOGY } from '../../config/terminology'
import { typography } from '../../styles/typography'

interface RangeChipsProps {
  conservative: number | null
  likely: number | null
  optimistic: number | null
  units?: 'currency' | 'percent' | 'count'
  unitSymbol?: string
}

/**
 * Check if the range is meaningful (> 5% spread)
 * Returns true if range should be displayed as chips
 */
function isRangeMeaningful(
  conservative: number | null,
  likely: number | null,
  optimistic: number | null
): boolean {
  // If any values are null, show chips with placeholders
  if (conservative === null || optimistic === null) {
    return true
  }

  const spread = Math.abs(optimistic - conservative)

  // If spread is 0, definitely not meaningful
  if (spread === 0) {
    return false
  }

  // Calculate percentage spread relative to average value
  const avgValue = likely !== null ? likely : (conservative + optimistic) / 2
  const denominator = Math.max(Math.abs(avgValue), 0.01) // Avoid division by zero
  const spreadPct = (spread / denominator) * 100

  // Less than 5% spread is not meaningful
  return spreadPct >= 5
}

export function RangeChips({
  conservative,
  likely,
  optimistic,
  units = 'percent',
  unitSymbol,
}: RangeChipsProps) {
  // Quick Win #3: Check if range is meaningful
  if (!isRangeMeaningful(conservative, likely, optimistic)) {
    const expectedValue = likely ?? optimistic ?? conservative
    const formattedValue = expectedValue !== null
      ? formatValue(expectedValue, units, unitSymbol)
      : '—'

    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200"
        role="status"
        aria-label="High certainty outcome"
        data-testid="range-high-certainty"
      >
        <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />
        <span className={`${typography.bodySmall} text-green-700`}>
          High certainty — outcome tightly clustered around <strong>{formattedValue}</strong>
        </span>
      </div>
    )
  }

  // Standardized labels: Downside/Expected/Upside
  const ranges = [
    { label: RANGE_TERMINOLOGY.conservative.userLabel, technicalLabel: RANGE_TERMINOLOGY.conservative.technicalTerm, value: conservative, variant: 'conservative' as const },
    { label: RANGE_TERMINOLOGY.likely.userLabel, technicalLabel: RANGE_TERMINOLOGY.likely.technicalTerm, value: likely, variant: 'likely' as const },
    { label: RANGE_TERMINOLOGY.optimistic.userLabel, technicalLabel: RANGE_TERMINOLOGY.optimistic.technicalTerm, value: optimistic, variant: 'optimistic' as const }
  ]

  return (
    <div
      className="range-chips-container"
      style={{
        display: 'flex',
        gap: '0.375rem',
        flexWrap: 'wrap'
      }}
      role="list"
      aria-label="Outcome range"
      aria-live="polite"
    >
      {ranges.map((range) => (
        <RangeChip
          key={range.label}
          label={range.label}
          technicalLabel={range.technicalLabel}
          value={range.value}
          variant={range.variant}
          units={units}
          unitSymbol={unitSymbol}
        />
      ))}
    </div>
  )
}

interface RangeChipProps {
  label: string
  technicalLabel: string // Phase 1A.3: Show in tooltip
  value: number | null
  variant: 'conservative' | 'likely' | 'optimistic'
  units: 'currency' | 'percent' | 'count'
  unitSymbol?: string
}

function RangeChip({ label, technicalLabel, value, variant, units, unitSymbol }: RangeChipProps) {
  const formattedValue = value === null ? '—' : formatValue(value, units, unitSymbol)

  const variantClasses = {
    conservative: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    likely: 'bg-info-50 border-info-200 text-info-600',
    optimistic: 'bg-green-50 border-green-200 text-green-600'
  }

  return (
    <div
      className={`
        flex flex-col items-center flex-1 min-w-[96px] p-2.5 rounded-lg border cursor-default
        transition-all duration-200
        ${variantClasses[variant]}
      `}
      title={`${technicalLabel}: ${formattedValue}`}
      role="listitem"
      aria-label={`${label} estimate: ${formattedValue}`}
    >
      <div className="text-lg font-semibold mb-1">
        {formattedValue}
      </div>
      <div className={`${typography.caption} font-medium text-ink-900/70`}>
        {label}
      </div>
    </div>
  )
}

function formatValue(value: number, units: 'currency' | 'percent' | 'count', unitSymbol?: string): string {
  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    if (value >= 1000000) {
      return `${symbol}${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${symbol}${(value / 1000).toFixed(1)}K`
    }
    return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'percent') {
    // Auto-detect if value is in 0-1 probability form vs already percentage
    // Values in 0-1 range (inclusive) are treated as probabilities: 0.5 → 50%, 1 → 100%
    // This handles the common case where backend returns normalized probabilities
    const isProbability = value >= 0 && value <= 1
    // Brief 33 Fix: Cap probability at 99% to avoid unrealistic "100% success"
    const cappedValue = isProbability ? Math.min(value, 0.99) : Math.min(value, 99)
    const displayValue = isProbability ? cappedValue * 100 : cappedValue
    return `${displayValue.toFixed(1)}%`
  }

  // For 'count' or undefined units: auto-detect probability format
  // Values in 0-1 range (inclusive) with decimals suggest probability format
  if (value >= 0 && value <= 1 && (value !== Math.floor(value) || value === 0 || value === 1)) {
    // Brief 33 Fix: Cap at 99%
    const cappedValue = Math.min(value, 0.99)
    return `${(cappedValue * 100).toFixed(1)}%`
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

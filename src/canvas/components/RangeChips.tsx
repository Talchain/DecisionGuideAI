/**
 * Range Chips Component
 *
 * Displays the three-point estimate with standardized terminology.
 * Compact strip with hover tooltips for additional context.
 */

import { RANGE_TERMINOLOGY } from '../../config/terminology'
import { typography } from '../../styles/typography'

interface RangeChipsProps {
  conservative: number | null
  likely: number | null
  optimistic: number | null
  units?: 'currency' | 'percent' | 'count'
  unitSymbol?: string
}

export function RangeChips({
  conservative,
  likely,
  optimistic,
  units = 'percent',
  unitSymbol,
}: RangeChipsProps) {
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
      <div className={`${typography.caption} font-medium text-ink-900/70 uppercase tracking-wide`}>
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
    return `${value.toFixed(1)}%`
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

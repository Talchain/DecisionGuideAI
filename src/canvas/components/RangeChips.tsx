/**
 * Range Chips Component
 *
 * Displays the three-point estimate: Conservative, Most Likely, Optimistic.
 * Compact strip with hover tooltips for additional context.
 */

interface RangeChipsProps {
  conservative: number | null
  likely: number | null
  optimistic: number | null
  units?: 'currency' | 'percent' | 'count'
  unitSymbol?: string
}

export function RangeChips({ conservative, likely, optimistic, units = 'percent', unitSymbol }: RangeChipsProps) {
  const ranges = [
    { label: 'Conservative', value: conservative, variant: 'conservative' as const },
    { label: 'Most Likely', value: likely, variant: 'likely' as const },
    { label: 'Optimistic', value: optimistic, variant: 'optimistic' as const }
  ]

  return (
    <div
      className="range-chips-container"
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap'
      }}
    >
      {ranges.map((range) => (
        <RangeChip
          key={range.label}
          label={range.label}
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
  value: number | null
  variant: 'conservative' | 'likely' | 'optimistic'
  units: 'currency' | 'percent' | 'count'
  unitSymbol?: string
}

function RangeChip({ label, value, variant, units, unitSymbol }: RangeChipProps) {
  const formattedValue = value === null ? '—' : formatValue(value, units, unitSymbol)

  const variantClasses = {
    conservative: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    likely: 'bg-info-50 border-info-200 text-info-600',
    optimistic: 'bg-green-50 border-green-200 text-green-600'
  }

  return (
    <div
      className={`
        flex flex-col items-center flex-1 min-w-[100px] p-3 rounded-lg border cursor-default
        transition-all duration-200
        ${variantClasses[variant]}
      `}
      title={`${label}: ${formattedValue}`}
    >
      <div className="text-xl font-semibold mb-1">
        {formattedValue}
      </div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
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

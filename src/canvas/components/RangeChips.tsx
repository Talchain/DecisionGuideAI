/**
 * Range Chips Component
 *
 * Displays the three-point estimate: Conservative, Most Likely, Optimistic.
 * Compact strip with hover tooltips for additional context.
 */

interface RangeChipsProps {
  conservative: number
  likely: number
  optimistic: number
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
  value: number
  variant: 'conservative' | 'likely' | 'optimistic'
  units: 'currency' | 'percent' | 'count'
  unitSymbol?: string
}

function RangeChip({ label, value, variant, units, unitSymbol }: RangeChipProps) {
  const formattedValue = formatValue(value, units, unitSymbol)

  const colors = {
    conservative: {
      bg: 'rgba(247, 201, 72, 0.15)',
      border: 'rgba(247, 201, 72, 0.3)',
      text: 'var(--olumi-warning)'
    },
    likely: {
      bg: 'rgba(91, 108, 255, 0.15)',
      border: 'rgba(91, 108, 255, 0.4)',
      text: 'var(--olumi-primary)'
    },
    optimistic: {
      bg: 'rgba(32, 201, 151, 0.15)',
      border: 'rgba(32, 201, 151, 0.3)',
      text: 'var(--olumi-success)'
    }
  }

  const color = colors[variant]

  return (
    <div
      className="range-chip"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        border: `1px solid ${color.border}`,
        backgroundColor: color.bg,
        flex: '1 1 0',
        minWidth: '100px',
        cursor: 'default',
        transition: 'all 0.2s ease'
      }}
      title={`${label}: ${formattedValue}`}
    >
      <div
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: color.text,
          marginBottom: '0.25rem'
        }}
      >
        {formattedValue}
      </div>
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 500,
          color: 'rgba(232, 236, 245, 0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
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

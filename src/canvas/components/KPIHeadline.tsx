/**
 * KPI Headline Component
 *
 * Large, prominent display of the most likely outcome from analysis.
 * Primary focal point for the Results panel.
 */

interface KPIHeadlineProps {
  value: number | null
  label: string
  units?: 'currency' | 'percent' | 'count'
  unitSymbol?: string
}

export function KPIHeadline({ value, label, units = 'percent', unitSymbol }: KPIHeadlineProps) {
  const formattedValue = value === null ? '—' : formatValue(value, units, unitSymbol)

  return (
    <div className="kpi-headline-container">
      <div
        className="kpi-value"
        style={{
          fontSize: '3.5rem',
          fontWeight: 700,
          lineHeight: 1.1,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}
      >
        {formattedValue}
      </div>
      <div
        className="kpi-label"
        style={{
          fontSize: '0.875rem',
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
    return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'percent') {
    return `${value.toFixed(1)}%`
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * KPI Headline Component
 *
 * Large, prominent display of the most likely outcome from analysis.
 * Primary focal point for the Results panel.
 *
 * Quick Win #2: Added baseline comparison display
 * - Shows "(↑20% from £1M baseline)" when baseline exists
 * - Color-coded: green for improvement, red for decline
 *
 * Phase 3: Enhanced no-data state
 * - Shows helpful placeholder when no value is available
 */

interface KPIHeadlineProps {
  value: number | null
  label: string
  units?: 'currency' | 'percent' | 'count'
  unitSymbol?: string
  /** Quick Win #2: Baseline value for comparison */
  baseline?: number | null
  /** Quick Win #2: Goal direction for interpreting changes */
  goalDirection?: 'maximize' | 'minimize'
}

export function KPIHeadline({
  value,
  label,
  units = 'percent',
  unitSymbol,
  baseline,
  goalDirection = 'maximize'
}: KPIHeadlineProps) {
  // Phase 3: Enhanced no-data state
  if (value === null) {
    return (
      <div className="kpi-headline-container" data-testid="kpi-headline-empty">
        <div
          className="kpi-value"
          style={{
            fontSize: '3rem',
            fontWeight: 700,
            lineHeight: 1.1,
            color: 'rgba(232, 236, 245, 0.4)',
            marginBottom: '0.5rem'
          }}
          aria-label="No outcome data yet"
        >
          —
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
        <div
          className="kpi-hint"
          style={{
            fontSize: '0.75rem',
            fontWeight: 400,
            color: 'rgba(232, 236, 245, 0.5)',
            marginTop: '0.75rem'
          }}
        >
          Run analysis to see predicted outcome
        </div>
      </div>
    )
  }

  const formattedValue = formatValue(value, units, unitSymbol)

  // Quick Win #2: Calculate baseline comparison
  const comparison = getBaselineComparison(value, baseline, units, unitSymbol, goalDirection)

  return (
    <div className="kpi-headline-container">
      <div
        className="kpi-value"
        style={{
          fontSize: '3rem',
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
      {/* Quick Win #2: Baseline comparison with delta value */}
      {comparison && (
        <div
          className="kpi-baseline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: comparison.isPositive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
            color: comparison.isPositive ? 'var(--success-600)' : 'var(--danger-600)'
          }}
          title={comparison.tooltip}
        >
          {comparison.text}
        </div>
      )}
    </div>
  )
}

function formatValue(value: number, units: 'currency' | 'percent' | 'count', unitSymbol?: string): string {
  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    // Quick Win #2: Smart formatting for large numbers
    if (Math.abs(value) >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(1)}K`
    }
    return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'percent') {
    // Auto-detect if value is in 0-1 probability form vs already percentage
    // Values in 0-1 range (inclusive) are treated as probabilities: 0.5 → 50%, 1 → 100%
    const isProbability = value >= 0 && value <= 1
    const displayValue = isProbability ? value * 100 : value
    return `${displayValue.toFixed(1)}%`
  }

  // For 'count' or undefined units: auto-detect probability format
  // Values in 0-1 range (inclusive) with decimals or boundary values suggest probability format
  if (value >= 0 && value <= 1 && (value !== Math.floor(value) || value === 0 || value === 1)) {
    return `${(value * 100).toFixed(1)}%`
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Quick Win #2: Calculate baseline comparison with enhanced display
 * Returns text like "↑$200K (+20%)" with delta value and percentage
 */
function getBaselineComparison(
  value: number | null,
  baseline: number | null | undefined,
  units: 'currency' | 'percent' | 'count',
  unitSymbol: string | undefined,
  goalDirection: 'maximize' | 'minimize'
): { text: string; isPositive: boolean; tooltip: string } | null {
  // Can't compare without both values
  if (value === null || baseline === null || baseline === undefined) {
    return null
  }

  // Skip if baseline is zero (can't calculate percentage change)
  if (baseline === 0) {
    return null
  }

  // Calculate absolute delta and percentage change
  const absoluteDelta = value - baseline
  const percentChange = (absoluteDelta / Math.abs(baseline)) * 100

  // Skip if values are essentially equal (within 0.1%)
  if (Math.abs(percentChange) < 0.1) {
    return null
  }

  // Format the delta value
  const formattedDelta = formatValue(Math.abs(absoluteDelta), units, unitSymbol)
  const formattedBaseline = formatValue(baseline, units, unitSymbol)

  // Determine direction and icon
  const isIncrease = percentChange > 0
  const arrow = isIncrease ? '↑' : '↓'
  const absChange = Math.abs(percentChange)

  // Determine if this is positive (good) based on goal direction
  const isPositive = (goalDirection === 'maximize' && isIncrease) ||
                     (goalDirection === 'minimize' && !isIncrease)

  // Format the percentage text
  const percentText = absChange >= 100
    ? `${(absChange / 100).toFixed(1)}×`
    : `${absChange.toFixed(0)}%`

  // Format display text: "↑$200K (+20%)" or "↓15% (-3pp)"
  const text = units === 'currency'
    ? `${arrow}${formattedDelta} (${isIncrease ? '+' : '-'}${percentText})`
    : `${arrow}${percentText}`

  // Generate tooltip with context
  const sentimentWord = isPositive ? 'improvement' : 'decline'
  const directionWord = goalDirection === 'maximize' ? 'towards' : 'away from'
  const tooltip = `${isPositive ? 'Positive' : 'Negative'} ${sentimentWord}: ${isIncrease ? '+' : ''}${percentChange.toFixed(1)}% ${isPositive ? directionWord : ''} your goal (baseline: ${formattedBaseline})`

  return {
    text,
    isPositive,
    tooltip
  }
}

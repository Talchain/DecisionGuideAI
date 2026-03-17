/**
 * A1: Delta indicator pill showing change from previous analysis run.
 * Renders a small outlined pill with trending icon and signed delta value.
 */
import { TrendingUp, TrendingDown } from 'lucide-react'
import { typography } from '../../styles/typography'

interface DeltaIndicatorProps {
  currentValue: number
  previousValue: number | undefined | null
  format: 'percent' | 'currency' | 'number'
  unit?: string
  /** Minimum absolute delta to display (default 0.01 for percent, 0.5 for others) */
  significanceThreshold?: number
}

export function DeltaIndicator({
  currentValue,
  previousValue,
  format,
  unit,
  significanceThreshold,
}: DeltaIndicatorProps) {
  if (previousValue == null) return null

  const delta = currentValue - previousValue
  const threshold = significanceThreshold ?? (format === 'percent' ? 0.01 : 0.5)

  if (Math.abs(delta) < threshold) return null

  const isPositive = delta > 0
  const Icon = isPositive ? TrendingUp : TrendingDown
  const colourClass = isPositive ? 'text-success border-success/30' : 'text-danger border-danger/30'

  let label: string
  if (format === 'percent') {
    const deltaPct = Math.round(Math.abs(delta) * 100)
    label = `${isPositive ? '+' : '\u2212'}${deltaPct}pp`
  } else if (format === 'currency') {
    const formatted = Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 0 })
    label = `${isPositive ? '+' : '\u2212'}${unit ?? ''}${formatted}`
  } else {
    const formatted = Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 1 })
    label = `${isPositive ? '+' : '\u2212'}${formatted}${unit ? ` ${unit}` : ''}`
  }

  return (
    <span
      className={`${typography.panelMeta} ${colourClass} bg-transparent border rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5`}
      data-testid="delta-indicator"
    >
      <Icon size={10} />
      {label}
    </span>
  )
}

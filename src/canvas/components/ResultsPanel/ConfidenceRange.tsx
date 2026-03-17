/**
 * ConfidenceRange - Display outcome confidence bands
 *
 * Brief H Task 8: Fixed range value display with consistent formatting
 *
 * Features:
 * - Shows p10/p50/p90 bands visually
 * - Consistent value formatting across all units
 * - Highlights the most likely value
 * - Shows baseline comparison if available
 */

import { TrendingUp, TrendingDown } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { formatOutcomeValue, type OutcomeUnits } from '../../../lib/format'

interface ConfidenceRangeProps {
  /** Conservative estimate (p10) */
  p10: number | null
  /** Most likely estimate (p50) */
  p50: number | null
  /** Optimistic estimate (p90) */
  p90: number | null
  /** Unit type for formatting */
  units: OutcomeUnits
  /** Unit symbol (e.g., '$', '%') */
  unitSymbol?: string
  /** Baseline value for comparison */
  baseline?: number | null
  /** Goal direction for interpreting improvement */
  goalDirection?: 'maximize' | 'minimize'
  /** Compact mode (horizontal layout) */
  compact?: boolean
}

export function ConfidenceRange({
  p10,
  p50,
  p90,
  units,
  unitSymbol,
  baseline,
  goalDirection = 'maximize',
  compact = false,
}: ConfidenceRangeProps) {
  // Check if we have valid data
  const hasData = p50 !== null

  if (!hasData) {
    return (
      <div className="text-center py-2" data-testid="confidence-range-empty">
        <span className={`${typography.caption} text-ink-500`}>
          No outcome data available
        </span>
      </div>
    )
  }

  // Calculate baseline comparison
  let baselineComparison: { delta: number; isPositive: boolean } | null = null
  if (baseline !== null && baseline !== undefined && p50 !== null) {
    const delta = p50 - baseline
    const isIncrease = delta > 0
    // For maximize: increase is positive. For minimize: decrease is positive.
    const isPositive = goalDirection === 'maximize' ? isIncrease : !isIncrease
    baselineComparison = { delta: Math.abs(delta), isPositive }
  }

  // Audit F-55: Removed p15/p85 interpolation (F.6 violation).
  // ISL only provides p10/p50/p90. UI must not fabricate intermediate percentiles.

  if (compact) {
    return (
      <div className="flex items-center gap-3" data-testid="confidence-range-compact">
        {p10 !== null && (
          <div className="text-center">
            <span className={`${typography.caption} text-ink-400 block`}>Low</span>
            <span className={`${typography.bodySmall} font-medium text-ink-600`}>
              {formatOutcomeValue(p10, units, unitSymbol)}
            </span>
          </div>
        )}
        <div className="flex-1 h-2 bg-sand-200 rounded-full relative">
          {p10 !== null && p90 !== null && (
            <div
              className="absolute h-full bg-sky-200 rounded-full"
              style={{
                left: '10%',
                right: '10%',
              }}
            />
          )}
          <div
            className="absolute h-full w-1.5 bg-sky-600 rounded-full -translate-x-1/2"
            style={{ left: '50%' }}
          />
        </div>
        {p90 !== null && (
          <div className="text-center">
            <span className={`${typography.caption} text-ink-400 block`}>High</span>
            <span className={`${typography.bodySmall} font-medium text-ink-600`}>
              {formatOutcomeValue(p90, units, unitSymbol)}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="confidence-range">
      {/* Main value - prominent display */}
      <div className="text-center">
        <span className={`${typography.caption} text-ink-500 block mb-1`}>
          Most Likely
        </span>
        <span className="text-2xl font-bold text-ink-900">
          {formatOutcomeValue(p50!, units, unitSymbol)}
        </span>
        {/* Baseline comparison */}
        {baselineComparison && (
          <div className="flex items-center justify-center gap-1 mt-2">
            {baselineComparison.isPositive ? (
              <TrendingUp className="h-4 w-4 text-mint-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-carrot-600" />
            )}
            <span
              className={`${typography.caption} font-medium ${
                baselineComparison.isPositive ? 'text-mint-700' : 'text-carrot-700'
              }`}
            >
              {formatOutcomeValue(baselineComparison.delta, units, unitSymbol)}
              {' '}
              {baselineComparison.isPositive ? 'better' : 'worse'} than baseline
            </span>
          </div>
        )}
      </div>

      {/* Range display */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-sand-50">
          <span className={`${typography.caption} text-ink-500 block`}>Conservative</span>
          <span className={`${typography.bodySmall} font-semibold text-ink-700`}>
            {p10 !== null ? formatOutcomeValue(p10, units, unitSymbol) : '-'}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-sky-50 border border-sky-200">
          <span className={`${typography.caption} text-sky-700 block`}>Likely</span>
          <span className={`${typography.bodySmall} font-bold text-sky-800`}>
            {formatOutcomeValue(p50!, units, unitSymbol)}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-sand-50">
          <span className={`${typography.caption} text-ink-500 block`}>Optimistic</span>
          <span className={`${typography.bodySmall} font-semibold text-ink-700`}>
            {p90 !== null ? formatOutcomeValue(p90, units, unitSymbol) : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}

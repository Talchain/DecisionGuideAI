/**
 * RangeDisplay Component
 *
 * Visual display for outcome ranges (p10/p50/p90) with progress bar visualisation.
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

/**
 * ⭐ THE RANGE IS THE FACT. THE BANDS WERE OURS.
 *
 * This turned p10/p50/p90 into one of four sentences using cutoffs chosen here
 * (0.5, 1.5), and the widest one added ADVICE — "treat with extra caution".
 * Founder's rule, 15 Sep: the UI renders the data; it does not decide what the
 * data means. How wide is too wide depends on the decision, and the reader is
 * the one holding it.
 *
 * What replaces it is the same quantity stated rather than graded: the p10–p90
 * span as a proportion of the central value, which is exactly what the bands
 * were computed from. A reader who wants "wide" can see it is 180%; a reader
 * whose domain makes 180% ordinary is no longer told to be cautious.
 *
 * ⛔ `span <= 0` SURVIVES AS A FACT, NOT A BAND — but it says LESS than it used
 * to claim. `p10 === p90` establishes that the MIDDLE 80% collapsed onto one
 * value; the tails below p10 and above p90 may still differ, so "every outcome
 * landed on the same value" was a claim about runs this function never sees.
 * Boundaries are facts; thresholds are choices; and a fact still has to be
 * stated at the width the data supports.
 *
 * ⭐⭐ AND THE DENOMINATOR WAS INHERITED FROM A LOOKUP THAT NO LONGER EXISTS.
 * `Math.max(Math.abs(center), 1)` guarded the OLD banded version against a
 * near-zero centre — harmless there, because a clamp only nudged which of four
 * sentences was chosen. **Printing the quotient made it a false precise
 * figure.** Found by an independent post-merge review of #1585, executed:
 * `p10=.2, p50=.4, p90=.6` rendered *"span 40% of the central value"* when the
 * true proportion is **100%**; the equivalent `20/40/60` rendered 100%
 * correctly, because there the clamp is inert.
 *
 * ⚠ This is the same mistake as grading a bar, one step along: I replaced a
 * graded claim with a stated number and carried the old arithmetic across
 * without asking whether it was still true for the new use. **A value that was
 * adequate as an input to a band is not automatically adequate as a published
 * figure.**
 *
 * ⛔ SO THE CLAMP GOES, AND THE UNDEFINED CASE IS REFUSED RATHER THAN FUDGED. A
 * proportion OF ZERO has no value, so at a zero centre this states the span
 * itself — a fact — instead of inventing a percentage. `center === 0` is a
 * BOUNDARY (division is undefined there), not a threshold someone chose.
 */
function getRangeWidthLabel(
  p10: number | null,
  p50: number | null,
  p90: number | null,
  units: Units = 'count',
  unitSymbol?: string,
): string | null {
  if (p10 === null || p90 === null || Number.isNaN(p10) || Number.isNaN(p90)) {
    return null
  }

  const span = p90 - p10
  if (span <= 0) {
    // Exactly what equal percentiles establish, and no more.
    return 'The middle 80% of outcomes all landed on the same value.'
  }

  const center = p50 !== null && !Number.isNaN(p50) ? p50 : (p10 + p90) / 2
  if (center === 0) {
    // A proportion OF ZERO has no value. State the span, which is a fact.
    return `The middle 80% of outcomes span ${formatValue(span, units, unitSymbol)}.`
  }

  const relSpan = span / Math.abs(center)
  return `The middle 80% of outcomes span ${Math.round(relSpan * 100)}% of the central value.`
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
      <div className={`${typography.caption} text-ink-900`} data-testid="range-display">
        Range is not available for this run.
      </div>
    )
  }

  const safeUnits: Units = units || 'percent'
  // Units reach the width label so the zero-centre case can state a SPAN rather
  // than a proportion of nothing.
  const rangeWidthMessage = getRangeWidthLabel(p10, p50, p90, safeUnits, unitSymbol)
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

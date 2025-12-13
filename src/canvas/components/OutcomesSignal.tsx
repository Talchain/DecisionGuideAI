/**
 * OutcomesSignal - Meaningful outcomes display for Results tab
 *
 * Shows the predicted outcome with full context:
 * - Objective description at top
 * - Success likelihood as primary value with label
 * - Comparison to baseline with direction/magnitude
 * - 70% confidence range (p15-p85)
 *
 * Features:
 * - Collapsed: objective + main value + comparison
 * - Expanded: range bands, confidence, baseline details
 * - Every number has context
 */

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { formatOutcomeValue, formatOutcomeValueCompact, type OutcomeUnits } from '../../lib/format'
import { typography } from '../../styles/typography'
import { computeBaselineComparison } from '../utils/baselineComparison'
import type { ConfidenceLevel } from '../../adapters/plot/types'

interface OutcomesSignalProps {
  /** Start expanded */
  defaultExpanded?: boolean
  /** Baseline value for comparison */
  baseline?: number | null
  /** Baseline label/name for context */
  baselineName?: string
  /** Goal direction for interpreting changes */
  goalDirection?: 'maximize' | 'minimize'
  /** Objective text describing what we're measuring */
  objectiveText?: string
}

// Confidence styling
const confidenceConfig: Record<ConfidenceLevel, {
  bgColor: string
  textColor: string
  label: string
}> = {
  high: {
    bgColor: 'bg-mint-100',
    textColor: 'text-mint-700',
    label: 'High confidence',
  },
  medium: {
    bgColor: 'bg-banana-100',
    textColor: 'text-banana-700',
    label: 'Medium confidence',
  },
  low: {
    bgColor: 'bg-carrot-100',
    textColor: 'text-carrot-700',
    label: 'Low confidence',
  },
}

export function OutcomesSignal({
  defaultExpanded = false,
  baseline,
  baselineName = 'baseline',
  goalDirection = 'maximize',
  objectiveText,
}: OutcomesSignalProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const results = useCanvasStore((s) => s.results)
  const report = results?.report

  // Extract outcome values
  const outcomes = useMemo(() => {
    if (!report?.results) return null

    const raw = {
      p10: report.results.conservative,
      p50: report.results.likely,
      p90: report.results.optimistic,
    }

    // Brief 26 Task 1 + Brief 32 Task 2: Cap probability values at realistic maximum (99%)
    // Handle both 0-1 format (0.65 = 65%) and 0-100 format (65 = 65%)
    const units = report.results.units || 'percent'

    // DEBUG: Log values for Brief 32 investigation
    if (import.meta.env.DEV) {
      console.log('[OutcomesSignal] Raw values:', { p90: raw.p90, units })
    }

    // Detect scale: values <=1 are probability format, >1 are percentage format
    const isProbabilityFormat = units === 'percent' && raw.p90 !== undefined && raw.p90 <= 1
    const isPercentageFormat = units === 'percent' && raw.p90 !== undefined && raw.p90 > 1

    // Cap at 99% regardless of format
    let p90 = raw.p90
    if (isProbabilityFormat) {
      p90 = Math.min(raw.p90, 0.99)  // Cap at 0.99 for 0-1 format
    } else if (isPercentageFormat) {
      p90 = Math.min(raw.p90, 99)    // Cap at 99 for 0-100 format
    }

    const p10 = raw.p10
    const p50 = raw.p50

    // Brief 26 Task 2: Ensure 70% range is consistent with percentiles
    // p15 must be >= p10, p85 must be <= p90
    // Use linear interpolation but clamp to valid bounds
    const p15 = Math.max(p10, p10 + (p50 - p10) * 0.5)
    const p85 = Math.min(p90, p50 + (p90 - p50) * 0.5)

    return {
      p10,
      p50,
      p90,
      p15,
      p85,
      units,
      unitSymbol: report.results.unitSymbol,
      confidence: report.confidence,
    }
  }, [report])

  // Calculate baseline comparison using unified utility
  // Note: baseline === 0 is valid (status quo = 0% success / "do nothing" scenario)
  const comparison = useMemo(() => {
    if (outcomes?.p50 === null || outcomes?.p50 === undefined || baseline === null || baseline === undefined) {
      return null
    }

    // Use unified baseline comparison logic (fixes P0 - units-aware detection)
    const result = computeBaselineComparison({
      value: outcomes.p50,
      baseline,
      units: outcomes.units as OutcomeUnits,
      goalDirection,
    })

    if (!result) return null

    // Extend with formatted delta for expanded view
    return {
      ...result,
      formattedDelta: formatOutcomeValueCompact(
        result.isProbabilityScale ? Math.abs(result.delta) * 100 : Math.abs(result.delta),
        outcomes.units,
        outcomes.unitSymbol
      ),
    }
  }, [outcomes, baseline, goalDirection])

  // Empty state
  if (!outcomes) {
    return (
      <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-sand-400 flex-shrink-0" />
          <div>
            <p className={`${typography.body} text-sand-600`}>No outcomes yet</p>
            <p className={`${typography.caption} text-sand-500`}>Run analysis to see predictions</p>
          </div>
        </div>
      </div>
    )
  }

  const confidenceLevel = (outcomes.confidence?.level || 'medium') as ConfidenceLevel
  const confConfig = confidenceConfig[confidenceLevel] || confidenceConfig.medium

  // Determine if outcome is likely positive or needs attention based on value
  const outcomeAssessment = outcomes.p50 >= 50 ? 'positive' : outcomes.p50 >= 25 ? 'moderate' : 'low'

  return (
    <div className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden" data-testid="outcomes-signal">
      {/* Objective context - always visible at top */}
      {objectiveText && (
        <div className="px-4 pt-3 pb-2 border-b border-sand-100">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-sky-600 flex-shrink-0" aria-hidden="true" />
            <span className={`${typography.caption} font-medium text-sky-700 uppercase tracking-wide`}>
              Your Objective
            </span>
          </div>
          <p className={`${typography.bodySmall} text-ink-700`}>{objectiveText}</p>
        </div>
      )}

      {/* Main outcome display */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <div>
            <span className={`${typography.caption} text-ink-500 block`}>
              Success Likelihood
            </span>
            <span className={`${typography.h3} font-bold text-ink-900`}>
              {formatOutcomeValue(outcomes.p50, outcomes.units, outcomes.unitSymbol)}
            </span>
          </div>
        </div>

        {/* Comparison context - Brief 26 Task 3: Better baseline handling */}
        <div className="text-right">
          {comparison ? (
            <div className="flex flex-col items-end">
              <span
                className={`${typography.bodySmall} flex items-center gap-1 font-medium ${
                  comparison.isPositive ? 'text-mint-600' : 'text-carrot-600'
                }`}
              >
                {comparison.isIncrease ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {/* Use unified display from comparison utility */}
                {comparison.display} {comparison.isPositive ? 'better' : 'worse'}
              </span>
              <span className={`${typography.caption} text-ink-500`}>
                vs. {baselineName}
              </span>
            </div>
          ) : baseline !== null && baseline !== undefined ? (
            // Brief 26: Show baseline value even when change is negligible
            <div className="flex flex-col items-end">
              <span className={`${typography.bodySmall} flex items-center gap-1 text-ink-500`}>
                <Minus className="h-4 w-4" />
                Similar to {baselineName}
              </span>
              <span className={`${typography.caption} text-ink-400`}>
                {formatOutcomeValueCompact(baseline, outcomes?.units || 'percent', outcomes?.unitSymbol)}
              </span>
            </div>
          ) : (
            <span className={`${typography.caption} text-ink-400`}>
              No baseline set
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-sand-200 px-4 py-4 space-y-4">
          {/* 70% Confidence Range - main takeaway */}
          <div className="p-3 bg-sky-50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className={`${typography.bodySmall} font-medium text-sky-800`}>
                70% Confidence Range
              </span>
              <span className={`${typography.body} font-semibold text-sky-700`}>
                {formatOutcomeValueCompact(outcomes.p15, outcomes.units, outcomes.unitSymbol)} – {formatOutcomeValueCompact(outcomes.p85, outcomes.units, outcomes.unitSymbol)}
              </span>
            </div>
            <p className={`${typography.caption} text-sky-600`}>
              Most outcomes will fall within this range
            </p>
          </div>

          {/* Full Range bands - 2 columns (worst/best case) since Most Likely is in header */}
          <div className="grid grid-cols-2 gap-4">
            {/* P10 - Pessimistic scenario */}
            <div className="text-center p-2 bg-sand-50 rounded-lg">
              <p className={`${typography.caption} text-ink-500 mb-1`}>Pessimistic</p>
              <p className={`${typography.body} font-semibold text-ink-700`}>
                {formatOutcomeValue(outcomes.p10, outcomes.units, outcomes.unitSymbol)}
              </p>
              <p className={`${typography.caption} text-ink-400`}>If things go poorly</p>
            </div>

            {/* P90 - Optimistic scenario */}
            <div className="text-center p-2 bg-sand-50 rounded-lg">
              <p className={`${typography.caption} text-ink-500 mb-1`}>Optimistic</p>
              <p className={`${typography.body} font-semibold text-ink-700`}>
                {formatOutcomeValue(outcomes.p90, outcomes.units, outcomes.unitSymbol)}
              </p>
              <p className={`${typography.caption} text-ink-400`}>If things go well</p>
            </div>
          </div>

          {/* Brief 26 Task 7: Improved range visualization with connected success value */}
          <div className="space-y-2">
            {/* Range labels */}
            <div className="flex justify-between text-xs text-ink-400">
              <span>{formatOutcomeValueCompact(outcomes.p10, outcomes.units, outcomes.unitSymbol)}</span>
              <span className="font-medium text-sky-700">
                Expected: {formatOutcomeValueCompact(outcomes.p50, outcomes.units, outcomes.unitSymbol)}
              </span>
              <span>{formatOutcomeValueCompact(outcomes.p90, outcomes.units, outcomes.unitSymbol)}</span>
            </div>
            {/* Range bar */}
            <div className="relative h-3 bg-sand-200 rounded-full overflow-hidden">
              {/* 70% confidence range highlight */}
              <div
                className="absolute inset-y-0 bg-sky-200 rounded-full"
                style={{
                  left: `${((outcomes.p15 - outcomes.p10) / (outcomes.p90 - outcomes.p10)) * 100}%`,
                  right: `${((outcomes.p90 - outcomes.p85) / (outcomes.p90 - outcomes.p10)) * 100}%`,
                }}
              />
              {/* Expected value marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-sky-600 rounded-full border-2 border-white shadow-md"
                style={{
                  left: `${((outcomes.p50 - outcomes.p10) / (outcomes.p90 - outcomes.p10)) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                title={`Expected: ${formatOutcomeValue(outcomes.p50, outcomes.units, outcomes.unitSymbol)}`}
              />
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-sky-200 rounded" />
                <span className="text-ink-500">70% likely range</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-sky-600 rounded-full" />
                <span className="text-ink-500">Expected</span>
              </span>
            </div>
          </div>

          {/* Confidence and source */}
          <div className="flex items-center justify-between">
            <span className={`${typography.caption} px-2 py-1 rounded ${confConfig.bgColor} ${confConfig.textColor}`}>
              {confConfig.label}
            </span>
            {outcomes.confidence?.why && (
              <span className={`${typography.caption} text-ink-500 max-w-[60%] text-right`}>
                {outcomes.confidence.why}
              </span>
            )}
          </div>

          {/* Baseline comparison detail */}
          {comparison && (
            <div className="flex items-center justify-between pt-2 border-t border-sand-100">
              <span className={`${typography.caption} text-ink-500`}>vs. {baselineName}</span>
              <div className="flex items-center gap-2">
                <span className={`${typography.caption} text-ink-500`}>
                  {formatOutcomeValueCompact(baseline!, outcomes.units, outcomes.unitSymbol)}
                </span>
                <span className={`${typography.caption} flex items-center gap-1 ${
                  comparison.isPositive ? 'text-mint-600' : 'text-carrot-600'
                }`}>
                  {comparison.isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {comparison.display}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

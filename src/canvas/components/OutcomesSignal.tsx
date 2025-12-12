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
import { formatOutcomeValue, formatOutcomeValueCompact } from '../../lib/format'
import { typography } from '../../styles/typography'
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

    return {
      p10: report.results.conservative,
      p50: report.results.likely,
      p90: report.results.optimistic,
      // Approximate 70% confidence range (p15-p85)
      p15: report.results.conservative + (report.results.likely - report.results.conservative) * 0.5,
      p85: report.results.optimistic - (report.results.optimistic - report.results.likely) * 0.5,
      units: report.results.units || 'percent',
      unitSymbol: report.results.unitSymbol,
      confidence: report.confidence,
    }
  }, [report])

  // Calculate baseline comparison
  // Note: baseline === 0 is valid (status quo = 0% success / "do nothing" scenario)
  const comparison = useMemo(() => {
    if (outcomes?.p50 === null || outcomes?.p50 === undefined || baseline === null || baseline === undefined) {
      return null
    }

    const delta = outcomes.p50 - baseline

    // Detect if values are in 0-1 probability scale vs 0-100 percentage scale
    // If outcome is between 0 and 1 (exclusive of 1 or very close to it), likely 0-1 scale
    const isProbabilityScale = outcomes.p50 >= 0 && outcomes.p50 <= 1

    // Skip if change is negligible:
    // - For 0-1 scale: 0.005 = 0.5 percentage points
    // - For 0-100 scale: 0.5 percentage points
    const threshold = isProbabilityScale ? 0.005 : 0.5
    if (Math.abs(delta) < threshold) return null

    // For baseline = 0, use absolute change (percentage points above 0)
    // For non-zero baseline, use relative percentage change
    // Convert to percentage if in 0-1 scale
    const deltaInPct = isProbabilityScale ? delta * 100 : delta
    const percentChange = baseline === 0
      ? deltaInPct  // Absolute change in percentage points
      : (delta / Math.abs(baseline)) * 100

    const isIncrease = delta > 0
    const isPositive =
      (goalDirection === 'maximize' && isIncrease) ||
      (goalDirection === 'minimize' && !isIncrease)

    return {
      delta,
      percentChange,
      isIncrease,
      isPositive,
      isAbsoluteChange: baseline === 0,  // Track if using absolute vs relative
      isProbabilityScale,
      // For formatted display, convert probability scale to percentage
      formattedDelta: formatOutcomeValueCompact(
        isProbabilityScale ? Math.abs(delta) * 100 : Math.abs(delta),
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

        {/* Comparison context */}
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
                {/* Show "pts" for baseline=0 (absolute), "%" for relative change */}
                {comparison.isAbsoluteChange
                  ? `${comparison.isIncrease ? '+' : ''}${Math.abs(comparison.percentChange).toFixed(0)} pts ${comparison.isPositive ? 'above' : 'below'}`
                  : `${Math.abs(comparison.percentChange).toFixed(0)}% ${comparison.isPositive ? 'better' : 'worse'}`
                }
              </span>
              <span className={`${typography.caption} text-ink-500`}>
                vs. {baselineName}
              </span>
            </div>
          ) : (
            <span className={`${typography.caption} text-ink-400`}>
              No baseline for comparison
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
            {/* P10 - Worst case */}
            <div className="text-center p-2 bg-sand-50 rounded-lg">
              <p className={`${typography.caption} text-ink-500 mb-1`}>Worst Case</p>
              <p className={`${typography.body} font-semibold text-ink-700`}>
                {formatOutcomeValue(outcomes.p10, outcomes.units, outcomes.unitSymbol)}
              </p>
              <p className={`${typography.caption} text-ink-400`}>10th percentile</p>
            </div>

            {/* P90 - Best case */}
            <div className="text-center p-2 bg-sand-50 rounded-lg">
              <p className={`${typography.caption} text-ink-500 mb-1`}>Best Case</p>
              <p className={`${typography.body} font-semibold text-ink-700`}>
                {formatOutcomeValue(outcomes.p90, outcomes.units, outcomes.unitSymbol)}
              </p>
              <p className={`${typography.caption} text-ink-400`}>90th percentile</p>
            </div>
          </div>

          {/* Range visualization */}
          <div className="relative h-2 bg-sand-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 bg-sky-300 rounded-full"
              style={{
                left: '10%',
                right: '10%',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-sky-600 rounded-full border-2 border-white shadow"
              style={{ left: '50%', transform: 'translate(-50%, -50%)' }}
            />
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
                  {comparison.isAbsoluteChange
                    ? `${comparison.isIncrease ? '+' : ''}${comparison.formattedDelta}`
                    : `${comparison.formattedDelta} (${comparison.isIncrease ? '+' : ''}${comparison.percentChange.toFixed(0)}%)`
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

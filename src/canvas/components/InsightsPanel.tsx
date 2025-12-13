/**
 * InsightsPanel Component (Sprint N - P0)
 *
 * Plain-English takeaway from the analysis.
 * Designed to be the primary "what does this mean?" component.
 *
 * Shows:
 * - Summary: ≤200 chars, plain English conclusion
 * - Risks: Max 5 items - things that could go wrong
 * - Next Steps: Max 3 items - recommended actions
 */

import { useState, useMemo, useRef } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageSquare,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import type { Insights } from '../../types/plot'
import { focusNodeById } from '../utils/focusHelpers'

/** Driver information for insight generation */
interface DriverSummary {
  label: string
  polarity: 'up' | 'down' | 'neutral'
  strength?: 'low' | 'medium' | 'high'
  contribution?: number
}

interface InsightsPanelProps {
  /** Insights data from engine response (may have missing/null fields) */
  insights: Partial<Insights> | null | undefined
  /** Start expanded to show risks and next steps */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
  /** Quick Win #5: Current outcome value for consistency check */
  outcomeValue?: number | null
  /** Quick Win #5: Baseline value for consistency check */
  baselineValue?: number | null
  /** Quick Win #5: Goal direction for interpreting changes */
  goalDirection?: 'maximize' | 'minimize'
  /** Top drivers for driver-focused insight */
  topDrivers?: DriverSummary[]
}

/**
 * P0.3: Normalize insights data with safe defaults
 *
 * Defends against:
 * - null/undefined insights
 * - missing fields (summary, risks, next_steps)
 * - oversized arrays (risks > 5, next_steps > 3)
 * - oversized summary (> 200 chars)
 */
function normalizeInsights(insights: Partial<Insights> | null | undefined): Insights {
  const DEFAULT_SUMMARY = 'Analysis complete. Review the results above for details.'
  const MAX_RISKS = 5
  const MAX_NEXT_STEPS = 3
  const MAX_SUMMARY_LENGTH = 200

  if (!insights) {
    return {
      summary: DEFAULT_SUMMARY,
      risks: [],
      next_steps: [],
    }
  }

  // Normalize and truncate summary
  let summary = insights.summary?.trim() || DEFAULT_SUMMARY
  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = summary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...'
  }

  // Normalize and limit arrays
  const risks = Array.isArray(insights.risks)
    ? insights.risks.slice(0, MAX_RISKS).filter(Boolean)
    : []

  const next_steps = Array.isArray(insights.next_steps)
    ? insights.next_steps.slice(0, MAX_NEXT_STEPS).filter(Boolean)
    : []

  return { summary, risks, next_steps }
}

/**
 * Quick Win #5: Check if insight text contradicts actual outcome direction
 * Returns a corrected summary if contradiction detected
 *
 * Also detects nonsensical claims like "99% decrease" when values are reasonable
 */
function validateInsightConsistency(
  summary: string,
  outcomeValue: number | null | undefined,
  baselineValue: number | null | undefined,
  goalDirection: 'maximize' | 'minimize' = 'maximize'
): { summary: string; wasContradictory: boolean } {
  // Check for extreme percentage claims that are likely calculation errors
  // e.g., "decrease by 99%" when actual values are reasonable
  const extremeClaimMatch = summary.match(/(?:decrease|drop|decline|fall|reduce|increase|rise|grow|gain)\s*(?:by\s*)?(?:approximately\s*)?(\d{2,3})%/i)
  if (extremeClaimMatch) {
    const claimedChange = parseInt(extremeClaimMatch[1], 10)

    // If claiming >50% change, validate against actual outcome
    if (claimedChange > 50 && outcomeValue != null) {
      // If outcome is a reasonable probability (0-1 range or 0-100 range),
      // extreme claims are likely backend calculation errors
      const isReasonableOutcome = (outcomeValue >= 0 && outcomeValue <= 1) ||
                                  (outcomeValue >= 0 && outcomeValue <= 100)

      if (isReasonableOutcome) {
        console.warn('[InsightsPanel] Extreme percentage claim detected:', {
          summary,
          claimedChange: `${claimedChange}%`,
          outcomeValue,
        })

        // Generate a sensible summary based on actual outcome
        const displayValue = outcomeValue >= 0 && outcomeValue <= 1
          ? `${(outcomeValue * 100).toFixed(0)}%`
          : `${outcomeValue.toFixed(0)}%`

        const isPositive = goalDirection === 'maximize' ? outcomeValue > 0.5 : outcomeValue < 0.5
        const sentiment = isPositive ? 'favorable' : 'moderate'

        return {
          summary: `Expected outcome is ${displayValue}, indicating ${sentiment} conditions for your objective.`,
          wasContradictory: true
        }
      }
    }
  }

  // Original baseline comparison logic
  if (outcomeValue == null || baselineValue == null || baselineValue === 0) {
    return { summary, wasContradictory: false }
  }

  // Calculate actual change
  const actualChange = ((outcomeValue - baselineValue) / Math.abs(baselineValue)) * 100

  // Detect direction claims in insight text
  const claimsDecrease = /decrease|drop|decline|fall|worse|lower|reduce|down by/i.test(summary)
  const claimsIncrease = /increase|rise|improve|grow|better|higher|up by|gain/i.test(summary)

  // Check for contradictions
  const isContradictory =
    (actualChange > 5 && claimsDecrease && !claimsIncrease) ||
    (actualChange < -5 && claimsIncrease && !claimsDecrease)

  if (isContradictory) {
    console.warn('[InsightsPanel] Contradictory insight detected:', {
      summary,
      actualChange: `${actualChange.toFixed(1)}%`,
      claimsDecrease,
      claimsIncrease,
    })

    // Generate corrected summary
    const direction = actualChange > 0 ? 'increase' : 'decrease'
    const magnitude = Math.abs(actualChange)
    const magnitudeWord = magnitude > 50 ? 'significantly' : magnitude > 20 ? 'moderately' : 'slightly'

    // Interpret based on goal direction
    const isPositive = (goalDirection === 'maximize' && actualChange > 0) ||
                       (goalDirection === 'minimize' && actualChange < 0)
    const sentiment = isPositive ? 'improving' : 'declining'

    const correctedSummary = `Outcome is expected to ${direction} by approximately ${magnitude.toFixed(0)}% compared to baseline, ${magnitudeWord} ${sentiment} your objective.`

    return { summary: correctedSummary, wasContradictory: true }
  }

  return { summary, wasContradictory: false }
}

/**
 * Generate driver-focused insight text instead of restating percentages
 */
function generateDriverInsight(
  drivers: DriverSummary[] | undefined,
  goalDirection: 'maximize' | 'minimize'
): string | null {
  if (!drivers || drivers.length === 0) return null

  // Get top 2 drivers that are having an impact
  const impactfulDrivers = drivers
    .filter(d => d.polarity !== 'neutral')
    .slice(0, 2)

  if (impactfulDrivers.length === 0) return null

  // Determine if outcome is positive based on drivers and goal
  const positiveDrivers = impactfulDrivers.filter(d =>
    (d.polarity === 'up' && goalDirection === 'maximize') ||
    (d.polarity === 'down' && goalDirection === 'minimize')
  )
  const negativeDrivers = impactfulDrivers.filter(d =>
    (d.polarity === 'down' && goalDirection === 'maximize') ||
    (d.polarity === 'up' && goalDirection === 'minimize')
  )

  // Generate insight based on driver analysis
  if (positiveDrivers.length > 0 && negativeDrivers.length === 0) {
    const topDriver = positiveDrivers[0]
    const strengthText = topDriver.strength === 'high' ? 'strongly' : topDriver.strength === 'medium' ? 'moderately' : ''
    return `${topDriver.label} is ${strengthText} driving favorable outcomes${positiveDrivers.length > 1 ? `, supported by ${positiveDrivers[1].label}` : ''}.`
  }

  if (negativeDrivers.length > 0 && positiveDrivers.length === 0) {
    const topDriver = negativeDrivers[0]
    const strengthText = topDriver.strength === 'high' ? 'significantly' : topDriver.strength === 'medium' ? 'moderately' : ''
    return `${topDriver.label} is ${strengthText} limiting outcomes${negativeDrivers.length > 1 ? `, compounded by ${negativeDrivers[1].label}` : ''}.`
  }

  // Mixed drivers
  if (positiveDrivers.length > 0 && negativeDrivers.length > 0) {
    return `${positiveDrivers[0].label} is helping, but ${negativeDrivers[0].label} is holding back results.`
  }

  return null
}

/**
 * Remove percentage patterns from insight summary to avoid redundancy
 * with OutcomesSignal which already shows the percentage prominently
 */
function stripPercentageFromSummary(summary: string): string {
  // Remove patterns like "65% success", "outcome of 65%", etc.
  return summary
    .replace(/\b\d+(\.\d+)?%\s*(success|probability|likelihood|chance|outcome)/gi, '')
    .replace(/\b(success|probability|likelihood|chance|outcome)\s*(of|is|at)\s*\d+(\.\d+)?%/gi, '')
    .replace(/\s{2,}/g, ' ') // Clean up double spaces
    .replace(/^[,.\s]+/, '') // Clean up leading punctuation
    .trim()
}

export function InsightsPanel({
  insights: rawInsights,
  defaultExpanded = true,
  className = '',
  outcomeValue,
  baselineValue,
  goalDirection = 'maximize',
  topDrivers,
}: InsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Brief 33b: Render counter for debugging re-render loop
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  if (import.meta.env.DEV) {
    console.log(`[InsightsPanel] Render #${renderCountRef.current}`)
  }

  // Brief 33 Fix: Memoize all expensive computations to prevent re-render loop
  // Previously these ran on every render, causing validateInsightConsistency to fire 6+ times

  // P0.3: Normalize insights with safe defaults and limits
  const normalized = useMemo(
    () => normalizeInsights(rawInsights),
    [rawInsights]
  )

  // Quick Win #5: Validate and correct contradictory insights
  const { summary: rawSummary, wasContradictory } = useMemo(
    () => validateInsightConsistency(
      normalized.summary,
      outcomeValue,
      baselineValue,
      goalDirection
    ),
    [normalized.summary, outcomeValue, baselineValue, goalDirection]
  )
  const { risks, next_steps } = normalized

  // Generate driver-focused insight OR strip percentage from backend summary
  const { driverInsight, cleanedSummary } = useMemo(() => ({
    driverInsight: generateDriverInsight(topDrivers, goalDirection),
    cleanedSummary: stripPercentageFromSummary(rawSummary),
  }), [topDrivers, goalDirection, rawSummary])

  // Prefer driver insight, fall back to cleaned summary
  const summary = driverInsight || (cleanedSummary.length > 20 ? cleanedSummary : rawSummary)

  const hasDetails = risks.length > 0 || next_steps.length > 0

  return (
    <div
      className={`rounded-lg border border-sky-200 bg-sky-50/50 ${className}`}
      data-testid="insights-panel"
    >
      {/* Header with summary */}
      <button
        type="button"
        className="w-full text-left px-3 py-3"
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="insights-details"
        disabled={!hasDetails}
      >
        <div className="flex items-start gap-2">
          <MessageSquare
            className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`${typography.label} text-sky-700`}>
                Key Insight
              </span>
              {hasDetails && (
                <span className="text-ink-900/40">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </span>
              )}
            </div>
            <p
              className={`${typography.body} text-ink-900`}
              data-testid="insights-summary"
            >
              {summary}
            </p>
          </div>
        </div>
      </button>

      {/* Expandable details */}
      {hasDetails && isExpanded && (
        <div
          id="insights-details"
          className="px-3 pb-3 space-y-3 border-t border-sky-200/50"
          data-testid="insights-details"
        >
          {/* Risks */}
          {risks.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle
                  className="w-4 h-4 text-amber-600"
                  aria-hidden="true"
                />
                <span className={`${typography.labelSmall} text-amber-700`}>
                  Risks to Consider
                </span>
              </div>
              <ul
                className="space-y-1.5 pl-5"
                role="list"
                aria-label="Risks to consider"
                data-testid="risks-list"
              >
                {risks.map((risk, index) => {
                  const label = String(risk)
                  const key = `risk-${label}-${index}`

                  return (
                    <li
                      key={key}
                      className={`${typography.bodySmall} text-ink-900/80 list-disc`}
                    >
                      {risk}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {next_steps.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb
                  className="w-4 h-4 text-green-600"
                  aria-hidden="true"
                />
                <span className={`${typography.labelSmall} text-green-700`}>
                  Recommended Next Steps
                </span>
              </div>
              <ul
                className="space-y-1.5"
                role="list"
                aria-label="Recommended next steps"
                data-testid="next-steps-list"
              >
                {next_steps.map((step, index) => {
                  const label = typeof step === 'string' ? step : step?.label ?? ''
                  const nodeId = typeof step === 'string' ? undefined : step?.nodeId

                  if (!label) return null

                  const handleClick = () => {
                    if (nodeId) {
                      focusNodeById(nodeId)
                    }
                  }

                  const isInteractive = Boolean(nodeId)
                  const itemKey = nodeId ? `next-${nodeId}` : `next-${label}-${index}`

                  return (
                    <li
                      key={itemKey}
                      className="flex items-start gap-2"
                    >
                      <ArrowRight
                        className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={isInteractive ? handleClick : undefined}
                        className={`${typography.bodySmall} text-ink-900/80 text-left ${
                          isInteractive ? 'underline decoration-dotted hover:text-green-700' : ''
                        }`}
                        disabled={!isInteractive}
                        data-testid="next-step-item"
                      >
                        {label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Compact variant showing only the summary
 */
export function InsightsSummaryCompact({
  insights: rawInsights,
  className = '',
}: Pick<InsightsPanelProps, 'insights' | 'className'>) {
  // P0.3: Normalize insights with safe defaults
  const { summary, risks, next_steps } = normalizeInsights(rawInsights)
  const detailsCount = risks.length + next_steps.length

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 ${className}`}
      role="region"
      aria-label="Key insight summary"
      data-testid="insights-compact"
    >
      <Lightbulb className="w-4 h-4 text-sky-600 flex-shrink-0" aria-hidden="true" />
      <span
        className={`${typography.bodySmall} text-ink-900 line-clamp-1`}
        title={summary}
      >
        {summary}
      </span>
      {detailsCount > 0 && (
        <span className={`${typography.caption} text-sky-600 flex-shrink-0`}>
          +{detailsCount}
        </span>
      )}
    </div>
  )
}

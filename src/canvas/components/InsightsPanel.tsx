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

import { useState } from 'react'
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

interface InsightsPanelProps {
  /** Insights data from engine response (may have missing/null fields) */
  insights: Partial<Insights> | null | undefined
  /** Start expanded to show risks and next steps */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
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

export function InsightsPanel({
  insights: rawInsights,
  defaultExpanded = true,
  className = '',
}: InsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // P0.3: Normalize insights with safe defaults and limits
  const { summary, risks, next_steps } = normalizeInsights(rawInsights)

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

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

interface InsightsPanelProps {
  /** Insights data from engine response */
  insights: Insights
  /** Start expanded to show risks and next steps */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
}

export function InsightsPanel({
  insights,
  defaultExpanded = true,
  className = '',
}: InsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const { summary, risks, next_steps } = insights

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
                {risks.map((risk, index) => (
                  <li
                    key={index}
                    className={`${typography.bodySmall} text-ink-900/80 list-disc`}
                  >
                    {risk}
                  </li>
                ))}
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
                {next_steps.map((step, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2"
                  >
                    <ArrowRight
                      className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className={`${typography.bodySmall} text-ink-900/80`}>
                      {step}
                    </span>
                  </li>
                ))}
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
  insights,
  className = '',
}: Pick<InsightsPanelProps, 'insights' | 'className'>) {
  const { summary, risks, next_steps } = insights
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

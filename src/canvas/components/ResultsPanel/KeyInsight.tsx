/**
 * KeyInsight - Display single key insight from analysis
 *
 * Brief H Task 10: Improved key insight quality and display
 *
 * Features:
 * - Shows headline insight prominently
 * - Supports multiple insight sources (CEE, PLoT, ISL synthesis)
 * - Click to expand for more details
 * - Filters out confusing backend messages
 */

import { useState, useMemo } from 'react'
import { Lightbulb, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { typography } from '../../../styles/typography'

interface KeyInsightProps {
  /** Primary insight headline */
  headline: string | null
  /** Expanded explanation (if available) */
  explanation?: string | null
  /** Source of insight */
  source?: 'cee' | 'plot' | 'isl' | 'synthesis'
  /** Additional context insights */
  additionalInsights?: string[]
  /** Click handler */
  onClick?: () => void
}

// Brief I Task 4: Pattern to filter out confusing/contradictory backend messages
// These raw PLoT summaries often contradict actual UI signals
const CONFUSING_PATTERNS = [
  // Raw percentage claims that duplicate KPI display
  /Outcome (is )?(likely |expected )?(to )?(increase|decrease|rise|fall|drop) by \d+%/i,
  /Expected to (increase|decrease|rise|fall|drop) by \d+%/i,
  /likely (increase|decrease) of \d+%/i,
  // Baseline comparison that duplicates other UI
  /Similar to (do nothing|baseline|status quo).*\d+%/i,
  // Raw standalone percentages
  /^[-+]?\d+\.?\d*%$/,
  // Generic "success/failure" statements without context
  /^\d+%\s*(success|failure|probability)/i,
  /probability\s*(of|is|:)\s*\d+%/i,
]

export function KeyInsight({
  headline,
  explanation,
  source,
  additionalInsights = [],
  onClick,
}: KeyInsightProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Filter out confusing patterns
  const filteredHeadline = useMemo(() => {
    if (!headline) return null
    for (const pattern of CONFUSING_PATTERNS) {
      if (pattern.test(headline)) return null
    }
    return headline.trim()
  }, [headline])

  // Filter additional insights
  const filteredAdditional = useMemo(() => {
    return additionalInsights.filter(insight => {
      for (const pattern of CONFUSING_PATTERNS) {
        if (pattern.test(insight)) return false
      }
      return insight.trim().length > 0
    })
  }, [additionalInsights])

  // Show nothing if no valid content
  if (!filteredHeadline && filteredAdditional.length === 0 && !explanation) {
    return null
  }

  const hasExpandableContent = (explanation && explanation.length > 0) || filteredAdditional.length > 0

  // Source label mapping
  const sourceLabels: Record<string, string> = {
    cee: 'AI Analysis',
    plot: 'Engine',
    isl: 'Robustness',
    synthesis: 'Synthesis',
  }

  return (
    <div
      className="bg-violet-50 border border-violet-200 rounded-lg overflow-hidden"
      data-testid="key-insight"
    >
      <button
        type="button"
        onClick={() => {
          if (hasExpandableContent) {
            setIsExpanded(!isExpanded)
          }
          onClick?.()
        }}
        disabled={!hasExpandableContent && !onClick}
        className={`w-full px-3 py-2.5 flex items-start gap-3 text-left ${
          hasExpandableContent || onClick ? 'hover:bg-violet-100 transition-colors' : ''
        }`}
      >
        <div className="flex-shrink-0 mt-0.5">
          {source === 'cee' || source === 'synthesis' ? (
            <Sparkles className="h-4 w-4 text-violet-600" aria-hidden="true" />
          ) : (
            <Lightbulb className="h-4 w-4 text-violet-600" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`${typography.caption} font-medium text-violet-700`}>
              Key Insight
            </span>
            {source && (
              <span className={`${typography.caption} px-1.5 py-0.5 rounded bg-violet-100 text-violet-600`}>
                {sourceLabels[source] || source}
              </span>
            )}
          </div>

          {filteredHeadline && (
            <p className={`${typography.bodySmall} text-ink-800`}>
              {filteredHeadline}
            </p>
          )}

          {!filteredHeadline && filteredAdditional.length > 0 && (
            <p className={`${typography.bodySmall} text-ink-800`}>
              {filteredAdditional[0]}
            </p>
          )}
        </div>

        {hasExpandableContent && (
          <div className="flex-shrink-0 mt-0.5">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-violet-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-violet-500" />
            )}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && hasExpandableContent && (
        <div className="px-3 pb-3 pt-0 ml-7 space-y-2 border-t border-violet-100">
          {explanation && (
            <p className={`${typography.caption} text-ink-600 pt-2`}>
              {explanation}
            </p>
          )}

          {filteredAdditional.length > (filteredHeadline ? 0 : 1) && (
            <ul className="space-y-1 pt-1">
              {filteredAdditional.slice(filteredHeadline ? 0 : 1).map((insight, index) => (
                <li
                  key={index}
                  className={`${typography.caption} text-ink-600 flex items-start gap-2`}
                >
                  <span className="text-violet-400 mt-1">-</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

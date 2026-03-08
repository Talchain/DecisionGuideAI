/**
 * ValueOfInformationList - Display VoI suggestions from ISL robustness
 *
 * Brief H Task 7: Shows which uncertainties are worth investigating
 *
 * Features:
 * - Shows expected value of perfect information (EVPI)
 * - Suggests actions to resolve uncertainty
 * - Shows estimated cost if available
 * - Click to focus on canvas node
 */

import { useCallback } from 'react'
import { Lightbulb, Search, DollarSign, TrendingUp } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { ValueOfInformation } from '../RecommendationCard/types'

interface ValueOfInformationListProps {
  /** VoI suggestions from ISL robustness */
  suggestions: ValueOfInformation[]
  /** Callback when suggestion is clicked */
  onSuggestionClick?: (nodeId: string, action?: string) => void
  /** Maximum items to show */
  maxItems?: number
  /** Currency symbol for value display */
  currencySymbol?: string
}

export function ValueOfInformationList({
  suggestions,
  onSuggestionClick,
  maxItems,
  currencySymbol = '\u00A3', // £
}: ValueOfInformationListProps) {
  const handleClick = useCallback(
    (nodeId: string, action?: string) => {
      onSuggestionClick?.(nodeId, action)
    },
    [onSuggestionClick]
  )

  // Filter to suggestions worth investigating
  const worthInvestigating = suggestions
    .filter(s => s.worth_investigating)
    .slice(0, maxItems ?? suggestions.length)

  if (worthInvestigating.length === 0) {
    return (
      <div className="p-3 text-center" data-testid="voi-empty">
        <p className={`${typography.caption} text-ink-500`}>
          No high-value uncertainties identified
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3" data-testid="voi-list">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-4 w-4 text-option" aria-hidden="true" />
        <span className={`${typography.caption} font-medium text-ink-700`}>
          Worth Investigating
        </span>
        <span className={`${typography.caption} text-option`}>
          High value of information
        </span>
      </div>

      {worthInvestigating.map((voi) => {
        // Format EVPI: show as currency if >= 1, otherwise as percentage
        const evpiDisplay = voi.evpi >= 1
          ? `${currencySymbol}${voi.evpi.toLocaleString()}/year`
          : `${(voi.evpi * 100).toFixed(0)}%`

        return (
          <button
            key={voi.node_id}
            type="button"
            onClick={() => handleClick(voi.node_id, voi.suggested_action)}
            className="w-full p-3 rounded-lg bg-panel border border-option/30 hover:bg-panel transition-colors text-left"
            data-testid={`voi-${voi.node_id}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-option" aria-hidden="true" />
                <span className={`${typography.bodySmall} font-medium text-ink-800`}>
                  {voi.label}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-option" aria-hidden="true" />
                <span className={`${typography.caption} font-semibold text-option`}>
                  Worth {evpiDisplay}
                </span>
              </div>
            </div>

            {/* Suggested action */}
            {voi.suggested_action && (
              <p className={`${typography.caption} text-option mb-1.5`}>
                {voi.suggested_action}
              </p>
            )}

            {/* Footer with cost and confidence */}
            <div className="flex items-center gap-3">
              {voi.resolution_cost != null && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-ink-400" aria-hidden="true" />
                  <span className={`${typography.caption} text-ink-500`}>
                    Est. cost: {currencySymbol}{voi.resolution_cost.toLocaleString()}
                  </span>
                </div>
              )}
              {voi.confidence && (
                <span
                  className={`${typography.caption} px-1.5 py-0.5 rounded ${
                    voi.confidence === 'high'
                      ? 'bg-mint-100 text-mint-700'
                      : voi.confidence === 'medium'
                        ? 'bg-banana-100 text-banana-700'
                        : 'bg-sand-100 text-sand-600'
                  }`}
                >
                  {voi.confidence} confidence
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

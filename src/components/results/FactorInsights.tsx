/**
 * FactorInsights Component
 *
 * Displays CEE-generated enrichments for factor cards:
 * - Observations (bullet list)
 * - Perspectives (bullet list)
 * - Confidence question (callout, for rank 1-3 factors)
 *
 * Features:
 * - Collapsible disclosure with "Insights" label
 * - Collapsed by default
 * - Independent toggles (not accordion)
 * - Accessible: button with aria-expanded, aria-controls
 */

import { useState, useId } from 'react'
import { ChevronRight, ChevronDown, Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { FactorEnrichment } from '../../lib/mappers/types'
import { stripEncodingNotation } from './utils/cleanFactorLabel'

interface FactorInsightsProps {
  enrichment: FactorEnrichment
}

/**
 * Check if enrichment has any displayable content
 * Includes observations, perspectives, OR confidence_question
 */
export function hasEnrichmentContent(enrichment: FactorEnrichment | undefined): boolean {
  if (!enrichment) return false
  return Boolean(
    enrichment.observations?.length ||
    enrichment.perspectives?.length ||
    enrichment.confidence_question?.trim().length
  )
}

/**
 * FactorInsights component - CEE-generated insights disclosure
 */
export function FactorInsights({ enrichment }: FactorInsightsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentId = useId()

  // Don't render if no content
  if (!hasEnrichmentContent(enrichment)) {
    return null
  }

  const hasObservations = enrichment.observations?.length > 0
  const hasPerspectives = enrichment.perspectives?.length > 0
  const hasConfidenceQuestion =
    typeof enrichment.confidence_question === 'string' &&
    enrichment.confidence_question.trim().length > 0

  return (
    <div className="mt-2 border-t border-sand-200 pt-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className={`flex items-center gap-1 ${typography.panelBody} text-text-light hover:text-text-body transition-colors w-full text-left`}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="shrink-0" />
        ) : (
          <ChevronRight size={14} className="shrink-0" />
        )}
        <span>Insights</span>
      </button>

      {/* Content region */}
      {isExpanded && (
        <div
          id={contentId}
          className={`mt-2 space-y-3 ${typography.panelBody} text-text-body`}
        >
          {/* Observations */}
          {hasObservations && (
            <div>
              <div className="text-text-light mb-1">Observations</div>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                {enrichment.observations.map((obs, idx) => (
                  <li key={idx} className="leading-relaxed">{stripEncodingNotation(obs)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Perspectives */}
          {hasPerspectives && (
            <div>
              <div className="text-text-light mb-1">Perspectives</div>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                {enrichment.perspectives.map((persp, idx) => (
                  <li key={idx} className="leading-relaxed">{stripEncodingNotation(persp)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence question callout */}
          {hasConfidenceQuestion && (
            <div className="bg-panel border border-info/30 rounded-md p-2 flex items-start gap-2">
              <Lightbulb size={14} className="text-info shrink-0 mt-0.5" />
              <span className="leading-relaxed">{stripEncodingNotation(enrichment.confidence_question!)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FactorInsights

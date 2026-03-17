/**
 * FormSuggestionBadge - Subtle suggestion badge for medium-confidence forms
 *
 * Brief 11.3: Non-intrusive badge showing CEE suggestions
 * Users can apply or dismiss the suggestion.
 */

import { memo, useState } from 'react'
import { Lightbulb, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { FORM_DISPLAY_NAMES, type EdgeFunctionType } from '../../domain/edges'
import type { FormSuggestionBadgeProps } from './types'

/**
 * FormSuggestionBadge - Shows a medium-confidence form suggestion
 */
export const FormSuggestionBadge = memo(function FormSuggestionBadge({
  recommendation,
  onApply,
  onDismiss,
  compact = false,
}: FormSuggestionBadgeProps) {
  const [showRationale, setShowRationale] = useState(false)

  const formInfo = FORM_DISPLAY_NAMES[recommendation.recommended_form]

  // Compact mode: Just a small badge
  if (compact) {
    return (
      <div
        data-testid={`form-suggestion-badge-${recommendation.edge_id}`}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-panel border border-warning/30"
        title={`Suggestion: ${formInfo?.name || recommendation.recommended_form}`}
      >
        <Lightbulb className="w-3 h-3 text-warning" aria-hidden="true" />
        <span className={`${typography.caption} text-warning font-medium`}>
          {formInfo?.name || recommendation.recommended_form}
        </span>
        <button
          type="button"
          onClick={() => onApply?.(recommendation.edge_id, recommendation.recommended_form)}
          className="p-0.5 rounded-full hover:bg-panel-hover text-warning transition-colors"
          aria-label={`Apply ${formInfo?.name || recommendation.recommended_form}`}
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.(recommendation.edge_id)}
          className="p-0.5 rounded-full hover:bg-panel-hover text-warning transition-colors"
          aria-label="Dismiss suggestion"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // Full mode: Badge with expandable rationale
  return (
    <div
      data-testid={`form-suggestion-badge-${recommendation.edge_id}`}
      className="rounded-lg border border-warning/30 bg-panel overflow-hidden"
      role="region"
      aria-label="Form suggestion"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-2.5">
        <Lightbulb className="w-4 h-4 text-warning flex-shrink-0" aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <p className={`${typography.caption} font-medium text-warning`}>
            Suggestion: Use <span className="font-semibold">{formInfo?.name || recommendation.recommended_form}</span>
          </p>
          <p className={`${typography.caption} text-warning truncate`}>
            {recommendation.source_label} → {recommendation.target_label}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onApply?.(recommendation.edge_id, recommendation.recommended_form)}
            className="px-2 py-1 rounded bg-panel hover:bg-panel-hover text-warning text-xs font-medium transition-colors"
            aria-label={`Apply ${formInfo?.name || recommendation.recommended_form}`}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => onDismiss?.(recommendation.edge_id)}
            className="p-1 rounded hover:bg-panel-hover text-warning transition-colors"
            aria-label="Dismiss suggestion"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rationale toggle */}
      <button
        type="button"
        onClick={() => setShowRationale(!showRationale)}
        className="w-full flex items-center justify-center gap-1 py-1.5 bg-panel/50 text-warning text-xs hover:bg-panel-hover transition-colors"
        aria-expanded={showRationale}
      >
        {showRationale ? (
          <>
            <ChevronUp className="w-3 h-3" />
            Hide rationale
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Why this form?
          </>
        )}
      </button>

      {/* Rationale content */}
      {showRationale && (
        <div className="px-3 py-2 bg-panel border-t border-warning/30">
          <p className={`${typography.caption} text-warning`}>
            {recommendation.rationale}
          </p>
          {formInfo?.shortDescription && (
            <p className={`${typography.caption} text-warning mt-1.5 italic`}>
              {formInfo.shortDescription}
            </p>
          )}
        </div>
      )}
    </div>
  )
})

export default FormSuggestionBadge

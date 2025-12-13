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
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 border border-amber-300"
        title={`Suggestion: ${formInfo?.name || recommendation.recommended_form}`}
      >
        <Lightbulb className="w-3 h-3 text-amber-600" aria-hidden="true" />
        <span className={`${typography.caption} text-amber-800 font-medium`}>
          {formInfo?.name || recommendation.recommended_form}
        </span>
        <button
          type="button"
          onClick={() => onApply?.(recommendation.edge_id, recommendation.recommended_form)}
          className="p-0.5 rounded-full hover:bg-amber-200 text-amber-700 transition-colors"
          aria-label={`Apply ${formInfo?.name || recommendation.recommended_form}`}
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.(recommendation.edge_id)}
          className="p-0.5 rounded-full hover:bg-amber-200 text-amber-600 transition-colors"
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
      className="rounded-lg border border-amber-300 bg-amber-50 overflow-hidden"
      role="region"
      aria-label="Form suggestion"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-2.5">
        <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <p className={`${typography.caption} font-medium text-amber-800`}>
            Suggestion: Use <span className="font-semibold">{formInfo?.name || recommendation.recommended_form}</span>
          </p>
          <p className={`${typography.caption} text-amber-700 truncate`}>
            {recommendation.source_label} → {recommendation.target_label}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onApply?.(recommendation.edge_id, recommendation.recommended_form)}
            className="px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-800 text-xs font-medium transition-colors"
            aria-label={`Apply ${formInfo?.name || recommendation.recommended_form}`}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => onDismiss?.(recommendation.edge_id)}
            className="p-1 rounded hover:bg-amber-200 text-amber-600 transition-colors"
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
        className="w-full flex items-center justify-center gap-1 py-1.5 bg-amber-100/50 text-amber-700 text-xs hover:bg-amber-100 transition-colors"
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
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200">
          <p className={`${typography.caption} text-amber-800`}>
            {recommendation.rationale}
          </p>
          {formInfo?.shortDescription && (
            <p className={`${typography.caption} text-amber-700 mt-1.5 italic`}>
              {formInfo.shortDescription}
            </p>
          )}
        </div>
      )}
    </div>
  )
})

export default FormSuggestionBadge

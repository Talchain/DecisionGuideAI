/**
 * AppliedFormsCallout - Shows high-confidence auto-applied forms
 *
 * Brief 11.2: Dismissible callout for forms automatically applied by CEE
 * Users can confirm, change, or dismiss each recommendation.
 */

import { memo, useState } from 'react'
import { ChevronDown, ChevronUp, Check, RefreshCw, X } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { FORM_DISPLAY_NAMES, type EdgeFunctionType } from '../../domain/edges'
import type { AppliedFormsCalloutProps, EdgeFormRecommendation } from './types'

/**
 * Single applied form item in the callout
 */
interface AppliedFormItemProps {
  recommendation: EdgeFormRecommendation
  onConfirm?: (edgeId: string) => void
  onChange?: (edgeId: string) => void
}

const AppliedFormItem = memo(function AppliedFormItem({
  recommendation,
  onConfirm,
  onChange,
}: AppliedFormItemProps) {
  const formInfo = FORM_DISPLAY_NAMES[recommendation.recommended_form]

  return (
    <li
      data-testid={`applied-form-${recommendation.edge_id}`}
      className="flex items-start gap-3 p-2 rounded-lg bg-teal-50 border border-teal-200"
    >
      {/* Form icon */}
      <span
        className="text-lg leading-none text-teal-600 font-mono"
        aria-hidden="true"
      >
        {formInfo?.icon || '─'}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Edge labels */}
        <p className={`${typography.caption} font-medium text-teal-800`}>
          {recommendation.source_label} → {recommendation.target_label}
        </p>

        {/* Form name and rationale */}
        <p className={`${typography.caption} text-teal-700 mt-0.5`}>
          <span className="font-medium">{formInfo?.name || recommendation.recommended_form}</span>
          {' — '}
          {recommendation.rationale}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onConfirm?.(recommendation.edge_id)}
          className="p-1.5 rounded hover:bg-teal-200 text-teal-700 transition-colors"
          title="Confirm this form"
          aria-label={`Confirm ${formInfo?.name || recommendation.recommended_form} for ${recommendation.source_label} to ${recommendation.target_label}`}
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange?.(recommendation.edge_id)}
          className="p-1.5 rounded hover:bg-teal-200 text-teal-600 transition-colors"
          title="Change this form"
          aria-label={`Change form for ${recommendation.source_label} to ${recommendation.target_label}`}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </li>
  )
})

/**
 * AppliedFormsCallout - Displays high-confidence auto-applied forms
 */
export const AppliedFormsCallout = memo(function AppliedFormsCallout({
  appliedForms,
  onConfirm,
  onChange,
  onDismiss,
  collapsible = true,
  defaultExpanded = true,
}: AppliedFormsCalloutProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  // Don't render if no forms to show
  if (appliedForms.length === 0) {
    return null
  }

  const formCount = appliedForms.length

  return (
    <div
      data-testid="applied-forms-callout"
      className="rounded-lg border border-teal-300 bg-teal-50/50 overflow-hidden"
      role="region"
      aria-label="Auto-applied relationship forms"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-teal-100/50">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left flex-1"
            aria-expanded={expanded}
            aria-controls="applied-forms-content"
          >
            <span
              className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-medium"
              aria-hidden="true"
            >
              {formCount}
            </span>
            <span className={`${typography.body} font-medium text-teal-800`}>
              {formCount === 1
                ? 'Relationship form applied'
                : `${formCount} relationship forms applied`}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-teal-600 ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 text-teal-600 ml-auto" />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-medium"
              aria-hidden="true"
            >
              {formCount}
            </span>
            <span className={`${typography.body} font-medium text-teal-800`}>
              {formCount === 1
                ? 'Relationship form applied'
                : `${formCount} relationship forms applied`}
            </span>
          </div>
        )}

        {/* Dismiss button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded hover:bg-teal-200 text-teal-600 transition-colors ml-2"
            title="Dismiss all"
            aria-label="Dismiss all applied forms"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div id="applied-forms-content" className="p-3 pt-0">
          {/* Help text */}
          <p className={`${typography.caption} text-teal-700 mb-3 mt-2`}>
            The AI detected likely relationship patterns and applied appropriate forms.
            Review below to confirm or adjust.
          </p>

          {/* Applied forms list */}
          <ul className="space-y-2" role="list">
            {appliedForms.map((rec) => (
              <AppliedFormItem
                key={rec.edge_id}
                recommendation={rec}
                onConfirm={onConfirm}
                onChange={onChange}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
})

export default AppliedFormsCallout

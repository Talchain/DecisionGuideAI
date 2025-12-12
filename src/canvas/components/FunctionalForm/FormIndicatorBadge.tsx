/**
 * FormIndicatorBadge - Visual indicator for edge functional form
 *
 * Brief 11.5: Small badge showing the functional form type on edges
 * Uses icons/symbols for quick visual identification.
 */

import { memo } from 'react'
import { FORM_DISPLAY_NAMES, type EdgeFunctionType, type FormProvenance } from '../../domain/edges'

interface FormIndicatorBadgeProps {
  /** The functional form type */
  form: EdgeFunctionType
  /** How the form was selected */
  provenance?: FormProvenance
  /** Size variant */
  size?: 'sm' | 'md'
  /** Show text label */
  showLabel?: boolean
  /** Dark mode */
  isDark?: boolean
  /** Additional CSS class */
  className?: string
}

/**
 * Get provenance-based styling
 */
function getProvenanceStyle(provenance?: FormProvenance, isDark = false): string {
  switch (provenance) {
    case 'cee_recommended':
      return isDark
        ? 'bg-teal-800 border-teal-600 text-teal-200'
        : 'bg-teal-100 border-teal-300 text-teal-700'
    case 'user_selected':
      return isDark
        ? 'bg-amber-800 border-amber-600 text-amber-200'
        : 'bg-amber-100 border-amber-300 text-amber-700'
    default:
      return isDark
        ? 'bg-gray-700 border-gray-500 text-gray-300'
        : 'bg-sand-100 border-sand-300 text-sand-600'
  }
}

/**
 * FormIndicatorBadge - Compact form type indicator
 */
export const FormIndicatorBadge = memo(function FormIndicatorBadge({
  form,
  provenance,
  size = 'sm',
  showLabel = false,
  isDark = false,
  className = '',
}: FormIndicatorBadgeProps) {
  const info = FORM_DISPLAY_NAMES[form]

  // Don't show indicator for linear (default)
  if (form === 'linear') {
    return null
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  }

  const provenanceStyle = getProvenanceStyle(provenance, isDark)

  return (
    <span
      data-testid={`form-indicator-${form}`}
      className={`
        inline-flex items-center gap-1 rounded border font-mono
        ${sizeClasses[size]}
        ${provenanceStyle}
        ${className}
      `}
      title={`${info?.name || form}: ${info?.shortDescription || ''}`}
      role="note"
      aria-label={`Functional form: ${info?.name || form}`}
    >
      <span aria-hidden="true">{info?.icon || '?'}</span>
      {showLabel && (
        <span className="font-sans font-medium">{info?.name || form}</span>
      )}
    </span>
  )
})

export default FormIndicatorBadge

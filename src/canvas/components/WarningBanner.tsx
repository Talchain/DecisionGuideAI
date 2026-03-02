/**
 * WarningBanner - Display response warnings from API
 *
 * Shows warnings like edge type inferred, weights normalized, etc.
 * Features:
 * - Amber styling with AlertTriangle icon
 * - Expandable for multiple warnings
 * - Dismissible with X button
 * - "View affected items" link to highlight nodes/edges
 */

import { useState, useMemo } from 'react'
import { AlertTriangle, X, ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface Warning {
  code: 'EDGE_TYPE_INFERRED' | 'PRIMARY_OUTCOME_INFERRED' | 'WEIGHTS_NORMALIZED' | string
  message: string
  affected_ids?: string[]
}

/** V14.3b: Defence-in-depth — filter out warnings containing internal ISL field names. */
const INTERNAL_PATTERN = /constraint_fac_|observed_state\.|intercept\s*=|fac_[a-z_]+|blocks_analysis|node_id\s*=|edge_id\s*=|opt_[a-z_]+|goal_[a-z_]+/i

interface WarningBannerProps {
  warnings: Warning[]
  onDismiss?: () => void
  /** Show "View in canvas" link for affected items */
  onViewAffected?: (ids: string[]) => void
}

export function WarningBanner({ warnings, onDismiss, onViewAffected }: WarningBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // V14.3b: Defence-in-depth — strip any warning with internal tokens that slipped past the adapter
  const safeWarnings = useMemo(
    () => warnings.filter(w => !INTERNAL_PATTERN.test(w.message)),
    [warnings],
  )

  if (safeWarnings.length === 0) return null

  const firstWarning = safeWarnings[0]
  const hasMultiple = safeWarnings.length > 1

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-warning-50 border-warning-200"
      data-testid="warning-banner"
    >
      {/* Icon */}
      <AlertTriangle
        className="w-5 h-5 flex-shrink-0 mt-0.5 text-warning-600"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`${typography.label} text-warning-900`}>
          {firstWarning.message}
        </p>

        {/* Multiple warnings - expandable */}
        {hasMultiple && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`${typography.caption} mt-1 text-warning-700 flex items-center gap-1 hover:text-warning-800`}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            +{safeWarnings.length - 1} more {safeWarnings.length === 2 ? 'warning' : 'warnings'}
          </button>
        )}

        {isExpanded && (
          <ul className="mt-2 space-y-1">
            {safeWarnings.slice(1).map((w, i) => (
              <li key={i} className={`${typography.caption} text-warning-800`}>
                • {w.message}
              </li>
            ))}
          </ul>
        )}

        {/* View affected items */}
        {firstWarning.affected_ids && firstWarning.affected_ids.length > 0 && onViewAffected && (
          <button
            type="button"
            onClick={() => onViewAffected(firstWarning.affected_ids!)}
            className={`mt-2 ${typography.caption} font-medium underline text-warning-800 hover:text-warning-900`}
          >
            View {firstWarning.affected_ids.length} affected{' '}
            {firstWarning.affected_ids.length === 1 ? 'item' : 'items'}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-warning-100 transition-colors"
          aria-label="Dismiss warning"
        >
          <X className="w-4 h-4 text-warning-600" />
        </button>
      )}
    </div>
  )
}

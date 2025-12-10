/**
 * EmptyState - Reusable empty state component with actionable guidance
 *
 * Transforms passive "Nothing here" messages into helpful, action-oriented prompts.
 * Used throughout the canvas UI to guide users toward productive next steps.
 */

import type { ReactNode, ComponentType } from 'react'
import { typography } from '../../styles/typography'

interface EmptyStateProps {
  /** Icon component to display */
  icon: ComponentType<{ className?: string }>
  /** Main heading text */
  title: string
  /** Descriptive message */
  description: string
  /** Primary action button */
  action?: {
    label: string
    onClick: () => void
  }
  /** Secondary text or link */
  hint?: ReactNode
  /** Custom className for container */
  className?: string
  /** Test ID for the component */
  testId?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  hint,
  className = '',
  testId = 'empty-state',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 ${className}`}
      data-testid={testId}
    >
      {/* Icon */}
      <div className="mb-4">
        <Icon className="w-12 h-12 text-sand-400" aria-hidden="true" />
      </div>

      {/* Title */}
      <h3 className={`${typography.label} text-ink-900 mb-2`}>
        {title}
      </h3>

      {/* Description */}
      <p className={`${typography.body} text-ink-600 mb-4 max-w-sm`}>
        {description}
      </p>

      {/* Primary CTA */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`
            ${typography.button} px-4 py-2 rounded-lg
            bg-sky-500 text-white hover:bg-sky-600
            transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50
          `}
        >
          {action.label}
        </button>
      )}

      {/* Hint */}
      {hint && (
        <div className={`${typography.caption} text-ink-500 mt-3`}>
          {hint}
        </div>
      )}
    </div>
  )
}

export default EmptyState

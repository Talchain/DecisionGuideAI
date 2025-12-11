/**
 * ExpandableSection - Reusable accordion component
 *
 * Used within RecommendationCard for collapsible sections:
 * - Why this option (drivers)
 * - What you're trading off
 * - Assumptions to validate
 * - When to reconsider
 */

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { ExpandableSectionProps } from './types'

const badgeVariants = {
  default: 'bg-sand-100 text-sand-700',
  warning: 'bg-banana-100 text-banana-700',
  critical: 'bg-carrot-100 text-carrot-700',
}

export function ExpandableSection({
  title,
  badgeCount,
  badgeVariant = 'default',
  defaultExpanded = false,
  children,
  testId,
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div
      className="border-t border-sand-100 first:border-t-0"
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={testId ? `${testId}-content` : undefined}
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={`h-4 w-4 text-ink-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          />
          <span className={`${typography.bodySmall} font-medium text-ink-700`}>
            {title}
          </span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span
              className={`${typography.caption} px-1.5 py-0.5 rounded-full ${badgeVariants[badgeVariant]}`}
            >
              {badgeCount}
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div
          id={testId ? `${testId}-content` : undefined}
          className="px-4 pb-3 animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          {children}
        </div>
      )}
    </div>
  )
}

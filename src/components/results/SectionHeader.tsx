/**
 * SectionHeader Component
 *
 * Reusable section header for the v7 Results Panel 4-section layout.
 * Matches prototype's `.section-header` pattern: title + optional count badge.
 *
 * Typography: 14px/600, --text-header
 * Badge: 11px/600, white on --info, pill radius
 */

import { typography } from '../../styles/typography'

export interface SectionHeaderProps {
  /** Section title — sentence case */
  title: string
  /** Optional count badge (e.g., number of drivers) */
  count?: number
  /** Badge state for outlined badge styling; callers can refine based on item resolution state */
  badgeState?: 'resolved' | 'unresolved' | 'critical'
  /** Legacy alias for badgeState */
  countState?: 'complete' | 'warning' | 'critical'
  /** Test ID for testing */
  testId?: string
}

const badgeStateClasses = {
  resolved: 'border-success/30',
  unresolved: 'border-warning/30',
  critical: 'border-danger/30',
} as const

const legacyCountStateMap = {
  complete: 'resolved',
  warning: 'unresolved',
  critical: 'critical',
} as const

export function SectionHeader({ title, count, badgeState, countState, testId }: SectionHeaderProps) {
  const resolvedBadgeState = count != null && count > 0
    ? (badgeState ?? (countState ? legacyCountStateMap[countState] : 'unresolved'))
    : undefined

  return (
    <div
      className="flex items-center gap-2 mb-2.5"
      data-testid={testId}
    >
      <h3
        className={`${typography.panelHeader} text-text-header`}
      >
        {title}
      </h3>
      {count != null && count > 0 && (
        <span
          className={`
            inline-flex min-w-[22px] items-center justify-center rounded-full border
            bg-transparent px-1.5 py-0.5 leading-none text-text-body
            ${typography.panelMeta} ${resolvedBadgeState ? badgeStateClasses[resolvedBadgeState] : ''}
          `}
          aria-label={`${count} items`}
        >
          {count}
        </span>
      )}
    </div>
  )
}

export default SectionHeader

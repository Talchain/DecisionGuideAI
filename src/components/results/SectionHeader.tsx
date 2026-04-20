/**
 * SectionHeader Component
 *
 * Shared section header used by both the Results panel and the Pre-analysis
 * panel. Matches the unified design spec §2.1: title (panelHeader) + optional
 * count badge (panelMeta, outlined pill).
 *
 * Typography: 14px/600, --text-header
 * Badge: 11px regular, outlined pill, border colour by section type
 */

import { typography } from '../../styles/typography'

export interface SectionHeaderProps {
  /** Section title — sentence case */
  title: string
  /** Optional scope subtitle rendered below the title row in panelMeta/text-text-light */
  subtitle?: string
  /** Optional count badge (e.g., number of items) */
  count?: number
  /** Badge state for outlined badge styling; callers can refine based on item resolution state */
  badgeState?: 'resolved' | 'unresolved' | 'critical'
  /** Legacy alias for badgeState */
  countState?: 'complete' | 'warning' | 'critical'
  /**
   * Direct border-colour class for the badge pill, e.g. "border-info/30".
   * When provided, overrides the badgeState-derived class. Allows pre-analysis
   * sections to use their canonical tones (danger/info/factor) without mapping
   * through the post-analysis badgeState vocabulary.
   */
  borderClass?: string
  /**
   * Additional className applied to the root div. Defaults to "mb-2.5".
   * Pass "" when the parent uses space-y-* spacing to avoid double gaps.
   */
  className?: string
  /** Test ID for testing */
  testId?: string
  /** Optional entity shape icon before the title */
  icon?: 'option'
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

export function SectionHeader({
  title,
  subtitle,
  count,
  badgeState,
  countState,
  borderClass,
  className = 'mb-2.5',
  testId,
  icon,
}: SectionHeaderProps) {
  const resolvedBadgeState = count != null && count > 0 && !borderClass
    ? (badgeState ?? (countState ? legacyCountStateMap[countState] : 'unresolved'))
    : undefined

  const badgeBorderClass = borderClass
    ?? (resolvedBadgeState ? badgeStateClasses[resolvedBadgeState] : '')

  const titleRow = (
    <>
      {icon === 'option' && (
        <svg width={16} height={16} viewBox="0 0 14 14" className="flex-shrink-0">
          <rect x={1} y={1} width={12} height={12} rx={2} fill="var(--option)" stroke="var(--option)" strokeWidth={1.5} />
        </svg>
      )}
      <h3 className={`${typography.panelHeader} text-text-header`}>
        {title}
      </h3>
      {count != null && count > 0 && (
        <span
          className={`
            inline-flex min-w-[22px] items-center justify-center rounded-full border
            bg-transparent px-1.5 py-0.5 leading-none text-text-body
            ${typography.panelMeta} ${badgeBorderClass}
          `}
          aria-label={`${count} items`}
        >
          {count}
        </span>
      )}
    </>
  )

  if (subtitle) {
    return (
      <div className={className} data-testid={testId}>
        <div className="flex items-center gap-2">{titleRow}</div>
        <p className={`mt-0.5 ${typography.panelMeta} text-text-light`}>{subtitle}</p>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid={testId}>
      {titleRow}
    </div>
  )
}

export default SectionHeader

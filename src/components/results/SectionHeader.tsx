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
  /** Test ID for testing */
  testId?: string
}

export function SectionHeader({ title, count, testId }: SectionHeaderProps) {
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
          className={`${typography.panelMeta} text-text-on-color bg-info px-1.5 py-0.5 rounded-full leading-none`}
          aria-label={`${count} items`}
        >
          {count}
        </span>
      )}
    </div>
  )
}

export default SectionHeader

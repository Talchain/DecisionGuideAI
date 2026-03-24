/**
 * SubgroupDivider — Sentence-case divider with count badge for section subgroups.
 */

import { typography } from '@/styles/typography'

export function SubgroupDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className={`${typography.panelMeta} text-text-light whitespace-nowrap`}>{label}</span>
      <div className="flex-1 h-px bg-panel-border" />
    </div>
  )
}

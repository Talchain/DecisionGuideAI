/**
 * InlineSectionLabel — quiet sub-header for subordinate rows inside a PanelGroup.
 *
 * Use for "Set by options" / "Influences" style labels that sit between
 * ConnectionRow lists. No icon — that's SectionTitle's job, and SectionTitle
 * is reserved for group-level headers.
 */

import type { ReactNode } from 'react'
import { typography } from '../../../../styles/typography'

interface InlineSectionLabelProps {
  children: ReactNode
}

export function InlineSectionLabel({ children }: InlineSectionLabelProps) {
  return (
    <div className={`${typography.panelMeta} text-text-light mt-2 mb-1`}>
      {children}
    </div>
  )
}

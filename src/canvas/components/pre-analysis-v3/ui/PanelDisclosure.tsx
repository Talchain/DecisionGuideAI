/**
 * PanelDisclosure — quiet collapsed section for the v3 panel (the prototype's
 * `details.dd` rhythm): chevron + title on the left, meta on the right,
 * focus-visible ring only (no ring on mouse click), whitespace over chrome.
 */

import { memo, useId, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'

interface PanelDisclosureProps {
  title: string
  /** Right-aligned meta line (counts), panelMeta muted. */
  meta?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  testId?: string
}

export const PanelDisclosure = memo(function PanelDisclosure({
  title,
  meta,
  open,
  onOpenChange,
  children,
  testId,
}: PanelDisclosureProps) {
  const bodyId = useId()
  return (
    <div className="border-t border-panel-border" data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info/40"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span className={`${typography.panelHeader} text-text-header`}>{title}</span>
        {meta && (
          <span className={`${typography.panelMeta} ml-auto truncate text-text-light`}>{meta}</span>
        )}
      </button>
      <div id={bodyId} hidden={!open} className="px-4 pb-4 pt-1">
        {children}
      </div>
    </div>
  )
})

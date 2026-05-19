import { memo, useCallback } from 'react'
import { ChevronUp } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useFloatingPanelState } from '../hooks/useFloatingPanelState'
import { useStageAwarePlaceholder } from '../hooks/useStageAwarePlaceholder'
import { AIInputBar } from './AIInputBar'

interface PersistentInputStripProps {
  /** True when the docked Olumi tab is the active dock tab. When true and
   *  floating is closed, the strip is a normal composer (its content goes
   *  into the docked conversation). When false (Compare/Model/etc.) and
   *  floating is closed, clicking the strip opens the floating panel
   *  rather than sending. */
  isOlumiTabActive: boolean
  /** Called when the user clicks the chevron OR the strip in a way that
   *  should open the floating Olumi panel. */
  onOpenFloating: () => void
  /** Called when the user clicks the strip while floating is open. The host
   *  should focus the floating panel's textarea. */
  onFocusFloating?: () => void
  /** Click handler for the cog icon (Attach / Voice / Depth menu). */
  onCogClick: (anchorEl: HTMLElement) => void
}

/**
 * PersistentInputStrip — 52px footer pinned to the bottom of the right panel.
 * Outside the tab content area; always visible (sibling of the dock body).
 *
 * Modes:
 *  - composer (floating closed, Olumi tab active):   AIInputBar (sends to docked conversation).
 *  - redirect (floating closed, other tab active):   a button-shaped placeholder
 *                                                    (NOT AIInputBar) — clicking anywhere
 *                                                    opens the floating panel. Any visual
 *                                                    submit/cog affordances would mislead
 *                                                    on this surface, so the placeholder
 *                                                    only shows the stage-aware prompt copy
 *                                                    and a chevron hint.
 *  - status (floating open):                         fixed "Olumi is open · Focus →" line —
 *                                                    clicking focuses the floating textarea.
 *
 * Invariant: when floating is open, the strip MUST NOT render a textarea —
 * preserves the "no duplicate composer" rule.
 */
export const PersistentInputStrip = memo(function PersistentInputStrip({
  isOlumiTabActive,
  onOpenFloating,
  onFocusFloating,
  onCogClick,
}: PersistentInputStripProps) {
  const floatingIsOpen = useFloatingPanelState((s) => s.isOpen)
  const placeholder = useStageAwarePlaceholder()

  const handleFocus = useCallback(() => {
    onFocusFloating?.()
  }, [onFocusFloating])

  // Status mode — floating panel is open. No textarea is rendered so the
  // "no duplicate composer" invariant holds. Fixed copy ("Olumi is open ·
  // Focus") replaces the previous truncated last-message preview: that
  // preview was noisy, broke at 50 chars mid-sentence, and read as
  // disabled chrome rather than a clickable affordance. Clicking anywhere
  // focuses the floating panel via the registered focus channel.
  if (floatingIsOpen) {
    return (
      <button
        type="button"
        onClick={handleFocus}
        className="w-full flex items-center justify-between gap-2 px-3 py-3 border-t border-panel-border bg-panel hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        data-testid="persistent-strip-status"
        aria-label="Focus floating Olumi panel"
      >
        <span className={typo('panelMeta', 'text-text-body text-left')}>Olumi is open</span>
        <span className={typo('panelMeta', 'text-info font-medium flex-shrink-0')}>Focus →</span>
      </button>
    )
  }

  // Redirect mode — non-Olumi tab AND floating closed. The whole surface is
  // a button that opens the floating panel. Per review, decoration that
  // implies submit / cog functionality is misleading on this surface —
  // those affordances live in the floating composer that opens on click.
  // Only the chevron (expand affordance) is kept as a visual hint.
  if (!isOlumiTabActive) {
    return (
      <button
        type="button"
        onClick={onOpenFloating}
        className="w-full flex items-center gap-1 px-2 py-2 border-t border-panel-border bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-info text-left"
        data-testid="persistent-strip-composer-redirect"
        aria-label={`Open Olumi: ${placeholder}`}
      >
        <span className="flex-1 bg-panel border border-panel-border rounded-lg py-2 px-3 hover:bg-panel-hover">
          <span className={typo('panelBody', 'text-text-light truncate block')}>{placeholder}</span>
        </span>
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-light flex-shrink-0"
          aria-hidden="true"
        >
          <ChevronUp className="w-4 h-4" />
        </span>
      </button>
    )
  }

  // Composer mode — Olumi tab active AND floating closed. The full
  // AIInputBar with a real textarea; Enter submits to the docked
  // conversation.
  return (
    <div className="border-t border-panel-border bg-panel" data-testid="persistent-strip-composer">
      <AIInputBar
        variant="strip"
        onCogClick={onCogClick}
        onChevronClick={onOpenFloating}
      />
    </div>
  )
})

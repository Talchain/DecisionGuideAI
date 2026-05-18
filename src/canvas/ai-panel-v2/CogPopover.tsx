import { memo, useCallback, useEffect, useRef } from 'react'
import { Brain, Mic, Paperclip } from 'lucide-react'
import { typography } from '../../styles/typography'

interface CogPopoverProps {
  open: boolean
  // Anchor element — used so outside-click can distinguish "inside cog
  // button" (which the parent already handles) from a real outside event.
  anchorRef: React.RefObject<HTMLElement>
  onClose: () => void
  onAttach: () => void
}

// Cog popover dismissal contract:
//   • outside click closes (capture-phase pointerdown — so mode/header
//     buttons that stopPropagation on bubble pointerdown still dismiss)
//   • Escape closes (only when popover is open — does NOT hijack Escape
//     elsewhere)
//   • selecting an enabled item closes and runs the action
//   • focus returns to the cog button after close (parent handles by
//     re-focusing the cog ref on close)
//
// Menu items (Batch 2):
//   1. Attach evidence       — functional (Paperclip)
//   2. Voice mode            — disabled (Mic). Badge "Coming soon".
//   3. Decision depth        — disabled (Brain). Badge "Coming soon".
//      Replaces any raw model selector for pilot users. When enabled
//      (future) it will surface Quick / Standard / Deep / Expert tiers
//      reflecting decision complexity, not raw model names.
//
// The dev-only model selector is intentionally NOT rendered here; if it
// returns it needs a flag-gated dev-mode branch outside this surface.

interface MenuItemProps {
  icon: typeof Paperclip
  label: string
  onClick?: () => void
  comingSoon?: boolean
  testId: string
}

function MenuItem({ icon: Icon, label, onClick, comingSoon = false, testId }: MenuItemProps) {
  const disabled = comingSoon || !onClick
  return (
    <button
      type="button"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      disabled={disabled}
      className={`flex items-center gap-2 w-full px-3 py-2 ${typography.panelBody} text-text-body ${
        disabled
          ? 'opacity-60 cursor-default'
          : 'hover:bg-panel-hover focus:outline-none focus-visible:bg-panel-hover'
      }`}
      data-testid={testId}
    >
      <Icon className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />
      <span className="flex-1 text-left">{label}</span>
      {comingSoon && (
        <span
          className={`${typography.panelMeta} text-text-light border border-default rounded-full px-1.5 py-0.5`}
          aria-label="Coming soon"
        >
          Coming soon
        </span>
      )}
    </button>
  )
}

export const CogPopover = memo(function CogPopover({
  open,
  anchorRef,
  onClose,
  onAttach,
}: CogPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    // Capture-phase pointerdown so mode-control buttons that call
    // event.stopPropagation() on their own pointerdown still trigger
    // the outside-click handler.
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Stop propagation so the document-level Escape priority chain
      // (Focus overlay → inspector → deselect) does not also fire on
      // the same keystroke.
      event.stopPropagation()
      onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true } as AddEventListenerOptions)
      document.removeEventListener('keydown', handleKeyDown, { capture: true } as AddEventListenerOptions)
    }
  }, [open, onClose, anchorRef])

  const handleAttachClick = useCallback(() => {
    onAttach()
    onClose()
  }, [onAttach, onClose])

  if (!open) return null

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label="Input options"
      data-testid="ai-panel-v2-cog-popover"
      className="absolute right-0 bottom-full mb-2 min-w-[200px] bg-panel border border-default rounded-lg shadow-2 py-1"
    >
      <MenuItem
        icon={Paperclip}
        label="Attach evidence"
        onClick={handleAttachClick}
        testId="ai-panel-v2-cog-attach"
      />
      <MenuItem
        icon={Mic}
        label="Voice mode"
        comingSoon
        testId="ai-panel-v2-cog-voice"
      />
      <MenuItem
        icon={Brain}
        label="Decision depth"
        comingSoon
        testId="ai-panel-v2-cog-depth"
      />
    </div>
  )
})

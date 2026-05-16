import { memo, useCallback, useEffect, useRef } from 'react'
import { Paperclip } from 'lucide-react'
import { typography } from '../../styles/typography'

interface CogPopoverProps {
  open: boolean
  // Anchor element — used so outside-click can distinguish "inside cog
  // button" (which the parent already handles) from a real outside event.
  anchorRef: React.RefObject<HTMLElement>
  onClose: () => void
  onAttach: () => void
}

// Cog popover dismissal contract (per correction #7):
//   • outside click closes
//   • Escape closes (only when popover is open — does NOT hijack Escape elsewhere)
//   • selecting an item closes and runs the action
//   • focus returns to the cog button after close (parent handles by re-focusing
//     the cog ref on close)
//   • does NOT close on focus loss while the user is composing in the input
//     (textarea sibling); we only listen to mousedown / Escape, never to
//     `blur` on the popover itself.

export const CogPopover = memo(function CogPopover({
  open,
  anchorRef,
  onClose,
  onAttach,
}: CogPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Stop propagation so the document-level Escape priority chain
      // (Focus overlay → inspector → deselect — step 13) does not also
      // fire on the same keystroke.
      event.stopPropagation()
      onClose()
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
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
      className="absolute right-0 bottom-full mb-2 min-w-[160px] bg-panel border border-panel-border rounded-lg shadow-2 py-1"
      // Sits above the input bar, anchored to the cog's bottom-right
    >
      <button
        type="button"
        role="menuitem"
        onClick={handleAttachClick}
        className={`flex items-center gap-2 w-full px-3 py-1.5 ${typography.panelBody} text-text-body hover:bg-panel-hover focus:outline-none focus-visible:bg-panel-hover`}
        data-testid="ai-panel-v2-cog-attach"
      >
        <Paperclip className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />
        <span>Attach evidence</span>
      </button>
    </div>
  )
})

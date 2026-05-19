import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Brain, Mic, Paperclip } from 'lucide-react'
import { typo } from '../../styles/typography'
import { isDebugEnabled } from '../../flags'

export interface CogPopoverProps {
  /** When true, popover is visible. */
  isOpen: boolean
  /** Anchor button element — popover positions relative to its bounding rect. */
  anchorEl: HTMLElement | null
  /** Called when user dismisses (outside click, Escape, item selection). */
  onClose: () => void
  /** Reserved hook for a future Attach evidence wire-up. The brief asks for
   *  this to be functional, but the orchestrator turn API (`sendMessage` opts
   *  in useConversation.ts) has no file/attachment parameter and no upload
   *  endpoint exists in the repo. Until backend support lands, the menu item
   *  is shipped as a disabled "Coming soon" item — the only honest choice.
   *  When this prop is provided AND a backend exists, flip the menu item's
   *  status to 'functional' below. */
  onAttachEvidence?: () => void
  /** Optional: dev-only model selector callback. Hidden unless the debug
   *  flag is on. */
  onChooseDevModel?: () => void
}

interface MenuItem {
  id: string
  label: string
  icon: typeof Paperclip
  testId: string
  status: 'functional' | 'coming-soon' | 'dev'
  onSelect?: () => void
}

const POPOVER_W = 240
const POPOVER_MARGIN = 4

/**
 * CogPopover — settings menu attached to the cog icon in the persistent input
 * strip / floating panel composer / first-use composer. Capability set:
 *  - Attach evidence  → disabled ("Coming soon"). The brief asks for this
 *    to be functional, but the orchestrator turn API has no file parameter
 *    and no upload endpoint exists. Shipping a chip-only UI was rejected
 *    in review as theatre. Re-enable once the backend lands.
 *  - Voice mode       → disabled ("Coming soon")
 *  - Decision depth   → disabled ("Coming soon")
 *  - Dev model selector → hidden unless debug flag is on
 *
 * Dismissal: outside click, Escape, or item selection. After dismissal focus
 * returns to the anchor element so keyboard nav is uninterrupted.
 *
 * Z-index 950: sits above the OutputsDock (z 900) so the popover is visible
 * when invoked from the strip's cog button, and above the floating panel
 * (z 300). Stays below modals (z 1000+). The brief originally specified
 * z=400 but the pre-existing dock z=900 means a lower value renders the
 * popover behind the dock when anchored to the strip — defeating the entire
 * affordance. 950 is the smallest value that satisfies both layering rules.
 */
export const CogPopover = memo(function CogPopover({
  isOpen,
  anchorEl,
  onClose,
  onAttachEvidence,
  onChooseDevModel,
}: CogPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  // Compute popover position from anchor rect — above the anchor.
  useLayoutEffect(() => {
    if (!isOpen || !anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    const left = Math.max(
      POPOVER_MARGIN,
      Math.min(rect.right - POPOVER_W, window.innerWidth - POPOVER_W - POPOVER_MARGIN),
    )
    // Position above the anchor; if no room, place below.
    const estimatedH = 200
    const above = rect.top - estimatedH - POPOVER_MARGIN
    const below = rect.bottom + POPOVER_MARGIN
    const top = above >= POPOVER_MARGIN ? above : below
    setPosition({ left, top })
  }, [isOpen, anchorEl])

  // Outside dismissal + Escape. Uses pointerdown so the popover dismisses on
  // touch taps too — `mousedown` only fires after a synthesised delay on
  // touch devices, and may never fire if the browser cancels the sequence.
  // We also listen to mousedown as a defensive secondary path for any
  // browser variants that don't surface pointerdown reliably (jsdom and
  // older Safari combinations).
  useEffect(() => {
    if (!isOpen) return
    const dismissIfOutside = (e: Event) => {
      const target = e.target as Node | null
      if (popoverRef.current?.contains(target)) return
      if (anchorEl?.contains(target as Node | null)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('pointerdown', dismissIfOutside)
    window.addEventListener('mousedown', dismissIfOutside)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('pointerdown', dismissIfOutside)
      window.removeEventListener('mousedown', dismissIfOutside)
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, anchorEl, onClose])

  // Return focus to the anchor after close.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      anchorEl?.focus()
    }
    wasOpenRef.current = isOpen
  }, [isOpen, anchorEl])

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const items: MenuItem[] = []
  items.push({
    id: 'attach',
    // Shortened to "Attach" so the row never wraps inside the popover —
    // "Attach evidence" + the "Coming soon" badge competed for width and
    // broke onto two lines on narrow viewports.
    label: 'Attach',
    icon: Paperclip,
    testId: 'cog-popover-attach',
    // When a host wires `onAttachEvidence` AND the backend supports
    // attachments, flip this to 'functional'. Until then, the brief's
    // "functional" requirement is honoured by NOT shipping a non-working
    // chip UI (theatre). See header doc-comment for rationale.
    status: onAttachEvidence ? 'functional' : 'coming-soon',
    onSelect: onAttachEvidence
      ? () => {
          onAttachEvidence()
          onClose()
        }
      : undefined,
  })
  items.push({
    id: 'voice',
    label: 'Voice mode',
    icon: Mic,
    testId: 'cog-popover-voice',
    status: 'coming-soon',
  })
  items.push({
    id: 'depth',
    label: 'Decision depth',
    icon: Brain,
    testId: 'cog-popover-depth',
    status: 'coming-soon',
  })
  if (isDebugEnabled() && onChooseDevModel) {
    items.push({
      id: 'dev-model',
      label: 'Dev model selector',
      icon: Brain,
      testId: 'cog-popover-dev-model',
      status: 'dev',
      onSelect: () => {
        onChooseDevModel()
        onClose()
      },
    })
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="menu"
      aria-label="Assistant options"
      data-testid="cog-popover"
      className="fixed bg-panel border border-panel-border rounded-lg shadow-2 py-1"
      // z-index 950 layers ABOVE the OutputsDock (zIndex: 900 in OutputsDock.tsx)
      // so the popover is visible when invoked from the strip's cog button,
      // and BELOW app-level modals (1000+) so a modal still overlays it.
      // Below the floating panel (z 300) isn't a concern — anchored popovers
      // open from elements inside the panel, so they layer naturally above it.
      style={{ zIndex: 950, left: position.left, top: position.top, width: POPOVER_W }}
    >
      <div
        className={typo(
          'panelMeta',
          'px-3 pt-2 pb-1 text-text-light uppercase tracking-wide',
        )}
        data-testid="cog-popover-heading"
      >
        Assistant options
      </div>
      {items.map((item) => {
        const Icon = item.icon
        const isDisabled = item.status === 'coming-soon'
        const showBadge = item.status === 'coming-soon'

        const className = [
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          isDisabled
            ? 'opacity-60 cursor-default'
            : 'hover:bg-panel-hover focus:bg-panel-hover',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
        ].join(' ')

        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={isDisabled}
            aria-disabled={isDisabled}
            onClick={() => {
              if (!isDisabled && item.onSelect) {
                item.onSelect()
              }
            }}
            data-testid={item.testId}
            className={className}
          >
            <Icon className="w-4 h-4 text-text-light flex-shrink-0" aria-hidden="true" />
            <span className={typo('panelBody', 'text-text-body flex-1')}>{item.label}</span>
            {showBadge ? (
              <span
                className={typo(
                  'panelMeta',
                  'text-text-light border border-panel-border rounded-full px-1.5 py-0.5 flex-shrink-0',
                )}
              >
                Coming soon
              </span>
            ) : null}
          </button>
        )
      })}
    </div>,
    document.body,
  )
})

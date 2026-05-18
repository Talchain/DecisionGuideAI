import { memo, useCallback } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { ExternalLink, Minus } from 'lucide-react'
import { ARROW_KEY_RESIZE_PX, AI_HEADER_STRIP_HEIGHT } from './constants'

// 28px header bar at the top of the AI zone (States 2, 3, 5).
// Replaces the old PullTab. Owns:
//   • Left: minimise icon (Lucide `Minus`)
//   • Right: float icon (Lucide `ExternalLink`)
//   • Background acts as the vertical resize drag handle (cursor
//     ns-resize). Icon hit-areas suppress the drag via
//     pointerdown.stopPropagation().
//
// In State 5 (floating) we still render this strip so the user can
// trigger minimise from the floating panel (and the strip swaps the
// float icon for a "Dock" icon — but the floating panel uses its own
// header instead; see FloatingPanel.tsx). This component is for the
// DOCKED chrome only.
//
// Arrow Up/Down on the strip resize ±ARROW_KEY_RESIZE_PX via
// onAdjustByPx callback. Tab order: minimise → drag separator → float.

interface AIHeaderStripProps {
  onStartDrag: (event: PointerEvent) => void
  onAdjustByPx: (deltaPx: number) => void
  onMinimise: () => void
  onFloat: () => void
}

export const AIHeaderStrip = memo(function AIHeaderStrip({
  onStartDrag,
  onAdjustByPx,
  onMinimise,
  onFloat,
}: AIHeaderStripProps) {
  const handleDragKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        onAdjustByPx(-ARROW_KEY_RESIZE_PX)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        onAdjustByPx(ARROW_KEY_RESIZE_PX)
      }
    },
    [onAdjustByPx],
  )

  // Icon click handlers stop pointerdown propagation so the underlying
  // drag-separator pointerdown listener doesn't start a drag when the
  // user is just clicking an icon.
  const stopDrag = useCallback((e: PointerEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      data-testid="ai-panel-v2-header-strip"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize AI panel"
      tabIndex={0}
      onPointerDown={onStartDrag}
      onKeyDown={handleDragKeyDown}
      className="relative flex items-center justify-between flex-shrink-0 px-1.5 cursor-ns-resize border-b border-default bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      style={{ height: AI_HEADER_STRIP_HEIGHT }}
    >
      <button
        type="button"
        onClick={onMinimise}
        onPointerDown={stopDrag}
        aria-label="Minimise assistant"
        title="Minimise assistant"
        data-testid="ai-panel-v2-minimise"
        className="inline-flex items-center justify-center w-8 h-8 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onFloat}
        onPointerDown={stopDrag}
        aria-label="Undock assistant"
        title="Undock assistant"
        data-testid="ai-panel-v2-float"
        className="inline-flex items-center justify-center w-8 h-8 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  )
})

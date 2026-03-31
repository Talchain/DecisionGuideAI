/**
 * NodePopover — portal-rendered card below a canvas node.
 * Contains Layer 2 content (bars, ConnRows, bias notes).
 * Renders via createPortal to escape ReactFlow's stacking context,
 * ensuring popovers always appear above adjacent nodes.
 * Tracks anchor position via rAF to stay aligned during pan/zoom.
 */
import { useRef, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface NodePopoverProps {
  visible: boolean
  width?: number
  children: ReactNode
  onMouseEnter: () => void
  onMouseLeave: () => void
  /** Ref to the anchor element (node wrapper) for positioning */
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function NodePopover({ visible, width, children, onMouseEnter, onMouseLeave, anchorRef }: NodePopoverProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Track anchor position continuously while visible (handles pan/zoom)
  useEffect(() => {
    if (!visible || !anchorRef?.current) {
      setPos(null)
      return
    }

    let rafId: number
    const track = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setPos(prev => {
        if (prev && Math.abs(prev.top - (rect.bottom + 4)) < 0.5 && Math.abs(prev.left - rect.left) < 0.5) {
          return prev // avoid re-render if position unchanged
        }
        return { top: rect.bottom + 4, left: rect.left }
      })
      rafId = requestAnimationFrame(track)
    }
    track()

    return () => cancelAnimationFrame(rafId)
  }, [visible, anchorRef])

  if (!visible) return null

  // Fallback: if no anchorRef, render inline (backward compat)
  if (!anchorRef) {
    return (
      <div
        className="absolute left-0 z-[9999] bg-panel border border-panel-border rounded-lg shadow-2 nodrag nopan nowheel"
        style={{ top: '100%', marginTop: 4, width: width ?? 280, maxHeight: 250, overflowY: 'auto', padding: '8px 10px' }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    )
  }

  if (!pos) return null

  return createPortal(
    <div
      className="fixed z-[9999] bg-panel border border-panel-border rounded-lg shadow-2 nodrag nopan nowheel"
      style={{ top: pos.top, left: pos.left, width: width ?? 280, maxHeight: 250, overflowY: 'auto', padding: '8px 10px' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body
  )
}

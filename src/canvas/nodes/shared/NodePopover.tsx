/**
 * NodePopover — portal-rendered card below a canvas node.
 * Contains Layer 2 content (bars, ConnRows, bias notes).
 * Renders via createPortal to escape ReactFlow's stacking context,
 * ensuring popovers always appear above adjacent nodes.
 */
import { useRef, useLayoutEffect, useState, type ReactNode } from 'react'
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
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!visible || !anchorRef?.current) {
      setPos(null)
      return
    }
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
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
      ref={popoverRef}
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

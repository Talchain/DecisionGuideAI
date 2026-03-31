/**
 * NodePopover — absolutely-positioned card below a canvas node.
 * Contains Layer 2 content (bars, ConnRows, bias notes).
 * Only renders when visible=true.
 */
import type { ReactNode } from 'react'

interface NodePopoverProps {
  visible: boolean
  width?: number
  children: ReactNode
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function NodePopover({ visible, width, children, onMouseEnter, onMouseLeave }: NodePopoverProps) {
  if (!visible) return null

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

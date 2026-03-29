/**
 * ExpertOverlay — collapsible panel below node content showing numeric parameters.
 * Only renders when viewMode === 'expert'. Info-tinted background.
 */
import { type ReactNode, Children } from 'react'
import { useCanvasStore } from '../../store'

interface ExpertOverlayProps {
  children: ReactNode
}

export function ExpertOverlay({ children }: ExpertOverlayProps) {
  const viewMode = useCanvasStore(s => s.viewMode)
  if (viewMode !== 'expert') return null

  // Prevent rendering an empty container when all children are conditionally null
  const hasContent = Children.toArray(children).length > 0
  if (!hasContent) return null

  return (
    <div className="bg-info/[0.08] border border-info/20 rounded-lg mt-1.5" style={{ padding: '6px 8px' }}>
      {children}
    </div>
  )
}

/**
 * RationaleTooltip — Shows per-node LLM reasoning on hover.
 *
 * Reads from the canvas store's nodeRationales map. Renders as a no-op
 * wrapper when no rationale exists for the given node.
 *
 * Typography: bodySmall (14px) for canvas context per Design System v5 §2.2.
 * Visual: bg-panel, border-panel-border, shadow-2, rounded-lg, max-w 280px.
 */

import { useState, cloneElement, useId, useEffect, type ReactElement, type MouseEvent, type FocusEvent } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'

interface RationaleTooltipProps {
  nodeId: string
  children: ReactElement
}

export function RationaleTooltip({ nodeId, children }: RationaleTooltipProps) {
  const rationale = useCanvasStore((s) => s.nodeRationales?.[nodeId])
  const [show, setShow] = useState(false)
  const tooltipId = useId()

  // Dismiss on Escape (WCAG 1.4.13)
  useEffect(() => {
    if (!show) return
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [show])

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => setShow(false), 5000)
    return () => clearTimeout(timer)
  }, [show])

  if (!rationale) return children

  const originalOnMouseEnter = children.props.onMouseEnter
  const originalOnMouseLeave = children.props.onMouseLeave
  const originalOnFocus = children.props.onFocus
  const originalOnBlur = children.props.onBlur

  const enhancedChild = cloneElement(children, {
    onMouseEnter: (e: MouseEvent) => { setShow(true); originalOnMouseEnter?.(e) },
    onMouseLeave: (e: MouseEvent) => { setShow(false); originalOnMouseLeave?.(e) },
    onFocus: (e: FocusEvent) => { setShow(true); originalOnFocus?.(e) },
    onBlur: (e: FocusEvent) => { setShow(false); originalOnBlur?.(e) },
    'aria-describedby': show ? tooltipId : undefined,
    tabIndex: children.props.tabIndex ?? 0,
  })

  return (
    <div className="relative inline-block">
      {enhancedChild}
      {show && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-[9000] px-3 py-2 ${typography.bodySmall} text-text-body bg-panel border border-panel-border shadow-2 rounded-lg pointer-events-none`}
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            maxWidth: '280px',
            whiteSpace: 'normal',
          }}
        >
          {rationale}
        </div>
      )}
    </div>
  )
}

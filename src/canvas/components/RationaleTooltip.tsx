/**
 * RationaleTooltip — Shows per-node LLM reasoning on hover.
 *
 * Reads from the canvas store's nodeRationales map. Renders children
 * directly (no wrapper, no extra DOM, no aria changes) when no rationale
 * exists for the node — so unattached nodes pay zero overhead.
 *
 * When a rationale exists, wraps the existing Tooltip component with
 * maxWidth=280 so it word-wraps with bodySmall typography. All hover,
 * focus, Escape-dismiss, and aria-describedby behaviour is inherited
 * from Tooltip.
 */

import { type ReactElement } from 'react'
import { useCanvasStore } from '../store'
import { Tooltip } from './Tooltip'

interface RationaleTooltipProps {
  nodeId: string
  children: ReactElement
}

export function RationaleTooltip({ nodeId, children }: RationaleTooltipProps) {
  const rationale = useCanvasStore((s) => s.nodeRationales?.[nodeId])

  if (!rationale) return children

  return (
    <Tooltip content={rationale} maxWidth={280}>
      {children}
    </Tooltip>
  )
}

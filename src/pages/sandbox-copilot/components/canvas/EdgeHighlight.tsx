/**
 * Edge Highlight Component
 *
 * Adds visual emphasis to important edges:
 * - Thickness based on importance (contribution)
 * - Color based on evidence quantity
 * - Glow effect for top drivers
 *
 * Rendered as an SVG overlay on top of the existing edge.
 */

import { useReactFlow } from '@xyflow/react'

export interface EdgeHighlightProps {
  edgeId: string
  importance: number // 0-1, where 1 is most important
  evidenceCount: number
}

export function EdgeHighlight({ edgeId, importance, evidenceCount }: EdgeHighlightProps): JSX.Element | null {
  const { getEdge, getNode } = useReactFlow()
  const edge = getEdge(edgeId)

  if (!edge) return null

  const sourceNode = getNode(edge.source)
  const targetNode = getNode(edge.target)

  if (!sourceNode || !targetNode) return null

  // Calculate edge path (simple straight line for now)
  const x1 = (sourceNode.position?.x || 0) + (sourceNode.width || 180) / 2
  const y1 = (sourceNode.position?.y || 0) + (sourceNode.height || 60) / 2
  const x2 = (targetNode.position?.x || 0) + (targetNode.width || 180) / 2
  const y2 = (targetNode.position?.y || 0) + (targetNode.height || 60) / 2

  // Calculate stroke width based on importance (2-8px)
  const strokeWidth = 2 + importance * 6

  // Calculate color based on evidence
  const getColor = (): string => {
    if (evidenceCount >= 5) return '#10b981' // green-500 - high evidence
    if (evidenceCount >= 2) return '#f59e0b' // amber-500 - medium evidence
    if (evidenceCount >= 1) return '#3b82f6' // blue-500 - some evidence
    return '#94a3b8' // slate-400 - no evidence
  }

  // Only render for significant importance
  if (importance < 0.1) return null

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-0"
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={getColor()}
        strokeWidth={strokeWidth}
        strokeOpacity={0.3}
        strokeLinecap="round"
      />
      {/* Glow effect for very important edges */}
      {importance > 0.5 && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={getColor()}
          strokeWidth={strokeWidth + 4}
          strokeOpacity={0.1}
          strokeLinecap="round"
          filter="blur(4px)"
        />
      )}
    </svg>
  )
}

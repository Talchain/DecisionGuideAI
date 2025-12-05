/**
 * Ghost Edge Component
 *
 * AI-suggested connection with Tab-to-accept workflow.
 * Visual features:
 * - Dashed grey appearance (60% opacity)
 * - Hint appears after 500ms
 * - Tab key accepts suggestion
 * - Esc key dismisses
 */

import { useState, useEffect } from 'react'
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'

interface GhostEdgeData {
  reasoning: string
  onAccept: () => void
  onDismiss: () => void
}

export interface GhostEdgeProps extends EdgeProps {
  data: GhostEdgeData
}

/**
 * Ghost edge - AI-suggested connection with Tab-to-accept workflow
 * Appears on node hover, dashed grey style, 500ms hint delay
 */
export function GhostEdge({ id, data, ...props }: GhostEdgeProps) {
  const [showHint, setShowHint] = useState(false)
  const [edgePath] = getBezierPath(props)

  const { reasoning, onAccept, onDismiss } = data

  // Show hint after 500ms
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), 500)
    return () => clearTimeout(timer)
  }, [])

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        onAccept()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAccept, onDismiss])

  // Position hint in middle of edge
  const labelX = (props.sourceX + props.targetX) / 2
  const labelY = (props.sourceY + props.targetY) / 2

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#A0AEC0',
          strokeWidth: 2,
          strokeDasharray: '5,5',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
        {...props}
      />

      {showHint && (
        <foreignObject
          width={240}
          height={80}
          x={labelX - 120}
          y={labelY - 40}
          className="overflow-visible pointer-events-none"
        >
          <div
            className="
            bg-white rounded-lg shadow-lg border border-analytical-300
            px-3 py-2 text-xs text-center font-sans
            animate-fade-in
          "
          >
            <div className="text-storm-700 mb-1.5 leading-tight">{reasoning}</div>
            <div className="flex items-center justify-center gap-2 text-analytical-600 font-medium">
              <kbd className="px-2 py-1 bg-storm-100 rounded text-xs shadow-sm">Tab</kbd>
              <span className="text-storm-500">to accept</span>
              <span className="text-storm-300">·</span>
              <kbd className="px-2 py-1 bg-storm-100 rounded text-xs shadow-sm">Esc</kbd>
              <span className="text-storm-500">to dismiss</span>
            </div>
          </div>
        </foreignObject>
      )}
    </>
  )
}

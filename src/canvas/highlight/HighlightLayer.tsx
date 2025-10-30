/**
 * HighlightLayer - Ephemeral visual overlays for driver nodes/edges
 *
 * Renders non-mutating highlights over canvas elements when Results panel shows drivers.
 * Uses React Flow's useReactFlow to get node/edge positions.
 */

import { useMemo } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { useCanvasStore, selectDrivers, selectResultsStatus } from '../store'

interface HighlightLayerProps {
  isResultsOpen: boolean
}

export function HighlightLayer({ isResultsOpen }: HighlightLayerProps): JSX.Element | null {
  const drivers = useCanvasStore(selectDrivers)
  const status = useCanvasStore(selectResultsStatus)
  const highlightedDriver = useCanvasStore(s => s.highlightedDriver)
  const { getNode, getEdge } = useReactFlow()

  // Only show highlights when Results is open, complete, and has drivers
  const shouldHighlight = isResultsOpen && status === 'complete' && drivers && drivers.length > 0

  // Get all nodes/edges from React Flow (for positions)
  const nodes = useStore(state => state.nodes)
  const edges = useStore(state => state.edges)

  // Memoize expensive node/edge lookups (performance optimization per code review)
  const targetElement = useMemo(() => {
    if (!highlightedDriver) return null

    if (highlightedDriver.kind === 'node') {
      const node = getNode(highlightedDriver.id)
      if (!node) return null
      return { type: 'node' as const, element: node }
    }

    const edge = getEdge(highlightedDriver.id)
    if (!edge) return null
    return { type: 'edge' as const, element: edge }
  }, [highlightedDriver, getNode, getEdge])

  if (!shouldHighlight || !targetElement) {
    return null
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ mixBlendMode: 'multiply' }}
    >
      {targetElement.type === 'node' && (
        <div
          key={highlightedDriver.id}
          className="absolute pointer-events-none transition-all duration-300"
          style={{
            left: targetElement.element.position.x,
            top: targetElement.element.position.y,
            width: targetElement.element.width || 200,
            height: targetElement.element.height || 80,
            border: '3px solid var(--olumi-primary)',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(91, 108, 255, 0.6)',
            backgroundColor: 'rgba(91, 108, 255, 0.15)'
          }}
        />
      )}

      {targetElement.type === 'edge' && (() => {
        const sourceNode = getNode(targetElement.element.source)
        const targetNode = getNode(targetElement.element.target)
        if (!sourceNode || !targetNode) return null

        const sx = sourceNode.position.x + (sourceNode.width || 200) / 2
        const sy = sourceNode.position.y + (sourceNode.height || 80) / 2
        const tx = targetNode.position.x + (targetNode.width || 200) / 2
        const ty = targetNode.position.y + (targetNode.height || 80) / 2

        return (
          <svg
            key={highlightedDriver.id}
            className="absolute inset-0 pointer-events-none"
            style={{ overflow: 'visible' }}
          >
            <line
              x1={sx}
              y1={sy}
              x2={tx}
              y2={ty}
              stroke="var(--olumi-primary)"
              strokeWidth={4}
              strokeDasharray="0"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(91, 108, 255, 0.8))'
              }}
            />
          </svg>
        )
      })()}
    </div>
  )
}

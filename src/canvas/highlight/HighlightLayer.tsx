/**
 * HighlightLayer - Ephemeral visual overlays for driver nodes/edges
 *
 * Renders non-mutating highlights over canvas elements when Results panel shows drivers.
 * Uses React Flow's useReactFlow to get node/edge positions.
 */

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

  if (!shouldHighlight) {
    return null
  }

  // Show subtle highlight for all drivers, brighter for hovered one
  if (!highlightedDriver) {
    return null
  }

  // Only render highlight for the hovered driver
  const driver = highlightedDriver
  const isNode = driver.kind === 'node'
  const node = isNode ? getNode(driver.id) : null
  const edge = !isNode ? getEdge(driver.id) : null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ mixBlendMode: 'multiply' }}
    >
      {isNode && node && (
        <div
          key={driver.id}
          className="absolute pointer-events-none transition-all duration-300"
          style={{
            left: node.position.x,
            top: node.position.y,
            width: node.width || 200,
            height: node.height || 80,
            border: '3px solid var(--olumi-primary)',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(91, 108, 255, 0.6)',
            backgroundColor: 'rgba(91, 108, 255, 0.15)'
          }}
        />
      )}

      {!isNode && edge && (() => {
        const sourceNode = getNode(edge.source)
        const targetNode = getNode(edge.target)
        if (!sourceNode || !targetNode) return null

        const sx = sourceNode.position.x + (sourceNode.width || 200) / 2
        const sy = sourceNode.position.y + (sourceNode.height || 80) / 2
        const tx = targetNode.position.x + (targetNode.width || 200) / 2
        const ty = targetNode.position.y + (targetNode.height || 80) / 2

        return (
          <svg
            key={driver.id}
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

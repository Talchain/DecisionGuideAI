/**
 * HighlightLayer - Ephemeral visual overlays for driver nodes/edges
 *
 * Renders non-mutating highlights over canvas elements when Results panel shows drivers.
 * Uses React Flow's useReactFlow to get node/edge positions.
 */

import { useEffect, useState } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { useCanvasStore, selectDrivers, selectResultsStatus } from '../store'

interface HighlightLayerProps {
  isResultsOpen: boolean
}

export function HighlightLayer({ isResultsOpen }: HighlightLayerProps): JSX.Element | null {
  const drivers = useCanvasStore(selectDrivers)
  const status = useCanvasStore(selectResultsStatus)
  const { getNode, getEdge } = useReactFlow()

  // Only show highlights when Results is open, complete, and has drivers
  const shouldHighlight = isResultsOpen && status === 'complete' && drivers && drivers.length > 0

  // Get all nodes/edges from React Flow (for positions)
  const nodes = useStore(state => state.nodes)
  const edges = useStore(state => state.edges)

  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null)

  useEffect(() => {
    // Clear highlights when panel closes
    if (!isResultsOpen) {
      setHoveredDriverId(null)
    }
  }, [isResultsOpen])

  if (!shouldHighlight) {
    return null
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ mixBlendMode: 'multiply' }}
    >
      {drivers.map(driver => {
        const isHovered = hoveredDriverId === driver.id

        if (driver.kind === 'node') {
          const node = getNode(driver.id)
          if (!node) return null

          return (
            <div
              key={driver.id}
              className={`absolute pointer-events-none transition-all duration-300 rounded-lg ${
                isHovered
                  ? 'border-4 border-info-500 shadow-lg shadow-info-500/60 bg-info-500/15'
                  : 'border-2 border-info-400/40 shadow-md shadow-info-500/30 bg-info-500/8'
              }`}
              style={{
                left: node.position.x,
                top: node.position.y,
                width: node.width || 200,
                height: node.height || 80,
              }}
            />
          )
        }

        if (driver.kind === 'edge') {
          const edge = getEdge(driver.id)
          if (!edge) return null

          const sourceNode = getNode(edge.source)
          const targetNode = getNode(edge.target)
          if (!sourceNode || !targetNode) return null

          // Simple edge highlight: draw a line from source center to target center
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
                className={isHovered ? 'stroke-info-500' : 'stroke-info-400/50'}
                strokeWidth={isHovered ? 4 : 3}
                strokeDasharray={isHovered ? '0' : '8 4'}
              />
            </svg>
          )
        }

        return null
      })}
    </div>
  )
}

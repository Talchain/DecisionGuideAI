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
              className="absolute pointer-events-none transition-all duration-300"
              style={{
                left: node.position.x,
                top: node.position.y,
                width: node.width || 200,
                height: node.height || 80,
                border: isHovered ? '3px solid var(--olumi-primary)' : '2px solid rgba(91, 108, 255, 0.4)',
                borderRadius: '8px',
                boxShadow: isHovered
                  ? '0 0 20px rgba(91, 108, 255, 0.6)'
                  : '0 0 10px rgba(91, 108, 255, 0.3)',
                backgroundColor: isHovered
                  ? 'rgba(91, 108, 255, 0.15)'
                  : 'rgba(91, 108, 255, 0.08)'
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
                stroke={isHovered ? 'var(--olumi-primary)' : 'rgba(91, 108, 255, 0.5)'}
                strokeWidth={isHovered ? 4 : 3}
                strokeDasharray={isHovered ? '0' : '8 4'}
                style={{
                  filter: isHovered
                    ? 'drop-shadow(0 0 8px rgba(91, 108, 255, 0.8))'
                    : 'drop-shadow(0 0 4px rgba(91, 108, 255, 0.4))'
                }}
              />
            </svg>
          )
        }

        return null
      })}
    </div>
  )
}

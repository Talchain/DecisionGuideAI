/**
 * Visual Diff Overlay
 *
 * Displays a semi-transparent "ghost" of a snapshot overlaid on the current canvas.
 * Used for comparing two snapshots visually.
 *
 * Features:
 * - Semi-transparent gray nodes and edges
 * - Canvas API rendering at z-index 24 (between canvas and chrome)
 * - Keyboard shortcut: D to toggle
 * - Respects camera zoom and pan
 *
 * Flag: VITE_FEATURE_SNAPSHOTS_V2=0|1
 */

import { useEffect, useRef } from 'react'
import type { SnapshotNode, SnapshotEdge } from './snapshots'
import { sanitizeLabel } from '../utils/sanitize'

export interface VisualDiffProps {
  /** Whether the diff overlay is enabled */
  enabled: boolean

  /** Snapshot nodes to render as ghost */
  snapshotNodes: SnapshotNode[]

  /** Snapshot edges to render as ghost */
  snapshotEdges: SnapshotEdge[]

  /** Camera state (zoom, pan) */
  camera: { x: number; y: number; zoom: number }

  /** Canvas dimensions */
  width: number
  height: number
}

/**
 * Convert world coordinates to screen coordinates
 */
function worldToScreen(
  worldX: number,
  worldY: number,
  camera: { x: number; y: number; zoom: number }
): { x: number; y: number } {
  return {
    x: worldX * camera.zoom + camera.x,
    y: worldY * camera.zoom + camera.y,
  }
}

/**
 * Draw a ghost node (semi-transparent gray circle with label)
 */
function drawGhostNode(
  ctx: CanvasRenderingContext2D,
  node: SnapshotNode,
  camera: { x: number; y: number; zoom: number }
) {
  const { x: screenX, y: screenY } = worldToScreen(node.x, node.y, camera)
  const radius = 30 * camera.zoom

  // Draw circle
  ctx.beginPath()
  ctx.arc(screenX, screenY, radius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(156, 163, 175, 0.3)' // gray-400 with 30% opacity
  ctx.fill()
  ctx.strokeStyle = 'rgba(156, 163, 175, 0.5)' // gray-400 with 50% opacity
  ctx.lineWidth = 2 * camera.zoom
  ctx.stroke()

  // Draw label
  const fontSize = 12 * camera.zoom
  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = 'rgba(75, 85, 99, 0.6)' // gray-600 with 60% opacity
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(sanitizeLabel(node.label || node.id).slice(0, 10), screenX, screenY)
}

/**
 * Draw a ghost edge (semi-transparent gray line with arrow)
 */
function drawGhostEdge(
  ctx: CanvasRenderingContext2D,
  edge: SnapshotEdge,
  nodeMap: Map<string, SnapshotNode>,
  camera: { x: number; y: number; zoom: number }
) {
  const fromNode = nodeMap.get(edge.from)
  const toNode = nodeMap.get(edge.to)

  if (!fromNode || !toNode) return

  const from = worldToScreen(fromNode.x, fromNode.y, camera)
  const to = worldToScreen(toNode.x, toNode.y, camera)

  // Draw line
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)' // gray-400 with 40% opacity
  ctx.lineWidth = 2 * camera.zoom
  ctx.stroke()

  // Draw arrow at end
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const arrowSize = 10 * camera.zoom

  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - arrowSize * Math.cos(angle - Math.PI / 6),
    to.y - arrowSize * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    to.x - arrowSize * Math.cos(angle + Math.PI / 6),
    to.y - arrowSize * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fillStyle = 'rgba(156, 163, 175, 0.4)'
  ctx.fill()
}

/**
 * Visual Diff Overlay Component
 */
export function VisualDiff({
  enabled,
  snapshotNodes,
  snapshotEdges,
  camera,
  width,
  height,
}: VisualDiffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!enabled || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Create node map for edge rendering
    const nodeMap = new Map<string, SnapshotNode>()
    snapshotNodes.forEach(node => nodeMap.set(node.id, node))

    // Draw ghost edges first (behind nodes)
    snapshotEdges.forEach(edge => {
      drawGhostEdge(ctx, edge, nodeMap, camera)
    })

    // Draw ghost nodes on top
    snapshotNodes.forEach(node => {
      drawGhostNode(ctx, node, camera)
    })
  }, [enabled, snapshotNodes, snapshotEdges, camera, width, height])

  if (!enabled) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 24, // Between canvas (z-20) and chrome (z-25+)
      }}
      width={width}
      height={height}
      aria-hidden="true"
      data-testid="visual-diff-overlay"
    />
  )
}

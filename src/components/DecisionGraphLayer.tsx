// src/components/DecisionGraphLayer.tsx
// Decision graph overlay that shares camera with whiteboard

import { useRef, useEffect, useState } from 'react'
import { useCamera } from './PlotCamera'

interface Node {
  id: string
  label: string
  x?: number
  y?: number
  type?: string
}

interface Edge {
  from: string
  to: string
  label?: string
  weight?: number
}

interface DecisionGraphLayerProps {
  nodes: Node[]
  edges: Edge[]
  onNodeClick?: (node: Node) => void
  onNodeMove?: (nodeId: string, x: number, y: number) => void
  selectedNodeId?: string
}

export default function DecisionGraphLayer({ nodes, edges, onNodeClick, onNodeMove, selectedNodeId }: DecisionGraphLayerProps) {
  const { camera } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Handle dragging with document-level listeners
  useEffect(() => {
    if (!draggingNodeId) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingNodeId || !onNodeMove) return
      const canvas = canvasRef.current
      if (!canvas) return
      
      // Get canvas position on page
      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      
      // Convert to world coordinates
      const worldX = (canvasX - camera.x) / camera.zoom - dragOffset.x
      const worldY = (canvasY - camera.y) / camera.zoom - dragOffset.y
      
      onNodeMove(draggingNodeId, worldX, worldY)
    }

    const handleMouseUp = () => {
      setDraggingNodeId(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingNodeId, dragOffset, camera, onNodeMove])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear with transparency
    ctx.clearRect(0, 0, rect.width, rect.height)

    if (nodes.length === 0) return

    // Apply camera transform
    ctx.save()
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.zoom, camera.zoom)

    // Auto-layout if nodes don't have positions
    const layoutNodes = nodes.map((n, i) => {
      if (n.x !== undefined && n.y !== undefined) {
        return { ...n, x: n.x, y: n.y }
      }
      // Simple circular layout
      const angle = (i / nodes.length) * Math.PI * 2
      const radius = 200
      return {
        ...n,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      }
    })

    // Draw edges
    edges.forEach(edge => {
      const from = layoutNodes.find(n => n.id === edge.from)
      const to = layoutNodes.find(n => n.id === edge.to)
      if (!from || !to) return

      const fromX = from.x!
      const fromY = from.y!
      const toX = to.x!
      const toY = to.y!

      // Draw edge line
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(toX, toY)
      ctx.stroke()

      // Draw arrow head
      const angle = Math.atan2(toY - fromY, toX - fromX)
      const arrowSize = 10
      ctx.fillStyle = '#94a3b8'
      ctx.beginPath()
      ctx.moveTo(toX, toY)
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle - Math.PI / 6),
        toY - arrowSize * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle + Math.PI / 6),
        toY - arrowSize * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fill()

      // Draw edge label if present
      if (edge.label) {
        const midX = (fromX + toX) / 2
        const midY = (fromY + toY) / 2
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(midX - 20, midY - 8, 40, 16)
        ctx.fillStyle = '#64748b'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(edge.label, midX, midY + 4)
      }
    })

    // Draw nodes
    layoutNodes.forEach(node => {
      const x = node.x!
      const y = node.y!
      const isSelected = node.id === selectedNodeId
      const nodeRadius = 40

      // Node background
      ctx.fillStyle = isSelected ? '#e0e7ff' : '#ffffff'
      ctx.strokeStyle = isSelected ? '#6366f1' : '#cbd5e1'
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.beginPath()
      ctx.arc(x, y, nodeRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Node label
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Wrap text if too long
      const maxWidth = nodeRadius * 1.6
      const words = node.label.split(' ')
      let line = ''
      let lineY = y - 5
      
      words.forEach((word, i) => {
        const testLine = line + (line ? ' ' : '') + word
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && line) {
          ctx.fillText(line, x, lineY)
          line = word
          lineY += 12
        } else {
          line = testLine
        }
      })
      ctx.fillText(line, x, lineY)
    })

    ctx.restore()
  }, [camera, nodes, edges, selectedNodeId])

  // Check if point hits a node (returns node or null)
  const getNodeAtPoint = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const x = (screenX - rect.left - camera.x) / camera.zoom
    const y = (screenY - rect.top - camera.y) / camera.zoom

    // Check if point hit a node
    const layoutNodes = nodes.map((n, i) => {
      if (n.x !== undefined && n.y !== undefined) {
        return { ...n, x: n.x, y: n.y }
      }
      const angle = (i / nodes.length) * Math.PI * 2
      const radius = 200
      return {
        ...n,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      }
    })

    return layoutNodes.find(n => {
      const dx = x - n.x!
      const dy = y - n.y!
      return Math.sqrt(dx * dx + dy * dy) <= 40
    }) || null
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    const clickedNode = getNodeAtPoint(e.clientX, e.clientY)
    if (clickedNode && onNodeClick) {
      e.stopPropagation()
      onNodeClick(clickedNode)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Change cursor if hovering over a node
    const node = getNodeAtPoint(e.clientX, e.clientY)
    canvas.style.cursor = node ? 'pointer' : 'default'
  }

  if (nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-6 py-4 text-center">
          <div className="text-sm font-semibold text-gray-700 mb-1">No decision graph yet</div>
          <div className="text-xs text-gray-500">Run a scenario to see the decision flow</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="absolute inset-0"
      style={{ zIndex: 10, pointerEvents: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }}
      />
      {/* Invisible hit areas for nodes */}
      {nodes.length > 0 && nodes.map((node, i) => {
        // Calculate screen position
        const n = node.x !== undefined && node.y !== undefined ? node : {
          ...node,
          x: Math.cos((i / nodes.length) * Math.PI * 2) * 200,
          y: Math.sin((i / nodes.length) * Math.PI * 2) * 200
        }
        const screenX = n.x! * camera.zoom + camera.x
        const screenY = n.y! * camera.zoom + camera.y
        const radius = 40 * camera.zoom
        
        const isDragging = draggingNodeId === node.id

        return (
          <div
            key={node.id}
            className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
              left: screenX - radius,
              top: screenY - radius,
              width: radius * 2,
              height: radius * 2,
              pointerEvents: 'auto',
              borderRadius: '50%'
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              const canvas = canvasRef.current
              if (!canvas) return
              
              setDraggingNodeId(node.id)
              
              // Get canvas position on page
              const rect = canvas.getBoundingClientRect()
              const canvasX = e.clientX - rect.left
              const canvasY = e.clientY - rect.top
              
              // Store offset from node center to click point in world coords
              const clickWorldX = (canvasX - camera.x) / camera.zoom
              const clickWorldY = (canvasY - camera.y) / camera.zoom
              setDragOffset({
                x: clickWorldX - n.x!,
                y: clickWorldY - n.y!
              })
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!isDragging && onNodeClick) {
                onNodeClick(node)
              }
            }}
            title={node.label}
          />
        )
      })}
    </div>
  )
}

/**
 * Full inspector panel - opens on double-click or expand button
 * Positioned relative to selected node/edge, draggable
 * British English: visualisation, colour
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { X, GripVertical } from 'lucide-react'
import { useViewport } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { NodeInspector } from '../ui/NodeInspector'
import { EdgeInspector } from '../ui/EdgeInspector'
import { InspectorRouter } from '../ui/inspector-v2'

/** Feature flag: when true, uses the new per-type inspector panels */
const USE_INSPECTOR_V2 = true

interface InspectorModalProps {
  nodeId: string | null
  edgeId: string | null
  onClose: () => void
}

interface Position {
  x: number
  y: number
}

export const InspectorModal = memo(({ nodeId, edgeId, onClose }: InspectorModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const { x: viewportX, y: viewportY, zoom } = useViewport()

  // Get anchor position from selection
  const anchorPosition = useCanvasStore(s => s.selection.anchorPosition)

  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasPos: { x: number; y: number }) => {
    return {
      x: canvasPos.x * zoom + viewportX,
      y: canvasPos.y * zoom + viewportY,
    }
  }, [viewportX, viewportY, zoom])

  // Calculate initial position based on anchor (right side of node with gap)
  useEffect(() => {
    if (!anchorPosition || position) return

    // Wait for panel to render to get dimensions
    requestAnimationFrame(() => {
      if (!panelRef.current) return

      const rect = panelRef.current.getBoundingClientRect()
      const padding = 16
      const gap = 24

      // Convert canvas coordinates to screen coordinates
      const screenAnchor = canvasToScreen(anchorPosition)

      // Start to the right of the anchor
      let x = screenAnchor.x + gap
      let y = screenAnchor.y - rect.height / 2

      // Prevent overflow right - flip to left side
      if (x + rect.width > window.innerWidth - padding) {
        x = screenAnchor.x - rect.width - gap
      }

      // Prevent overflow left
      if (x < padding) {
        x = padding
      }

      // Prevent overflow bottom
      if (y + rect.height > window.innerHeight - padding) {
        y = window.innerHeight - rect.height - padding
      }

      // Prevent overflow top
      if (y < padding) {
        y = padding
      }

      setPosition({ x, y })
    })
  }, [anchorPosition, canvasToScreen, position])

  // Reset position when node/edge changes
  useEffect(() => {
    setPosition(null)
  }, [nodeId, edgeId])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Drag handlers — passed to InspectorShell header in v2 mode
  const handleDragStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (!position) return

    setIsDragging(true)
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      posX: position.x,
      posY: position.y,
    }

    // Capture pointer for smooth dragging
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }, [position])

  const handleDragMove = useCallback((event: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return

    const deltaX = event.clientX - dragStartRef.current.x
    const deltaY = event.clientY - dragStartRef.current.y

    setPosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    })
  }, [isDragging])

  const handleDragEnd = useCallback((event: React.PointerEvent) => {
    setIsDragging(false)
    dragStartRef.current = null
    ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
  }, [])

  if (!nodeId && !edgeId) return null

  // Calculate initial position from anchor while waiting for measured position
  const screenAnchor = anchorPosition ? canvasToScreen(anchorPosition) : { x: 200, y: 200 }

  const dragHandlers = {
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: handleDragEnd,
    onPointerCancel: handleDragEnd,
    isDragging,
  }

  if (USE_INSPECTOR_V2) {
    return (
      <div
        ref={panelRef}
        className="fixed z-[5000]"
        style={{
          left: position?.x ?? screenAnchor.x + 24,
          top: position?.y ?? screenAnchor.y,
          opacity: position ? 1 : 0,
          transition: isDragging ? 'none' : 'opacity 150ms ease-out',
        }}
        role="dialog"
        aria-modal="false"
        aria-label={nodeId ? 'Node inspector' : 'Edge inspector'}
      >
        <InspectorRouter
          nodeId={nodeId}
          edgeId={edgeId}
          onClose={onClose}
          dragHandlers={dragHandlers}
        />
      </div>
    )
  }

  // Legacy v1 path
  return (
    <div
      ref={panelRef}
      className="fixed z-[5000] bg-white rounded-lg shadow-3 max-w-md w-full max-h-[80vh] overflow-hidden border border-panel-border"
      style={{
        left: position?.x ?? screenAnchor.x + 24,
        top: position?.y ?? screenAnchor.y,
        opacity: position ? 1 : 0,
        transition: isDragging ? 'none' : 'opacity 150ms ease-out',
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="inspector-panel-title"
    >
      <div
        className={`sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-xl select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-gray-400" aria-hidden="true" />
          <h2 id="inspector-panel-title" className="text-sm font-semibold text-gray-900">
            {nodeId ? 'Node Properties' : 'Edge Properties'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Close inspector"
        >
          <X size={18} />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[calc(80vh-52px)]">
        {nodeId && (
          <NodeInspector
            nodeId={nodeId}
            onClose={onClose}
          />
        )}
        {edgeId && !nodeId && (
          <EdgeInspector
            edgeId={edgeId}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
})

InspectorModal.displayName = 'InspectorModal'

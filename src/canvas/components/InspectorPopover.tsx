/**
 * Contextual inspector popover - appears next to selected node/edge
 * Handles positioning and viewport boundary adjustments
 * British English: visualisation, colour
 */

import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { useViewport } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { NodeInspectorCompact } from '../ui/NodeInspectorCompact'
import { EdgeInspectorCompact } from '../ui/EdgeInspectorCompact'

interface InspectorPopoverProps {
  onExpandToFull: () => void
}

interface Position {
  x: number
  y: number
}

export const InspectorPopover = memo(({ onExpandToFull }: InspectorPopoverProps) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const { x: viewportX, y: viewportY, zoom } = useViewport()

  // Get selection state
  const nodeId = useCanvasStore(s => {
    const ids = s.selection.nodeIds
    if (ids.size !== 1) return null
    return ids.values().next().value ?? null
  })

  const edgeId = useCanvasStore(s => {
    const ids = s.selection.edgeIds
    if (ids.size !== 1) return null
    return ids.values().next().value ?? null
  })

  const anchorPosition = useCanvasStore(s => s.selection.anchorPosition)
  const clearSelection = useCanvasStore(s => s.clearSelection)

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasPos: { x: number; y: number }) => {
    return {
      x: canvasPos.x * zoom + viewportX,
      y: canvasPos.y * zoom + viewportY,
    }
  }, [viewportX, viewportY, zoom])

  // Calculate popover position based on anchor
  useEffect(() => {
    if (!anchorPosition || (!nodeId && !edgeId)) {
      setPosition(null)
      return
    }

    // Use requestAnimationFrame to wait for popover to render
    requestAnimationFrame(() => {
      if (!popoverRef.current) return

      const rect = popoverRef.current.getBoundingClientRect()
      const padding = 16

      // Convert canvas coordinates to screen coordinates
      const screenAnchor = canvasToScreen(anchorPosition)

      // Start to the right of the anchor
      let x = screenAnchor.x + 20
      let y = screenAnchor.y - rect.height / 2

      // Prevent overflow right - flip to left side
      if (x + rect.width > window.innerWidth - padding) {
        x = screenAnchor.x - rect.width - 20
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
  }, [anchorPosition, nodeId, edgeId, canvasToScreen])

  // Handle click outside
  useEffect(() => {
    if (!nodeId && !edgeId) return

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        // Check if click is on the canvas (not other UI elements)
        const target = event.target as HTMLElement
        const isCanvasClick = target.closest('.react-flow__pane') ||
                              target.closest('.react-flow__node') ||
                              target.closest('.react-flow__edge')

        if (isCanvasClick) {
          // Let the canvas handle selection change
          return
        }

        // Otherwise close the popover
        clearSelection()
      }
    }

    // Delay adding listener to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [nodeId, edgeId, clearSelection])

  // Handle escape key
  useEffect(() => {
    if (!nodeId && !edgeId) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [nodeId, edgeId, clearSelection])

  // Handle close
  const handleClose = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  // Don't render if nothing selected or no anchor
  if ((!nodeId && !edgeId) || !anchorPosition) {
    return null
  }

  // Convert anchor to screen coords for initial render
  const screenAnchor = canvasToScreen(anchorPosition)

  return (
    <div
      ref={popoverRef}
      className="fixed z-[4000] transition-opacity duration-150"
      style={{
        left: position?.x ?? screenAnchor.x + 20,
        top: position?.y ?? screenAnchor.y,
        opacity: position ? 1 : 0,
      }}
    >
      {nodeId && (
        <NodeInspectorCompact
          nodeId={nodeId}
          onClose={handleClose}
          onExpandToFull={onExpandToFull}
        />
      )}
      {edgeId && !nodeId && (
        <EdgeInspectorCompact
          edgeId={edgeId}
          onClose={handleClose}
          onExpandToFull={onExpandToFull}
        />
      )}
    </div>
  )
})

InspectorPopover.displayName = 'InspectorPopover'

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
import { ICON_STANDALONE } from '../conversation/panelIcons'
import { useInspectorPresenceStore } from '../stores/inspectorPresenceStore'

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

/**
 * ⭐ WHERE THE INSPECTOR OPENS — canvas visual contract v3.1 ("no overlap").
 *
 * Measured on the served dev build (pricing, 1280x800, dock open at x=853): a
 * Risk click opened the inspector at x=611..941, 88px over the right panel —
 * the placement kept clear of the WINDOW edge only, and the dock is the right
 * edge the canvas actually has. `rightLimit` is that edge (the dock's left, or
 * the window's width when there is no dock).
 *
 * Rule, unchanged except for that limit: right of the anchor with a gap; flip
 * to the left when the right side is blocked; clamp inside
 * [padding, rightLimit - padding - width]; clamp vertically in the window.
 */
export function placeInspector({
  anchor,
  panel,
  viewport,
  rightLimit,
  topLimit = 0,
  padding = 16,
  gap = 24,
}: {
  anchor: Position
  panel: { width: number; height: number }
  viewport: { width: number; height: number }
  rightLimit: number
  /** The app bar's bottom edge (`--topbar-h`); the panel never starts above it. */
  topLimit?: number
  padding?: number
  gap?: number
}): Position {
  const right = Math.min(rightLimit, viewport.width) - padding
  let x = anchor.x + gap
  let y = anchor.y - panel.height / 2
  // Blocked on the right (by the dock or the window) — flip to the left side.
  if (x + panel.width > right) x = anchor.x - panel.width - gap
  // Never over the right edge, never off the left.
  if (x + panel.width > right) x = right - panel.width
  if (x < padding) x = padding
  if (y + panel.height > viewport.height - padding) y = viewport.height - panel.height - padding
  if (y < topLimit + padding) y = topLimit + padding
  return { x, y }
}

/** The right panel's left edge, or the window's width when it is not showing. */
function canvasRightLimit(): number {
  const dock = document.querySelector('[data-testid="outputs-dock"]')
  const r = dock?.getBoundingClientRect()
  return r && r.width > 0 && r.left > 0 ? Math.min(r.left, window.innerWidth) : window.innerWidth
}

export const InspectorModal = memo(({ nodeId, edgeId, onClose }: InspectorModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const { x: viewportX, y: viewportY, zoom } = useViewport()

  // Get anchor position from selection
  const anchorPosition = useCanvasStore(s => s.selection.anchorPosition)

  // Design audit #14: the dock's "Selected" row stands down while this is open
  // (`SelectionPill`). Reported on mount, withdrawn on unmount.
  const hasTarget = Boolean(nodeId || edgeId)
  useEffect(() => {
    if (!hasTarget) return
    const { setOpen } = useInspectorPresenceStore.getState()
    setOpen(true)
    return () => setOpen(false)
  }, [hasTarget])

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
      // Convert canvas coordinates to screen coordinates, then place clear of
      // the right panel (v3.1 "no overlap" — see `placeInspector`) AND below the
      // app bar. Canvas v3.1 DESIGN-GAP #5 made the top bar the contract's
      // full-width 51px `.app-top`, so a y clamped to `padding` alone put this
      // panel's header over the bar at every x (the floating pill only spanned
      // x 12..450). `--topbar-h` is the bar's bottom edge, written by
      // `TopBar.tsx`; 0 when no bar is mounted.
      const topBarBottom =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0
      setPosition(placeInspector({
        anchor: canvasToScreen(anchorPosition),
        panel: { width: rect.width, height: rect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        rightLimit: canvasRightLimit(),
        topLimit: topBarBottom,
      }))
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
          <X size={ICON_STANDALONE} />
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

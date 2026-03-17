/**
 * Debug Panel Component
 *
 * Collapsible diagnostic panel for staging environments.
 * Shell wrapper that handles visibility, positioning, and resizing.
 * All debug functionality is delegated to DebugPanelV2.
 *
 * Tabs (via DebugPanelV2):
 * - Summary: At-a-glance health check
 * - Data Flow: Service chain tracing
 * - Pipeline: CEE internal processing stages
 * - Captured: Recorded payloads
 *
 * Activation:
 * - URL parameter: ?diag=1
 * - Console: window.__OLUMI_DEBUG = true
 * - Only visible in staging/development (VITE_APP_ENV)
 *
 * @example
 * ```tsx
 * // Add to app root
 * <DebugPanel />
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { DebugPanelV2 } from './debug/DebugPanelV2'

declare global {
  interface Window {
    __OLUMI_DEBUG?: boolean
  }
}

/**
 * Check if debug panel should be visible
 */
function shouldShowDebugPanel(): boolean {
  // Only in staging or development environment
  const env = import.meta.env.VITE_APP_ENV || 'development'
  const allowedEnvs = ['staging', 'development']
  if (!allowedEnvs.includes(env)) return false

  // Check URL parameter - handle both regular and HashRouter URLs
  // Accepts ?diag (bare param) or ?diag=1
  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.has('diag')) return true

  // Check hash for HashRouter query params (e.g., #/canvas?diag or #/canvas?diag=1)
  const hashParts = window.location.hash.split('?')
  if (hashParts.length > 1) {
    const hashParams = new URLSearchParams(hashParts[1])
    if (hashParams.has('diag')) return true
  }

  // Check global flag (console: window.__OLUMI_DEBUG = true)
  if (window.__OLUMI_DEBUG === true) return true

  return false
}

// Debug panel resizing constraints
const MIN_PANEL_WIDTH = 360
const MIN_PANEL_HEIGHT = 260
const STORAGE_KEY_WIDTH = 'olumi:debugPanelWidth'
const STORAGE_KEY_HEIGHT = 'olumi:debugPanelHeight'
const STORAGE_KEY_POSITION = 'olumi:debugPanelPosition'
const COLLAPSED_WIDTH_ESTIMATE = 180

function getInitialPanelWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH)
    if (stored) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed)) {
        return Math.max(parsed, MIN_PANEL_WIDTH)
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 520
}

function getInitialPanelHeight(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HEIGHT)
    if (stored) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed)) {
        return Math.max(parsed, MIN_PANEL_HEIGHT)
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 480
}

function getInitialPanelPosition(): { x: number; y: number } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_POSITION)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number'
      ) {
        return { x: parsed.x, y: parsed.y }
      }
    }
  } catch {
    // Ignore storage errors
  }
  const defaultY =
    typeof window !== 'undefined'
      ? Math.max(16, window.innerHeight - MIN_PANEL_HEIGHT - 32)
      : 16
  return { x: 16, y: defaultY }
}

/**
 * Debug Panel main component
 */
export function DebugPanel() {
  const [visible, setVisible] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [expanded, setExpanded] = useState(false) // Maximized state
  const [userPanelWidth, setUserPanelWidth] = useState(getInitialPanelWidth)
  const [userPanelHeight, setUserPanelHeight] = useState(getInitialPanelHeight)
  const [isResizingWidth, setIsResizingWidth] = useState(false)
  const [isResizingHeight, setIsResizingHeight] = useState(false)
  const [isResizingCorner, setIsResizingCorner] = useState(false)
  const [panelPosition, setPanelPosition] = useState(getInitialPanelPosition)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)
  const resizeStartPanelY = useRef(0)
  const verticalResizeEdge = useRef<'top' | 'bottom'>('bottom')
  const dragStartPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartPanelPos = useRef<{ x: number; y: number }>(panelPosition)
  const panelPositionRef = useRef(panelPosition)

  // Check visibility on mount and URL changes
  useEffect(() => {
    const checkVisibility = () => setVisible(shouldShowDebugPanel())
    checkVisibility()

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', checkVisibility)
    return () => window.removeEventListener('popstate', checkVisibility)
  }, [])

  // Handle panel resize
  const handleHorizontalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingWidth(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = userPanelWidth
  }, [userPanelWidth])

  const handleVerticalResizeStart = useCallback(
    (edge: 'top' | 'bottom') => (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizingHeight(true)
      verticalResizeEdge.current = edge
      resizeStartY.current = e.clientY
      resizeStartHeight.current = userPanelHeight
      resizeStartPanelY.current = panelPosition.y
    },
    [panelPosition.y, userPanelHeight]
  )

  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingPanel(true)
    dragStartPoint.current = { x: e.clientX, y: e.clientY }
    dragStartPanelPos.current = panelPosition
  }, [panelPosition])

  // Corner resize handler (bottom-right corner) - unused for bottom-left anchored panel
  const handleCornerResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingCorner(true)
    resizeStartX.current = e.clientX
    resizeStartY.current = e.clientY
    resizeStartWidth.current = userPanelWidth
    resizeStartHeight.current = userPanelHeight
  }, [userPanelWidth, userPanelHeight])

  // Top-right corner resize handler (for bottom-left anchored panel)
  const handleTopRightCornerResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingCorner(true)
    resizeStartX.current = e.clientX
    resizeStartY.current = e.clientY
    resizeStartWidth.current = userPanelWidth
    resizeStartHeight.current = userPanelHeight
  }, [userPanelWidth, userPanelHeight])

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
      const widthForClamp = collapsed
        ? COLLAPSED_WIDTH_ESTIMATE
        : Math.max(userPanelWidth, MIN_PANEL_WIDTH)
      const maxHeightAvailable =
        typeof window !== 'undefined' ? Math.max(MIN_PANEL_HEIGHT, window.innerHeight - 32) : userPanelHeight
      const resolvedHeight = Math.min(userPanelHeight, maxHeightAvailable ?? userPanelHeight)
      const heightForClamp = collapsed
        ? 80
        : Math.max(resolvedHeight, MIN_PANEL_HEIGHT)
      const minX = 8
      const minY = 8
      const maxX = Math.max(minX, viewportWidth - widthForClamp - 8)
      const maxY = Math.max(minY, viewportHeight - heightForClamp - 8)
      return {
        x: Math.min(Math.max(x, minX), maxX),
        y: Math.min(Math.max(y, minY), maxY),
      }
    },
    [collapsed, userPanelHeight, userPanelWidth]
  )

  const persistPanelPosition = useCallback((pos: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(pos))
    } catch {
      // Ignore storage errors
    }
  }, [])

  useEffect(() => {
    panelPositionRef.current = panelPosition
  }, [panelPosition])

  useEffect(() => {
    if (!isResizingWidth) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth - 32 : resizeStartWidth.current + delta
      const maxWidth = Math.max(MIN_PANEL_WIDTH, viewportWidth)
      const newWidth = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, resizeStartWidth.current + delta))
      setUserPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizingWidth(false)
      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_WIDTH, String(userPanelWidth))
      } catch {
        // Ignore localStorage errors
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingWidth, userPanelWidth])

  useEffect(() => {
    if (!isResizingHeight) return

    const handleMouseMove = (e: MouseEvent) => {
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : resizeStartHeight.current
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, viewportHeight)

      if (verticalResizeEdge.current === 'bottom') {
        const delta = e.clientY - resizeStartY.current
        const desiredHeight = Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT, resizeStartHeight.current + delta))
        setUserPanelHeight(desiredHeight)
        return
      }

      // Top edge resize: adjust height and y position together
      const delta = e.clientY - resizeStartY.current
      const desiredHeight = Math.min(
        maxHeight,
        Math.max(MIN_PANEL_HEIGHT, resizeStartHeight.current - delta)
      )

      const viewport = typeof window !== 'undefined' ? window.innerHeight : resizeStartHeight.current
      const minY = 8
      const maxY = Math.max(minY, viewport - desiredHeight - 8)
      const proposedY = resizeStartPanelY.current + delta
      const clampedY = Math.min(Math.max(proposedY, minY), maxY)

      setPanelPosition((prev) => (prev.y === clampedY ? prev : { ...prev, y: clampedY }))
      setUserPanelHeight(desiredHeight)
    }

    const handleMouseUp = () => {
      setIsResizingHeight(false)
      try {
        localStorage.setItem(STORAGE_KEY_HEIGHT, String(userPanelHeight))
      } catch {
        // Ignore storage errors
      }
      if (verticalResizeEdge.current === 'top') {
        persistPanelPosition(panelPositionRef.current)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingHeight, userPanelHeight])

  useEffect(() => {
    if (!isDraggingPanel) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPoint.current.x
      const deltaY = e.clientY - dragStartPoint.current.y
      const next = clampPosition(
        dragStartPanelPos.current.x + deltaX,
        dragStartPanelPos.current.y + deltaY
      )
      setPanelPosition(next)
    }

    const handleMouseUp = () => {
      setIsDraggingPanel(false)
      persistPanelPosition(panelPosition)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [clampPosition, isDraggingPanel, panelPosition, persistPanelPosition])

  // Corner resize effect (top-right corner for bottom-left anchored panel)
  // Width: drag right increases, Height: drag UP increases (inverted Y)
  useEffect(() => {
    if (!isResizingCorner) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current
      const deltaY = e.clientY - resizeStartY.current

      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth - 32 : resizeStartWidth.current + deltaX
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : resizeStartHeight.current - deltaY

      const maxWidth = Math.max(MIN_PANEL_WIDTH, viewportWidth)
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, viewportHeight)

      const newWidth = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, resizeStartWidth.current + deltaX))
      // Inverted Y: dragging UP (negative deltaY) increases height
      const newHeight = Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT, resizeStartHeight.current - deltaY))

      setUserPanelWidth(newWidth)
      setUserPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizingCorner(false)
      try {
        localStorage.setItem(STORAGE_KEY_WIDTH, String(userPanelWidth))
        localStorage.setItem(STORAGE_KEY_HEIGHT, String(userPanelHeight))
      } catch {
        // Ignore storage errors
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingCorner, userPanelWidth, userPanelHeight])

  useEffect(() => {
    const handleResize = () => {
      setPanelPosition(prev => clampPosition(prev.x, prev.y))
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [clampPosition])

  useEffect(() => {
    setPanelPosition(prev => clampPosition(prev.x, prev.y))
  }, [clampPosition])

  if (!visible) return null

  // Panel dimensions based on state
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : undefined
  // When expanded, use half viewport width (min 600px) and half viewport height
  const expandedWidth = Math.max(600, Math.floor(viewportWidth * 0.5))
  const expandedHeight = viewportHeight ? Math.floor(viewportHeight * 0.6) : 500
  const panelHeightValue =
    collapsed
      ? null
      : expanded
        ? expandedHeight
        : userPanelHeight
          ? Math.min(userPanelHeight, viewportHeight ?? userPanelHeight)
          : null
  const panelHeightPx = panelHeightValue ? `${panelHeightValue}px` : undefined
  const panelWidth = collapsed ? 120 : expanded ? expandedWidth : userPanelWidth
  const panelWidthPx = collapsed ? undefined : `${panelWidth}px`

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        zIndex: 99998,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: collapsed ? undefined : panelWidthPx,
        width: collapsed ? 'auto' : panelWidthPx,
        height: collapsed ? undefined : panelHeightPx,
        maxHeight: collapsed ? undefined : panelHeightPx,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Collapsed state */}
      {collapsed ? (
        <button
          onClick={() => {
            setCollapsed(false)
            const clamped = clampPosition(panelPosition.x, panelPosition.y)
            setPanelPosition(clamped)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#1e293b',
            color: '#f8fafc',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          title="Open Debug Panel"
        >
          <span>Test</span>
        </button>
      ) : (
        /* Debug Panel V2 - 4-tab layout */
        <div
          style={{
            position: 'relative',
            background: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            width: panelWidthPx,
            minHeight: `${MIN_PANEL_HEIGHT}px`,
            height: panelHeightPx,
            maxHeight: panelHeightPx ?? '70vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <DebugPanelV2
            onClose={() => setCollapsed(true)}
            width={panelWidth}
            height={panelHeightValue ?? undefined}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((prev) => !prev)}
          />

          {/* Resize handles for bottom-left anchored panel */}
          {/* Right edge - width resize */}
          <div
            onMouseDown={handleHorizontalResizeStart}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 6,
              height: '100%',
              cursor: 'ew-resize',
              background: isResizingWidth ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
            }}
          />

          {/* Top edge - height resize (expands upward) */}
          <div
            onMouseDown={handleVerticalResizeStart('top')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: 6,
              cursor: 'ns-resize',
              background: isResizingHeight ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
            }}
          />

          {/* Top-right corner - diagonal resize */}
          <div
            onMouseDown={handleTopRightCornerResizeStart}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 14,
              height: 14,
              cursor: 'nesw-resize',
              background: isResizingCorner ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              zIndex: 1,
            }}
          />
        </div>
      )}
    </div>
  )
}

export default DebugPanel

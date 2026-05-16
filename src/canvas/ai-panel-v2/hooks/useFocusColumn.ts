import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FOCUS_COLUMN_DEFAULT,
  FOCUS_COLUMN_MIN,
  FOCUS_SNAP_THRESHOLD,
} from '../constants'

// Brief §4.3 / §4.6 — Focus column width + snap-back.
//
//   • Width: 400 default, 320 min, 50vw max
//   • Left-edge drag widens the column
//   • Right-edge drag toward the dock either narrows OR (within
//     FOCUS_SNAP_THRESHOLD of the dock) snaps back to Compact mode
//
// The hook is session-only state (no localStorage per the plan). Exits
// Focus via `onExit()` rather than mutating panel-split state directly so
// the snap-back is opt-in: the parent decides what to do on snap.

export interface UseFocusColumnOptions {
  /** Called when the column should detach back into Compact mode (snap). */
  onExit: () => void
}

export interface UseFocusColumnResult {
  /** Current column width in pixels. */
  width: number
  /** True while either edge is being dragged. */
  isResizing: boolean
  /** Pointer-down on the LEFT edge — widen or narrow. */
  startLeftEdgeResize: (event: React.PointerEvent) => void
  /** Pointer-down on the RIGHT edge — narrow or snap to exit. */
  startRightEdgeResize: (event: React.PointerEvent) => void
}

export function useFocusColumn({ onExit }: UseFocusColumnOptions): UseFocusColumnResult {
  const [width, setWidth] = useState(FOCUS_COLUMN_DEFAULT)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(FOCUS_COLUMN_DEFAULT)
  const latestWidthRef = useRef(FOCUS_COLUMN_DEFAULT)
  const dragEdgeRef = useRef<'left' | 'right' | null>(null)

  useEffect(() => {
    latestWidthRef.current = width
  }, [width])

  const clampWidth = useCallback((px: number): number => {
    const maxWidth = typeof window === 'undefined' ? 1200 : Math.floor(window.innerWidth * 0.5)
    return Math.max(FOCUS_COLUMN_MIN, Math.min(maxWidth, px))
  }, [])

  const startResize = useCallback((event: React.PointerEvent, edge: 'left' | 'right') => {
    if (event.button !== 0) return
    event.preventDefault()
    dragStartXRef.current = event.clientX
    dragStartWidthRef.current = width
    dragEdgeRef.current = edge
    setIsResizing(true)
  }, [width])

  const startLeftEdgeResize = useCallback((event: React.PointerEvent) => startResize(event, 'left'), [startResize])
  const startRightEdgeResize = useCallback((event: React.PointerEvent) => startResize(event, 'right'), [startResize])

  useEffect(() => {
    if (!isResizing) return
    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStartXRef.current
      const edge = dragEdgeRef.current
      if (edge === 'left') {
        // Left edge: drag LEFT (negative dx) widens; drag RIGHT narrows.
        const proposed = dragStartWidthRef.current - dx
        setWidth(clampWidth(proposed))
      } else if (edge === 'right') {
        // Right edge: drag LEFT widens; drag RIGHT narrows. If the right
        // edge ends up within FOCUS_SNAP_THRESHOLD of the dock's left
        // edge (i.e. the column has shrunk close to "disappearing"), the
        // parent exits Focus mode on release.
        const proposed = dragStartWidthRef.current + dx
        setWidth(clampWidth(proposed))
      }
    }
    const handleUp = () => {
      const edge = dragEdgeRef.current
      const finalWidth = latestWidthRef.current
      setIsResizing(false)
      dragEdgeRef.current = null
      // Snap-back: only when the right-edge drag brought the column close
      // to its minimum (which equals "snapped against the dock"). The
      // brief specifies "within 20px of the right panel edge"; once
      // clampWidth has pinned to FOCUS_COLUMN_MIN, the user's intent to
      // exit is clear — fire onExit. We approximate with width <= MIN +
      // SNAP_THRESHOLD so users have a small dead-zone.
      if (edge === 'right' && finalWidth <= FOCUS_COLUMN_MIN + FOCUS_SNAP_THRESHOLD) {
        onExit()
      }
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleUp)
    }
  }, [isResizing, clampWidth, onExit])

  return {
    width,
    isResizing,
    startLeftEdgeResize,
    startRightEdgeResize,
  }
}

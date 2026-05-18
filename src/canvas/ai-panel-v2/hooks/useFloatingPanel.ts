import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import {
  FLOATING_DEFAULT_HEIGHT,
  FLOATING_DEFAULT_RIGHT_OFFSET,
  FLOATING_DEFAULT_TOP_OFFSET,
  FLOATING_DEFAULT_WIDTH,
  FLOATING_MAX_HEIGHT_FRACTION,
  FLOATING_MAX_WIDTH_FRACTION,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
} from '../constants'

// Drag + resize for the FloatingPanel.
//
// Responsibilities:
//   • Track position (top-left x/y) and size (width/height)
//   • Clamp to viewport bounds + min/max dimensions
//   • Provide pointerdown handlers for the header (drag) and the
//     bottom-right resize handle (resize)
//   • Session-only — defaults restore on every mount (no localStorage,
//     per the brief)
//
// State shape exposed to the panel: { left, top, width, height }. The
// panel renders with position: fixed at those coords.

export interface FloatingRect {
  left: number
  top: number
  width: number
  height: number
}

interface UseFloatingPanelResult {
  rect: FloatingRect
  isDragging: boolean
  isResizing: boolean
  startDrag: (event: PointerEvent) => void
  startResize: (event: PointerEvent) => void
}

function viewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1280, height: 800 }
  return { width: window.innerWidth, height: window.innerHeight }
}

function initialRect(): FloatingRect {
  const vp = viewportSize()
  const width = Math.min(FLOATING_DEFAULT_WIDTH, vp.width * FLOATING_MAX_WIDTH_FRACTION)
  const height = Math.min(FLOATING_DEFAULT_HEIGHT, vp.height * FLOATING_MAX_HEIGHT_FRACTION)
  // Anchor near the right edge so undocking reads as a sideways move
  // rather than teleporting to (0,0).
  const left = Math.max(0, vp.width - width - FLOATING_DEFAULT_RIGHT_OFFSET)
  const top = Math.min(vp.height - height, FLOATING_DEFAULT_TOP_OFFSET)
  return { left, top, width, height }
}

function clampRect(rect: FloatingRect): FloatingRect {
  const vp = viewportSize()
  const maxW = Math.max(FLOATING_MIN_WIDTH, Math.floor(vp.width * FLOATING_MAX_WIDTH_FRACTION))
  const maxH = Math.max(FLOATING_MIN_HEIGHT, Math.floor(vp.height * FLOATING_MAX_HEIGHT_FRACTION))
  const width = Math.min(maxW, Math.max(FLOATING_MIN_WIDTH, rect.width))
  const height = Math.min(maxH, Math.max(FLOATING_MIN_HEIGHT, rect.height))
  const left = Math.min(Math.max(0, rect.left), Math.max(0, vp.width - width))
  const top = Math.min(Math.max(0, rect.top), Math.max(0, vp.height - height))
  return { left, top, width, height }
}

export function useFloatingPanel(): UseFloatingPanelResult {
  const [rect, setRect] = useState<FloatingRect>(() => clampRect(initialRect()))
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const dragOriginRef = useRef<{ pointerX: number; pointerY: number; left: number; top: number } | null>(null)
  const resizeOriginRef = useRef<{ pointerX: number; pointerY: number; width: number; height: number } | null>(null)

  // Re-clamp when the viewport changes so the panel doesn't get left
  // off-screen after a window resize.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setRect(prev => clampRect(prev))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startDrag = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      dragOriginRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        left: rect.left,
        top: rect.top,
      }
      setIsDragging(true)
    },
    [rect.left, rect.top],
  )

  const startResize = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      resizeOriginRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        width: rect.width,
        height: rect.height,
      }
      setIsResizing(true)
    },
    [rect.width, rect.height],
  )

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (ev: globalThis.PointerEvent) => {
      const origin = dragOriginRef.current
      if (!origin) return
      const nextLeft = origin.left + (ev.clientX - origin.pointerX)
      const nextTop = origin.top + (ev.clientY - origin.pointerY)
      setRect(prev => clampRect({ ...prev, left: nextLeft, top: nextTop }))
    }
    const handleUp = () => {
      setIsDragging(false)
      dragOriginRef.current = null
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleUp)
    }
  }, [isDragging])

  useEffect(() => {
    if (!isResizing) return
    const handleMove = (ev: globalThis.PointerEvent) => {
      const origin = resizeOriginRef.current
      if (!origin) return
      const nextW = origin.width + (ev.clientX - origin.pointerX)
      const nextH = origin.height + (ev.clientY - origin.pointerY)
      setRect(prev => clampRect({ ...prev, width: nextW, height: nextH }))
    }
    const handleUp = () => {
      setIsResizing(false)
      resizeOriginRef.current = null
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleUp)
    }
  }, [isResizing])

  return { rect, isDragging, isResizing, startDrag, startResize }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  ARROW_KEY_RESIZE_PX,
  COMPACT_AI_RATIO,
  CONVERSATION_AI_RATIO,
  FOCUS_MIN_VIEWPORT,
  MODE_THRESHOLDS,
} from '../constants'
import type { AIPanelMode } from '../constants'

// Vertical split between analysis (top) + AI zone (bottom) PLUS Focus mode
// switching. Owns:
//   • aiRatio          — current vertical ratio (0..1) for Compact/Conv
//   • activeMode       — Compact / Conversation / Focus
//   • isDragging       — true while a drag is in progress
//   • setMode          — click handler; jumps to preset
//   • startDrag        — pointer-down on the pull-tab drag region
//   • adjustByPx       — ±N px arrow-key support
//
// Drag axis detection: first 8px commits the axis. Vertical drag resizes
// the Compact/Conv ratio. Horizontal LEFT drag (only when viewport ≥
// FOCUS_MIN_VIEWPORT) switches to Focus mode.

export interface UsePanelSplitOptions {
  /** Returns the panel's current pixel height. Read live during drag. */
  getPanelHeight: () => number
}

export interface UsePanelSplitResult {
  aiRatio: number
  activeMode: AIPanelMode
  isDragging: boolean
  setMode: (mode: AIPanelMode) => void
  startDrag: (event: React.PointerEvent) => void
  adjustByPx: (deltaPx: number) => void
}

function deriveModeFromRatio(ratio: number): AIPanelMode {
  if (ratio >= MODE_THRESHOLDS.compact.min && ratio <= MODE_THRESHOLDS.compact.max) {
    return 'compact'
  }
  if (ratio >= MODE_THRESHOLDS.conversation.min && ratio <= MODE_THRESHOLDS.conversation.max) {
    return 'conversation'
  }
  const compactMid = (MODE_THRESHOLDS.compact.min + MODE_THRESHOLDS.compact.max) / 2
  const conversationMid = (MODE_THRESHOLDS.conversation.min + MODE_THRESHOLDS.conversation.max) / 2
  return Math.abs(ratio - compactMid) < Math.abs(ratio - conversationMid)
    ? 'compact'
    : 'conversation'
}

function clampRatio(ratio: number, panelHeightPx: number): number {
  if (panelHeightPx <= 0) return ratio
  const minRatio = AI_ZONE_MIN_HEIGHT / panelHeightPx
  const maxRatio = (panelHeightPx - ANALYSIS_ZONE_MIN_HEIGHT) / panelHeightPx
  if (minRatio > maxRatio) return minRatio
  return Math.min(maxRatio, Math.max(minRatio, ratio))
}

function focusEnabledAtViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= FOCUS_MIN_VIEWPORT
}

export function usePanelSplit({ getPanelHeight }: UsePanelSplitOptions): UsePanelSplitResult {
  const [aiRatio, setAiRatio] = useState(COMPACT_AI_RATIO)
  const [explicitMode, setExplicitMode] = useState<AIPanelMode | null>(null)
  const [focusActive, setFocusActive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const dragStartRatioRef = useRef(0)
  const axisCommittedRef = useRef<'vertical' | 'horizontal' | null>(null)

  // Viewport guard: if the user narrows the window below FOCUS_MIN_VIEWPORT
  // while Focus is active, drop back to the last non-Focus preset so the
  // disabled-Focus state in the PullTab is consistent.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      if (focusActive && !focusEnabledAtViewport()) {
        setFocusActive(false)
        setExplicitMode('compact')
        setAiRatio(clampRatio(COMPACT_AI_RATIO, getPanelHeight()))
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [focusActive, getPanelHeight])

  const activeMode = useMemo<AIPanelMode>(() => {
    if (focusActive) return 'focus'
    if (explicitMode === 'compact' && aiRatio >= MODE_THRESHOLDS.compact.min && aiRatio <= MODE_THRESHOLDS.compact.max) {
      return 'compact'
    }
    if (explicitMode === 'conversation' && aiRatio >= MODE_THRESHOLDS.conversation.min && aiRatio <= MODE_THRESHOLDS.conversation.max) {
      return 'conversation'
    }
    return deriveModeFromRatio(aiRatio)
  }, [focusActive, aiRatio, explicitMode])

  const setMode = useCallback((mode: AIPanelMode) => {
    if (mode === 'focus') {
      if (!focusEnabledAtViewport()) return
      setFocusActive(true)
      setExplicitMode('focus')
      return
    }
    setFocusActive(false)
    setExplicitMode(mode)
    if (mode === 'compact') {
      setAiRatio(clampRatio(COMPACT_AI_RATIO, getPanelHeight()))
    } else if (mode === 'conversation') {
      setAiRatio(clampRatio(CONVERSATION_AI_RATIO, getPanelHeight()))
    }
  }, [getPanelHeight])

  const adjustByPx = useCallback((deltaPx: number) => {
    if (focusActive) return // vertical resize doesn't apply in Focus mode
    const h = getPanelHeight()
    if (h <= 0) return
    setAiRatio(prev => clampRatio(prev + deltaPx / h, h))
    setExplicitMode(null)
  }, [focusActive, getPanelHeight])

  const startDrag = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragStartXRef.current = event.clientX
    dragStartYRef.current = event.clientY
    dragStartRatioRef.current = aiRatio
    axisCommittedRef.current = null
    setIsDragging(true)
  }, [aiRatio])

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStartXRef.current
      const dy = ev.clientY - dragStartYRef.current

      if (axisCommittedRef.current === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // Commit whichever axis moved further past the dead-zone.
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal commit only matters if the user is dragging LEFT
          // (positive direction = right; we want leftward = negative dx
          // → triggers Focus). Brief §4.3: "Dragging the tab to the left
          // pulls the AI zone out". Horizontal drag is disabled below
          // FOCUS_MIN_VIEWPORT.
          if (dx < 0 && focusEnabledAtViewport()) {
            axisCommittedRef.current = 'horizontal'
            setFocusActive(true)
            setExplicitMode('focus')
            setIsDragging(false) // Focus engaged; release the drag handle
            return
          }
          // Right-drag or no-focus-allowed → fall through to vertical.
          axisCommittedRef.current = 'vertical'
        } else {
          axisCommittedRef.current = 'vertical'
        }
      }

      if (axisCommittedRef.current === 'vertical') {
        if (focusActive) return // can't vertically resize a detached column
        const h = getPanelHeight()
        if (h <= 0) return
        const proposedRatio = dragStartRatioRef.current - dy / h
        setAiRatio(clampRatio(proposedRatio, h))
        setExplicitMode(null)
      }
    }
    const handleUp = () => setIsDragging(false)
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleUp)
    }
  }, [isDragging, focusActive, getPanelHeight])

  return {
    aiRatio,
    activeMode,
    isDragging,
    setMode,
    startDrag,
    adjustByPx,
  }
}

export { ARROW_KEY_RESIZE_PX }

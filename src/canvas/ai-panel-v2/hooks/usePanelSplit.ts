import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  ARROW_KEY_RESIZE_PX,
  COMPACT_AI_RATIO,
  CONVERSATION_AI_RATIO,
  MODE_THRESHOLDS,
} from '../constants'
import type { AIPanelMode } from '../constants'

// Vertical split between analysis (top) + AI zone (bottom). Owns:
//   • aiRatio          — current ratio (0..1), AI-zone height / panel height
//   • activeMode       — Compact/Conversation/Focus derived from ratio +
//                        explicit user clicks (free position outside
//                        threshold bands shows nearest mode)
//   • setMode          — click handler; jumps ratio to the preset
//   • startDrag        — pointer-down handler for the pull-tab drag region
//   • adjustByPx       — arrow-key support (brief §11.4)
//
// Drag uses pointer events on the document so dragging continues even when
// the pointer leaves the tab. Min-height clamping happens in pixels using
// the live panel height (passed via getPanelHeight ref) so the constraints
// remain meaningful across viewport sizes.

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
  // Free position — pick nearest preset by distance to its midpoint.
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
  if (minRatio > maxRatio) {
    // Panel too short for both minimums — give the AI zone its minimum
    // share and let the analysis zone shrink. The visible result is the AI
    // zone at exactly AI_ZONE_MIN_HEIGHT and analysis using whatever's left.
    return minRatio
  }
  return Math.min(maxRatio, Math.max(minRatio, ratio))
}

export function usePanelSplit({ getPanelHeight }: UsePanelSplitOptions): UsePanelSplitResult {
  const [aiRatio, setAiRatio] = useState(COMPACT_AI_RATIO)
  const [explicitMode, setExplicitMode] = useState<AIPanelMode | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Refs used inside pointer move/up handlers so the listeners stay stable.
  const dragStartYRef = useRef(0)
  const dragStartRatioRef = useRef(0)
  const axisCommittedRef = useRef<'vertical' | null>(null)

  const activeMode = useMemo(() => {
    // Explicit click "wins" only while the ratio still matches its band.
    // Once the user drags out of the band, the highlight follows the ratio.
    if (explicitMode === 'compact' && aiRatio >= MODE_THRESHOLDS.compact.min && aiRatio <= MODE_THRESHOLDS.compact.max) {
      return 'compact'
    }
    if (explicitMode === 'conversation' && aiRatio >= MODE_THRESHOLDS.conversation.min && aiRatio <= MODE_THRESHOLDS.conversation.max) {
      return 'conversation'
    }
    return deriveModeFromRatio(aiRatio)
  }, [aiRatio, explicitMode])

  const setMode = useCallback((mode: AIPanelMode) => {
    setExplicitMode(mode)
    if (mode === 'compact') {
      setAiRatio(clampRatio(COMPACT_AI_RATIO, getPanelHeight()))
    } else if (mode === 'conversation') {
      setAiRatio(clampRatio(CONVERSATION_AI_RATIO, getPanelHeight()))
    }
    // Focus mode does not modify the vertical split — it's handled by a
    // sibling layout in step 12.
  }, [getPanelHeight])

  const adjustByPx = useCallback((deltaPx: number) => {
    const h = getPanelHeight()
    if (h <= 0) return
    setAiRatio(prev => clampRatio(prev + deltaPx / h, h))
    setExplicitMode(null)
  }, [getPanelHeight])

  const startDrag = useCallback((event: React.PointerEvent) => {
    // Only primary mouse / touch — ignore right-clicks and stylus barrel taps.
    if (event.button !== 0) return
    event.preventDefault()
    dragStartYRef.current = event.clientY
    dragStartRatioRef.current = aiRatio
    axisCommittedRef.current = null
    setIsDragging(true)
  }, [aiRatio])

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (ev: PointerEvent) => {
      const h = getPanelHeight()
      if (h <= 0) return
      // Vertical drag: dragging tab DOWN expands the AI zone (its top moves
      // up). The pull-tab sits at the AI zone's top edge, so moving the
      // pointer up shrinks the AI zone (analysis grows) and vice versa.
      const dy = ev.clientY - dragStartYRef.current
      // Axis detection: vertical drags commit at >=8px movement. Horizontal
      // axis is reserved for step 12 (Focus mode).
      if (axisCommittedRef.current === null && Math.abs(dy) < 8) return
      axisCommittedRef.current = 'vertical'
      // Inverted because tab is at the AI zone's TOP edge.
      const proposedRatio = dragStartRatioRef.current - dy / h
      setAiRatio(clampRatio(proposedRatio, h))
      setExplicitMode(null)
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
  }, [isDragging, getPanelHeight])

  return {
    aiRatio,
    activeMode,
    isDragging,
    setMode,
    startDrag,
    adjustByPx,
  }
}

// Re-export for tests and arrow-key wiring outside the hook.
export { ARROW_KEY_RESIZE_PX }

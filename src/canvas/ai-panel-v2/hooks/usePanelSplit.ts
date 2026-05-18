import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  PRE_ANALYSIS_AI_RATIO,
  POST_ANALYSIS_AI_RATIO,
} from '../constants'

// Vertical split between analysis (top) + AI zone (bottom).
//
// Batch 2 redesign: this hook no longer owns "Compact / Conv / Focus"
// modes — the panel layout is state-led (pre-analysis vs post-analysis)
// and the user-facing controls are minimise + float, not three named
// modes. usePanelSplit's responsibility shrinks to:
//   • aiRatio          — current vertical ratio (0..1)
//   • isDragging       — true while a drag is in progress
//   • startDrag        — pointer-down on the AIHeaderStrip drag region
//   • adjustByPx       — ±N px arrow-key support
//   • setRatio         — programmatic ratio set (used when state
//                        changes from pre-analysis → post-analysis)
//
// Min heights are clamped from constants. Vertical drag adjusts the
// ratio live; arrow keys do ±ARROW_KEY_RESIZE_PX (handled by the
// AIHeaderStrip's drag separator). No axis detection, no Focus mode.

export interface UsePanelSplitOptions {
  /** Returns the panel's current pixel height. Read live during drag. */
  getPanelHeight: () => number
  /**
   * Initial ratio. Defaults to PRE_ANALYSIS_AI_RATIO. The Layout
   * computes the right default from canvas state and passes it in.
   */
  initialRatio?: number
}

export interface UsePanelSplitResult {
  aiRatio: number
  isDragging: boolean
  startDrag: (event: React.PointerEvent) => void
  adjustByPx: (deltaPx: number) => void
  setRatio: (ratio: number) => void
}

function clampRatio(ratio: number, panelHeightPx: number): number {
  if (panelHeightPx <= 0) return ratio
  const minRatio = AI_ZONE_MIN_HEIGHT / panelHeightPx
  const maxRatio = (panelHeightPx - ANALYSIS_ZONE_MIN_HEIGHT) / panelHeightPx
  if (minRatio > maxRatio) return minRatio
  return Math.min(maxRatio, Math.max(minRatio, ratio))
}

export function usePanelSplit({ getPanelHeight, initialRatio = PRE_ANALYSIS_AI_RATIO }: UsePanelSplitOptions): UsePanelSplitResult {
  const [aiRatio, setAiRatio] = useState(initialRatio)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartYRef = useRef(0)
  const dragStartRatioRef = useRef(0)

  const setRatio = useCallback((ratio: number) => {
    setAiRatio(clampRatio(ratio, getPanelHeight()))
  }, [getPanelHeight])

  const adjustByPx = useCallback((deltaPx: number) => {
    const h = getPanelHeight()
    if (h <= 0) return
    setAiRatio(prev => clampRatio(prev + deltaPx / h, h))
  }, [getPanelHeight])

  const startDrag = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragStartYRef.current = event.clientY
    dragStartRatioRef.current = aiRatio
    setIsDragging(true)
  }, [aiRatio])

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (ev: PointerEvent) => {
      const dy = ev.clientY - dragStartYRef.current
      const h = getPanelHeight()
      if (h <= 0) return
      // dy positive (cursor moved down) → AI zone shrinks, analysis grows.
      const proposedRatio = dragStartRatioRef.current - dy / h
      setAiRatio(clampRatio(proposedRatio, h))
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

  return useMemo(() => ({
    aiRatio,
    isDragging,
    startDrag,
    adjustByPx,
    setRatio,
  }), [aiRatio, isDragging, startDrag, adjustByPx, setRatio])
}

// Backward-compat: the brief calls "pre-analysis" State 2 and "post-
// analysis" State 3. Layout code maps a derived state into a preset ratio
// via this helper.
export function ratioForState(state: 'pre-analysis' | 'post-analysis'): number {
  return state === 'pre-analysis' ? PRE_ANALYSIS_AI_RATIO : POST_ANALYSIS_AI_RATIO
}

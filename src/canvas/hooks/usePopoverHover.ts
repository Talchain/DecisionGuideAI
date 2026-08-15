/**
 * usePopoverHover — shared hook for node popover behaviour.
 *
 * Hover (pointers with `hover: fine`): 300ms enter delay, 100ms leave delay.
 * The mouse can transition from node into popover without closing.
 *
 * Click / tap: toggles a PINNED popover that hover cannot close. Tapping or
 * clicking outside unpins it.
 *
 * ⚠ CHANGED 15 Aug 2026 (Paul's testing: "every hover-only affordance gets a
 * click/tap equivalent"). Two things were wrong before:
 *
 *  1. `onClick` early-returned unless `matchMedia('(hover: none)')` matched,
 *     so on a laptop the popover — which carries the node's Layer-2 detail —
 *     had NO click equivalent at all. It was reachable only by dwelling for
 *     300ms and holding the mouse still.
 *  2. Worse, `onClick` was never wired by ANY of the six node consumers
 *     (DecisionNode, OptionNode, FactorNode, RiskNode, GoalNode, OutcomeNode)
 *     — they each spread `onMouseEnter`/`onMouseLeave` by hand and dropped it.
 *     So the touch path the hook documented did not exist either: on a tablet
 *     the popover was unreachable full stop.
 *
 * The pinned/hover split is what makes a click equivalent actually usable: a
 * click-opened popover must survive the mouse leaving the node, or the click
 * is indistinguishable from the hover it was meant to replace.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

const ENTER_DELAY = 300
const LEAVE_DELAY = 100
/**
 * A pointer that travelled further than this between down and up was a drag
 * (node move / marquee), not a click. Without this guard every node drag in
 * select mode would toggle the popover on release.
 */
const CLICK_MOVEMENT_TOLERANCE_PX = 4

export function usePopoverHover() {
  const [hoverOpen, setHoverOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTouchRef = useRef(false)
  const nodeElRef = useRef<HTMLElement | null>(null)
  const pointerDownAtRef = useRef<{ x: number; y: number } | null>(null)

  const showPopover = pinned || hoverOpen

  useEffect(() => {
    if (typeof window !== 'undefined') {
      isTouchRef.current = window.matchMedia('(hover: none)').matches
    }
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  // Unpin when the next pointer gesture starts outside the node. Applies to
  // every pointer type now, not just touch — a pinned popover on a laptop
  // needs the same escape hatch a tapped one always had.
  useEffect(() => {
    if (!pinned) return
    const handler = (e: PointerEvent | MouseEvent) => {
      if (nodeElRef.current && !nodeElRef.current.contains(e.target as Node)) {
        setPinned(false)
      }
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [pinned])

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const cancelEnter = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = null
    }
  }, [])

  const onMouseEnter = useCallback(() => {
    if (isTouchRef.current) return
    cancelLeave()
    enterTimerRef.current = setTimeout(() => setHoverOpen(true), ENTER_DELAY)
  }, [cancelLeave])

  const onMouseLeave = useCallback(() => {
    if (isTouchRef.current) return
    cancelEnter()
    // Only the HOVER channel closes here. A pinned popover survives, which is
    // the whole point of the click equivalent.
    leaveTimerRef.current = setTimeout(() => setHoverOpen(false), LEAVE_DELAY)
  }, [cancelEnter])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownAtRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onClick = useCallback((e: React.MouseEvent) => {
    const start = pointerDownAtRef.current
    pointerDownAtRef.current = null
    // A drag that happens to end on the node is not a click.
    if (start) {
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (moved > CLICK_MOVEMENT_TOLERANCE_PX) return
    }
    if (isTouchRef.current) {
      // Touch keeps its historic behaviour: the tap is CONSUMED, so it does
      // not also select the node underneath.
      e.stopPropagation()
    }
    // Desktop deliberately does NOT stopPropagation — React Flow still gets
    // the click, so clicking a node continues to select it. The popover is an
    // addition to that gesture, not a replacement for it.
    cancelEnter()
    setPinned((prev) => !prev)
  }, [cancelEnter])

  // Keyboard parity: a focusable node wrapper gets the popover on focus and
  // loses it on blur. Inert on wrappers that are not focusable, so consumers
  // can wire them unconditionally.
  const onFocus = useCallback(() => {
    cancelLeave()
    setHoverOpen(true)
  }, [cancelLeave])

  const onBlur = useCallback(() => {
    cancelEnter()
    setHoverOpen(false)
    setPinned(false)
  }, [cancelEnter])

  const nodeHandlers = useMemo(
    () => ({ onMouseEnter, onMouseLeave, onPointerDown, onClick, onFocus, onBlur }),
    [onMouseEnter, onMouseLeave, onPointerDown, onClick, onFocus, onBlur],
  )

  const popoverHandlers = {
    onMouseEnter: useCallback(() => {
      cancelLeave()
    }, [cancelLeave]),

    onMouseLeave: useCallback(() => {
      leaveTimerRef.current = setTimeout(() => setHoverOpen(false), LEAVE_DELAY)
    }, []),
  }

  const close = useCallback(() => {
    setHoverOpen(false)
    setPinned(false)
  }, [])

  return { showPopover, nodeHandlers, popoverHandlers, close, nodeElRef }
}

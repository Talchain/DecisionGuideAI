/**
 * usePopoverHover — shared hook for node hover popover behaviour.
 *
 * Desktop (hover: fine): 300ms enter delay, 100ms leave delay.
 * Mouse can transition from node into popover without closing.
 * Touch (hover: none): tap node to toggle popover open/closed.
 * Tap elsewhere to close on touch devices.
 * Quick-action and card-metadata hover/focus take precedence over the node preview. This
 * prevents its tooltip from competing with the preview; Escape dismisses
 * the preview until the pointer leaves and re-enters the node.
 */
import { useState, useRef, useEffect, useCallback } from 'react'

const ENTER_DELAY = 300
const LEAVE_DELAY = 100

export function usePopoverHover() {
  const [showPopover, setShowPopover] = useState(false)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTouchRef = useRef(false)
  const nodeElRef = useRef<HTMLElement | null>(null)
  const pointerWithin = useRef(false)
  const actionHovered = useRef(false)
  const actionFocused = useRef(false)
  const dismissed = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      isTouchRef.current = window.matchMedia('(hover: none)').matches
    }
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  // Touch: close popover when tapping outside the node
  useEffect(() => {
    if (!showPopover || !isTouchRef.current) return
    const handler = (e: MouseEvent) => {
      if (nodeElRef.current && !nodeElRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [showPopover])

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

  const scheduleEnter = useCallback(() => {
    cancelEnter()
    if (actionHovered.current || actionFocused.current || dismissed.current) return
    enterTimerRef.current = setTimeout(() => {
      if (!actionHovered.current && !actionFocused.current && !dismissed.current) {
        setShowPopover(true)
      }
    }, ENTER_DELAY)
  }, [cancelEnter])

  useEffect(() => {
    const node = nodeElRef.current
    if (!node) return
    const isAction = (target: EventTarget | null) =>
      target instanceof Element && node.contains(target) &&
      !!target.closest('.node-quick-actions, [data-node-tooltip]')
    const update = () => {
      if (actionHovered.current || actionFocused.current) {
        cancelEnter()
        cancelLeave()
        setShowPopover(false)
      } else if (pointerWithin.current && !isTouchRef.current) {
        scheduleEnter()
      }
    }
    const over = (event: MouseEvent) => { actionHovered.current = isAction(event.target); update() }
    const out = (event: MouseEvent) => { actionHovered.current = isAction(event.relatedTarget); update() }
    const focus = (event: FocusEvent) => { actionFocused.current = isAction(event.target); update() }
    const blur = (event: FocusEvent) => { actionFocused.current = isAction(event.relatedTarget); update() }
    node.addEventListener('mouseover', over)
    node.addEventListener('mouseout', out)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', blur)
    return () => {
      node.removeEventListener('mouseover', over)
      node.removeEventListener('mouseout', out)
      node.removeEventListener('focusin', focus)
      node.removeEventListener('focusout', blur)
    }
  }, [cancelEnter, cancelLeave, scheduleEnter])

  useEffect(() => {
    if (!showPopover) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      dismissed.current = true
      cancelEnter()
      cancelLeave()
      setShowPopover(false)
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [showPopover, cancelEnter, cancelLeave])

  const nodeHandlers = {
    onMouseEnter: useCallback(() => {
      if (isTouchRef.current) return
      pointerWithin.current = true
      cancelLeave()
      scheduleEnter()
    }, [cancelLeave, scheduleEnter]),

    onMouseLeave: useCallback(() => {
      if (isTouchRef.current) return
      pointerWithin.current = false
      actionHovered.current = false
      dismissed.current = false
      cancelEnter()
      leaveTimerRef.current = setTimeout(() => setShowPopover(false), LEAVE_DELAY)
    }, [cancelEnter]),

    onClick: useCallback((e: React.MouseEvent) => {
      if (!isTouchRef.current) return
      e.stopPropagation()
      setShowPopover(prev => !prev)
    }, []),
  }

  const popoverHandlers = {
    onMouseEnter: useCallback(() => {
      cancelLeave()
    }, [cancelLeave]),

    onMouseLeave: useCallback(() => {
      leaveTimerRef.current = setTimeout(() => setShowPopover(false), LEAVE_DELAY)
    }, []),
  }

  const close = useCallback(() => setShowPopover(false), [])

  return { showPopover, nodeHandlers, popoverHandlers, close, nodeElRef }
}

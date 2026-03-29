/**
 * usePopoverHover — shared hook for node hover popover behaviour.
 *
 * Desktop (hover: fine): 300ms enter delay, 100ms leave delay.
 * Mouse can transition from node into popover without closing.
 * Touch (hover: none): tap node to toggle popover open/closed.
 * Tap elsewhere to close on touch devices.
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

  const nodeHandlers = {
    onMouseEnter: useCallback(() => {
      if (isTouchRef.current) return
      cancelLeave()
      enterTimerRef.current = setTimeout(() => setShowPopover(true), ENTER_DELAY)
    }, [cancelLeave]),

    onMouseLeave: useCallback(() => {
      if (isTouchRef.current) return
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

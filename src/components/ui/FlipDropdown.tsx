/**
 * FlipDropdown — viewport-aware anchored dropdown primitive.
 *
 * Renders children as a portalled `position: fixed` popover anchored above
 * or below an anchor element. Prefers upward placement (suits composer and
 * bottom-bar triggers). Flips to downward placement when there is not enough
 * room above the anchor for the content.
 *
 * DS v5 §27.3 z-index `popover: 400`. DS v5 §3.2 `bg-panel` background.
 *
 * Handles click-outside and Escape dismissal. Returns focus to the anchor on
 * Escape. Uses `createPortal` to escape stacking context of clipping parents.
 */

import { useCallback, useRef, useEffect, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode, RefObject } from 'react'

export interface FlipDropdownProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  /**
   * Horizontal alignment relative to the anchor.
   * 'right' pins the dropdown's right edge to the anchor's right edge.
   * 'left' pins the dropdown's left edge to the anchor's left edge.
   * Default: 'right'.
   */
  align?: 'left' | 'right'
  /** Gap (px) between anchor edge and dropdown edge along the flip axis. Default: 6. */
  offset?: number
  /**
   * Minimum room in px needed above the anchor to prefer upward placement.
   * If the measured content height exceeds the available space above,
   * FlipDropdown flips to render below the anchor.
   */
  minRoomForUpward?: number
  /** role attribute (menu|dialog|listbox). Default: 'menu'. */
  role?: string
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  testId?: string
}

type Placement = 'above' | 'below'

type Position =
  | { placement: 'above'; bottom: number; left?: number; right?: number }
  | { placement: 'below'; top: number; left?: number; right?: number }

export function FlipDropdown({
  isOpen,
  onClose,
  anchorRef,
  children,
  align = 'right',
  offset = 6,
  minRoomForUpward,
  role = 'menu',
  ariaLabel,
  className,
  style,
  testId,
}: FlipDropdownProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)

  // Position recomputation is shared across the initial layout effect and the
  // resize/scroll/ResizeObserver listeners registered below.
  const updatePosition = useCallback(() => {
    if (!anchorRef.current || !popoverRef.current) return
    const anchorRect = anchorRef.current.getBoundingClientRect()
    const contentHeight = popoverRef.current.offsetHeight || 0
    const required = minRoomForUpward ?? contentHeight + offset
    const roomAbove = anchorRect.top
    const roomBelow = window.innerHeight - anchorRect.bottom

    // Prefer upward placement; flip to downward when insufficient room above
    // AND the below space can hold it.
    const placement: Placement =
      roomAbove >= required || roomBelow < required ? 'above' : 'below'

    const horizontal = align === 'right'
      ? { right: Math.max(0, window.innerWidth - anchorRect.right) }
      : { left: Math.max(0, anchorRect.left) }

    if (placement === 'above') {
      setPos({
        placement,
        bottom: window.innerHeight - anchorRect.top + offset,
        ...horizontal,
      })
    } else {
      setPos({
        placement,
        top: anchorRect.bottom + offset,
        ...horizontal,
      })
    }
  }, [anchorRef, align, offset, minRoomForUpward])

  // Initial placement + placement on prop changes.
  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
  }, [isOpen, updatePosition])

  // Recompute on viewport resize, scroll (capture so parent-container scrolls
  // are caught), and content-size changes via ResizeObserver. Without these
  // the dropdown can drift off-screen when the anchor moves after open.
  useEffect(() => {
    if (!isOpen) return
    const onResize = () => updatePosition()
    const onScroll = () => updatePosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && popoverRef.current) {
      ro = new ResizeObserver(() => updatePosition())
      ro.observe(popoverRef.current)
    }

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      ro?.disconnect()
    }
  }, [isOpen, updatePosition])

  // Click-outside and Escape handlers.
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        anchorRef.current?.focus()
      }
    }
    // Defer mousedown listener by a tick so the opening click doesn't
    // immediately dismiss.
    const tid = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    document.addEventListener('keydown', handleEsc)
    return () => {
      clearTimeout(tid)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  // When position is pending (first paint) render off-screen with opacity 0 so
  // the element is still present in the accessibility tree for querying by
  // role, but not visually flashed in the wrong place.
  const baseStyle: CSSProperties = {
    position: 'fixed',
    zIndex: 400,
    ...(pos?.placement === 'above'
      ? { bottom: pos.bottom, left: pos.left, right: pos.right }
      : pos?.placement === 'below'
        ? { top: pos.top, left: pos.left, right: pos.right }
        : { top: 0, left: 0, opacity: 0, pointerEvents: 'none' }),
    ...style,
  }

  return createPortal(
    <div
      ref={popoverRef}
      role={role}
      aria-label={ariaLabel}
      className={className}
      style={baseStyle}
      data-placement={pos?.placement ?? 'pending'}
      data-testid={testId}
    >
      {children}
    </div>,
    document.body,
  )
}

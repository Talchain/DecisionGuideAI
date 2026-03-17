/**
 * MenuTooltip — tooltip for context menu items.
 *
 * 300ms delay, positioned right of the item (or left if near viewport edge).
 * DS v4 compliant: bg-surface, shadow-1, panelMeta font, text-text-light.
 */

import { useEffect, useRef, useState } from 'react'
import { typography } from '../../styles/typography'

interface MenuTooltipProps {
  id?: string
  text: string
  anchorRect: DOMRect | null
  visible: boolean
}

export function MenuTooltip({ id, text, anchorRect, visible }: MenuTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  useEffect(() => {
    if (!visible || !anchorRect) return
    const tooltip = tooltipRef.current
    if (!tooltip) return

    const rect = tooltip.getBoundingClientRect()
    let left = anchorRect.right + 8
    let top = anchorRect.top

    // Flip left if would overflow viewport
    if (left + rect.width > window.innerWidth) {
      left = anchorRect.left - rect.width - 8
    }
    // Flip up if would overflow viewport
    if (top + rect.height > window.innerHeight) {
      top = window.innerHeight - rect.height - 8
    }

    setPosition({ left, top })
  }, [visible, anchorRect])

  if (!visible || !text) return null

  return (
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      className={`fixed z-[101] max-w-[240px] rounded-lg bg-surface px-2.5 py-1.5 shadow-1 ${typography.panelMeta} text-text-light pointer-events-none`}
      style={{ left: position.left, top: position.top }}
    >
      {text}
    </div>
  )
}

/**
 * Hook to manage tooltip delay (300ms show, instant hide).
 */
export function useTooltipDelay(delay = 300) {
  const [activeTooltip, setActiveTooltip] = useState<{ text: string; rect: DOMRect; itemId?: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTooltip = (text: string, element: HTMLElement, itemId?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setActiveTooltip({ text, rect: element.getBoundingClientRect(), itemId })
    }, delay)
  }

  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setActiveTooltip(null)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { activeTooltip, showTooltip, hideTooltip }
}

/**
 * Submenu — flyout panel for context menu submenus.
 *
 * Opens to the right of the parent item (flips left on viewport overflow).
 * 150ms open delay, 200ms close delay. Same styling as parent menu.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { typography } from '../../styles/typography'
import { isDivider, isMenuItem, type MenuEntry, type MenuItemDef } from './types'
import { CANVAS_LAYER_CLASS } from '../layers'

interface SubmenuProps {
  items: MenuEntry[]
  anchorRect: DOMRect | null
  onClose: () => void
  onShowTooltip?: (text: string, el: HTMLElement) => void
  onHideTooltip?: () => void
}

interface SubmenuPosition {
  left: number
  top: number
  maxWidth: number
  maxHeight: number
}

/** The anchor spans the parent panel horizontally and the trigger row vertically. */
export function getSubmenuPosition(
  anchor: Pick<DOMRect, 'left' | 'right' | 'top'>,
  size: Pick<DOMRect, 'width' | 'height'>,
  viewport: { width: number; height: number },
): SubmenuPosition {
  const gap = 2
  const margin = 8
  const rightSpace = Math.max(0, viewport.width - margin - anchor.right - gap)
  const leftSpace = Math.max(0, anchor.left - gap - margin)
  // Prefer a full-width flyout on the right, then the left. If neither side
  // fits, constrain it to the wider side rather than moving over the parent.
  const opensRight = size.width <= rightSpace
    || (size.width > leftSpace && rightSpace >= leftSpace)
  const maxWidth = Math.min(320, opensRight ? rightSpace : leftSpace)
  const width = Math.min(size.width, maxWidth)
  const maxHeight = Math.max(0, viewport.height - margin * 2)
  const height = Math.min(size.height, maxHeight)

  return {
    left: Math.max(margin, Math.min(
      viewport.width - width - margin,
      opensRight ? anchor.right + gap : anchor.left - width - gap,
    )),
    top: Math.max(margin, Math.min(anchor.top, viewport.height - height - margin)),
    maxWidth,
    maxHeight,
  }
}

export function Submenu({ items, anchorRect, onClose, onShowTooltip, onHideTooltip }: SubmenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<SubmenuPosition>({
    left: 0, top: 0, maxWidth: 320, maxHeight: window.innerHeight - 16,
  })
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const actionableItems = items.filter(isMenuItem)

  // Re-measure after constraining the width: wrapped labels can change height.
  useLayoutEffect(() => {
    if (!anchorRect || !menuRef.current) return
    const updatePosition = () => {
      if (!menuRef.current) return
      setPosition(getSubmenuPosition(anchorRect, menuRef.current.getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight,
      }))
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [anchorRect, position.maxWidth, position.maxHeight])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((p) => Math.min(p + 1, actionableItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((p) => Math.max(p - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const item = actionableItems[focusedIndex]
      if (item?.enabled) item.action()
    } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [focusedIndex, actionableItems, onClose])

  let actionIdx = -1

  // A9 — same defect and fix as the parent menu (`CanvasContextMenu.tsx`):
  // `position: fixed` at a z-index (101) below `OutputsDock`'s 900 sat under
  // the dock for any submenu opened near it. Portalled to `document.body` so
  // it is not left relying on always being rendered inside the parent menu's
  // own portal, and raised above the dock.
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={`fixed ${CANVAS_LAYER_CLASS.submenu} min-w-[180px] max-w-[320px] rounded-md border border-panel-border bg-panel py-2 shadow-2`}
      style={{
        ...position,
        minWidth: Math.min(180, position.maxWidth),
        overflowY: 'auto',
      }}
      onKeyDown={handleKeyDown}
    >
      {items.map((entry, i) => {
        if (isDivider(entry)) {
          return <div key={i} role="separator" className="mx-2 my-2 border-t border-panel-border/50" />
        }

        actionIdx++
        const currentIdx = actionIdx
        const item = entry as MenuItemDef
        const isFocused = currentIdx === focusedIndex

        return (
          <button
            key={item.id}
            role="menuitem"
            aria-disabled={!item.enabled || undefined}
            tabIndex={isFocused ? 0 : -1}
            onClick={() => item.enabled && item.action()}
            onMouseEnter={(e) => {
              setFocusedIndex(currentIdx)
              if (item.tooltip) onShowTooltip?.(item.tooltip, e.currentTarget)
            }}
            onMouseLeave={() => onHideTooltip?.()}
            className={`group flex h-9 w-full items-center gap-2 px-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset ${typography.panelBody} transition-colors ${
              !item.enabled
                ? 'cursor-not-allowed text-text-light opacity-50'
                : item.destructive && isFocused
                  ? 'cursor-pointer bg-panel-hover text-danger'
                  : isFocused
                    ? 'cursor-pointer bg-panel-hover text-text-body'
                    : 'cursor-pointer text-text-body hover:bg-panel-hover'
            }`}
          >
            {/* Glyph (for Add node submenu) — symbol font stack for cross-platform rendering */}
            {item.glyph && (
              <span
                className={`inline-flex w-4 items-center justify-center text-sm ${item.glyphColor ?? 'text-text-light'}`}
                style={{ fontFamily: "'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif" }}
              >
                {item.glyph}
              </span>
            )}
            {/* Icon (Lucide) */}
            {!item.glyph && item.icon && (
              <item.icon
                size={16}
                className={`shrink-0 ${
                  item.glyphColor
                    ? item.glyphColor
                    : isFocused ? 'text-text-body' : 'text-text-light group-hover:text-text-body'
                }`}
              />
            )}
            <span className="flex-1 text-left">{item.label}</span>
            {item.disabledReason && !item.enabled && (
              <span className={`${typography.panelMeta} text-text-light`}>({item.disabledReason})</span>
            )}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

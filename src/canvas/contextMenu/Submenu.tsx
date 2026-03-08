/**
 * Submenu — flyout panel for context menu submenus.
 *
 * Opens to the right of the parent item (flips left on viewport overflow).
 * 150ms open delay, 200ms close delay. Same styling as parent menu.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { isDivider, isMenuItem, type MenuEntry, type MenuItemDef } from './types'

interface SubmenuProps {
  items: MenuEntry[]
  anchorRect: DOMRect | null
  onClose: () => void
  onShowTooltip?: (text: string, el: HTMLElement) => void
  onHideTooltip?: () => void
}

export function Submenu({ items, anchorRect, onClose, onShowTooltip, onHideTooltip }: SubmenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const actionableItems = items.filter(isMenuItem)

  useEffect(() => {
    if (!anchorRect || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    let left = anchorRect.right + 2
    let top = anchorRect.top

    // Flip left if would overflow
    if (left + rect.width > window.innerWidth) {
      left = anchorRect.left - rect.width - 2
    }
    // Adjust vertical if overflow
    if (top + rect.height > window.innerHeight) {
      top = Math.max(8, window.innerHeight - rect.height - 8)
    }

    setPosition({ left, top })
  }, [anchorRect])

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

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[101] min-w-[180px] max-w-[320px] rounded-xl border border-panel-border bg-panel py-2 shadow-2"
      style={{ left: position.left, top: position.top }}
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
    </div>
  )
}

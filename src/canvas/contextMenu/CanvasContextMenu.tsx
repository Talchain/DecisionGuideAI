/**
 * CanvasContextMenu — context-sensitive right-click menu.
 *
 * Replaces the old ContextMenu.tsx with DS v4 compliance, Lucide icons,
 * submenu mechanics, keyboard navigation, and tooltips.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useShowToast } from '../ToastContext'
import { useMenuItems } from './useMenuItems'
import { Submenu } from './Submenu'
import { MenuTooltip, useTooltipDelay } from './MenuTooltip'
import { isDivider, isMenuItem, type ContextTarget, type MenuItemDef, type MenuEntry } from './types'
import { SetValuePopover } from './SetValuePopover'
import { setValueCustom } from './actions'

interface CanvasContextMenuProps {
  target: ContextTarget
  onClose: () => void
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }
}

export function CanvasContextMenu({ target, onClose, screenToFlowPosition }: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const showToast = useShowToast()
  const [position, setPosition] = useState(target.screenPos)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)
  const [submenuAnchorRect, setSubmenuAnchorRect] = useState<DOMRect | null>(null)
  const submenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeSubmenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [customValueNodeId, setCustomValueNodeId] = useState<string | null>(null)

  const { activeTooltip, showTooltip, hideTooltip } = useTooltipDelay(300)

  const handleOpenCustomValue = useCallback((nodeId: string) => {
    setCustomValueNodeId(nodeId)
  }, [])

  const items = useMenuItems({
    target,
    showToast,
    screenToFlowPosition,
    onClose,
    onOpenCustomValue: handleOpenCustomValue,
  })

  const actionableItems = items.filter(isMenuItem)

  // Adjust position if menu would overflow viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    let x = target.screenPos.x
    let y = target.screenPos.y

    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8
    if (x < 0) x = 8
    if (y < 0) y = 8

    setPosition({ x, y })
  }, [target.screenPos])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (openSubmenuId) {
        // Let submenu handle its own keys; Escape bubbles up
        if (e.key === 'Escape') {
          e.preventDefault()
          setOpenSubmenuId(null)
          return
        }
        return
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((p) => Math.min(p + 1, actionableItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((p) => Math.max(p - 1, 0))
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const item = actionableItems[focusedIndex]
          if (!item?.enabled) break
          if (item.hasSubmenu) {
            setOpenSubmenuId(item.id)
          } else {
            item.action()
          }
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          const item = actionableItems[focusedIndex]
          if (item?.hasSubmenu && item.enabled) {
            setOpenSubmenuId(item.id)
          }
          break
        }
        case 'ArrowLeft':
          e.preventDefault()
          if (openSubmenuId) setOpenSubmenuId(null)
          break
        case 'Tab':
          e.preventDefault()
          setFocusedIndex((p) => (p + 1) % actionableItems.length)
          break
      }
    },
    [actionableItems, focusedIndex, onClose, openSubmenuId],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Cleanup submenu timers
  useEffect(() => {
    return () => {
      if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current)
      if (closeSubmenuTimerRef.current) clearTimeout(closeSubmenuTimerRef.current)
    }
  }, [])

  const handleSubmenuHoverEnter = (itemId: string, el: HTMLElement) => {
    if (closeSubmenuTimerRef.current) {
      clearTimeout(closeSubmenuTimerRef.current)
      closeSubmenuTimerRef.current = null
    }
    if (openSubmenuId === itemId) {
      hideTooltip() // Submenu already open — suppress tooltip on re-entry
      return
    }
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current)
    submenuTimerRef.current = setTimeout(() => {
      hideTooltip() // Cancel tooltip before submenu opens (prevents overlap)
      setOpenSubmenuId(itemId)
      setSubmenuAnchorRect(el.getBoundingClientRect())
    }, 150)
  }

  const handleSubmenuHoverLeave = () => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current)
      submenuTimerRef.current = null
    }
    closeSubmenuTimerRef.current = setTimeout(() => {
      setOpenSubmenuId(null)
    }, 200)
  }

  const handleSubmenuMouseEnter = () => {
    if (closeSubmenuTimerRef.current) {
      clearTimeout(closeSubmenuTimerRef.current)
      closeSubmenuTimerRef.current = null
    }
  }

  let actionIdx = -1

  // When custom value popover is open, hide menu but keep component mounted
  if (customValueNodeId) {
    return (
      <SetValuePopover
        nodeId={customValueNodeId}
        anchorPos={target.screenPos}
        onConfirm={(nodeId, value) => {
          void setValueCustom(nodeId, value, showToast)
        }}
        onClose={() => { setCustomValueNodeId(null); onClose() }}
      />
    )
  }

  return (
    <>
      {/* Invisible backdrop catches all outside clicks/right-clicks to dismiss menu */}
      <div
        role="presentation"
        className="fixed inset-0 z-[99]"
        onMouseDown={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Canvas context menu"
        className="fixed z-[100] min-w-[220px] max-w-[320px] rounded-xl border border-panel-border bg-panel py-2 shadow-2"
        style={{ left: position.x, top: position.y }}
      >
        {items.map((entry, i) => {
          if (isDivider(entry)) {
            return <div key={i} role="separator" className="mx-2 my-2 border-t border-panel-border/50" />
          }

          actionIdx++
          const currentIdx = actionIdx
          const item = entry as MenuItemDef
          const isFocused = currentIdx === focusedIndex
          const isSubmenuOpen = openSubmenuId === item.id

          return (
            <button
              key={item.id}
              role="menuitem"
              aria-disabled={!item.enabled || undefined}
              aria-haspopup={item.hasSubmenu ? 'menu' : undefined}
              aria-expanded={item.hasSubmenu ? isSubmenuOpen : undefined}
              aria-describedby={
                activeTooltip?.itemId === item.id ? `tooltip-${item.id}` : undefined
              }
              tabIndex={isFocused ? 0 : -1}
              onClick={() => {
                if (!item.enabled) return
                if (item.hasSubmenu) {
                  setOpenSubmenuId(isSubmenuOpen ? null : item.id)
                  return
                }
                item.action()
              }}
              onMouseEnter={(e) => {
                setFocusedIndex(currentIdx)
                // Always start tooltip timer — submenu open (150ms) cancels it before it fires (300ms)
                if (item.tooltip) showTooltip(item.tooltip, e.currentTarget, item.id)
                if (item.hasSubmenu && item.enabled) {
                  handleSubmenuHoverEnter(item.id, e.currentTarget)
                } else {
                  // Close any open submenu when hovering a non-submenu item
                  handleSubmenuHoverLeave()
                }
              }}
              onMouseLeave={() => {
                hideTooltip()
                if (item.hasSubmenu) handleSubmenuHoverLeave()
              }}
              className={`group flex h-9 w-full items-center justify-between gap-2 px-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset ${typography.panelBody} transition-colors ${
                !item.enabled
                  ? 'cursor-not-allowed text-text-light opacity-50'
                  : item.destructive && isFocused
                    ? 'cursor-pointer bg-panel-hover text-danger'
                    : isFocused
                      ? 'cursor-pointer bg-panel-hover text-text-body'
                      : 'cursor-pointer text-text-body hover:bg-panel-hover'
              }`}
            >
              <span className="flex items-center gap-2">
                {/* Glyph (Add node shape) — symbol font stack for cross-platform rendering */}
                {item.glyph && (
                  <span
                    className={`inline-flex w-4 items-center justify-center text-sm ${item.glyphColor ?? 'text-text-light'}`}
                    style={{ fontFamily: "'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif" }}
                  >
                    {item.glyph}
                  </span>
                )}
                {/* Lucide icon */}
                {!item.glyph && item.icon && (
                  <item.icon
                    size={16}
                    className={`shrink-0 ${
                      item.id.startsWith('ask-ai')
                        ? 'text-info'
                        : isFocused
                          ? 'text-text-body'
                          : 'text-text-light group-hover:text-text-body'
                    }`}
                  />
                )}
                <span>{item.label}</span>
              </span>
              {item.hasSubmenu ? (
                <ChevronRight size={14} className="text-text-light" />
              ) : item.shortcut ? (
                <span className={`${typography.panelMeta} text-text-light`}>{item.shortcut}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Active submenu */}
      {openSubmenuId && (() => {
        const parentItem = actionableItems.find((i) => i.id === openSubmenuId)
        if (!parentItem?.submenuItems) return null
        return (
          <div
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuHoverLeave}
          >
            <Submenu
              items={parentItem.submenuItems}
              anchorRect={submenuAnchorRect}
              onClose={() => setOpenSubmenuId(null)}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
            />
          </div>
        )
      })()}

      {/* Tooltip */}
      <MenuTooltip
        id={activeTooltip?.itemId ? `tooltip-${activeTooltip.itemId}` : undefined}
        text={activeTooltip?.text ?? ''}
        anchorRect={activeTooltip?.rect ?? null}
        visible={!!activeTooltip}
      />

    </>
  )
}

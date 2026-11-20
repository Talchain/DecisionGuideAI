/**
 * CanvasContextMenu — context-sensitive right-click menu.
 *
 * Replaces the old ContextMenu.tsx with DS v4 compliance, Lucide icons,
 * submenu mechanics, keyboard navigation, and tooltips.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { OkIcon } from '../../olumiView/look/icons'
import { typography } from '../../styles/typography'
import { useShowToast } from '../ToastContext'
import { useMenuItems } from './useMenuItems'
import { Submenu } from './Submenu'
import { MenuTooltip } from './MenuTooltip'
import { Tip, TIP_DELAY, focusRing, rowTipOf, useTipDelay, useTipDismissOnMove } from '../../olumiView/look/Tip'
import { menuLook } from '../../olumiView/look/menu'
import { isDivider, isMenuItem, type ContextTarget, type MenuItemDef, type MenuEntry } from './types'
import { SetValuePopover } from './SetValuePopover'
import { setValueCustom, type FactorValueWriter } from './actions'
import { useModelEditAuthority } from '../hooks/useModelEditAuthority'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { CardMenuHeader } from '../../olumiView/v12/chat/CardMenuHeader'
import { CANVAS_LAYER_CLASS } from '../layers'

export interface CanvasContextMenuProps {
  target: ContextTarget
  onClose: () => void
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }
  /** The mode the canvas is ACTUALLY in (`effectiveMode`), not the raw stored value. */
  interactionMode?: 'select' | 'hand'
  /** Omitted by hosts with no mode to switch; the menu row is then absent. */
  onSetInteractionMode?: (mode: 'select' | 'hand') => void
}

/** What a menu's items hook hands the shared menu: the rows, and (the lane only) a small edit form that stands in for the menu while it is open. */
export interface MenuItemsOptions {
  target: ContextTarget
  showToast: ReturnType<typeof useShowToast>
  screenToFlowPosition: CanvasContextMenuProps['screenToFlowPosition']
  onClose: () => void
  onOpenCustomValue: (nodeId: string) => void
  factorValueWriter: FactorValueWriter | undefined
  interactionMode?: 'select' | 'hand'
  onSetInteractionMode?: (mode: 'select' | 'hand') => void
}
export type MenuItemsHook = (o: MenuItemsOptions) => { items: MenuEntry[]; overlay: ReactNode | null }
/** The previous product's rows (the legacy canvas). Never swapped for another hook in a mounted menu. */
const useLegacyItems: MenuItemsHook = (o) => ({ items: useMenuItems(o), overlay: null })

// V12 manual editing: on the olumi-core lane the menu is the lane's own (laneMenu.ts), every edit row a real core route through one small form.
// It is loaded only there, so the legacy canvas (and its specs) never import it.
const LaneContextMenu = lazy(() => import('./LaneContextMenu'))

export function CanvasContextMenu(props: CanvasContextMenuProps) {
  if (isOlumiCoreLane()) return <Suspense fallback={null}><LaneContextMenu {...props} /></Suspense>
  return <CanvasContextMenuBase {...props} useItems={useLegacyItems} />
}

export function CanvasContextMenuBase({
  target,
  onClose,
  screenToFlowPosition,
  interactionMode,
  onSetInteractionMode,
  useItems,
}: CanvasContextMenuProps & { useItems: MenuItemsHook }) {
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuTriggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const showToast = useShowToast()
  const [position, setPosition] = useState(target.screenPos)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)
  const [submenuAnchorRect, setSubmenuAnchorRect] = useState<DOMRect | null>(null)
  const submenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeSubmenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [customValueNodeId, setCustomValueNodeId] = useState<string | null>(null)

  // The lane wears the one menu shell and the one Tip (surfaces step B); the older look keeps its own box, row and tooltip.
  const lane = isOlumiCoreLane(), look = menuLook(lane)
  // The lane's hover is the one 150 ms hover; the older look keeps its own 300 ms.
  const { activeTooltip, showTooltip, hideTooltip } = useTipDelay(lane ? TIP_DELAY : 300)
  // The saved anchor is measured once: a scroll or a resize closes the tip rather than leave it detached (the same rule as every other Tip).
  useTipDismissOnMove(activeTooltip !== null, hideTooltip)
  /** A row's tip words, or null. On the lane a label the row cut is said whole first; an enabled submenu row starts no tip (its submenu opens at the same 150 ms and would cancel it). */
  // The menu's focus is virtual (the arrows move `focusedIndex`, not DOM focus), so a key move opens the row's tip through the same one timer; a pointer move does not (its own enter does).
  const keyMoved = useRef(false)
  const rowTip = (row: HTMLElement, item: MenuItemDef): string | null => {
    const tip = lane ? rowTipOf(row, item.label, item.tooltip) : item.tooltip || null
    return tip !== null && !(lane && item.hasSubmenu && item.enabled) ? tip : null
  }

  /**
   * ⭐⭐ THE CARD'S WRITER, KEYED TO THIS MENU'S NODE — the one path a value set
   * here may take. `FactorNode` commits its inline editor through
   * `useModelEditAuthority(props.id).proposeFactorValue`; this is the same hook,
   * keyed the same way, so Set value ▸ Best / Worst / Custom and the card are
   * one writer (`factor_value_edit`: provenance, CEE's receipt, the revert, the
   * edit-delivery hold), not two. A hook cannot be called from the action
   * functions, so the host owns it — the Model tab's pattern for the same hook.
   *
   * ⚠ RESIDUAL, STATED: with no conversation panel mounted the writer's outcome
   * is `'local_only'`, exactly as it is for the card; the action says so.
   */
  const authorityNodeId = target.kind === 'node' ? target.nodeId : null
  const { proposeFactorValue } = useModelEditAuthority(authorityNodeId)
  const factorValueWriter = useMemo<FactorValueWriter | undefined>(
    () => (authorityNodeId ? { nodeId: authorityNodeId, propose: proposeFactorValue } : undefined),
    [authorityNodeId, proposeFactorValue],
  )

  const handleOpenCustomValue = useCallback((nodeId: string) => {
    setCustomValueNodeId(nodeId)
  }, [])

  const { items, overlay } = useItems({
    target,
    showToast,
    screenToFlowPosition,
    onClose,
    onOpenCustomValue: handleOpenCustomValue,
    factorValueWriter,
    interactionMode,
    onSetInteractionMode,
  })

  const actionableItems = items.filter(isMenuItem)
  // The blank 16px inset keeps words aligned only in a menu where some row draws an icon or glyph; a menu with none has no gap to hold.
  const anyIconRow = actionableItems.some((it) => Boolean(it.glyph) || it.iconId !== undefined || Boolean(it.icon))

  const openSubmenu = useCallback((itemId: string, trigger: HTMLElement | undefined) => {
    if (!trigger || !menuRef.current) return
    const parentRect = menuRef.current.getBoundingClientRect()
    const itemRect = trigger.getBoundingClientRect()
    // Use the whole panel for left/right bounds, and the chosen row for top
    // alignment. Click, keyboard and hover must all measure the same anchor.
    setSubmenuAnchorRect(new DOMRect(parentRect.left, itemRect.top, parentRect.width, itemRect.height))
    setOpenSubmenuId(itemId)
  }, [])

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
      // The lane's edit form owns the keys while it is open (a space or an Enter typed in it is its own).
      if (overlay !== null) return
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
          keyMoved.current = true
          setFocusedIndex((p) => Math.min(p + 1, actionableItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          keyMoved.current = true
          setFocusedIndex((p) => Math.max(p - 1, 0))
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const item = actionableItems[focusedIndex]
          if (!item?.enabled) break
          if (item.hasSubmenu) {
            openSubmenu(item.id, submenuTriggerRefs.current.get(item.id))
          } else {
            item.action()
          }
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          const item = actionableItems[focusedIndex]
          if (item?.hasSubmenu && item.enabled) {
            openSubmenu(item.id, submenuTriggerRefs.current.get(item.id))
          }
          break
        }
        case 'ArrowLeft':
          e.preventDefault()
          if (openSubmenuId) setOpenSubmenuId(null)
          break
        case 'Tab':
          e.preventDefault()
          keyMoved.current = true
          setFocusedIndex((p) => (p + 1) % actionableItems.length)
          break
      }
    },
    [actionableItems, focusedIndex, onClose, openSubmenuId, openSubmenu, overlay],
  )

  useEffect(() => {
    if (!keyMoved.current) return
    const item = actionableItems[focusedIndex]
    const row = item === undefined ? undefined : submenuTriggerRefs.current.get(item.id)
    const tip = item !== undefined && row !== undefined ? rowTip(row, item) : null
    // The old row's tip goes at once when the focus moves on; the new row's opens after the one delay.
    hideTooltip()
    if (tip !== null && item !== undefined && row !== undefined) showTooltip(tip, row, item.id)
  }, [focusedIndex])  // eslint-disable-line react-hooks/exhaustive-deps -- runs on a key move only; the helpers are per-render closures over the same state

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
      openSubmenu(itemId, el)
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
  //
  // A9 — portalled to `document.body`, same reason as the menu below: a
  // `position: fixed` descendant still stacks UNDER any ancestor-independent
  // element with a higher z-index (measured: the 900 dock over this control's
  // undocumented z-101), and `NodePopover.tsx`'s own header names the fix for
  // exactly this class of control — "Renders via createPortal to escape
  // ReactFlow's stacking context."
  if (overlay !== null) return <>{overlay}</>
  if (customValueNodeId) {
    return createPortal(
      <SetValuePopover
        nodeId={customValueNodeId}
        anchorPos={target.screenPos}
        onConfirm={(nodeId, value) => setValueCustom(nodeId, value, factorValueWriter, showToast)}
        onClose={() => { setCustomValueNodeId(null); onClose() }}
      />,
      document.body,
    )
  }

  // A9 — THE DEFECT, MEASURED. `CanvasContextMenu` and `Submenu` both render
  // `position: fixed` at z-100/101, siblings in the DOM to `OutputsDock`'s
  // `position: fixed; z-index: 900` aside. Stacking order is decided by
  // z-index alone once both are `fixed`, independent of DOM nesting order —
  // so for any card near the dock, the dock painted OVER the menu and its
  // submenu, and every click on "Explain", "Challenge" or "Trace" landed on
  // the dock instead. Portalling to `document.body` is not what fixes the
  // stacking order (z-index alone does that); it is what keeps this control
  // in the SAME stacking context as the dock rather than nested inside some
  // future ReactFlow-transformed ancestor, matching the established pattern
  // (`NodePopover.tsx`) for every other floating control this canvas has.
  return createPortal(
    <>
      {/* Invisible backdrop catches all outside clicks/right-clicks to dismiss menu */}
      <div
        role="presentation"
        // A9 — above OutputsDock's `zIndex: 900` aside, so the backdrop
        // actually catches a click made through where the dock paints.
        className={`fixed inset-0 ${CANVAS_LAYER_CLASS.contextMenuBackdrop}`}
        onMouseDown={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Canvas context menu"
        className={`fixed ${CANVAS_LAYER_CLASS.contextMenu} min-w-[220px] max-w-[320px] ${look.shell}`}
        style={{ left: position.x, top: position.y }}
      >
        {isOlumiCoreLane() && target.kind === 'node' ? <CardMenuHeader nodeId={target.nodeId} /> : null}
        {items.map((entry, i) => {
          if (isDivider(entry)) {
            return <div key={i} role="separator" className={look.separator} />
          }

          actionIdx++
          const currentIdx = actionIdx
          const item = entry as MenuItemDef
          const isFocused = currentIdx === focusedIndex
          const isSubmenuOpen = openSubmenuId === item.id

          return (
            <button
              key={item.id}
              ref={element => {
                if (element) submenuTriggerRefs.current.set(item.id, element)
                else submenuTriggerRefs.current.delete(item.id)
              }}
              role="menuitem"
              aria-disabled={!item.enabled || undefined}
              aria-haspopup={item.hasSubmenu ? 'menu' : undefined}
              aria-expanded={item.hasSubmenu ? isSubmenuOpen : undefined}
              aria-describedby={
                activeTooltip?.itemId === item.id ? `tooltip-${item.id}` : undefined
              }
              tabIndex={isFocused ? 0 : -1}
              onClick={(event) => {
                if (!item.enabled) return
                if (item.hasSubmenu) {
                  if (isSubmenuOpen) setOpenSubmenuId(null)
                  else openSubmenu(item.id, event.currentTarget)
                  return
                }
                item.action()
              }}
              onMouseEnter={(e) => {
                keyMoved.current = false
                setFocusedIndex(currentIdx)
                // Older look: start the tooltip timer — submenu open (150ms) cancels it before it fires (300ms)
                // (Surfaces step B, the lane: a label the row cut is said whole in the same tip, before the row's own note.)
                const tip = rowTip(e.currentTarget, item)
                if (tip !== null) showTooltip(tip, e.currentTarget, item.id)
                if (item.hasSubmenu && item.enabled) {
                  handleSubmenuHoverEnter(item.id, e.currentTarget)
                } else {
                  // Close any open submenu when hovering a non-submenu item
                  handleSubmenuHoverLeave()
                }
              }}
              // Keyboard focus (a focus ring, not a mouse press) opens the same tip through the same one timer; blur cancels it.
              onFocus={(e) => {
                if (!focusRing(e)) return
                const tip = rowTip(e.currentTarget, item)
                if (tip !== null) showTooltip(tip, e.currentTarget, item.id)
              }}
              onBlur={() => hideTooltip()}
              onMouseLeave={() => {
                hideTooltip()
                if (item.hasSubmenu) handleSubmenuHoverLeave()
              }}
              className={`group flex ${look.row} w-full items-center justify-between gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset transition-colors ${
                !item.enabled
                  ? 'cursor-not-allowed text-text-light opacity-50'
                  : item.destructive && isFocused
                    ? 'cursor-pointer bg-panel-hover text-danger'
                    : isFocused
                      ? 'cursor-pointer bg-panel-hover text-text-body'
                      : 'cursor-pointer text-text-body hover:bg-panel-hover'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
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
                {!item.glyph && item.iconId !== undefined && (
                  <OkIcon id={item.iconId} variant={item.iconAlt ? 'alt' : undefined} decorative inherit
                    className={isFocused ? 'text-text-body' : 'text-text-light group-hover:text-text-body'} />
                )}
                {!item.glyph && item.iconId === undefined && item.icon && (
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
                {/* One line per row (Paul, 18 Nov: core's Undo words for a kept idea ran to five lines and drew over the rows around it): a long
                    label is cut with an ellipsis here and stands whole in the row's tooltip. */}
                {anyIconRow && !item.glyph && item.iconId === undefined && !item.icon && <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0" />}
                <span className="min-w-0 truncate" data-menu-label={item.id}>{item.label}</span>
                {/*
                  ⚠ THE TOP-LEVEL MENU DID NOT RENDER `disabledReason` AT ALL
                  until this lane, while `Submenu.tsx:126` always has. So every
                  greyed row here — "Nothing to undo", "No nodes to arrange" —
                  was disabled for a reason the row already carried and never
                  showed. A disabled row with no reason is the same defect this
                  menu is being fixed for, one level down.
                */}
                {item.disabledReason && !item.enabled && (
                  <span className={`${typography.panelMeta} text-text-light`}>
                    ({item.disabledReason})
                  </span>
                )}
              </span>
              {item.hasSubmenu ? (
                <OkIcon id="fold-chevron" size={14} decorative />
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
      {lane ? (
        <Tip
          id={activeTooltip?.itemId ? `tooltip-${activeTooltip.itemId}` : undefined}
          text={activeTooltip?.text ?? ''}
          anchorRect={activeTooltip?.rect ?? null}
        />
      ) : (
        <MenuTooltip
          id={activeTooltip?.itemId ? `tooltip-${activeTooltip.itemId}` : undefined}
          text={activeTooltip?.text ?? ''}
          anchorRect={activeTooltip?.rect ?? null}
          visible={!!activeTooltip}
        />
      )}

    </>,
    document.body,
  )
}

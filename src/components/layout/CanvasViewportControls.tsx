/**
 * CanvasViewportControls — bottom-left vertical floating toolbar with zoom,
 * fit-view, auto-arrange and the "how to read this" legend.
 *
 * ⭐ CONTRACT v3.1: THREE TOOLS ON THE CANVAS, THE REST ONE CLICK AWAY
 * (DESIGN-GAP #14, 26 Sep 2026). v3.1 `.zoom-tools` draws −, + and fit, in the
 * same panel as the canvas tools. The served build drew six (a "50" read-out,
 * −, +, Fit, Auto-arrange, "?"). So −, + and fit stay on the canvas, and
 * everything else moves into ONE overflow menu (⋯) — nothing is removed:
 *   · "Zoom to 100%" with the current level beside it (the read-out's reset;
 *     v3.1 has no standing zoom read-out, so the number is shown only here);
 *   · "Auto-arrange", still advertising ⇧A (see the ⛔ note below);
 *   · "Detailed view" — the Standard/Detailed toggle that was the canvas
 *     tools' eye button (v3.1's canvas tools have no eye; DESIGN-GAP #13);
 *   · "How to read this" — opens the same canvas key, now anchored to this
 *     toolbar (`CanvasLegendPopover` `variant="controlled"`).
 *
 * A19 — THE DENSITY TOGGLE WAS REMOVED (25 Sep 2026), NOT FIXED. Compact set
 * `layerSpacing` to 30; `layout.ts`'s own floor,
 * `Math.max(LAYOUT_LAYER_GAP, layerSpacing ?? …)` with `LAYOUT_LAYER_GAP = 48`
 * (`nodeLayoutConstants.ts:611`), raised it straight back to 48 — the exact
 * value comfortable already uses. So pressing the toggle changed no rendered
 * spacing at all, while still firing `onAutoArrange()` and its "Auto-arranged
 * layout." success toast — a control that told the user something happened
 * when nothing did. The prototype has no density control, so this removes it
 * rather than un-flooring `layout.ts`, which the item did not ask for and
 * which existing callers may depend on. `layoutStore.ts`'s `setDensity` /
 * `densityOf` / `LAYOUT_DENSITY_PRESETS` are left in place — untouched,
 * unreachable from any UI now — since a full unwind is a separate cleanup
 * from removing the one control that called them.
 *
 * Reads zoom level reactively from the @xyflow/react store.
 * All action handlers are passed as props from ReactFlowGraph.
 *
 * ⚠ VISUAL TREATMENT IS NOT OWNED HERE. This toolbar and the LeftSidebar
 * ("Canvas tools") are the canvas's two left-edge floating toolbars and must
 * read as one UI system; they had drifted to different widths, radii, button
 * sizes, gaps, divider widths and hover grammars. The surface, buttons, menu
 * and icon sizing all come from `CanvasFloatingToolbar.module.css`, whose
 * values are now contract v3.1's `.canvas-tools` — shared rather than copied so
 * the two cannot drift apart again.
 *
 * The toolbar is ONE run (−, +, fit, ⋯) with no separator rule, as v3.1 draws
 * it; the zoom · layout · help grouping lives in the overflow menu's order.
 *
 * ⛔ NO KEYBOARD SHORTCUT IS ADVERTISED HERE EXCEPT `⇧A` (29 Aug 2026).
 * "Zoom out (⌘-)", "Zoom in (⌘+)" and "Fit to view (⌘0)" were removed: no
 * handler for `-`, `+`, `=` or `0` exists anywhere in `src`. Those are the
 * BROWSER's zoom keys, so a user following our instruction scaled the whole
 * page — we were teaching a gesture that visibly breaks the app. The buttons
 * themselves were never at fault and are unchanged.
 * `⇧A` STAYS because it is real and ungated (`useCanvasKeyboardShortcuts.ts`
 * :208 calls `onAutoArrange()` with no authority guard — unlike `T`, which is
 * swallowed by `CANVAS_SEMANTIC_MUTATIONS_CONNECTED`). Do not "tidy" it away
 * with the others: `CanvasViewportControls.shortcutHonesty.spec.tsx` case (b)
 * exists to go red if you do. Advertise a key here only with a test that
 * fails when its handler stops working.
 */

import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Minus, Plus, Maximize, MoreHorizontal, Percent, LayoutGrid, Eye, HelpCircle } from 'lucide-react'
import { useStore } from '@xyflow/react'
import Tooltip from '../Tooltip'
import { CanvasLegendPopover } from '../../canvas/components/CanvasLegendPopover'
import { useCanvasStore } from '../../canvas/store'
import { MENU_EXCLUSIVE_EVENT } from './LeftSidebar'
import styles from './CanvasFloatingToolbar.module.css'

interface CanvasViewportControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onFitView: () => void
  onAutoArrange: () => void
}

export const CanvasViewportControls = memo(function CanvasViewportControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitView,
  onAutoArrange,
}: CanvasViewportControlsProps) {
  const zoom = useStore(s => s.transform[2])
  const zoomPct = `${Math.round(zoom * 100)}%`

  // Standard/Detailed view — read and written exactly as the canvas tools'
  // eye button did before it moved here.
  const isDetailed = useCanvasStore(s => s.viewMode === 'expert')
  const setViewMode = useCanvasStore(s => s.setViewMode)

  const [menuOpen, setMenuOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const moreRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const closeMenu = useCallback((returnFocus: boolean) => {
    setMenuOpen(false)
    if (returnFocus) moreRef.current?.focus()
  }, [])

  // One menu at a time across the chrome (the canvas tools' lens, the top
  // bar's menus): announce on open, close when another claims the screen.
  useEffect(() => {
    if (!menuOpen) return
    window.dispatchEvent(new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'viewport' } }))
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
    const onPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu(true)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, closeMenu])

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.source !== 'viewport') setMenuOpen(false)
    }
    window.addEventListener(MENU_EXCLUSIVE_EVENT, handler)
    return () => window.removeEventListener(MENU_EXCLUSIVE_EVENT, handler)
  }, [])

  // Arrow keys move between items — the menu pattern the role promises.
  const onMenuKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
    items[next]?.focus()
  }, [])

  const run = (action: () => void) => () => {
    action()
    closeMenu(false)
  }

  return (
    <nav aria-label="Viewport controls" className={styles.viewportControls}>
      {/* contract v3.1 `.zoom-tools`: −, +, fit — in that order. */}
      <div className={styles.group}>
        <Tooltip content="Zoom out">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <Minus className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Zoom in">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            <Plus className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Fit to view">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Fit to view"
            onClick={onFitView}
          >
            <Maximize className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        {/* ONE overflow for everything v3.1 does not draw on the canvas. */}
        <div ref={wrapRef} className="relative">
          <Tooltip content="More view options">
            <button
              ref={moreRef}
              type="button"
              className={menuOpen ? styles.iconButtonActive : styles.iconButton}
              aria-label="More view options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-testid="viewport-more"
              onClick={() => setMenuOpen(o => !o)}
            >
              <MoreHorizontal className={styles.icon} aria-hidden="true" />
            </button>
          </Tooltip>

          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="More view options"
              className={styles.menu}
              data-testid="viewport-more-menu"
              onKeyDown={onMenuKeyDown}
            >
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                data-testid="viewport-zoom-reset"
                aria-label={`Zoom to 100% (now ${zoomPct})`}
                onClick={run(onZoomReset)}
              >
                <Percent aria-hidden="true" />
                <span>Zoom to 100%</span>
                <span className={styles.menuItemMeta} aria-hidden="true">{zoomPct}</span>
              </button>
              {/* ⛔ `⇧A` STAYS ADVERTISED — see the header note: it is real and
                  ungated, and `CanvasViewportControls.shortcutHonesty.spec.tsx`
                  case (b) goes red if it is tidied away with the others. */}
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                data-testid="viewport-auto-arrange"
                aria-label="Auto-arrange"
                aria-keyshortcuts="Shift+A"
                onClick={run(onAutoArrange)}
              >
                <LayoutGrid aria-hidden="true" />
                <span>Auto-arrange</span>
                <span className={styles.menuItemMeta} aria-hidden="true">⇧A</span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isDetailed}
                className={styles.menuItem}
                data-testid="viewport-detailed-view"
                onClick={run(() => setViewMode(isDetailed ? 'standard' : 'expert'))}
              >
                <Eye aria-hidden="true" />
                <span>Detailed view</span>
                <span className={styles.menuItemMeta} aria-hidden="true">{isDetailed ? 'On' : 'Off'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                data-testid="viewport-legend"
                aria-haspopup="dialog"
                onClick={run(() => setLegendOpen(true))}
              >
                <HelpCircle aria-hidden="true" />
                <span>How to read this</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* The canvas key, opened from the menu and anchored to this toolbar —
          the same component and content the "?" button used to toggle. */}
      <CanvasLegendPopover variant="controlled" open={legendOpen} onOpenChange={setLegendOpen} />
    </nav>
  )
})

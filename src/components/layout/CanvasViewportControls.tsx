/**
 * CanvasViewportControls — bottom-left vertical floating toolbar with zoom,
 * fit-view, auto-arrange and the "how to read this" legend.
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
 * sizes, gaps, divider widths and hover grammars. The surface, groups, buttons,
 * dividers and icon sizing all come from `CanvasFloatingToolbar.module.css`,
 * whose values ARE the LeftSidebar's — shared rather than copied so the two
 * cannot drift apart again. Nothing about which controls live here, how they
 * are grouped, or what they do changed with that alignment.
 *
 * The three groups below are the same three the two hand-drawn `<div>`
 * separators used to delimit (zoom · layout · help); the dividers are now drawn
 * by `.group:not(:last-child)::after`, at the sidebar's width.
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

import { memo } from 'react'
import { ZoomOut, ZoomIn, Maximize2, LayoutGrid } from 'lucide-react'
import { useStore } from '@xyflow/react'
import Tooltip from '../Tooltip'
import { CanvasLegendPopover } from '../../canvas/components/CanvasLegendPopover'
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
  // The face shows the number; the unit rides the tooltip and the accessible
  // name (see `.readout` — "400%" does not fit the shared circle legibly).
  const zoomWhole = String(Math.round(zoom * 100))
  const zoomPct = `${zoomWhole}%`

  return (
    <nav aria-label="Viewport controls" className={styles.viewportControls}>
      {/* Zoom group: read-out/reset, out, in */}
      <div className={styles.group}>
        {/* Zoom read-out — click resets to 100%. Leads the group rather than
            sitting between the two zoom buttons: it is a state display you can
            act on, not a third step in a -/+ sequence. It wears the shared
            circle for the same reason — it is a control, and a bare number
            was the one thing here that did not look like one. */}
        <Tooltip content="Reset to 100%">
          <button
            type="button"
            className={styles.readout}
            aria-label={`Zoom level ${zoomPct}. Click to reset to 100%`}
            onClick={onZoomReset}
          >
            {zoomWhole}
          </button>
        </Tooltip>

        <Tooltip content="Zoom out">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <ZoomOut className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Zoom in">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            <ZoomIn className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Layout group: fit to view, auto-arrange */}
      <div className={styles.group}>
        <Tooltip content="Fit to view">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Fit to view"
            onClick={onFitView}
          >
            <Maximize2 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Auto-arrange (⇧A)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Auto-arrange"
            onClick={onAutoArrange}
          >
            <LayoutGrid className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Help group: "How to read this" legend — presentational disclosure. */}
      <div className={styles.group}>
        <CanvasLegendPopover />
      </div>
    </nav>
  )
})

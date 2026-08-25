/**
 * CanvasViewportControls — bottom-left vertical floating toolbar with zoom,
 * fit-view, auto-arrange, density and the "how to read this" legend.
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
 */

import { memo } from 'react'
import { ZoomOut, ZoomIn, Maximize2, LayoutGrid, Rows3, Rows4 } from 'lucide-react'
import { useStore } from '@xyflow/react'
import Tooltip from '../Tooltip'
import { CanvasLegendPopover } from '../../canvas/components/CanvasLegendPopover'
import { useLayoutStore, densityOf } from '../../canvas/layoutStore'
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

  // D4: comfortable/compact density is derived from the persisted tier spacing.
  const layerSpacing = useLayoutStore(s => s.layerSpacing)
  const setDensity = useLayoutStore(s => s.setDensity)
  const density = densityOf(layerSpacing)
  const nextDensity = density === 'compact' ? 'comfortable' : 'compact'
  const toggleDensity = () => {
    setDensity(nextDensity)
    onAutoArrange() // re-run layout with the new spacing
  }

  return (
    <nav aria-label="Viewport controls" className={styles.viewportControls}>
      {/* Zoom group: read-out/reset, out, in */}
      <div className={styles.group}>
        {/* Zoom read-out — click resets to 100%. Leads the group rather than
            sitting between the two zoom buttons: it is a state display you can
            act on, not a third step in a -/+ sequence. */}
        <Tooltip content="Reset to 100%">
          <button
            type="button"
            className={`${styles.textButton} text-xs text-text-light hover:text-text-body hover:underline`}
            aria-label={`Zoom level ${zoomPct}. Click to reset to 100%`}
            onClick={onZoomReset}
          >
            {zoomPct}
          </button>
        </Tooltip>

        <Tooltip content="Zoom out (⌘-)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <ZoomOut className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Zoom in (⌘+)">
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

      {/* Layout group: fit to view, auto-arrange, density */}
      <div className={styles.group}>
        <Tooltip content="Fit to view (⌘0)">
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

        {/* D4: layout density — comfortable ⇄ compact (tighter tier spacing).
            Pressed takes the sidebar's active treatment, the same grammar its
            own mode toggles use. */}
        <Tooltip content={density === 'compact' ? 'Comfortable spacing' : 'Compact spacing'}>
          <button
            type="button"
            className={density === 'compact' ? styles.iconButtonActive : styles.iconButton}
            aria-label={`Layout density: ${density}. Switch to ${nextDensity}.`}
            aria-pressed={density === 'compact'}
            data-testid="layout-density-toggle"
            onClick={toggleDensity}
          >
            {density === 'compact'
              ? <Rows3 className={styles.icon} aria-hidden="true" />
              : <Rows4 className={styles.icon} aria-hidden="true" />}
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

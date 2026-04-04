/**
 * CanvasViewportControls — bottom-left floating pill with zoom, fit-view, and auto-arrange.
 *
 * Reads zoom level reactively from the @xyflow/react store.
 * All action handlers are passed as props from ReactFlowGraph.
 */

import { memo } from 'react'
import { ZoomOut, ZoomIn, Maximize2, LayoutGrid } from 'lucide-react'
import { useStore } from '@xyflow/react'
import Tooltip from '../Tooltip'

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

  return (
    <nav
      aria-label="Viewport controls"
      className="fixed bottom-3 left-3 flex items-center h-9 border border-border-default bg-panel/95 backdrop-blur-[8px] rounded-full px-2 gap-1"
      style={{
        /* z-index: matches sidebar rail — see DS v5 z-index scale (pending) */
        zIndex: 1100,
        boxShadow: 'var(--shadow-1)',
      }}
    >
      {/* Zoom out */}
      <Tooltip content="Zoom out (⌘-)">
        <button
          type="button"
          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-text-light hover:text-text-body transition-colors focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2"
          aria-label="Zoom out"
          onClick={onZoomOut}
        >
          <ZoomOut size={16} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Zoom percentage — click resets to 100% */}
      <Tooltip content="Reset to 100%">
        <button
          type="button"
          className="min-w-[40px] h-7 inline-flex items-center justify-center text-xs text-text-light hover:text-text-body hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2"
          aria-label={`Zoom level ${zoomPct}. Click to reset to 100%`}
          onClick={onZoomReset}
        >
          {zoomPct}
        </button>
      </Tooltip>

      {/* Zoom in */}
      <Tooltip content="Zoom in (⌘+)">
        <button
          type="button"
          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-text-light hover:text-text-body transition-colors focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2"
          aria-label="Zoom in"
          onClick={onZoomIn}
        >
          <ZoomIn size={16} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Separator */}
      <div
        className="w-px h-4 mx-1 bg-border-default"
        aria-hidden="true"
      />

      {/* Fit to view */}
      <Tooltip content="Fit to view (⌘0)">
        <button
          type="button"
          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-text-light hover:text-text-body transition-colors focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2"
          aria-label="Fit to view"
          onClick={onFitView}
        >
          <Maximize2 size={16} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Auto-arrange */}
      <Tooltip content="Auto-arrange (⇧A)">
        <button
          type="button"
          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-text-light hover:text-text-body transition-colors focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2"
          aria-label="Auto-arrange"
          onClick={onAutoArrange}
        >
          <LayoutGrid size={16} aria-hidden="true" />
        </button>
      </Tooltip>
    </nav>
  )
})

// Slim zoom/fit controls for the vNext surface. Deliberately NOT the shared
// CanvasViewportControls: that component hard-wires the store-writing
// auto-arrange action, and this surface makes no graph writes.
//
// aria-label "Canvas tools" matches what computeFitPadding measures, so
// fit-to-view padding accounts for this control cluster exactly like the
// default canvas.

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { computeFitPadding } from '../../canvas/utils/computeFitPadding'

const BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-md border border-panel-border bg-panel text-text-body hover:bg-panel-hover'

export function VNextViewportControls() {
  const rf = useReactFlow()

  const handleFit = useCallback(() => {
    const flowEl = document.querySelector('.react-flow')
    rf.fitView({ padding: computeFitPadding(flowEl), duration: 300 })
  }, [rf])

  return (
    <nav
      aria-label="Canvas tools"
      data-testid="vnext-viewport-controls"
      className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border border-panel-border bg-panel p-1 shadow-sm"
    >
      <button type="button" aria-label="Zoom in" className={BUTTON_CLASS} onClick={() => rf.zoomIn({ duration: 200 })}>
        <ZoomIn size={16} aria-hidden />
      </button>
      <button type="button" aria-label="Zoom out" className={BUTTON_CLASS} onClick={() => rf.zoomOut({ duration: 200 })}>
        <ZoomOut size={16} aria-hidden />
      </button>
      <button type="button" aria-label="Fit view" className={BUTTON_CLASS} onClick={handleFit}>
        <Maximize size={16} aria-hidden />
      </button>
    </nav>
  )
}

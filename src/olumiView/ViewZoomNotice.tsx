/**
 * The previous product's zoomed-out notice on the core lane (`CanvasLodNotice`: "Zoomed out — showing less on each card · Zoom in for detail"),
 * said whenever the cards draw their reduced face (below `READABLE_WHOLE_ZOOM`, camera.ts). The legacy notice answers the legacy ladder's
 * rung (below 0.42) and its action lands on 0.5, so it cannot say this lane's state; the words and the way back are its own, reused.
 * Pressing the action zooms in to full size (the full face, a notch clear of the threshold), about the middle of the free canvas (left of the dock).
 */
import { useReactFlow, useStore } from '@xyflow/react'
import { ZoomIn } from 'lucide-react'
import { CANVAS_LOD_NOTICE_ACTION, CANVAS_LOD_NOTICE_COPY, CANVAS_LOD_NOTICE_TESTID } from '../canvas/components/CanvasLodNotice'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { typography } from '../styles/typography'
import { useCanvasStore } from '../canvas/store'
import { selectLodBodyHidden } from '../canvas/utils/zoomLegibility'

/** The zoom the action lands on: full size, a whole notch clear of the threshold (one step out would draw the reduced face again). */
const DETAIL_ZOOM = 1

export function ViewZoomNotice({ onZoom }: { onZoom?: () => void }): JSX.Element | null {
  // UI restore, 11 Nov: the cards are the previous frame's, so the notice answers the frame's own rung (the zoom at which a card shows
  // only its name and one line), never a second threshold of this lane's.
  const reduced = useCanvasStore(selectLodBodyHidden)
  const width = useStore((s) => s.width), height = useStore((s) => s.height)
  const { getViewport, setViewport } = useReactFlow()
  if (!reduced) return null
  const free = Math.max(1, width - measureDockInset())
  const zoomIn = () => {
    const v = getViewport(), k = DETAIL_ZOOM / v.zoom
    onZoom?.()
    void setViewport({ zoom: DETAIL_ZOOM, x: free / 2 - (free / 2 - v.x) * k, y: height / 2 - (height / 2 - v.y) * k }, { duration: 300 })
  }
  return (
    <div className="pointer-events-none fixed bottom-[16px] left-0 z-[1200] flex justify-center" style={{ width: free }}>
      <div data-testid={CANVAS_LOD_NOTICE_TESTID} role="status" aria-live="polite"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1.5 shadow-2">
        <ZoomIn className="h-3.5 w-3.5 flex-none text-text-light" aria-hidden="true" />
        <span className={`${typography.panelMeta} text-text-body`}>{CANVAS_LOD_NOTICE_COPY}</span>
        <button type="button" data-testid={`${CANVAS_LOD_NOTICE_TESTID}-action`} onClick={zoomIn}
          className={`${typography.panelMeta} rounded text-info underline hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}>{CANVAS_LOD_NOTICE_ACTION}</button>
      </div>
    </div>
  )
}

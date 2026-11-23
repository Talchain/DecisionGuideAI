/**
 * The previous product's zoomed-out notice on the core lane (`CanvasLodNotice`: "Zoomed out — showing less on each card · Zoom in for detail"),
 * said whenever the cards draw their reduced face (below `READABLE_WHOLE_ZOOM`, camera.ts). The legacy notice answers the legacy ladder's
 * rung (below 0.42) and its action lands on 0.5, so it cannot say this lane's state; the words and the way back are its own, reused.
 * Pressing the action zooms in to full size (the full face, a notch clear of the threshold), about the middle of the free canvas (left of the dock).
 */
import { useReactFlow, useStore } from '@xyflow/react'
import { OkIcon } from './look/icons'
import { TOOLBAR_BAR, TOOLBAR_BAR_SEPARATOR, TOOLBAR_LABEL, TOOLBAR_STATUS } from './look/toolbar'
import { CANVAS_LOD_NOTICE_ACTION, CANVAS_LOD_NOTICE_TESTID } from '../canvas/components/CanvasLodNotice'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
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
      <div data-testid={CANVAS_LOD_NOTICE_TESTID} className={`pointer-events-auto ${TOOLBAR_BAR}`}>
        <span role="status" aria-live="polite" className={TOOLBAR_STATUS}>
          <OkIcon id="zoom" size={14} decorative className="text-text-light" inherit />
          Zoomed out, showing less on each card
        </span>
        <span aria-hidden="true" className={TOOLBAR_BAR_SEPARATOR} />
        <button type="button" data-testid={`${CANVAS_LOD_NOTICE_TESTID}-action`} onClick={zoomIn} className={TOOLBAR_LABEL}>
          {CANVAS_LOD_NOTICE_ACTION}
        </button>
      </div>
    </div>
  )
}

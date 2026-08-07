/**
 * LodSync — D2 (graph-visuals): watch the main canvas zoom and flip the
 * store's level-of-detail flag when it crosses the threshold.
 *
 * Mounted as a child of the MAIN <ReactFlow> instance only (the Compare-tab
 * minis are already simplified views). Selecting the derived boolean — not
 * the raw zoom — means this component re-renders only when the flag flips,
 * not on every zoom tick; setLodActive additionally skip-if-same guards the
 * store write. Renders nothing.
 */
import { useEffect } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { LABEL_LEGIBLE_ZOOM, labelsRenderedAtZoom } from '../utils/zoomLegibility'

/**
 * Below this zoom, full node cards are unreadable soup — simplify (D2).
 *
 * DERIVED, never restated: this used to be its own hand-written `0.5`, twinned
 * with `cameraComfort.MIN_READABLE_ZOOM`. They agreed by luck, and the
 * post-draft auto-fit was floored by neither — the 25 Jul blank-first-view
 * defect. The number now lives once, in `utils/zoomLegibility.ts`.
 */
export const LOD_ZOOM_THRESHOLD = LABEL_LEGIBLE_ZOOM

export function isLodZoom(zoom: number): boolean {
  return !labelsRenderedAtZoom(zoom)
}

export function LodSync() {
  const lod = useStore((s) => isLodZoom(s.transform[2]))
  useEffect(() => {
    const { setLodActive } = useCanvasStore.getState()
    if (typeof setLodActive === 'function') setLodActive(lod)
  }, [lod])
  return null
}

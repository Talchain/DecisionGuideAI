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

/** Below this zoom, full node cards are unreadable soup — simplify (D2). */
export const LOD_ZOOM_THRESHOLD = 0.5

export function isLodZoom(zoom: number): boolean {
  return zoom < LOD_ZOOM_THRESHOLD
}

export function LodSync() {
  const lod = useStore((s) => isLodZoom(s.transform[2]))
  useEffect(() => {
    const { setLodActive } = useCanvasStore.getState()
    if (typeof setLodActive === 'function') setLodActive(lod)
  }, [lod])
  return null
}

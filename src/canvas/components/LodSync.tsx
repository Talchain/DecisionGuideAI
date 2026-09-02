/**
 * LodSync — D2 (graph-visuals): watch the main canvas zoom and write which rung
 * of the semantic-zoom ladder it sits on.
 *
 * Mounted as a child of the MAIN <ReactFlow> instance only (the Compare-tab
 * minis are already simplified views). Selecting the derived RUNG — not the raw
 * zoom — means this component re-renders only when the rung changes, not on
 * every zoom tick; `setLodRung` additionally skip-if-same guards the store
 * write. Renders nothing.
 *
 * ⚠ THIS USED TO SELECT A BOOLEAN, AND THE RE-RENDER ARGUMENT ABOVE IS WHY THE
 * CHANGE IS SAFE RATHER THAN MERELY EQUIVALENT: a rung is still a primitive, so
 * the referential-stability property the selector depends on is unchanged. What
 * moves is the granularity — the store now also updates crossing 0.714, where it
 * previously did not. That write is a no-op for every consumer at this tip
 * (`quiet` and `full` behave identically), and `BaseNode.lodQuietIsNoOp.spec.tsx`
 * measures it rather than asserting it.
 */
import { useEffect } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { LABEL_LEGIBLE_ZOOM, labelsRenderedAtZoom, resolveLodRung } from '../utils/zoomLegibility'

/**
 * Below this zoom, full node cards are unreadable soup — simplify (D2).
 *
 * DERIVED, never restated: this used to be its own hand-written `0.5`, twinned
 * with `cameraComfort.MIN_READABLE_ZOOM`. They agreed by luck, and the
 * post-draft auto-fit was floored by neither — the 25 Jul blank-first-view
 * defect. The number now lives once, in `utils/zoomLegibility.ts`.
 */
export const LOD_ZOOM_THRESHOLD = LABEL_LEGIBLE_ZOOM

/**
 * ⚠ KEPT, AND KEPT EXACTLY. This predicate is the FLOOR question — "are labels
 * rendered at all?" — which is a different question from "which rung is this?",
 * and four specs plus `autoFitLegibility.spec.tsx` bind their auto-fit claims to
 * it. Re-expressing it in terms of the rung would make one function answer two
 * questions (CLAUDE.md trap 21, this estate's signature defect). `zoomLadder`
 * asserts the two agree across the range instead, so they cannot drift.
 */
export function isLodZoom(zoom: number): boolean {
  return !labelsRenderedAtZoom(zoom)
}

export function LodSync() {
  const rung = useStore((s) => resolveLodRung(s.transform[2]))
  useEffect(() => {
    const { setLodRung } = useCanvasStore.getState()
    if (typeof setLodRung === 'function') setLodRung(rung)
  }, [rung])
  return null
}

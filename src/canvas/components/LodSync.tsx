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
import { useEffect, useRef } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { LABEL_LEGIBLE_ZOOM, labelsRenderedAtZoom, resolveLodRung } from '../utils/zoomLegibility'
import type { LodRung } from '../utils/zoomLegibility'
import { anchorRailFitsBesideAtZoom, setAnchorRailFitsBeside } from '../nodes/shared/anchorRailFloor'

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

/**
 * ⭐⭐ THE ONLY PLACE THE HYSTERESIS IS APPLIED, AND IT MUST BE HERE.
 *
 * `resolveLodRung` is pure and stateless when called with one argument; the
 * dead-band only exists for a caller that can say what the rung WAS. This
 * component is the single non-test call site and the only thing that sees a
 * real camera's SEQUENCE, so threading the previous rung here gives the
 * dead-band to the live board without letting any stateless caller — a spec, a
 * selector, a future surface asking "what rung is 0.42?" — inherit a stale
 * opinion from a render it did not perform.
 *
 * ⚠ THE REF IS READ INSIDE THE SELECTOR, DELIBERATELY. Zustand re-runs the
 * selector on every transform tick; the ref holds the rung we last COMMITTED,
 * so the comparison is always against the state the user is actually looking
 * at. Keeping the previous rung in React state instead would schedule a render
 * to decide whether to render, which is the loop this ref exists to avoid.
 *
 * ⚠ The store's `setLodRung` already skips a write when the rung is unchanged
 * (`store.ts`), so this adds a dead-band on the THRESHOLD where that only ever
 * de-duplicated the WRITE. The two are complementary: without the dead-band a
 * camera resting on the boundary produces a genuine alternating sequence, and
 * a skip-if-same cannot suppress an alternation — only a repeat.
 */
export function LodSync() {
  const previousRef = useRef<LodRung | undefined>(undefined)
  const rung = useStore((s) => resolveLodRung(s.transform[2], previousRef.current))
  useEffect(() => {
    previousRef.current = rung
    const { setLodRung } = useCanvasStore.getState()
    if (typeof setLodRung === 'function') setLodRung(rung)
  }, [rung])
  const anchorRailFitsBeside = useStore((s) => anchorRailFitsBesideAtZoom(s.transform[2]))
  useEffect(() => { setAnchorRailFitsBeside(anchorRailFitsBeside) }, [anchorRailFitsBeside])
  return null
}

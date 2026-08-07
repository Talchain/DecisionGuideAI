import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { computeFitPadding } from '../utils/computeFitPadding'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { cameraDuration } from '../utils/cameraMotion'
import { LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'

/**
 * Schedule a single RAF-synchronised fitView every time `layoutVersion`
 * increments. Each successful `applyLayout` bumps `layoutVersion`, so
 * this hook fits the viewport exactly once per completed layout.
 *
 * The contract is `{ padding: computeFitPadding(), minZoom: LABEL_LEGIBLE_ZOOM,
 * duration: 400 }`: panel-aware per-side padding (reserves the OutputsDock /
 * LeftSidebar so the graph frames into the visible canvas, clear of those
 * panels), the legibility floor, plus the 400ms duration asserted by the
 * lifecycle integration test. With nothing occluding, `computeFitPadding()`
 * reproduces the prior `padding: 0.2` framing exactly.
 *
 * THE FLOOR — why it is here and only here. This is the product choosing the
 * first view for the user, and unfloored it chose an unreadable one: on
 * deployed staging a 19-node first draft auto-fitted to 0.4456 and an 18-node
 * saved-example template to 0.4509 — both below the level-of-detail threshold,
 * so 16 of 18 (resp. 15 of 17) titles and EVERY node body rendered
 * `visibility: hidden`. The landing zoom is a function of node count and pane
 * size, which is why the fix floors the fit rather than moving a threshold:
 * lowering the threshold to suit one graph leaves the next one unreadable.
 * `minZoom` is honoured by xyflow — `fitViewport` passes
 * `options?.minZoom` into `getViewportForBounds`, which does
 * `clamp(zoom, minZoom, maxZoom)` and re-centres on the clamped zoom
 * (@xyflow/system 0.0.76); it clamps and re-frames, it does not no-op. The
 * canvas instance's own `minZoom={0.1}` still lets the USER go lower by hand,
 * which is the intended asymmetry: the user may choose the overview, the
 * product may not choose it for them. See `utils/zoomLegibility.ts`.
 *
 * Must be called inside a ReactFlowProvider (uses `useReactFlow`).
 */
export function useFitViewOnLayoutVersion(): void {
  const layoutVersion = useCanvasStore((s) => s.layoutVersion)
  const { fitView } = useReactFlow()
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView

  // F1: the post-layout auto-fit fires on every layout change, so honour
  // reduced-motion here too (mirrored to a ref to keep the effect deps = only
  // layoutVersion — the fit re-runs on layout, not on a preference flip).
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedMotionRef = useRef(prefersReducedMotion)
  reducedMotionRef.current = prefersReducedMotion

  useEffect(() => {
    if (layoutVersion === 0) return
    const raf = requestAnimationFrame(() => {
      fitViewRef.current({
        padding: computeFitPadding(),
        minZoom: LABEL_LEGIBLE_ZOOM,
        duration: cameraDuration(400, reducedMotionRef.current),
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [layoutVersion])
}

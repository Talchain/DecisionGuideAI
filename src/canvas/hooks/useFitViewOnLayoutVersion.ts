import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { computeFitPadding } from '../utils/computeFitPadding'
import { excludeNonModelNodes } from '../utils/fitTargets'
import { watchReservedBox } from '../utils/reservedBoxWatcher'
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
 * ⭐ TWO TRIGGERS, ONE CONTRACT (18 Aug 2026,
 * `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` §5.1). The hook used to fit
 * once per completed layout and never again, so every pixel of canvas won back
 * — by collapsing the dock, or now by the floating companion no longer
 * reserving — was won and then not spent. A lane witnessed the camera stranded
 * at zoom 0.385 after the conversation panel closed while the computed fit for
 * the new box was 0.582: the graph sitting 34% smaller than it needed to be,
 * live, on the deployed build. The RESERVED BOX is therefore a trigger too, and
 * both triggers pass the same options object so they cannot drift.
 *
 * ⭐ AND THE FIT TARGETS EXCLUDE UI PLACEHOLDERS. `__ghost-option__` is an
 * add-an-option affordance, not part of the user's model, and the fit used to
 * frame it as though it were — on one measured starter it adds 9% to the width
 * the fit must accommodate. See `utils/fitTargets.ts`, which also records why
 * this is honest bookkeeping and NOT a legibility win to bank.
 *
 * Must be called inside a ReactFlowProvider (uses `useReactFlow`).
 */
export function useFitViewOnLayoutVersion(): void {
  const layoutVersion = useCanvasStore((s) => s.layoutVersion)
  const { fitView, getNodes } = useReactFlow()
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView
  const getNodesRef = useRef(getNodes)
  getNodesRef.current = getNodes

  // F1: the post-layout auto-fit fires on every layout change, so honour
  // reduced-motion here too (mirrored to a ref to keep the effect deps = only
  // layoutVersion — the fit re-runs on layout, not on a preference flip).
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedMotionRef = useRef(prefersReducedMotion)
  reducedMotionRef.current = prefersReducedMotion

  // ONE contract, both triggers. A second literal here is how the auto-fit and
  // the re-fit would silently stop agreeing (and how three copies of the dock
  // bounds drifted before `dockWidth.ts` existed).
  const fitNow = useRef(() => {
    const nodes = getNodesRef.current ? excludeNonModelNodes(getNodesRef.current()) : []
    fitViewRef.current({
      // Only constrain the target set when there IS one: an empty `nodes` array
      // would frame nothing, so absent/unavailable nodes fall back to xyflow's
      // fit-everything, i.e. exactly the previous behaviour.
      ...(nodes.length > 0 ? { nodes } : {}),
      padding: computeFitPadding(),
      minZoom: LABEL_LEGIBLE_ZOOM,
      duration: cameraDuration(400, reducedMotionRef.current),
    })
  })

  useEffect(() => {
    if (layoutVersion === 0) return
    const raf = requestAnimationFrame(() => {
      fitNow.current()
    })
    return () => cancelAnimationFrame(raf)
  }, [layoutVersion])

  // Re-fit when the RESERVED BOX changes. Gated on a layout having happened, so
  // this never fits an empty canvas; the watcher derives the change from
  // `computeFitPadding` itself rather than from a list of things that move it
  // (see `reservedBoxWatcher.ts`).
  useEffect(() => {
    return watchReservedBox(() => {
      if (useCanvasStore.getState().layoutVersion === 0) return
      fitNow.current()
    })
  }, [])
}

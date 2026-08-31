/**
 * ModelExtentNotice — says how much of the model is out of view, and offers
 * the overview the product itself is not permitted to choose.
 *
 * ⭐ THE MEASUREMENT THIS EXISTS FOR (Chromium, 1280x800, warm, the five
 * shipped starters, 30 Aug 2026). Every starter's auto-fit clamps at the
 * `LABEL_LEGIBLE_ZOOM` floor of 0.50, and every one is HEIGHT-bound:
 *
 *     starter                graph (units)   nodes fully visible   entirely off-screen
 *     build-vs-buy            1328 x 2354          10 of 20               5
 *     vendor-selection        1328 x 2195          15 of 20               1
 *     market-entry            1184 x 2275          14 of 19               1
 *     pricing-model           1814 x 1689          14 of 16               0
 *     headcount-allocation    1814 x 1536          15 of 17               0
 *
 * On `build-vs-buy` the five are the DECISION NODE ITSELF, the goal, and all
 * three risks.
 *
 * ⚠ RE-DERIVED at `ca49e2ed` after #967 repaired a malformed starter string.
 * The first reading of this table, at `e38b8e96`, was 2693 units and SIX off —
 * a shorter card recovered 339 units of height and one node. The numbers here
 * are the corrected ones; the conclusion did not move, but it was checked
 * rather than assumed, because a table quoted from a previous tip is exactly
 * the stale evidence this estate keeps inheriting. A colleague opening that
 * starter alone, with nobody to say "scroll down", forms their first impression
 * of the product from a view that does not contain the decision.
 *
 * ⚠ WHY THIS IS A NOTICE AND NOT A CAMERA FIX. The camera is ALREADY fitted —
 * `useFitViewOnLayoutVersion` ran, computed a fit below the floor, and was
 * clamped to 0.50 by design. Fitting again changes nothing. The only way to see
 * the whole model is to go below the legibility floor, and `zoomLegibility.ts`
 * rules who may do that: "the user may choose the overview, the product may not
 * choose it for them." So this states the fact and hands the user the choice.
 * That asymmetry is deliberate and this component depends on it — it must never
 * zoom out on its own.
 *
 * ⚠ AND WHAT IT IS NOT. It is not a fix for the height problem; it is a caveat
 * on it (Paul, 29 Aug: do not hide what is weak, caveat it). The model is still
 * taller than the pane can show legibly. Fixing that is a layout question this
 * notice deliberately does not pre-empt.
 *
 * The count comes from `countNodesOutsideFrame`, which shares its frame
 * arithmetic with `nodesComfortablyVisible` rather than restating it, and the
 * node set is `excludeNonModelNodes` — the fit's OWN target set, so the notice
 * counts exactly what the camera was trying to frame and cannot disagree with
 * it about what the model is.
 */
import { useCallback, useMemo } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { Maximize2 } from 'lucide-react'
import { useCanvasStore } from '../store'
import { excludeNonModelNodes } from '../utils/fitTargets'
import { computeFitPadding } from '../utils/computeFitPadding'
import { countNodesOutsideFrame, readFocusCamera } from '../utils/cameraComfort'
import { cameraDuration } from '../utils/cameraMotion'
import { claimCameraForUser } from '../utils/userCameraClaim'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { typography } from '../../styles/typography'

/**
 * Base duration for the overview move. Routed through `cameraDuration` at the
 * call site so it collapses to 0 under `prefers-reduced-motion` —
 * `cameraMotion.sourceScan.spec.ts` REDs on any camera duration that is not,
 * which is what it did to the first version of this file.
 */
const OVERVIEW_FIT_MS = 400

export function ModelExtentNotice() {
  const { getViewport, fitView, getNodes } = useReactFlow()
  const prefersReducedMotion = usePrefersReducedMotion()
  const nodes = useCanvasStore(s => s.nodes)
  // Subscribe to the live transform so the count follows pan and zoom rather
  // than going stale the moment the user moves. Without this the notice would
  // keep claiming nodes are off-screen after they had been scrolled into view.
  const transform = useStore(s => s.transform)

  const modelNodes = useMemo(() => excludeNonModelNodes(nodes), [nodes])

  const outside = useMemo(() => {
    const cam = readFocusCamera(getViewport)
    if (!cam) return null
    return countNodesOutsideFrame(modelNodes, cam.viewport, cam.paneWidth, cam.paneHeight, cam.insets)
    // `transform` is the reactivity trigger; the camera is read fresh above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelNodes, getViewport, transform])

  const showAll = useCallback(() => {
    // ⚠ ALL THREE OPTIONS ARE LOAD-BEARING — MEASURED, NOT COPIED.
    //
    // `fitView({ minZoom })` ALONE DOES NOTHING HERE. Measured 30 Aug 2026 on
    // build-vs-buy: it left the camera at 0.5000 with 11 of 20 nodes outside
    // the pane, and returned without error — a button that looked wired and
    // was not. Passing the node set explicitly (the same thing
    // `ReactFlowGraph.handleFitView` has always done) lands it at 0.2604 with
    // every node inside. Do not "simplify" this call.
    //
    // `padding` comes from `computeFitPadding()` so the overview frames into
    // the visible canvas, clear of the dock and sidebar, rather than behind
    // them — the same frame every other fit in this product uses.
    //
    // ⭐ AND NO `minZoom` IS PASSED, DELIBERATELY. Omitting it lets the fit fall
    // to the canvas instance's own floor (`minZoom={0.1}` on the ReactFlow
    // element), which is exactly the bound wanted here: the user asked for the
    // overview, so the only limit should be what the canvas itself permits.
    //
    // The first version passed an explicit `0.1`, which was BOTH unnecessary
    // and a doctrine violation — `zoomLegibilitySingleSource.spec.ts` allows
    // exactly two zoom-threshold literals under `src/canvas`, both in
    // `zoomLegibility.ts`, and REDed on the third. Declaring it there was the
    // wrong fix too: this is not a legibility threshold, it is the canvas's
    // floor, and the honest way to use that floor is to not restate it.
    // ⭐⭐ AND THE CAMERA IS NOW THE USER'S — WITHOUT THIS LINE THE BUTTON WAS
    // MEASURED DOING ITS JOB AND HAVING IT UNDONE 155ms LATER (`#1051`). The
    // product's own re-fit is floored at the legibility zoom, so on any model
    // this notice appears for it CANNOT leave the whole model on screen; it ran
    // after this fit and parked the camera back at the floor. See
    // `utils/userCameraClaim.ts` for the two camera writes, timed and named.
    claimCameraForUser()
    const fitTargets = excludeNonModelNodes(getNodes())
    fitView({
      ...(fitTargets.length > 0 ? { nodes: fitTargets } : {}),
      padding: computeFitPadding(),
      duration: cameraDuration(OVERVIEW_FIT_MS, prefersReducedMotion),
    })
  }, [fitView, getNodes, prefersReducedMotion])

  // Absent, zero, or a model small enough that the question does not arise.
  if (outside === null || outside === 0) return null

  const total = modelNodes.length
  const visible = total - outside

  return (
    <div
      data-testid="model-extent-notice"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[90] pointer-events-auto
                 flex items-center gap-3 rounded-lg border border-panel-border bg-panel
                 shadow-1 px-3 py-2"
    >
      <span className={`${typography.caption} text-text-body`} data-testid="model-extent-count">
        {/* States the REMAINDER, never a bare fade — the same honesty rule the
            product's other truncations follow ("+N more in inspector"). */}
        Showing {visible} of {total} elements
      </span>
      <button
        type="button"
        onClick={showAll}
        data-testid="model-extent-show-all"
        className={`${typography.caption} inline-flex items-center gap-1 rounded border
                    border-panel-border px-2 py-1 text-info hover:bg-panel-hover
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        <Maximize2 size={12} aria-hidden="true" />
        Show whole model
      </button>
    </div>
  )
}

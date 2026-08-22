import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { computeFitPadding } from '../utils/computeFitPadding'
import { excludeNonModelNodes } from '../utils/fitTargets'
import { watchReservedBox } from '../utils/reservedBoxWatcher'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { cameraDuration } from '../utils/cameraMotion'
import { LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'
import { getGraphIdentityKey, graphNeedsInitialLayout } from '../utils/graphNeedsInitialLayout'

/** The slice of canvas state the camera's readiness questions are asked of. */
type CameraReadinessState = Pick<
  ReturnType<typeof useCanvasStore.getState>,
  'nodes' | 'layoutVersion' | 'pendingLayout' | 'layoutInProgress'
>

/**
 * Is there a RESTORED model on the canvas that the product has never aimed the
 * camera at? True exactly in the state a page reload lands in.
 *
 * Deliberately reuses `graphNeedsInitialLayout` — `useInitialLayoutGuard`'s own
 * predicate and the estate's authority on "are these positions meaningful" —
 * rather than minting a second answer to the same question.
 */
function isRestoredModelReady(s: CameraReadinessState): boolean {
  // A layout is about to move every position; fitting now frames a graph that
  // is already obsolete.
  if (s.pendingLayout || s.layoutInProgress) return false
  // `excludeNonModelNodes` is the fit's own target set, so a canvas holding
  // only the `__ghost-option__` affordance correctly reads as empty.
  if (excludeNonModelNodes(s.nodes).length === 0) return false
  // Stacked at the origin means a fresh draft whose layout is already on its
  // way. The LAYOUT trigger owns that fit; aiming here frames a pile.
  if (graphNeedsInitialLayout(s.nodes)) return false
  return true
}

/**
 * Has the product a model it may aim the camera at?
 *
 * ⚠ THIS REPLACES A `layoutVersion === 0` TEST THAT WAS ANSWERING A DIFFERENT
 * QUESTION FROM THE ONE ITS CALLER ASKED (CLAUDE.md trap 21). On the reserved-box
 * trigger, `layoutVersion === 0` was standing in for *"there is nothing to fit"*
 * — and that proxy is FALSE for a restored graph, which is the whole of UX gate
 * point 7. On the LAYOUT trigger the same expression means *"this effect run is
 * the mount, not a layout completion"*, which is correct and is left alone.
 */
function cameraHasATarget(s: CameraReadinessState): boolean {
  // A completed layout stays authoritative: the product laid this graph out, so
  // it owns the camera for it, whatever the positions now look like.
  if (s.layoutVersion > 0) return true
  return isRestoredModelReady(s)
}

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
 * ⭐⭐ THREE TRIGGERS, ONE CONTRACT. The third — THE RESTORE TRIGGER — landed
 * 20 Aug 2026 (UX gate point 7); see the effect itself for the measurement.
 * ⚠ This count is a hand-maintained mirror of the effects below (CLAUDE.md
 * trap 12): it said TWO while a third was being added. Count the effects, not
 * this sentence. What IS derived is that all three pass the SAME `fitNow`
 * closure, so the contract cannot fork however many triggers there are.
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
  // Restore-trigger inputs. Selected individually and as stable references /
  // primitives — a selector returning a fresh object here is the React #185
  // shape `ci:guard:zustand` exists to catch.
  const restoreNodes = useCanvasStore((s) => s.nodes)
  const restoreEdges = useCanvasStore((s) => s.edges)
  const restorePendingLayout = useCanvasStore((s) => s.pendingLayout)
  const restoreLayoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const restoreScenarioId = useCanvasStore((s) => s.currentScenarioId)
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

  // ⭐ TRIGGER 3 — THE RESTORE TRIGGER (UX gate point 7, 20 Aug 2026).
  //
  // A restored graph reaches the canvas through `hydrateGraphSlice` /
  // `loadScenario` with its positions ALREADY REAL, so nothing sets
  // `pendingLayout`, `applyLayout` never runs, and `layoutVersion` stays 0 for
  // the whole page session. Before this, that latched off both triggers above
  // and the camera was never aimed at a reloaded model AT ALL: the graph kept
  // whatever xyflow's own `fitView` PROP produced at mount, with xyflow's
  // DEFAULT padding — no header-banner inset, no dock, no sidebar.
  //
  // ⚠ STATE THE HARM NARROWLY, because a wider version of this sentence was
  // written first and was REFUTED (20 Aug 2026). xyflow's prop fit DOES run at
  // each mount, so arriving at a different window size does give a different
  // frame — "the restore never re-fits" is FALSE and must not be repeated. What
  // is true is that the PRODUCT's panel-aware fit never runs, so no arrival on
  // this path carries the reservations `computeFitPadding` exists to apply.
  // Measured headed, real Chromium, on the frozen base `2b6ec553`, reloading AT
  // each size: `behindBanner: ["dec_cdp"]` at 1280x800 — the Decision node under
  // the floating header at the smallest desktop this product commits to — and
  // clean at 1440x900 / 1512x982. The fresh path at 1280x800 is clean, which is
  // the contrast that makes it the restore's defect and not the graph's.
  //
  // Fires ONCE PER GRAPH IDENTITY, keyed by `getGraphIdentityKey` (the key
  // `useInitialLayoutGuard` already uses, and structural rather than
  // positional, so a user's own pan/drag never re-arms it). A graph that goes
  // on to be laid out is handled by trigger 1 and returns early here.
  //
  // ⭐⭐ THE LATCH IS SET INSIDE THE FRAME, NOT BEFORE IT — and that ordering is
  // the whole of SENDABLE failure 6 (23 Aug 2026). Written the other way round,
  // this effect claimed the identity and THEN scheduled the fit, while its own
  // cleanup cancels that frame on every dependency change. A restored graph
  // changes `nodes` between the effect and the frame BY CONSTRUCTION: React
  // Flow measures the nodes it has just mounted and dispatches `dimensions`
  // changes, the canvas routes them through `onNodesChange`, and
  // `applyNodeChanges` returns a NEW array (`store.ts` — `set({ nodes:
  // updatedNodes })`). So the frame was cancelled, the effect re-ran, the
  // already-claimed identity bounced it, and THE PRODUCT'S FIT NEVER RAN AT ALL
  // — leaving the camera on xyflow's own mount `fitView` prop, which carries
  // neither `computeFitPadding`'s reservations nor `minZoom`.
  //
  // What that costs, measured on deployed staging at 1280x800 (the minimum
  // supported PoC viewport), restore arm: the camera parks at 0.4279 — BELOW
  // `LABEL_LEGIBLE_ZOOM`, i.e. inside the band the product itself labels
  // unreadable and offers a "zoom in to read" notice for. `labelCounterScale`
  // is capped at `1 / LABEL_LEGIBLE_ZOOM` by construction, so every
  // counter-scaled glyph renders at 0.4279 / 0.5 = 85.6% of its declared size:
  // 8.56px on 58 elements against the Design System v5 §2.4 10px canvas floor.
  //
  // ⚠ THE CAP IS NOT THE DEFECT AND MUST NOT BE RAISED. `MAX_LABEL_COUNTER_SCALE`
  // is what node GEOMETRY is sized for (`nodeLayoutConstants.ts`), and it is a
  // constant only because the lowest zoom the product ever CHOOSES is a
  // constant — `LABEL_LEGIBLE_ZOOM`, passed as `minZoom` by the closure above.
  // Letting an automatic fit park below that floor does not merely under-size
  // text; it falsifies the premise the geometry bound rests on. The floor is
  // the authority; this effect simply has to reach it.
  //
  // Latching in the frame keeps the once-per-identity guarantee intact — the
  // claim is made at the moment the camera actually moves — while a fit that
  // has not happened yet stays re-schedulable. It also means the fit runs on
  // the LAST frame the dependencies settle into, i.e. after measurement, so it
  // frames measured nodes rather than un-measured ones.
  const aimedIdentityRef = useRef<string | null>(null)
  useEffect(() => {
    if (layoutVersion > 0) return
    const s = useCanvasStore.getState()
    if (!isRestoredModelReady(s)) return
    const key = getGraphIdentityKey(s.currentScenarioId, s.nodes, s.edges)
    if (aimedIdentityRef.current === key) return
    const raf = requestAnimationFrame(() => {
      aimedIdentityRef.current = key
      fitNow.current()
    })
    return () => cancelAnimationFrame(raf)
  }, [
    layoutVersion,
    restoreNodes,
    restoreEdges,
    restorePendingLayout,
    restoreLayoutInProgress,
    restoreScenarioId,
  ])

  // Re-fit when the RESERVED BOX changes — including a window resize, which is
  // the half the UX gate measured directly. Gated on the camera having a target
  // so this never fits an empty canvas; the watcher derives the change from
  // `computeFitPadding` itself rather than from a list of things that move it
  // (see `reservedBoxWatcher.ts`).
  useEffect(() => {
    return watchReservedBox(() => {
      if (!cameraHasATarget(useCanvasStore.getState())) return
      fitNow.current()
    })
  }, [])
}

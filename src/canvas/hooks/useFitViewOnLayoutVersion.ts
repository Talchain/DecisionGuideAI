import { useEffect, useRef } from 'react'
import { useReactFlow, getNodesBounds } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { computeFitPadding } from '../utils/computeFitPadding'
import { excludeNonModelNodes } from '../utils/fitTargets'
import { paddingToInsets, readFocusCamera, topAnchoredViewportWhenClamped } from '../utils/cameraComfort'
import { watchReservedBox } from '../utils/reservedBoxWatcher'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import { cameraDuration } from '../utils/cameraMotion'
import { LABEL_LEGIBLE_ZOOM, fitBoundsFor } from '../utils/zoomLegibility'
import { releaseUserCameraClaim, userOwnsCamera, userOwnsCameraFor } from '../utils/userCameraClaim'
import { graphNeedsInitialLayout } from '../utils/graphNeedsInitialLayout'
import { currentModelKey } from '../utils/currentModelKey'

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
/**
 * The identity of a RESTORE, which is what the restore trigger latches on.
 *
 * Deliberately NOT `getGraphIdentityKey`: that one is a STRUCTURAL hash and
 * answers "is this the same shape of graph?". This one answers "is this the same
 * restored model?", and must therefore survive every edit the user makes to it.
 */
export function restoreIdentityKey(scenarioId: string | null | undefined): string {
  return typeof scenarioId === 'string' && scenarioId.length > 0
    ? `scenario:${scenarioId}`
    : 'draft'
}

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
  const { fitView, getNodes, getViewport, setViewport } = useReactFlow()
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView
  const getNodesRef = useRef(getNodes)
  getNodesRef.current = getNodes
  const getViewportRef = useRef(getViewport)
  getViewportRef.current = getViewport
  const setViewportRef = useRef(setViewport)
  setViewportRef.current = setViewport

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
    const padding = computeFitPadding()
    const duration = cameraDuration(400, reducedMotionRef.current)

    // ⭐⭐ WHEN THE FIT WOULD CLAMP, ANCHOR THE VIEW TO THE MODEL'S TOP.
    //
    // xyflow honours `minZoom` by clamping AND RE-CENTRING, so a model taller
    // than the frame is cropped equally at both ends — and the two ends are not
    // equally valuable. Measured on the five shipped starters (30 Aug 2026),
    // `build-vs-buy`'s first view contained NO decision and NOT ONE of its four
    // options: eight factor cards and nothing else. Top-anchoring recovers the
    // decision on all three starters that lose it. Full table and the trade in
    // `cameraComfort.topAnchoredViewportWhenClamped`.
    //
    // ⚠ NULL WHENEVER THE MODEL ALREADY FITS, so this changes nothing except in
    // the state where the camera was already cropping. It also never zooms out:
    // going below the legibility floor stays the user's choice, not ours.
    //
    // ⚠ THE FRAME IS THE FIT'S, NOT THE GATE'S — this file's sibling documents
    // exactly this fork. `computeFitPadding()` is what the fit frames into;
    // `FocusCamera.insets` is the wider no-churn GATE frame, widened by
    // companion occlusion. Using the gate frame here would anchor against a box
    // the fit never targets. `readFocusCamera` is consulted ONLY for the pane
    // measurement.
    const cam = readFocusCamera(getViewportRef.current)
    if (nodes.length > 0 && cam) {
      const anchored = topAnchoredViewportWhenClamped(
        getNodesBounds(nodes),
        cam.paneWidth,
        cam.paneHeight,
        paddingToInsets(padding),
        LABEL_LEGIBLE_ZOOM,
      )
      if (anchored) {
        setViewportRef.current(anchored, { duration })
        return
      }
    }

    fitViewRef.current({
      // Only constrain the target set when there IS one: an empty `nodes` array
      // would frame nothing, so absent/unavailable nodes fall back to xyflow's
      // fit-everything, i.e. exactly the previous behaviour.
      ...(nodes.length > 0 ? { nodes } : {}),
      padding,
      // ⭐ THE PRODUCT'S BAND, BOTH ENDS. The floor keeps an automatic fit out of
      // the band the product itself calls unreadable; the ceiling stops a
      // degenerate bounding box — one node, or a graph the layout engine never
      // spread — framing at up to the instance's `maxZoom={4}` (a witnessed
      // canvas sat at 328%). Automatic fits neither hide labels nor magnify; the
      // user may do both.
      //
      // ⚠ SPREAD FROM `fitBoundsFor`, NOT RESTATED. Until 31 Aug 2026 the two
      // USER-invoked fits set `minZoom` to this same constant by hand, against
      // the doctrine in the module that owns it, and nothing could tell the two
      // classes apart (#1051). Naming the class is what makes them different.
      ...fitBoundsFor('product'),
      duration,
    })
  })

  useEffect(() => {
    if (layoutVersion === 0) return
    const raf = requestAnimationFrame(() => {
      // ⭐⭐ A LAYOUT PASS IS NOT A NEW MODEL, AND THIS LINE USED TO ASSUME IT WAS
      // (CLAUDE.md trap 21 — two questions under one name).
      //
      // The premise written here was *"a completed layout has moved every
      // position, so whatever the user framed is gone"*. That is true of the
      // layout that lays out an ARRIVING model, and false of the corrective
      // passes `useMeasureThenLayout` runs on the model already on screen: it
      // re-lays out when a card grows taller than the height the committed
      // layout was computed against (measurement landing late, or analysis
      // results adding content to a card). Same nodes, same edges, same ids —
      // only the geometry is recomputed. `layoutVersion` cannot tell the two
      // apart, so the user's overview was discarded by both.
      //
      // MEASURED, real Chromium, real clock, 1280x800, `build-vs-buy`, at
      // `8220f48d` — the camera sampled every frame after the click:
      //
      //     t=1     zoom=0.5000  x=181  y=61   before the click
      //     t=681   zoom=0.2907  x=480  y=67   the user's overview, whole model
      //     t=1279  zoom=0.5000  x=181  y=61   back to EXACTLY the pre-click camera
      //
      //     +17632ms  showAll / claimCameraForUser
      //     +18219ms  this trigger fires (layoutVersion 4 -> 5)
      //     +18220ms  releaseUserCameraClaim   <- the claim, discarded
      //     +18220ms  fitNow                   <- floored product fit, back to 0.50
      //
      // The button did its job and 587ms later the product threw the result
      // away — the same shape as the reserved-box defect `claimCameraForUser`
      // was written for, through the one trigger that never consulted it. On
      // this starter `dec_billing` was measured growing 94 -> 198 -> 295px
      // across successive corrective passes, so whether one is still in flight
      // when the user clicks is a matter of machine load. That is why this read
      // as intermittent, and why instrumenting the page could hide it.
      //
      // So: the claim is honoured when the layout is of THE MODEL THE USER
      // CLAIMED, and released only when a DIFFERENT model has arrived — which is
      // the case the original premise actually describes, and which still needs
      // the camera aimed at it.
      //
      // ⚠ AND THE KEY IS THE USER'S, NOT THE PRODUCT'S — corrected in review of
      // #1096, trap 21 one level down. The first version of this fix compared
      // against a ref stamped inside `fitNow`, i.e. on the PRODUCT's last fit.
      // The user's own fit does not run through `fitNow`, so an ordinary edit
      // between the two left it stale: frame A, add a node (now A'), click, and
      // the next corrective layout read A' as a new model and took the frame
      // back (`fitView calls = 2` in jsdom). `store.ts` has exactly ONE write to
      // `layoutVersion` and neither `addNode` nor `deleteNodeById` calls
      // `setPendingLayout`, so that edit genuinely lands without a layout —
      // the window is reachable by an ordinary edit-then-click, not theoretical.
      // The claim now carries its own key, taken at claim time.
      if (userOwnsCameraFor(currentModelKey())) return
      releaseUserCameraClaim()
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
  // Fires ONCE PER RESTORE, keyed by the SCENARIO (see `restoreIdentityKey`), so
  // neither the user's own pan/drag nor their subsequent edits re-arm it. A graph
  // that goes on to be laid out is handled by trigger 1 and returns early here.
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
  //
  // ⭐⭐ AND THE LATCH IS KEYED ON THE RESTORE, NOT ON THE STRUCTURE. These are two
  // different questions and the old key conflated them. `getGraphIdentityKey`
  // hashes SORTED NODE AND EDGE IDS (`graphNeedsInitialLayout.ts` —
  // `structuralHash`), so it changes on every add, delete, undo and paste.
  //
  // ⚠ That conflation is harmless only while the fit can never re-schedule. Make
  // the fit re-schedulable — which is the whole point of the change above — and a
  // STRUCTURAL key turns every node the user adds into an animated fit-all that
  // yanks the camera out from under them. On a RESTORED graph there is nothing to
  // stop it: `layoutVersion` stays `0` for the entire session, because `addNode`,
  // `addNodeWithEdge` and `deleteNodeById` never call `setPendingLayout`, and the
  // only write to `layoutVersion` in the store is inside `applyLayout`. So the
  // user zooms into one corner, adds an option, and the canvas animates back to
  // fit-all. The old code swallowed that silently — via the same cancellation bug
  // this fix repairs.
  //
  // The question this latch answers is "have we framed THIS RESTORE yet?", never
  // "have we framed THIS STRUCTURE yet?". One semantic question, one key. Keying
  // on the scenario also gives the right behaviour on scenario SWITCH: the ref
  // holds only the last key, so X → Y → X re-frames X, which is a new restore.
  const aimedRestoreRef = useRef<string | null>(null)
  useEffect(() => {
    if (layoutVersion > 0) return
    if (!isRestoredModelReady(useCanvasStore.getState())) return
    const restoreKey = restoreIdentityKey(useCanvasStore.getState().currentScenarioId)
    if (aimedRestoreRef.current === restoreKey) return
    const raf = requestAnimationFrame(() => {
      // Re-read the guards at FIRE time. They were evaluated a frame ago, and a
      // store write from a NON-DISCRETE context (a ResizeObserver, the
      // `applyLayout` promise chain) can land in between without React having
      // flushed this effect's cleanup first. Without this re-check the frame
      // could frame a graph whose positions are about to be replaced — precisely
      // the state `isRestoredModelReady` exists to refuse.
      const now = useCanvasStore.getState()
      if (now.layoutVersion > 0) return
      if (!isRestoredModelReady(now)) return
      if (restoreIdentityKey(now.currentScenarioId) !== restoreKey) return
      aimedRestoreRef.current = restoreKey
      // A restore is a model ARRIVING. Nothing the user framed on a previous
      // model survives it, so the claim is released here too.
      releaseUserCameraClaim()
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
      // ⭐⭐ THE USER'S FRAME WINS. Measured on `build-vs-buy` (#1051): the
      // overview landed at 0.2630 with 19 of 19 nodes inside the pane, and this
      // trigger overwrote it 155ms later with the floored 0.5000 top-anchored
      // view, 9 of 19 inside. This re-fit exists to SPEND canvas won back; it
      // was also spending the user's own camera. `utils/userCameraClaim.ts`
      // carries the timed trace and why the layout/restore triggers differ.
      if (userOwnsCamera()) return
      fitNow.current()
    })
  }, [])
}

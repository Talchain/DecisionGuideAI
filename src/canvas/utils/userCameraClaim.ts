/**
 * userCameraClaim — WHO OWNS THE CAMERA RIGHT NOW: the user, or the product?
 *
 * ⭐⭐ WHY THIS EXISTS. "Show whole model" did not show the whole model
 * (`#1051`, raised twice by the founder). Measured locally in Chromium at
 * 1280x800 on the `build-vs-buy` starter, with `panZoom.setViewport` wrapped so
 * every camera write named its caller:
 *
 *     t=272ms  setViewport zoom=0.2630   fitViewport <- resolveFitView
 *                                        <- updateNodeInternals <- ResizeObserver
 *              ...the user's overview. 19 of 19 nodes inside the pane.
 *     t=427ms  setViewport zoom=0.5000   useFitViewOnLayoutVersion.fitNow
 *                                        <- reservedBoxWatcher.check
 *              ...the PRODUCT's automatic re-fit. 9 of 19 inside the pane.
 *
 * The button worked. 155ms later the product threw the result away.
 *
 * The automatic fit is floored at `LABEL_LEGIBLE_ZOOM` by design, and when the
 * fit would clamp it is replaced by a top-anchored `setViewport` at exactly that
 * floor. So on any model whose whole-model fit sits below the floor — which is
 * every model the notice appears on, by construction — the automatic fit CANNOT
 * leave the whole model on screen. Whenever it runs after the user's overview,
 * the promise on the button is broken by the product itself.
 *
 * The founder's second reproduction is the same arithmetic from the other end:
 * a freshly drafted 12-node graph went from "Showing 0 of 12" to "Showing 10 of
 * 12 **at 50%**". 50% is `LABEL_LEGIBLE_ZOOM`. That is not a fit that fell
 * short; it is the floored automatic fit wearing the user's click.
 *
 * ⚠ THE TRIGGER IS A RACE, WHICH IS WHY THIS LOOKED INTERMITTENT AND
 * UNEXPLAINED. `reservedBoxWatcher` takes its baseline signature when it
 * subscribes — at canvas mount, while the OutputsDock is still a 68px rail. The
 * dock reaches its expanded 444px reservation ~2.4s later, so the watcher fires
 * one legitimate-looking "the reserved box changed" at an arbitrary moment
 * during early interaction. Land it before the user's click and the button
 * works; land it after and the camera is yanked back to the floor. Instrumenting
 * the page changed the timing enough to make it pass — the classic signature of
 * a race, and the reason the deployed-bundle archaeology in `#1051` could not
 * settle it.
 *
 * ⭐ WHAT THIS MODULE DOES, AND WHY IT IS THE DOCTRINE ALREADY WRITTEN DOWN.
 * `zoomLegibility.ts` states the asymmetry this product runs on:
 *
 *   > "the user may choose the overview, the product may not choose it for them"
 *
 * The defect is that half of it was enforced (the product's fits are floored)
 * and half was not (nothing stopped a floored product fit from overwriting the
 * user's unfloored one). This is the missing half: once the user has explicitly
 * framed the camera, an AUTOMATIC re-frame may not take it away from them.
 *
 * ⚠ SCOPE, STATED NARROWLY — AND CORRECTED 1 Sep 2026, BECAUSE THE NARROW SCOPE
 * WAS THE OTHER HALF OF THE DEFECT.
 *
 * This paragraph used to read: *"This claim is honoured by the RESERVED-BOX
 * trigger only. The layout and restore triggers RELEASE it and then fit, because
 * those fire when the model itself changed or arrived."* The reasoning is right;
 * the premise about the LAYOUT trigger is not. `layoutVersion` increments on
 * every layout pass, including the CORRECTIVE ones `useMeasureThenLayout` runs
 * on the model already on screen when a card's measured height changes — late
 * measurement, or analysis adding content to a card. Those are not a new model
 * arriving, and treating them as one discarded the user's overview about half a
 * second after they asked for it.
 *
 * Measured in real Chromium at 1280x800 on `build-vs-buy` (staging tip
 * `8220f48d`): the button reached 0.2907 with the whole model framed, and 587ms
 * later the layout trigger returned the camera to EXACTLY its pre-click value of
 * 0.5000 — leaving 10 of 19 model nodes behind the dock or off the pane. So
 * `claimCameraForUser` was a half-fix: it closed the reserved-box door and the
 * layout door was never shut.
 *
 * The scope now: the claim is honoured by the RESERVED-BOX trigger, and by the
 * LAYOUT trigger WHENEVER THE MODEL IS THE ONE THE PRODUCT ALREADY FRAMED. It is
 * released — and the product re-frames — only when a DIFFERENT model has
 * arrived, which is what the original premise actually describes, and which
 * still needs the camera aimed at it: a stale claim there would strand the
 * camera on a graph that no longer exists (measured — dropping that condition
 * leaves a newly arrived model at the previous model's zoom of 0.3233, never
 * re-aimed). The RESTORE trigger still releases unconditionally; it fires once
 * per restore identity, before the user has had a chance to frame anything.
 *
 * ⚠ WHAT IT IS NOT. It is not a fix for the reserved-box baseline being taken
 * too early, and it does not claim the watcher's spurious startup fire is
 * harmless — it is simply no longer able to cost the user their view. And it is
 * not a fix for the whole-model fit sitting below the legibility floor on tall
 * models; that is the layout question `ModelExtentNotice` deliberately caveats
 * rather than hides.
 */

/**
 * Module-level rather than store state, deliberately: this is a fact about the
 * live camera, not about the model. Putting it in the canvas store would make it
 * persistable, undoable and serialisable, none of which it should ever be.
 */
let claimed = false

/**
 * The user has explicitly framed the camera — "Show whole model", the left-rail
 * "Fit to view", or the command palette's "Zoom to Fit".
 *
 * Every call site is a control the user pressed. Nothing automatic may call it:
 * `userCameraClaim.sourceScan.spec.ts` reads the bytes of `src/canvas` and REDs
 * if it is reached from anywhere else, so the claim cannot quietly grow into
 * "the camera is busy" (CLAUDE.md trap 12 — a rule nobody can drift past).
 */
export function claimCameraForUser(): void {
  claimed = true
}

/**
 * The product may frame the camera again — the model changed or a new one
 * arrived, so whatever the user framed no longer exists to be preserved.
 */
export function releaseUserCameraClaim(): void {
  claimed = false
}

/** Has the user framed this camera themselves? */
export function userOwnsCamera(): boolean {
  return claimed
}

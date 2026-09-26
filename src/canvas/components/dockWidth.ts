/**
 * Responsive width for the right-hand OutputsDock.
 *
 * Why this module exists: the dock's expanded width used to be a single fixed
 * `--dock-right-expanded: 26rem` (416px) written into three hand-copied
 * inline literals — the mount path, the resize path and the drag path each
 * carried their own bounds. They agreed on the day they were written and
 * nothing would have gone red when they stopped. The rules now live here once.
 *
 * ⭐⭐ NARROWED TO 300px BY FOUNDER RULING, 14 Sep 2026 — AND THE 17 Aug RECORD
 * BELOW IS KEPT RATHER THAN DELETED, because it is the strongest argument
 * against this change and the next reader is entitled to it.
 *
 * ⚠ WHAT THE 17 Aug REVERT PROVED, AND WHAT IT DID NOT. It proved that
 * narrowing does not lower the CLAMP: the post-draft fit parks at the 0.50
 * `LABEL_LEGIBLE_ZOOM` floor at 416px, at 333px and at 280px alike. That is
 * true, it is re-confirmed by measurement today, and nothing here disputes it.
 *
 * ⛔ BUT IT MEASURED THE WRONG OUTCOME. "Does the fit zoom improve?" is not the
 * question a reader of the canvas has; "how much of my model can I see at the
 * zoom the product picks?" is. Measured at 1600x1000 on the five committed
 * starters: the graph is offered 1080px of pane against a 3080-unit layout on
 * three of them, so at the 0.50 floor roughly 70% of the model's width is
 * visible and the rest needs panning. At 300px the pane offers 1208px and that
 * becomes ~78%. The legibility claim the old experiment made was never
 * deliverable at any width; the VISIBILITY gain is real and was never measured.
 * (CLAUDE.md trap 23 — a fix judged against the symptom's metric rather than
 * the outcome's.)
 *
 * ⚠ AND THE COST THE 17 Aug NOTE RECORDS IS REAL AND UNCHANGED: the panel's
 * content budget goes from roughly 390px to roughly 274px after borders and
 * `px-3`, and it was tab FORMATTING that broke last time, not the width itself.
 * That is a live risk on this change, it is not addressed here, and it should
 * be looked at on a real screen rather than assumed.
 *
 * ⚠⚠ THE NARROWING THIS MODULE ORIGINALLY SHIPPED IS REVERTED (17 Aug 2026).
 * The ratio was set to 0.26 to buy graph legibility back from the dock: at
 * 1280x800 the fit box went 760px → 843px, and a later pre-analysis clamp
 * pushed it to 896px. **None of it was enough and none of it was ever going
 * to be.** The drafted 17-node graph measures 2016 flow-units, so at the 0.50
 * `LABEL_LEGIBLE_ZOOM` floor it needs 1008px — the post-draft `fitView`
 * clamps at the floor at 416px, at 333px AND at 280px alike (asserted in
 * `computeFitPadding.spec.ts`). The width was traded and the legibility was
 * never delivered, while the panel lost 35% of its content budget (390px →
 * 254px after borders and `px-3` padding) and every tab's formatting with it.
 *
 * So the default returns to 416 wherever the viewport allows. Closing the
 * 1008px gap needs the dock COLLAPSED, which is a workspace-shell decision,
 * not a width constant. This is containment; the canonical panel shell that
 * owns width, tabs, scroll regions and type scale is separate work.
 *
 * The rules, in one place so the mount path, the resize path and the drag
 * path cannot drift apart (they were three separate copies of the bounds):
 *
 *  - `dockWidthBounds` — the HARD bounds a user drag may reach. Unchanged
 *    from the previous inline copies (`280` .. `min(480, 40% of viewport)`),
 *    so an existing persisted width keeps behaving exactly as before.
 *  - `responsiveDockWidth` — what the dock is when the user has NEVER dragged
 *    it. Capped at the historic 416px, floored at 280px so it stays usable,
 *    and proportional only in the band between — which, at the restored
 *    ratio, is viewports NARROWER than 1280.
 *  - `resolveDockWidth` — the width to apply right now. An explicit user
 *    width always wins over the responsive default; it is only re-clamped to
 *    the hard bounds, which is itself a fix (previously a width persisted at
 *    a wide viewport stayed 480px in a 900px window, where the clamp says 360).
 *
 * All three are pure so they can be unit-tested without a DOM.
 */

/** Narrowest usable dock. Never derived away — below this the panel content wraps unusably. */
export const DOCK_MIN_WIDTH = 280

/**
 * Ceiling for the RESPONSIVE default. Every viewport wide enough to reach it
 * gets it.
 *
 * ⭐⭐⭐ 319, THE DESIGN CONTRACT'S FLUSH PANEL (26 Sep 2026). The locked visual
 * contract (`olumi-canvas-visual-contract.html`) states the right panel as
 * `.ai-panel{position:absolute;right:0;top:51px;bottom:0;width:319px;
 * border-left:1px solid #DCD7CF}` — flush, not a floating card — and Paul asked
 * on 26 Sep for the 25 Sep design prototype to be completed. The served dock
 * (design audit 26 Sep, `853feeb7`) was a 416×721 floating card at (852,63).
 * This is the PANEL lane's change, reviewed by Panel — the ruling below said
 * the width was the panel workstream's to decide, and the design contract is
 * that decision.
 *
 * ⚠ THE 17 Aug COST WAS MEASURED BEFORE MOVING IT, NOT ASSUMED. The served
 * build at `e63c89a0` was loaded at a persisted 319px width (1280×800, pricing
 * starter) and every visible leaf in all four pre-run tabs was swept for
 * clipping and for crossing the dock's right edge: 0 and 0 in each tab, against
 * the same sweep at 416px (13 sr-only `Inspect …` spans report clientWidth 1 at
 * BOTH widths — the probe's own positive control, not a regression). The one
 * designed reflow it causes is the Reasoning method strip's compact mode
 * (`METHOD_STRIP_COMPACT_BELOW_PX`, content < 300): four icons plus the
 * overflow instead of five. Post-run tab content was not swept (no run is sent
 * from a measurement); that is stated in the PR as a limit.
 *
 * The history below is kept verbatim: it is the record of why 416 stood.
 *
 * ⛔⛔ 416, AND THE CANVAS LANE MAY NOT CHANGE IT. FOUNDER RULING, 14 Sep 2026:
 * *"That's for the panel Workstream to decide, not you. Your job is to make the
 * graph look as optimal as it can with the space available."*
 *
 * This constant was moved to 300 by the canvas lane earlier the same day and is
 * restored here. The measurement that motivated it is not withdrawn — the graph
 * genuinely gets 1080px of a 1600px window and three starters cannot fit
 * legibly — but **the remedy is not ours to apply.** A canvas lane that wants
 * more room states the measurement and hands it to Panel; it does not take the
 * pixels. The reason is not politics: the dock's floor exists because panel
 * CONTENT wraps unusably below it, and the canvas lane has never measured that
 * content. We were optimising one surface using the other surface's budget.
 *
 * ⛔ DO NOT GO BELOW `DOCK_MIN_WIDTH`. That floor is not a preference — below it
 * the panel content wraps unusably, which is the failure the 17 Aug revert was
 * actually about.
 *
 * ⚠ MIRRORED IN CSS, DELIBERATELY AND UNAVOIDABLY: `src/index.css`
 * (`--dock-right-expanded`) must carry the same number as a pre-hydration
 * fallback, because the custom property has to have a value before this module
 * runs. `dockCssFallbackAgrees.spec.ts` REDs if the two disagree.
 */
export const DOCK_RESPONSIVE_MAX_WIDTH = 319

/**
 * The reference viewport the ceiling is sized against — the laptop every
 * measurement in this module was taken at.
 */
export const DOCK_REFERENCE_VIEWPORT = 1280

/**
 * Share of the viewport the dock takes before the ceiling bites.
 *
 * ⭐⭐ NOW GENUINELY DERIVED, WHICH ITS OWN COMMENT ALREADY CLAIMED IT WAS.
 *
 * This read `= 0.325` beside a comment saying *"DERIVED, not chosen:
 * 416 / 1280 = 0.325 exactly"*. That was true on the day it was written and
 * became false the moment the ceiling moved — a hand-maintained mirror with the
 * word "derived" written on it, which is the estate's dominant defect wearing
 * the label of its own remedy (CLAUDE.md trap 12).
 *
 * It is now the division itself, so the invariant the module is designed around
 * — *the reference laptop lands exactly ON the ceiling, and only narrower
 * viewports taper* — holds for any future ceiling without anyone remembering.
 *
 * ⚠ CHANGING THE CEILING NOW CHANGES THIS. That is the point, and it is why
 * `dockWidth.spec.ts` pins the invariant (`responsiveDockWidth(1280) ===
 * DOCK_RESPONSIVE_MAX_WIDTH`) rather than either number.
 */
export const DOCK_VIEWPORT_RATIO = DOCK_RESPONSIVE_MAX_WIDTH / DOCK_REFERENCE_VIEWPORT

/** Hard bounds a user drag may reach — the pre-existing rule, now stated once. */
export function dockWidthBounds(viewportWidth: number): { min: number; max: number } {
  const usable = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0
  return {
    min: DOCK_MIN_WIDTH,
    // `max(min, …)` so a pathologically narrow viewport can never produce
    // max < min, which would make the clamp order-dependent.
    max: Math.max(DOCK_MIN_WIDTH, Math.min(480, Math.floor(usable * 0.4))),
  }
}

/** The dock's width when the user has never resized it. */
export function responsiveDockWidth(viewportWidth: number): number {
  const { min, max } = dockWidthBounds(viewportWidth)
  const proportional = Math.round((Number.isFinite(viewportWidth) ? viewportWidth : 0) * DOCK_VIEWPORT_RATIO)
  const ceiling = Math.min(DOCK_RESPONSIVE_MAX_WIDTH, max)
  return Math.max(min, Math.min(ceiling, proportional))
}

/**
 * The width to apply now.
 *
 * @param storedWidth the user's persisted explicit width, or `null` when they
 *   have never dragged the dock. `null` — not `0`, not `NaN` — is the signal
 *   that the responsive default applies; anything unparseable is treated the
 *   same way rather than silently becoming a number.
 */
export function resolveDockWidth(viewportWidth: number, storedWidth: number | null): number {
  const { min, max } = dockWidthBounds(viewportWidth)
  if (storedWidth == null || !Number.isFinite(storedWidth)) return responsiveDockWidth(viewportWidth)
  return Math.max(min, Math.min(max, Math.round(storedWidth)))
}

/** Parse the persisted value into the `number | null` `resolveDockWidth` expects. */
export function parseStoredDockWidth(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

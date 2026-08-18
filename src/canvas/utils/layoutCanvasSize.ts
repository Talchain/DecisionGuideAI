/**
 * layoutCanvasSize — THE ONE AUTHORITY for the canvas size the layout solver is
 * packed against.
 *
 * WHY THIS MODULE EXISTS (18 Aug 2026, founder correction to
 * `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md`):
 *
 * > "You have derived that the model/layout solver assumes ~1088px while the fit
 * > stage actually gets ~760px. That is a first-order upstream defect. Fix/unify
 * > that authority first… Do not choose a workaround around a measurement made
 * > under a known sizing inconsistency."
 *
 * The duplication was the defect in its clearest form: `DraftChat.tsx` and
 * `LayoutOptionsPanel.tsx` each carried their own hand-copied block reading the
 * live `.react-flow` rect, with their own floors and their own window fallback,
 * both commented *"regardless of whether the right panel is open or collapsed"*.
 * They agreed on the day they were written and nothing would have gone red when
 * they stopped. A third path — a layout run through neither — silently used
 * `layout.ts`'s `FALLBACK_CANVAS` of 1300x750, a fourth answer nobody chose.
 *
 * ⭐ WHAT THIS DOES AND DOES NOT FIX — say it here, because the numbers invite
 * the wrong conclusion. At a 1280px viewport this resolves to width 1280, so
 * `layout.ts` solves tier packing against `1280 * 0.85 = 1088` units while the
 * post-layout `fitView` frames into 760px (dock expanded) or 1136px (dock at its
 * 40px rail). Derived at this tip, and the two halves are NOT the same kind of
 * thing:
 *
 *  1. **The phantom half — 392px — WAS a defect and step 1 deletes it.** The
 *     free-floating conversation panel was contributing a rectangular
 *     `fitView` inset, so the fit box measured 368px with it open. It is not
 *     edge-anchored and not layout-reserving; it now reserves nothing, ever
 *     (`computeFitPadding.ts`). Fit box 368 → 760 at 1280.
 *  2. **The residual half — 328px — is NOT a defect and no pin closes it.** The
 *     dock (444px) and the canvas-tools sidebar (76px) genuinely occlude the
 *     canvas. `canvasSize` deliberately ignores them, and that is the founder's
 *     binding rule, not an oversight: *"stable model, adaptive attention — the
 *     canonical strategic model should not silently change merely because the
 *     screen is small."* Subtracting live panel width here would re-pack the
 *     canonical model every time a panel opened.
 *
 * So the two stages measure different things and both are right to: this one
 * answers *"how wide may the canonical model be?"* (a model question, panel- and
 * viewport-stable), and `computeFitPadding` answers *"how much canvas can the
 * user see right now?"* (a presentation question). Unifying the AUTHORITY means
 * one derivation of the first question — not making the two answers equal.
 * **The only state in which the fit stage receives at least what the solver
 * assumed is the collapsed dock: 1136 ≥ 1088.** That is arithmetic on this
 * module's own output and `computeFitPadding`'s, and it is why the rail clears
 * the legibility floor on 12 of 12 measured models where the expanded dock
 * clears 6.
 *
 * ⚠⚠ FORBIDDEN, and it is the whole point of the paragraph above: do NOT derive
 * this width from the fit box (`availableWidth = boxW / LABEL_LEGIBLE_ZOOM`, and
 * any relative of it). It is one plausible refactor away and it re-packs the
 * canonical model when a panel opens. See `layout.ts`'s header.
 *
 * ⚠ A SEPARATE, GENUINE SIZING DEFECT THIS MODULE DOES NOT FIX, recorded so it
 * is not lost: `layout.ts`'s DOWN branch treats `availableWidth` as a budget for
 * deciding single-row-vs-multi-row and then emits a row that OVERRUNS it — a
 * 6-wide tier packs to 2140 units against a 1088 budget (63% over). Changing
 * that changes the shape of every model at every viewport, so it is a product
 * decision with a visual-regression gate in front of it, not a tidy-up.
 */

/** Floors carried over verbatim from the two duplicated call sites. */
export const LAYOUT_CANVAS_MIN_WIDTH = 600
export const LAYOUT_CANVAS_MIN_HEIGHT = 400

/**
 * Fixed chrome subtracted by the pre-existing WINDOW fallback, kept identical to
 * the blocks this module replaces: left sidebar 48, top bar 57, canvas toolbar
 * 72. Deliberately NO right-panel deduction — see the header: the dock's width
 * must not reach the canonical model.
 */
export const LAYOUT_CANVAS_FALLBACK_CHROME_X = 48
export const LAYOUT_CANVAS_FALLBACK_CHROME_Y = 57 + 72

export interface LayoutCanvasSize {
  width: number
  height: number
}

/**
 * The canvas size to pack the canonical model against.
 *
 * Measured from the live `.react-flow` rect, which spans the full pane: the dock
 * and the sidebar are `position: fixed` chrome ON TOP of it, so this reading is
 * panel-state-independent by construction rather than by intention. Falls back
 * to the window minus fixed chrome before the canvas has mounted, and returns
 * `null` when neither is measurable, so a caller never invents a size.
 *
 * @param flowEl optional explicit pane (comparison canvases pass their own).
 */
export function resolveLayoutCanvasSize(flowEl?: Element | null): LayoutCanvasSize | null {
  const el =
    flowEl ?? (typeof document !== 'undefined' ? document.querySelector('.react-flow') : null)
  const rect = el?.getBoundingClientRect()
  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      width: Math.max(LAYOUT_CANVAS_MIN_WIDTH, rect.width),
      height: Math.max(LAYOUT_CANVAS_MIN_HEIGHT, rect.height),
    }
  }
  if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
    return {
      width: Math.max(LAYOUT_CANVAS_MIN_WIDTH, window.innerWidth - LAYOUT_CANVAS_FALLBACK_CHROME_X),
      height: Math.max(LAYOUT_CANVAS_MIN_HEIGHT, window.innerHeight - LAYOUT_CANVAS_FALLBACK_CHROME_Y),
    }
  }
  return null
}

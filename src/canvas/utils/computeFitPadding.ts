/**
 * Panel-aware fitView padding for the decision-graph canvas.
 *
 * The `.react-flow` pane fills its container, but product chrome floats on top
 * of it (`position: fixed`): the OutputsDock on the right and the LeftSidebar
 * ("Canvas tools") on the left. React Flow's `fitView` frames the graph against
 * the *full* container, so a wide graph runs underneath those panels. This
 * helper returns per-side padding that reserves whatever those panels actually
 * occlude, so `fitView` frames the graph into the genuinely-visible canvas.
 *
 * Why px strings (xyflow v12 semantics): `fitView` padding as a bare number is
 * a *fraction* of the viewport — `0.2` resolves to `floor((V - V/1.2) * 0.5)`
 * ≈ 8.33% of V, NOT 20%. Only `'<n>px'` strings are pixels, and in the per-side
 * object form any omitted side defaults to 0. So we must return all four sides
 * as `'<n>px'` strings — a bare `{ right: 428 }` is read as a fraction and
 * collapses to ~half the pane (`floor((V - V/429) * 0.5)` ≈ 0.499·V), not 428px.
 *
 * Margin model — each side gets `max(baseMargin, occluderOverlap + GAP)`, then a
 * defensive clamp:
 *  - `baseMargin` is the breathing room when nothing occludes a side. It uses
 *    xyflow's own bare-number formula so it is expressed in the same units the
 *    rest of the codebase reasons about. See `BASE_RATIO` for why it was
 *    lowered from `0.2` on 15 Aug 2026 and what that changes.
 *  - Because the base is now smaller than the collapsed rail (~40px + 12px
 *    right gap) and the left sidebar (~52px) at laptop widths, those panels
 *    reserve their own overlap rather than hiding inside a larger base. That
 *    is the intended behaviour of this function — it clears the panel — it is
 *    simply no longer a no-op at those sizes.
 *  - Only an *expanded* panel (e.g. the ~416px OutputsDock) meaningfully exceeds
 *    `baseMargin` and pushes that side in, framing the graph clear of the panel.
 *  - A final clamp caps total per-axis padding at `MAX_PADDING_FRACTION` of the
 *    pane, so a huge panel on a tiny viewport can never consume the whole fitting
 *    area (which would make React Flow zoom pathologically).
 *
 * Overlap is measured against the live `.react-flow` rect (NOT window-relative
 * like FloatingOlumiPanel.measureDockInset), so it stays correct if the canvas
 * is offset or embedded.
 *
 * ⭐⭐ THE TOP BAR IS AN OCCLUDER, AND THIS FUNCTION USED TO SAY IT WAS NOT
 * (19 Aug 2026 — UX gate point 7b). The comment on the `top`/`bottom` branch
 * below read *"Top bar sits above `.react-flow` in the flex layout, so it never
 * overlaps the flow rect"*. **That was false at the deployed tip.** `TopBar`
 * has been a FLOATING PILL since the Miro-style header landed:
 * `position: fixed; top: 12px; left: 12px; height: 45px; z-index: 3000`
 * (`TopBar.module.css:1-19`), and `.react-flow` is the full window.
 *
 * Derived live on the deployed build `4d1e650b`, fresh guest, 1280x800:
 * `[role="banner"]` = `{left 12, top 12, right 526.6, bottom 57}`, `.react-flow`
 * = `{left 0, top 0, right 1280, bottom 800}`. So the bar overlaps the flow rect
 * by **57px** while this function reserved the 29px base margin — a fitted graph's
 * top row lands UNDER the bar BY CONSTRUCTION. At z-3000 over a z-0 canvas it is
 * not merely obscured but unclickable: `elementFromPoint` inside the bar returns
 * the bar's own controls. The UX gate measured the Decision node — the anchor of
 * the model — 33% / 18% / 12% behind it at 1280 / 1440 / 1512, with header
 * controls answering 3 of 4 hit probes inside it.
 *
 * ⚠ WHY THIS IS NOT THE RESERVATION THE HEADER BELOW ABOLISHES — AND THE FOUR
 * CRITERIA A CONTRIBUTOR MUST MEET, stated as a test rather than a slogan.
 *
 * The short rule used to read "only EDGE-ANCHORED, LAYOUT-RESERVING chrome
 * contributes". ⚠ **"LAYOUT-RESERVING" IS THE WRONG WORD AND ALWAYS WAS**
 * (adversarial review, 19 Aug 2026): all three contributors are
 * `position: fixed` and none of them reserves layout in the CSS sense — they
 * are overlays, and what this function does is buy the graph back the canvas
 * they permanently sit on. A contributor qualifies only if ALL FOUR hold:
 *
 *   1. **EDGE-ANCHORED** — pinned to the side it reserves from, so "how much
 *      does it occlude" has exactly one answer.
 *   2. **NOT USER-MOVABLE** — that answer cannot change under the user's hand.
 *   3. **NOT DISMISSIBLE** — the user cannot clear it, so the cost is not a
 *      charge for something they could remove.
 *   4. **PERSISTENT — present whenever the canvas is.** ⭐ ADDED BY REVIEW, and
 *      it is not hypothetical: the reviewer swept every `position: fixed` rule
 *      in `src/` and found **`ValidationChip`** (`fixed; bottom: 1rem;
 *      right: 1rem; z-1000`) passes 1-3 — edge-anchored, non-movable, and with
 *      no dismiss control — while being a transient corner chip that must never
 *      move the camera. Criteria 1-3 alone ADMIT IT.
 *
 * The floating conversation panel fails 1, 2 and 3, so "how much does it
 * occlude" has no single answer and clearing it cost a `cheapestClearance` band
 * of 392px / 52% of the fit box. The top bar passes all four, and its cost is
 * bounded and small: top goes 29px → 73px at 800px of pane, 5.5% of the
 * vertical, against 52%.
 *
 * ⚠ AND THE APPROXIMATION, STATED RATHER THAN DISCOVERED LATER: a rectangular
 * inset is a FULL BAND, and two of the three contributors do not span the edge
 * they reserve from — the LeftSidebar is 227px of an 800px edge, the top bar
 * 514.6px of a 1280px one. So this over-reserves on the part of the edge they
 * do not cover. That is a deliberate conservative approximation (the alternative
 * vocabulary — per-region insets — does not exist in `fitView`), it is what the
 * dock and sidebar have always done, and it is only defensible while the amount
 * stays small. It is a reason to keep the contributor set SHORT, not a reason to
 * reach for `cheapestClearance` again.
 *
 * Criteria 1-4 are **REVIEW-ONLY** — no mechanism can decide "persistent" or
 * "dismissible" from the bytes. What IS mechanised is that the set cannot grow
 * without someone applying them: see `FIT_PADDING_CONTRIBUTORS` below.
 *
 * ⭐⭐ THE STATED RULE, added 18 Aug 2026: **ONLY EDGE-ANCHORED, LAYOUT-RESERVING
 * CHROME CONTRIBUTES.** The OutputsDock and the LeftSidebar are edge-anchored, so
 * "how much do they occlude" has exactly one answer and the caller reserves it on
 * that side. The floating Olumi conversation panel is not, and it used to be
 * handled here anyway — converted into a rectangular inset by taking the cheapest
 * of four clearing directions.
 *
 * That conflated two concepts the founder ruled are different:
 *
 * > "DO NOT remove floating/concurrent Olumi… FLOATING AND LAYOUT-RESERVING ARE
 * > DIFFERENT CONCEPTS… FIX THE COMPOSITION, NOT THE CAPABILITY."
 *
 * A `fitView` padding is a rectangular inset and cannot express "this box is
 * covered", so the only way to clear a 400x550 overlay was to surrender a whole
 * band of canvas. Measured live at 1280x800 on the deployed build: **392px of
 * canvas, 52% of the resulting fit box** — the fit box was 368x742 with the panel
 * open against 760x742 without it, and at a dragged position it fell to 257 and
 * even 194px. Nought of twelve measured models cleared the 0.50 legibility floor
 * in that state; six of twelve clear it at 760.
 *
 * So the floating panel — and its side tab, and its minimised pill — now reserve
 * NOTHING, EVER. The panel keeps its capability and stops charging the graph for
 * it. Pinned by the padding-invariance guard (decision guard G2a) in
 * `computeFitPadding.spec.ts`.
 *
 * ⚠ THIS IS NOT "nothing may know the panel is there", and the difference is a
 * live regression if it is missed. `cameraComfort`'s no-churn rule asks whether a
 * target is *"off-screen, UNDER AN OCCLUDING PANEL, or rendered unreadably
 * small"*, and it derived that frame from this function. Deleting the branch here
 * ALONE scores a node behind the panel COMFORTABLE, so the focus camera silently
 * refuses to move — no error, no red, and "Ask Olumi about this node" quietly
 * stops working. The companion-aware COMFORT frame therefore lives in
 * `cameraComfort.ts` and landed in the same commit as this deletion. Padding is
 * about layout; comfort is about occlusion; they are not the same question.
 *
 * Scope caveat: with no `flowEl` argument this defaults to the FIRST `.react-flow`
 * in the document — correct for the single live main canvas (where the wired fit
 * sites run). Multi-canvas surfaces (comparison mode) use their own separate
 * fitView calls and are untouched; if a future caller needs a specific canvas,
 * pass its element explicitly.
 */

/**
 * Breathing margin around the graph, expressed in xyflow's bare-number padding
 * units (see the header note: `r` resolves to ~`r/(2(1+r))` of the dimension,
 * so `0.08` ≈ 3.7% per side, not 8%).
 *
 * ⚠ WAS `0.2` (≈8.33% per side). Measured 15 Aug 2026 at 1280x800 with the
 * committed CEE draft capture (17 nodes / 37 edges): `0.2` reserved 106px per
 * side horizontally and 66px vertically, leaving a 730x668 fitting box out of
 * a 1280x800 pane — 43% of the width gone before the dock's own reservation
 * was even counted. The drafted graph rendered at the `minZoom` legibility
 * floor with its left edge clipped under the floating Olumi panel.
 *
 * `0.08` keeps a genuine margin (47px horizontally / 29px vertically at
 * 1280x800) while returning ~170px of fitting box. It does NOT change how an
 * occluding panel is handled — each side is still
 * `max(baseMargin, occluderOverlap + GAP)`, so the dock and sidebar reserve
 * exactly what they occlude. The visible consequence of the lower base is that
 * the collapsed rail and the left sidebar now EXCEED it and reserve their own
 * overlap (68px for a 52px sidebar) instead of hiding inside a larger base —
 * which is the correct behaviour, just no longer "inert".
 */
const BASE_RATIO = 0.08
/** Breathing gap between the graph and an occluding panel edge. */
const GAP = 16
/**
 * The floating TopBar pill, spelled ONCE. `role="banner"` is the page's header
 * LANDMARK and there is exactly one in the app (`TopBar.tsx:209` is the only
 * `role="banner"` in `src/`) — so this binds to the bar by identity rather than
 * by a class name or a position predicate another fixed element could satisfy.
 * Pinned by `topBarFitInset.dom.spec.tsx`, which renders the real `TopBar` and
 * asserts the element this selector finds IS it, and that it is unique.
 */
export const TOP_BAR_SELECTOR = '[role="banner"]'
/** The OutputsDock (rail when collapsed, panel when expanded). */
export const DOCK_SELECTOR = 'aside[aria-label="Outputs dock"]'
/** The LeftSidebar ("Canvas tools"). */
export const SIDEBAR_SELECTOR = 'nav[aria-label="Canvas tools"]'

/**
 * THE DECLARED CONTRIBUTOR SET — the whole of it, and the only thing standing
 * between this function and the reservation it exists to have abolished.
 *
 * G2a (the padding-invariance guard) names three floating-panel selectors and
 * therefore only catches a re-admission spelled those three ways. This set is
 * the general case: `computeFitPadding.contributorSet.spec.ts` reads THIS FILE'S
 * BYTES, extracts every selector actually reached by `rectOf(...)` inside
 * `computeFitPadding`, and asserts the two sets are equal. A lane adding ANY
 * fourth occluder — by any selector — REDs it and must either declare it here,
 * having applied criteria 1-4 above, or not add it.
 *
 * ⚠ WHAT THIS CANNOT DO (trap 12d): it proves the code and this list AGREE. It
 * cannot prove the list is RIGHT — that is criteria 1-4, and they are
 * review-only. Deriving a guard from a list moves the risk; it does not remove
 * it. The same spec also asserts this function reaches for no store, so a
 * contributor smuggled in as state rather than as a rect REDs too.
 */
export const FIT_PADDING_CONTRIBUTORS = [DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR] as const
/** Never let combined per-axis padding exceed this fraction of the pane (keeps a fitting area). */
const MAX_PADDING_FRACTION = 0.8

/** A pixel padding string, e.g. `'120px'` — matches xyflow's `PaddingWithUnit`. */
type PxString = `${number}px`

export interface FitPadding {
  top: PxString
  right: PxString
  bottom: PxString
  left: PxString
}

/** Reproduces xyflow's bare-number padding → px, so the no-occluder case matches the old behaviour. */
function baseMargin(dimension: number): number {
  if (!Number.isFinite(dimension) || dimension <= 0) return 0
  return Math.max(0, Math.floor((dimension - dimension / (1 + BASE_RATIO)) * 0.5))
}

/**
 * Cap a pair of opposing paddings so their sum can't exceed `max`, scaling both
 * down proportionally when it would. Guarantees the pane keeps a fitting area.
 */
function capPair(a: number, b: number, max: number): [number, number] {
  const total = a + b
  if (total <= max || total <= 0) return [a, b]
  const k = max / total
  return [Math.floor(a * k), Math.floor(b * k)]
}

function rectOf(selector: string): DOMRect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

/**
 * Compute panel-aware `fitView` padding for the given flow element (defaults to
 * the live `.react-flow` element). Returns `'<n>px'` strings for all four sides.
 */
export function computeFitPadding(flowEl?: Element | null): FitPadding {
  const el =
    flowEl ?? (typeof document !== 'undefined' ? document.querySelector('.react-flow') : null)
  const flowRect = el?.getBoundingClientRect()

  // Base margin uses the flow rect when available, else the window — this keeps
  // a sensible result in tests / before the canvas has mounted.
  const width = flowRect?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0)
  const height = flowRect?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0)
  const baseX = baseMargin(width)
  const baseY = baseMargin(height)

  let right = baseX
  let left = baseX
  // Bottom keeps the base margin: nothing is anchored to the bottom edge of the
  // canvas. `top` is resolved against the floating top bar below — see the
  // header for why the old claim on this line ("the top bar never overlaps the
  // flow rect") was false at the deployed tip.
  let top = baseY
  let bottom = baseY

  if (flowRect) {
    // Right edge — OutputsDock (rail when collapsed, full panel when expanded).
    // Overlap = flowRect.right − dock.left, so it naturally includes the dock's
    // own right gap (the dock is positioned `right: 12`).
    const dock = rectOf(DOCK_SELECTOR)
    if (dock) {
      const overlap = Math.max(0, flowRect.right - dock.left)
      if (overlap > 0) right = Math.max(right, overlap + GAP)
    }
    // Left edge — LeftSidebar ("Canvas tools").
    const sidebar = rectOf(SIDEBAR_SELECTOR)
    if (sidebar) {
      const overlap = Math.max(0, sidebar.right - flowRect.left)
      if (overlap > 0) left = Math.max(left, overlap + GAP)
    }
    // Top edge — the floating TopBar pill (`role="banner"`, the header landmark).
    // MEASURED, NEVER NAMED AS A NUMBER: the bar's height is a CSS value that has
    // already moved once, and `--topbar-h` is a hand-maintained mirror of it
    // (`TopBar.tsx` writes the literal '57px' next to the comment "12px top + 45px
    // height"). Reading the live rect is the same derivation the dock and the
    // sidebar use, and it is the one that stays true when the bar's height,
    // padding or offset changes.
    const topBar = rectOf(TOP_BAR_SELECTOR)
    if (topBar) {
      const overlap = Math.max(0, topBar.bottom - flowRect.top)
      if (overlap > 0) top = Math.max(top, overlap + GAP)
    }

    // ⭐ NOTHING ELSE CONTRIBUTES. The floating conversation panel, its side tab
    // and its minimised pill are read here NOWHERE — deliberately, and see the
    // header for the 392px this gives back and for why `cameraComfort` still
    // observes the panel.
    //
    // ⚠ THE OLD SENTENCE HERE OVERCLAIMED, AND IT OVERCLAIMED ABOUT A GUARD, so
    // it taught readers to stop checking (adversarial review, 19 Aug 2026). It
    // said *"a future lane adding a free-floating occluder to this function REDs
    // the padding-invariance guard (G2a)"*. **G2a is three hardcoded selector
    // strings** — a re-admission under any OTHER selector, or via the store,
    // stays green. A hand-maintained mirror inside the guard written to prevent
    // one. The true scope: G2a REDs a re-admission of the panel BY THOSE THREE
    // SELECTORS. What catches the general case is the structural guard over
    // `FIT_PADDING_CONTRIBUTORS`, which is derived from these bytes.
  }

  // Defensive clamp: never reserve so much padding that the pane is left with no
  // room to fit into (a huge panel on a tiny viewport would otherwise blow up zoom).
  if (width > 0) [left, right] = capPair(left, right, Math.floor(width * MAX_PADDING_FRACTION))
  if (height > 0) [top, bottom] = capPair(top, bottom, Math.floor(height * MAX_PADDING_FRACTION))

  return {
    top: `${top}px`,
    right: `${right}px`,
    bottom: `${bottom}px`,
    left: `${left}px`,
  }
}

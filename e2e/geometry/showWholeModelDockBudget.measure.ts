/**
 * "SHOW WHOLE MODEL" AND THE DOCK — THE FRAME BUDGET, DERIVED.
 *
 * ⚠ RUN IT DELIBERATELY. `*.measure.ts` is not collected by the main e2e config
 * and no merge gate runs it:
 *
 *     GEOMETRY_PORT=5417 pnpm exec playwright test -c playwright.geometry.config.ts \
 *       e2e/geometry/showWholeModelDockBudget.measure.ts
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⭐⭐ WHY IT EXISTS, AND THE PREMISE IT CORRECTS.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This file was commissioned to fix a stated defect: *"'Show whole model' does
 * not show the whole model; the fit does not account for the 416px OutputsDock,
 * so elements land behind it."* **MEASURED, THAT PREMISE IS FALSE, AND THE
 * MEASUREMENT IS THE DELIVERABLE.**
 *
 * `computeFitPadding` measures the dock's live rect and reserves it: at 1280x800
 * with the dock at its 416px default it returns `right: 444px`, and the fit
 * frames into the 760px of canvas actually left over. **Across 190 arms of this
 * file — 19 full runs, 9 at `9c94a718` and 10 at the pre-band `72a43938`, five
 * shipped starters x two viewports, dock asserted expanded at 416px, the button
 * actually offered and clicked in 162 of them — ZERO model nodes end the click
 * behind the dock**, and the same on a further 20 arms at the rebased base. A further 30 arms run independently in review agree, as do
 * 5 arms at `a1fd39cc` (the build the complaint was taken on) and the 20-arm
 * fresh/restored sweep in `savedExampleShowWholeModel.measure.ts`. The button
 * reaches the dock-aware overview and stays there.
 *
 * ⭐ WHAT WAS ACTUALLY SEEN IS THE **DEFAULT VIEW**, NOT THE BUTTON.
 * `headcount-allocation` at 1280x800, dock expanded, after the product's own
 * automatic fit and before any click, has `opt_sales` (an option) and
 * `fac_quota_attainment` (a factor) behind the dock in **every** run.
 *
 * ⚠⚠ ITS COUNTER IS BIMODAL, THE MODE IS A RACE, AND — THE PART TWO SUCCESSIVE
 * DRAFTS OF THIS FILE GOT WRONG — **THE MODE IS NOT A PROPERTY OF THE VIEWPORT.**
 * `headcount-allocation`'s measured extent height races a corrective layout and
 * settles into one of two values, and the notice tracks it:
 *
 *     extent ~1472  ->  "Showing 14 of 16 elements"
 *     extent ~1524  ->  "Showing 10 of 16 elements"      <- as reported
 *
 * At 1280x800, n=9: **5 tall / 4 short**. At 1440x900, n=9: **1 tall / 8 short**.
 * At the pre-band commit, 1280x800, n=10: **1 tall / 9 short**. So BOTH modes
 * occur at BOTH viewports and at both commits, and the reported string is the
 * MAJORITY mode at 1280x800 once the sample is large enough to see it.
 *
 * ⚠ THIS IS THE SECOND TIME THIS FILE HAS MIS-STATED THIS, IN THE OPPOSITE
 * DIRECTION EACH TIME, AND BOTH TIMES FROM TOO FEW RUNS. Draft 1 quoted a
 * 1440x900 extent inside a 1280x800 sentence. Draft 2 corrected that and then
 * called the reported string "the rarer mode, 1 of 4" — from four runs that
 * happened to land 3-1, when nine land 5-4 the other way; and quoted a 1440x900
 * head range of `0.4990-0.4993` from four runs that ALL happened to be short
 * mode, when nine give **0.4820-0.4993** (which contains, exactly, the
 * independently measured 0.4820 / 0.4823 / 0.4973 that flagged it). **Neither
 * error was a viewport substitution; both were a range quoted from too small a
 * sample of a BIMODAL variable, which is the failure the run-count rule below
 * exists to catch.** Quote `n`, and quote it large enough to have seen both
 * modes.
 *
 * ⭐⭐ AND THE THIRD TIME IT HAPPENED, IT HAPPENED IN THE COLUMN NOBODY WAS
 * LOOKING AT. Drafts 1-3 applied the run-count rule to the HEAD column — the one
 * under scrutiny — and left the PRE-BAND column at n=4. Re-running it to n=10
 * turned up two more instances immediately: `headcount-allocation` at 1280x800
 * pre-band is NOT the deterministic "14 of 16" it was recorded as (its 9 short
 * runs say 14, its 1 tall run says 13), and `market-entry` pre-band is not
 * "12 of 18, 4 of 4" either (9 of 10, with one "10 of 18"). **A discipline
 * applied only where you are being watched is not a discipline; it is a
 * response.** The rule is per-COLUMN and per-CELL, and the cheapest way to
 * honour it is to sample every side of a comparison to the same depth BEFORE
 * writing any of it down.
 *
 * ⚠ AND THE NOTICE IS NOT THIS FILE'S `outsideVisible` — two questions, one
 * shape (CLAUDE.md trap 21). The notice counts the STORE's model against the
 * PADDED FRAME when it renders; `outsideVisible` counts RENDERED DOM boxes
 * against the visible canvas.
 *
 * ⭐ AND THE DIFFERENCE CANNOT BE A FRAME EFFECT, WHICH IS WHAT SETTLES IT: the
 * notice's frame is the STRICTER of the two — the padded frame is inset from the
 * visible canvas by `GAP` on every side — and yet it reports FEWER nodes outside
 * (2 against 6). A stricter frame cannot find less. What is left is the other
 * term: the notice reasons in MODEL units (`position + measured.height`) while
 * this file reasons in RENDERED pixels, and `measured.height x zoom` is not the
 * rendered height, because card height is itself zoom-dependent through
 * level-of-detail (the effect `canvasGateSet.ts` already names). Neither count
 * is wrong; they must not be arithmetically reconciled.
 *
 * ⭐⭐ THE MECHANISM IS A BUDGET, NOT A BUG.
 * The product's automatic fit is floored at `LABEL_LEGIBLE_ZOOM` (0.5) — below
 * it every node body renders blank, so an automatic fit is not allowed to park
 * there. `topAnchoredViewportWhenClamped` then pins the model's top-LEFT inside
 * the fit frame, which is the best available placement. Whatever will not fit at
 * 0.5 overflows the frame's RIGHT edge — and the right edge is where a 416px
 * opaque panel is. **The dock does not cause the loss; it decides that the loss
 * reads as "an option has vanished" rather than "the model continues off the
 * edge".**
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⭐⭐⭐ WHY NO DOCK CHANGE CAN FIX IT — AND THE ARGUMENT DELIBERATELY DOES NOT
 * REST ON A BINDING-AXIS LABEL.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The tempting statement is *"the binding axis is vertical, so the dock is
 * irrelevant"*. **An earlier draft of this docblock said exactly that, said it
 * of all five starters, and it was FALSE** — `headcount-allocation` at 1280x800
 * measures width-bound in some runs and height-bound in others, because the two
 * ceilings sit 0.8% apart inside a run-to-run band of up to 3.5%. A conclusion
 * resting on that comparison is a coin toss dressed as a measurement.
 *
 * **So the load-bearing quantity is `heightOnlyCeiling` — `frameHeight /
 * modelHeight`, the zoom the model could reach IF EVERY HORIZONTAL OCCLUDER
 * VANISHED.** It is structurally untouched by the dock's width, by collapsing it,
 * by removing it, and by the sidebar, because `computeFitPadding`'s only cap
 * (`capPair` / `MAX_PADDING_FRACTION`) is applied PER AXIS. Measured at head,
 * 1280x800, **n=9**, against a floor of **0.50**:
 *
 *     build-vs-buy          0.2361-0.2428   headcount-allocation  0.4164-0.4314
 *     vendor-selection      0.2892-0.2994   pricing-model         0.4014-0.4137
 *     market-entry          0.2747
 *
 * **Not one clears the floor, and the highest is 13.7% below it.** Collapsing the
 * dock (416 -> 40px) widens the frame 760 -> 1136 and moves none of these
 * numbers at all. **No horizontal change makes any starter whole-and-legible at
 * 1280x800.** That holds however the binding-axis coin lands, which is the point
 * of stating it this way.
 *
 * ⚠ ONE RESIDUAL, STATED RATHER THAN LEFT TO BE FOUND: `extent.height` is read
 * from `measured` UNDER THE CURRENT CAMERA, so `heightOnlyCeiling` is not
 * strictly a constant of the model — it inherits the same bimodal race as the
 * notice above. It survives that because the margin it is asked to carry is
 * 13.7% and the observed spread is 3.5%. A future model whose ceiling sits
 * within a few percent of the floor would need this re-derived at a pinned
 * camera before the same argument could be made about it.
 *
 * The frame at head: **760 x 635** at 1280x800 and **920 x 735** at 1440x900 —
 * 520px of horizontal chrome and **165px of vertical**, the latter being the
 * floating TopBar pill (73) and the `CanvasOverlayBand` (92).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ AND THE VERTICAL BUDGET IS NOT A STANDING FACT — 56% OF IT ARRIVED WITH
 * `#1162`, AND IT TOOK TWO STARTERS BELOW THE FLOOR THE SAME NIGHT.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Measured at the pre-band parent `72a43938` (**n=10**) against head (**n=9**),
 * with this file's frame reproducing `computeFitPadding`'s base margin so the
 * comparison is like-for-like:
 *
 *     vertical chrome   1280x800   102px -> 165px   (the band costs 63px)
 *                       1440x900   106px -> 165px   (the band costs 59px)
 *
 * At **1440x900** that crosses the legibility floor for two of the five, and
 * **BOTH crossings are user-visible**. ⚠ ONE METRIC ON BOTH SIDES — this table
 * previously quoted `heightOnlyCeiling` on the pre-band side and
 * `zoomToShowWhole` on the head side, a substitution that is INVISIBLE at head
 * because head is height-bound and the two coincide there. Both columns are
 * `zoomToShowWhole` (pre-band n=10, head n=9):
 *
 *     pricing-model         0.5013-0.5173 -> 0.4646-0.4788   above -> below floor
 *         clears floor: 10 of 10  ->  0 of 9
 *         first view:  no extent notice, 10 of 10  ->  "Showing 14 of 15", 9 of 9
 *
 *     headcount-allocation  0.5180        -> 0.4817-0.4993   above -> below floor
 *         (pre-band is WIDTH-bound and dead constant at 920/1776; its height
 *          ceiling was 0.5210-0.5394, so BOTH quantities cleared)
 *         clears floor: 10 of 10  ->  0 of 9
 *         first view:  no extent notice, 10 of 10  ->  "Showing 15 of 16", 1 of 9
 *
 * ⚠ AN EARLIER DRAFT SAID `headcount-allocation` "offered no notice in any of
 * this file's runs at either commit" — TRUE OF ITS FOUR RUNS AND FALSE OF NINE,
 * and it halved this file's own most decision-relevant finding. **There are two
 * crossings, not one.** The headcount one is intermittent because it is gated on
 * the TALL extent mode above: of the nine head runs, the single tall one is
 * exactly the one that offers the button — and independently reproduced 7 of 7
 * on a sample that split 3 tall / 1 short. Pre-band, the tall mode still cleared
 * on both quantities. **So the band does not make the race; it turns the race's
 * tall arm from harmless into user-visible.**
 *
 * ⭐ AND IT IS NOT ONLY 1440x900. At **1280x800** three starters report strictly
 * MORE of the model hidden in the default view at head (pre-band n=10, head n=9):
 *
 *     market-entry     "12 of 18" 9/10, "10 of 18" 1/10  ->  "9 of 18"  9/9
 *     pricing-model    "12 of 15" 10/10                  ->  "10 of 15" 9/9
 *     headcount-alloc  "14 of 16" 8/10, "13 of 16" 2/10  ->  "14 of 16" 4/9,
 *                                                            "10 of 16" 5/9
 *
 * ⭐ READ THE HEADCOUNT ROW BY MODE, BECAUSE THE FLAT NUMBERS HIDE THE EFFECT.
 * Split by the extent race, pre-band n=10 against head n=9:
 *
 *     short mode  "14 of 16", 9 of 9 pre-band  ->  "14 of 16", 4 of 4 head
 *     tall mode   "13 of 16", 1 of 1 pre-band  ->  "10 of 16", 5 of 5 head
 *
 * **The band costs this starter NOTHING in the short mode and THREE more hidden
 * elements in the tall one** — not the flat "14 -> 10" an earlier draft implied,
 * which was wrong at both ends. `market-entry` is the contrast that shows the
 * band's cost is not merely a race artefact: its extent is **2312 in all 19
 * runs, no race at all**, and it still loses three elements.
 *
 * **This is a regression in the product's first view, and it is the most
 * decision-relevant number here.** It is REPORTED, not acted on: `#1162` solved
 * a real overlap defect, and trading its band back for 60px is a founder call.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE ASSERTS, AND WHAT IT ONLY RECORDS.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * HARD ASSERTION — one, and it is the button's promise against the dock:
 * **after the click, no model node's rendered box crosses `dock.left`.** That is
 * the regression guard the premise deserved: it passes today, and it REDs the
 * moment the dock stops being reserved. Proven to bite by a DISCRIMINATING
 * MUTANT PAIR (CLAUDE.md trap 19) — deleting the DOCK branch of
 * `computeFitPadding` REDs it; deleting the SIDEBAR branch leaves it GREEN, so
 * it is bound to the dock and not merely to "the padding changed".
 *
 * RECORDED, NEVER ASSERTED — the frame budget and the default view. A product
 * assertion on those would be this lane deciding the legibility/visibility trade
 * silently, which is a founder decision, and it would abort the run on the first
 * arm and cost the rest.
 *
 * ⚠ QUOTE THE NUMBERS WITH THEIR RUN COUNT. Two runs AT THE SAME COMMIT differ
 * by up to 3.5% on `zoomToShowWhole`, because measured card heights race
 * corrective layout passes. Every figure above carries its `n`. A single-run
 * figure from this harness is an anecdote, and the 1440x900
 * `headcount-allocation` arm is the standing proof of why.
 *
 * ⭐ THE INSTRUMENT IS ASSERTED BEFORE ANY COUNT (CLAUDE.md trap 13). A sibling
 * lane's harness measured zero because its fixture never mounted the component
 * under test, and a zero for the wrong reason is indistinguishable from a pass.
 * So every arm proves, before it counts anything: the pane renders, the model
 * nodes are PRESENT and agree with the store, and the dock is present, EXPANDED,
 * and at its ~416px default width. A collapsed dock would make the central
 * assertion vacuous — there would be nothing to hide behind.
 *
 * ⚠ THE VISIBLE CANVAS HERE INCLUDES THE OVERLAY BAND, AND THE TWO OLDER
 * "show whole model" MEASURES DO NOT. `showWholeModel.measure.ts` and
 * `savedExampleShowWholeModel.measure.ts` both take `bottom: flow.bottom`,
 * which predates `CanvasOverlayBand` (#1162) and is now a fourth occluder they
 * cannot see. On `headcount-allocation`'s default view at head the sets are
 * disjoint and add up: **2 behind the dock + 4 below the band's top edge = the 6
 * this file reports outside**, and those 4 are invisible to a band-blind frame.
 * REPORTED here rather than edited into files this lane does not own.
 *
 * ⭐ RE-MEASURED ACROSS A REBASE, because the base moved under this branch and
 * `#1166` changed `OptionNode`'s card copy — which is exactly the kind of change
 * that moves measured card heights and therefore every extent above. Re-run at
 * `bd18bace` (n=2, 20 arms): the frame is unchanged at 760x635 / 920x735 with
 * 165px of vertical chrome, the guard is still 0 arms behind the dock, and every
 * head range above still contains the new readings — `headcount-allocation` at
 * 1440x900 read 0.4817 against the n=9 low of 0.4820, three ten-thousandths
 * outside, so that range says 0.4817. Nothing else moved outside its band.
 *
 * STATE CLASS (status-ladder fixture rule): FRESH seeded starter draft, no prior
 * camera, real clock, animations ON (`reducedMotion: no-preference`) — freezing
 * motion collapses `cameraDuration` to 0 and removes the window the camera
 * animates through.
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import { seedStarterDraft, type StarterId } from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'
import { LABEL_LEGIBLE_ZOOM } from '../../src/canvas/utils/zoomLegibility'

const STARTERS: StarterId[] = [
  'build-vs-buy',
  'vendor-selection',
  'market-entry',
  'headcount-allocation',
  'pricing-model',
]

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]

/**
 * The dock's expanded default is `--dock-right-expanded: 26rem` = 416px
 * (`OutputsDock.tsx` `asideStyle`). The band is deliberately wide rather than a
 * literal: the dock is user-resizable and the assertion means "expanded at
 * something like its default", not "exactly 416".
 */
const DOCK_EXPANDED_MIN = 380
const DOCK_EXPANDED_MAX = 500

interface Reading {
  zoom: number
  x: number
  y: number
  /** Model nodes whose rendered box crosses `dock.left` — the guarded set. */
  behindDock: string[]
  /** Model nodes whose rendered box crosses the overlay band's top edge. */
  underBand: string[]
  /** Model nodes leaving the visible canvas by ANY edge (band included). */
  outsideVisible: string[]
  /** Model nodes leaving the pane entirely. */
  outsidePane: string[]
  modelNodeCount: number
  storeModelNodeCount: number
  notice: string | null
  showAllPresent: boolean
  /** The fit frame, derived from the live occluder rects. */
  frame: { left: number; right: number; top: number; bottom: number }
  /** The model's extent in flow units, from the store's measured node boxes. */
  extent: { width: number; height: number }
  /** Occluder presence — the instrument's own witness. */
  occluders: { dock: boolean; dockWidth: number; dockComposition: string | null; sidebar: boolean; banner: boolean; band: boolean }
  paneWidth: number
  paneHeight: number
}

/**
 * ⚠ THE FRAME IS DERIVED FROM THE LIVE RECTS, NEVER FROM NAMED NUMBERS, and it
 * reproduces `computeFitPadding`'s four contributors — dock, sidebar, TopBar
 * banner, overlay band — including its 16px `GAP`. Restating the numbers here
 * would be a hand-maintained mirror of the module under measurement (trap 12),
 * and a mirror that drifts would read GREEN.
 */
const FIT_GAP = 16

async function readFrame(page: Page, ghostPrefix: string): Promise<Reading> {
  return page.evaluate((gp: string) => {
    const GAP = 16
    const flowEl = document.querySelector('.react-flow')
    if (!flowEl) throw new Error('instrument: no .react-flow')
    const flow = flowEl.getBoundingClientRect()
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!vpEl) throw new Error('instrument: no .react-flow__viewport')
    const m = new DOMMatrixReadOnly(getComputedStyle(vpEl).transform)

    const rectOf = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r : null
    }
    const dock = rectOf('aside[aria-label="Outputs dock"]')
    const sidebar = rectOf('nav[aria-label="Canvas tools"]')
    const banner = rectOf('[role="banner"]')
    const band = rectOf('[data-canvas-overlay-band]')

    // ⭐ THE FRAME REPRODUCES `computeFitPadding` EXACTLY, INCLUDING ITS BASE
    // MARGIN — `max(baseMargin, occluderOverlap + GAP)` per side, with
    // `baseMargin(d) = floor((d - d / (1 + BASE_RATIO)) * 0.5)` and
    // BASE_RATIO 0.08. An earlier cut of this file fell back to the raw flow
    // edge when a contributor was ABSENT, which silently overstated the frame
    // by the base margin on that side — invisible at this tip (all four
    // contributors exceed their base) and a 29px error at 1280x800 on any
    // commit predating `CanvasOverlayBand`, which is exactly the comparison
    // this file is used for. Reproducing the whole formula removes the caveat
    // rather than carrying it.
    // ⚠ SCOPE — TWO DELIBERATE DIVERGENCES FROM `computeFitPadding`, BOTH
    // STRUCTURALLY UNREACHABLE AT THE VIEWPORTS THIS FILE DRIVES, NAMED HERE
    // BECAUSE THE FILE EXISTS FOR CROSS-COMMIT WORK AND A FUTURE ARM MAY LEAVE
    // THAT RANGE. (1) The module clamps each overlap with `Math.max(0, ...)`;
    // this does not, so an occluder positioned entirely OUTSIDE the flow rect
    // would contribute a negative overlap here and zero there — it cannot
    // happen while all four are pinned to the pane's own edges. (2) The module
    // applies `capPair` / `MAX_PADDING_FRACTION` (0.8), which this omits; at
    // 1280x800 the per-axis totals are 520/1024 horizontally and 165/640
    // vertically, so the cap is nowhere near binding. Re-derive both before
    // trusting this frame on a materially smaller pane.
    const BASE_RATIO = 0.08
    const baseMargin = (d: number) =>
      Number.isFinite(d) && d > 0 ? Math.max(0, Math.floor((d - d / (1 + BASE_RATIO)) * 0.5)) : 0
    const baseX = baseMargin(flow.width)
    const baseY = baseMargin(flow.height)
    const frame = {
      left: flow.left + Math.max(baseX, sidebar ? sidebar.right - flow.left + GAP : 0),
      right: flow.right - Math.max(baseX, dock ? flow.right - dock.left + GAP : 0),
      top: flow.top + Math.max(baseY, banner ? banner.bottom - flow.top + GAP : 0),
      bottom: flow.bottom - Math.max(baseY, band ? flow.bottom - band.top + GAP : 0),
    }

    const nodes = (Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[])
      .map((el) => ({ id: el.getAttribute('data-id') ?? '', r: el.getBoundingClientRect() }))
      .filter((n) => !n.id.startsWith(gp))

    // BOUND BY IDENTITY, NEVER BY A VALUE PREDICATE (trap 19): the guarded set is
    // "nodes crossing the rect of the element whose aria-label is the dock's",
    // named by node id — not "nodes beyond some x".
    const behindDock = dock
      ? nodes.filter((n) => n.r.right > dock.left).map((n) => n.id).sort()
      : []
    const underBand = band
      ? nodes.filter((n) => n.r.bottom > band.top).map((n) => n.id).sort()
      : []
    const outsideVisible = nodes
      .filter(
        (n) =>
          n.r.left < (sidebar ? sidebar.right : flow.left) ||
          n.r.right > (dock ? dock.left : flow.right) ||
          n.r.top < (banner ? banner.bottom : flow.top) ||
          n.r.bottom > (band ? band.top : flow.bottom),
      )
      .map((n) => n.id)
      .sort()
    const outsidePane = nodes
      .filter((n) => n.r.left < flow.left || n.r.right > flow.right || n.r.top < flow.top || n.r.bottom > flow.bottom)
      .map((n) => n.id)
      .sort()

    const w = window as unknown as {
      useCanvasStore: {
        getState: () => {
          nodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>
        }
      }
    }
    const storeNodes = w.useCanvasStore.getState().nodes.filter((n) => !n.id.startsWith(gp))
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of storeNodes) {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + (n.measured?.width ?? 0))
      maxY = Math.max(maxY, n.position.y + (n.measured?.height ?? 0))
    }

    return {
      zoom: m.a,
      x: m.e,
      y: m.f,
      behindDock,
      underBand,
      outsideVisible,
      outsidePane,
      modelNodeCount: nodes.length,
      storeModelNodeCount: storeNodes.length,
      notice: document.querySelector('[data-testid="model-extent-count"]')?.textContent ?? null,
      showAllPresent: !!document.querySelector('[data-testid="model-extent-show-all"]'),
      frame,
      extent: {
        width: Number.isFinite(maxX - minX) ? Math.round(maxX - minX) : 0,
        height: Number.isFinite(maxY - minY) ? Math.round(maxY - minY) : 0,
      },
      occluders: {
        dock: !!dock,
        dockWidth: dock ? Math.round(dock.width) : 0,
        dockComposition:
          (document.querySelector('aside[aria-label="Outputs dock"]') as HTMLElement | null)?.getAttribute(
            'data-panel-composition',
          ) ?? null,
        sidebar: !!sidebar,
        banner: !!banner,
        band: !!band,
      },
      paneWidth: flow.width,
      paneHeight: flow.height,
    }
  }, ghostPrefix)
}

/** Block until `layoutVersion` has not moved and no layout is pending. */
async function layoutSettled(page: Page, stableMs = 1500, timeoutMs = 45_000): Promise<void> {
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as {
        useCanvasStore: {
          getState: () => { layoutVersion: number; pendingLayout: boolean; layoutInProgress: boolean }
        }
        __lvLast?: number
        __lvSince?: number
      }
      const s = w.useCanvasStore.getState()
      if (s.pendingLayout || s.layoutInProgress) return false
      const now = performance.now()
      if (w.__lvLast !== s.layoutVersion) {
        w.__lvLast = s.layoutVersion
        w.__lvSince = now
        return false
      }
      return now - (w.__lvSince ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 100 },
  )
}

/**
 * ⚠ A FIXED SETTLE, NOT A "has the transform stopped moving" POLL — and the
 * difference cost this lane a false defect before it was caught.
 *
 * A stability poll that keeps its `lastTransform` on `window` between calls
 * returns TRUE IMMEDIATELY on the next call, because the pre-click transform is
 * still in place for the ~160ms between the click and the animation's first
 * frame and already satisfies the stability window from the PREVIOUS call. The
 * reading then lands mid-animation and reads as "the button stopped short".
 * Measured: it reported `vendor-selection` settling at zoom 0.485 with 7 nodes
 * outside, on a run that in fact reached 0.289 with none.
 *
 * `showWholeModel.measure.ts` and `savedExampleShowWholeModel.measure.ts` share
 * that helper shape. Neither is bitten at this tip — both arms happen to read
 * after the animation — but the latch is stale in both. REPORTED, not edited.
 */
const SETTLE_MS = 3000

async function boot(page: Page, starter: StarterId, size: { width: number; height: number }): Promise<void> {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins }: { flagPins: Array<{ storageKey: string; value: string }> }) => {
      try {
        localStorage.clear()
        sessionStorage.clear()
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
      } catch {
        /* the instrument assertions below catch a dead storage */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )
  await page.setViewportSize(size)
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
  })
  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 150_000 })
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore?.getState ===
      'function',
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
  const seeded = await seedStarterDraft(page, starter)
  expect(seeded.nodeCount, `instrument: ${starter} seeded no nodes`).toBeGreaterThan(0)
  await layoutSettled(page)
  await page.waitForTimeout(1200)
}

for (const size of SIZES) {
  for (const starter of STARTERS) {
    test(`"Show whole model" clears the dock — ${starter} @${size.width}x${size.height}`, async ({ page }) => {
      await boot(page, starter, size)

      const before = await readFrame(page, GHOST_ID_PREFIX)

      // ── THE INSTRUMENT, ASSERTED BEFORE ANY COUNT ──────────────────────────
      // Each of these can independently make the guard below vacuous: no nodes
      // to hide, a store the DOM disagrees with, or a dock too narrow to hide
      // anything behind.
      expect(before.modelNodeCount, `instrument: no model nodes rendered (${starter})`).toBeGreaterThan(0)
      expect(
        before.modelNodeCount,
        `instrument: DOM/store node counts disagree (${starter}) — the count is measuring the wrong set`,
      ).toBe(before.storeModelNodeCount)
      expect(before.occluders.dock, `instrument: the OutputsDock is not mounted (${starter})`).toBe(true)
      expect(
        before.occluders.dockComposition,
        `instrument: the dock is not EXPANDED — nothing could hide behind it (${starter})`,
      ).toBe('expanded')
      expect(
        before.occluders.dockWidth,
        `instrument: dock width ${before.occluders.dockWidth}px is outside its expanded default band (${starter})`,
      ).toBeGreaterThanOrEqual(DOCK_EXPANDED_MIN)
      expect(before.occluders.dockWidth).toBeLessThanOrEqual(DOCK_EXPANDED_MAX)
      expect(before.extent.width, `instrument: the model has no measured extent (${starter})`).toBeGreaterThan(0)
      expect(before.extent.height).toBeGreaterThan(0)

      // ── THE FRAME BUDGET — RECORDED, NEVER ASSERTED ────────────────────────
      const frameW = before.frame.right - before.frame.left
      const frameH = before.frame.bottom - before.frame.top
      const widthOnlyCeiling = frameW / before.extent.width
      const heightOnlyCeiling = frameH / before.extent.height
      const zoomToShowWhole = Math.min(widthOnlyCeiling, heightOnlyCeiling)
      const bindingAxis = widthOnlyCeiling < heightOnlyCeiling ? 'width' : 'height'
      const chromeVertical = before.paneHeight - frameH
      const chromeHorizontal = before.paneWidth - frameW

      const clicked = before.showAllPresent
      let after: Reading | null = null
      if (clicked) {
        await page.locator('[data-testid="model-extent-show-all"]').click()
        await page.waitForTimeout(SETTLE_MS)
        after = await readFrame(page, GHOST_ID_PREFIX)
      }

      // eslint-disable-next-line no-console
      console.log(
        'DOCKFITJSON ' +
          JSON.stringify({
            starter,
            viewport: `${size.width}x${size.height}`,
            stateClass: 'FRESH',
            gap: FIT_GAP,
            legibilityFloor: LABEL_LEGIBLE_ZOOM,
            budget: {
              pane: { width: before.paneWidth, height: before.paneHeight },
              frame: { width: Math.round(frameW), height: Math.round(frameH) },
              chrome: { horizontal: Math.round(chromeHorizontal), vertical: Math.round(chromeVertical) },
              extent: before.extent,
              zoomToShowWhole: +zoomToShowWhole.toFixed(4),
              // ⭐ THE TWO CEILINGS SEPARATELY, because the founder-facing
              // question "would collapsing the dock fix this?" is answered by
              // `heightOnlyCeiling` ALONE — it is what the model could reach if
              // every horizontal occluder vanished, and no dock change moves it.
              widthOnlyCeiling: +widthOnlyCeiling.toFixed(4),
              heightOnlyCeiling: +heightOnlyCeiling.toFixed(4),
              bindingAxis,
              clearsLegibilityFloor: zoomToShowWhole >= LABEL_LEGIBLE_ZOOM,
            },
            defaultView: {
              zoom: +before.zoom.toFixed(4),
              notice: before.notice,
              behindDock: before.behindDock,
              underBand: before.underBand,
              outsideVisible: before.outsideVisible,
              outsidePane: before.outsidePane,
            },
            afterClick: after
              ? {
                  zoom: +after.zoom.toFixed(4),
                  notice: after.notice,
                  behindDock: after.behindDock,
                  underBand: after.underBand,
                  outsideVisible: after.outsideVisible,
                  outsidePane: after.outsidePane,
                }
              : null,
            clicked,
            occluders: before.occluders,
          }),
      )

      // ── THE ONE HARD PRODUCT ASSERTION: THE BUTTON CLEARS THE DOCK ─────────
      // Skipped, loudly, when the notice is absent — there is no button to press
      // and asserting on the default view would be asserting the trade this file
      // deliberately only records.
      if (!clicked) {
        test.info().annotations.push({
          type: 'note',
          description: `${starter} @${size.width}x${size.height}: the model already fits the visible canvas, so no "Show whole model" is offered — nothing to assert.`,
        })
        return
      }
      expect(after, 'instrument: no post-click reading').not.toBeNull()
      expect(
        after!.occluders.dock,
        'instrument: the dock disappeared across the click — the assertion below would be vacuous',
      ).toBe(true)
      expect(
        after!.behindDock,
        `"Show whole model" left ${after!.behindDock.length} of ${after!.modelNodeCount} model nodes behind the ` +
          `${after!.occluders.dockWidth}px OutputsDock (settled zoom ${after!.zoom.toFixed(4)}, ` +
          `notice ${JSON.stringify(after!.notice)})`,
      ).toEqual([])
    })
  }
}

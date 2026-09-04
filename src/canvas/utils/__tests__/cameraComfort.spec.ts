/**
 * cameraComfort — the pinned "no camera churn" rule shared by F2 (focus) and
 * F4 (pulse fit).
 *
 * THE RULE (Paul-ratified F2/F4, graph-visuals): the camera must NOT move
 * when every target node is already comfortably visible — meaning each
 * target's rect sits fully inside the panel-aware fit frame (the pane inset
 * by computeFitPadding's per-side margins, with a small slack so a frame the
 * camera just fitted still counts) AT a readable zoom (>= MIN_READABLE_ZOOM).
 * Anything less — a target off-screen, under an occluding panel, or rendered
 * unreadably small — and the camera fits.
 *
 * Fail-open to fitting: an unmeasurable pane (jsdom, pre-mount) or an empty
 * target list is NOT comfortable, so callers fall back to today's fit.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  nodesComfortablyVisible,
  paddingToInsets,
  readFocusCamera,
  MIN_READABLE_ZOOM,
  COMFORT_SLACK_PX,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  topAnchoredViewportWhenClamped,
} from '../cameraComfort'
import { computeFitPadding, DOCK_SELECTOR, SIDEBAR_SELECTOR } from '../computeFitPadding'
import { dockWidthBounds, responsiveDockWidth } from '../../components/dockWidth'

const PANE_W = 1000
const PANE_H = 800
const INSETS = { top: 80, right: 80, bottom: 80, left: 80 }

const sized = (x: number, y: number, width = 200, height = 80) => ({
  position: { x, y },
  measured: { width, height },
})

describe('nodesComfortablyVisible — the pinned no-churn rule', () => {
  it('a node fully inside the fit frame at zoom 1 is comfortable', () => {
    const node = sized(200, 200)
    expect(
      nodesComfortablyVisible([node], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(true)
  })

  it('below MIN_READABLE_ZOOM is NEVER comfortable, even fully in frame', () => {
    const node = sized(400, 300, 100, 40)
    expect(
      nodesComfortablyVisible(
        [node],
        { x: 0, y: 0, zoom: MIN_READABLE_ZOOM - 0.1 },
        PANE_W,
        PANE_H,
        INSETS,
      ),
    ).toBe(false)
  })

  it('exactly MIN_READABLE_ZOOM counts as readable (>= boundary)', () => {
    const node = sized(400, 300, 100, 40)
    expect(
      nodesComfortablyVisible(
        [node],
        { x: 0, y: 0, zoom: MIN_READABLE_ZOOM },
        PANE_W,
        PANE_H,
        INSETS,
      ),
    ).toBe(true)
  })

  it('a node poking past the right frame edge is not comfortable', () => {
    // 780 + 200 = 980 > 1000 - 80 (right inset) → outside the frame
    const node = sized(780, 200)
    expect(
      nodesComfortablyVisible([node], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(false)
  })

  it('a node under an expanded panel inset (occluded) is not comfortable', () => {
    // Node at x 600..800 would clear an 80px inset but NOT a 320px dock inset
    const node = sized(600, 200)
    const dockInsets = { ...INSETS, right: 320 }
    expect(
      nodesComfortablyVisible([node], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, dockInsets),
    ).toBe(false)
  })

  it('a node off-screen above (negative screen y) is not comfortable', () => {
    const node = sized(200, -400)
    expect(
      nodesComfortablyVisible([node], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(false)
  })

  it('viewport translation is applied: an off-origin node panned into frame IS comfortable', () => {
    // Flow position (1000, 1000) with viewport x/y -800 → screen (200, 200)
    const node = sized(1000, 1000)
    expect(
      nodesComfortablyVisible([node], { x: -800, y: -800, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(true)
  })

  it('ALL targets must be in frame — one stray neighbour breaks comfort', () => {
    const inFrame = sized(200, 200)
    const stray = sized(2000, 200)
    expect(
      nodesComfortablyVisible([inFrame, stray], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(false)
  })

  it('an empty target list is not comfortable (nothing to be comfortable about)', () => {
    expect(nodesComfortablyVisible([], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS)).toBe(
      false,
    )
  })

  it('an unmeasurable pane (0×0, e.g. jsdom) is not comfortable — callers fall back to fitting', () => {
    const node = sized(200, 200)
    expect(nodesComfortablyVisible([node], { x: 0, y: 0, zoom: 1 }, 0, 0, INSETS)).toBe(false)
  })

  it('a missing viewport is not comfortable', () => {
    const node = sized(200, 200)
    expect(nodesComfortablyVisible([node], null, PANE_W, PANE_H, INSETS)).toBe(false)
  })

  it('falls back to DEFAULT_NODE_WIDTH/HEIGHT when a node has no measured dims', () => {
    // With default dims the node at x=850 overflows the right frame edge;
    // if unmeasured nodes were treated as 0-sized this would wrongly pass.
    const unmeasured = { position: { x: PANE_W - INSETS.right - DEFAULT_NODE_WIDTH + 40, y: 200 } }
    expect(
      nodesComfortablyVisible([unmeasured], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(false)
    const wellInside = { position: { x: 300, y: 300 } }
    expect(DEFAULT_NODE_HEIGHT).toBeGreaterThan(0)
    expect(
      nodesComfortablyVisible([wellInside], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(true)
  })

  it('COMFORT_SLACK_PX: a node exactly on the fit-frame boundary still counts (a just-fitted frame is comfortable)', () => {
    // Node left edge lands exactly at the inset → inside thanks to slack
    const node = sized(INSETS.left, INSETS.top, 200, 80)
    expect(
      nodesComfortablyVisible([node], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(true)
    // …and a couple of px of animation-end drift is also forgiven
    const drifted = sized(INSETS.left - (COMFORT_SLACK_PX - 2), INSETS.top, 200, 80)
    expect(
      nodesComfortablyVisible([drifted], { x: 0, y: 0, zoom: 1 }, PANE_W, PANE_H, INSETS),
    ).toBe(true)
  })
})

describe('paddingToInsets — bridges computeFitPadding px strings to numeric insets', () => {
  it('parses per-side px strings', () => {
    expect(
      paddingToInsets({ top: '10px', right: '428px', bottom: '10px', left: '68px' }),
    ).toEqual({ top: 10, right: 428, bottom: 10, left: 68 })
  })
})

/**
 * readFocusCamera — the DOM measurement bridge BOTH F2 and F4 depend on for
 * the no-churn decision (adversarial review finding 7: every fit-seam test
 * replaces it with a spy, so the real bridge never executed under test).
 *
 * Exercised here against the REAL computeFitPadding — only the element rects
 * are faked — so the panel-aware measurement is genuinely run.
 */
function fakeEl(rect: Partial<DOMRect>): HTMLElement {
  const full = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect
  return { getBoundingClientRect: () => full } as unknown as HTMLElement
}

function stubSelectors(map: Record<string, HTMLElement | null>) {
  vi.spyOn(document, 'querySelector').mockImplementation(
    (sel: string) => (sel in map ? map[sel] : null) as Element | null,
  )
}

const FLOW = '.react-flow'
const DOCK = 'aside[aria-label="Outputs dock"]'
const VIEWPORT = { x: 12, y: 34, zoom: 0.9 }
const getViewport = () => VIEWPORT

describe('readFocusCamera — the live camera measurement bridge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when there is no .react-flow element (pre-mount)', () => {
    stubSelectors({})
    expect(readFocusCamera(getViewport)).toBeNull()
  })

  it('returns null when the pane is unmeasurable (0×0, e.g. jsdom) — callers fail open and fit', () => {
    stubSelectors({ [FLOW]: fakeEl({ width: 0, height: 0 }) })
    expect(readFocusCamera(getViewport)).toBeNull()
  })

  it('reports the caller’s viewport and the measured pane size', () => {
    stubSelectors({ [FLOW]: fakeEl({ width: 1440, height: 900, left: 0, right: 1440 }) })
    const camera = readFocusCamera(getViewport)
    expect(camera?.viewport).toEqual(VIEWPORT)
    expect(camera?.paneWidth).toBe(1440)
    expect(camera?.paneHeight).toBe(900)
  })

  it('SAME-FRAME RULE: insets are exactly the parsed form of the padding it hands the fit', () => {
    // Finding 4's regression in one assertion — the gate (insets) and the fit
    // (padding) must describe ONE rect. If they ever diverge, the camera moves
    // and leaves an occluded target occluded.
    stubSelectors({
      [FLOW]: fakeEl({ width: 1440, height: 900, left: 0, right: 1440 }),
      [DOCK]: fakeEl({ width: 416, height: 900, left: 1012, right: 1428 }),
    })
    const camera = readFocusCamera(getViewport)
    expect(camera).not.toBeNull()
    expect(paddingToInsets(camera!.padding)).toEqual(camera!.insets)
  })

  it('is panel-aware: an expanded dock reserves the right side it occludes', () => {
    stubSelectors({
      [FLOW]: fakeEl({ width: 1440, height: 900, left: 0, right: 1440 }),
      [DOCK]: fakeEl({ width: 416, height: 900, left: 1012, right: 1428 }),
    })
    const camera = readFocusCamera(getViewport)
    // overlap = flowRect.right - dock.left = 428, plus the 16px gap.
    expect(camera?.insets.right).toBe(444)
    expect(camera?.padding.right).toBe('444px')
    // Base margin is untouched on the unoccluded left: floor((1440 - 1440/1.08) * 0.5).
    // ⚠ Was 120 under BASE_RATIO 0.2; the ratio moved to 0.08 on 15 Aug 2026.
    // The point of this assertion is that an occluded side and an unoccluded
    // side are treated DIFFERENTLY — that still holds, at a smaller base.
    expect(camera?.insets.left).toBe(53)
  })

  it('a node under the expanded dock is NOT comfortable through the real bridge (F2/F4 end to end)', () => {
    // The whole point of the bridge: measurement → gate. A node sitting under
    // the dock must read as uncomfortable so focus/pulse actually fits it.
    stubSelectors({
      [FLOW]: fakeEl({ width: 1440, height: 900, left: 0, right: 1440 }),
      [DOCK]: fakeEl({ width: 416, height: 900, left: 1012, right: 1428 }),
    })
    const camera = readFocusCamera(() => ({ x: 0, y: 0, zoom: 1 }))!
    const underDock = sized(1100, 300)
    expect(
      nodesComfortablyVisible([underDock], camera.viewport, camera.paneWidth, camera.paneHeight, camera.insets),
    ).toBe(false)
    // ...while the same node in the clear reads comfortable.
    const inTheClear = sized(300, 300)
    expect(
      nodesComfortablyVisible([inTheClear], camera.viewport, camera.paneWidth, camera.paneHeight, camera.insets),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TOP-ANCHORING A CLAMPED VIEW
//
// Measured 30 Aug 2026 on the five shipped starters: every auto-fit clamps at
// the legibility floor, and xyflow re-centres on the clamped zoom — so a model
// taller than the frame is cropped equally at both ends. On `build-vs-buy` that
// left NO decision and NOT ONE of four options in the first view.
// ---------------------------------------------------------------------------
describe('topAnchoredViewportWhenClamped', () => {
  const INSETS = { top: 20, right: 20, bottom: 20, left: 20 }
  const PANE_W = 1000
  const PANE_H = 800
  // frame = 960 x 760

  it('returns null when the model already fits — the correction must not touch it', () => {
    // 900x700 inside a 960x760 frame fits at zoom 1, well above the floor.
    expect(
      topAnchoredViewportWhenClamped({ x: 0, y: 0, width: 900, height: 700 }, PANE_W, PANE_H, INSETS, 0.5),
    ).toBeNull()
  })

  it('returns null at exactly the floor — the boundary belongs to the fit', () => {
    // 1920x1520 needs exactly 0.5 to fit: zoomToFit === floor, not below it.
    expect(
      topAnchoredViewportWhenClamped({ x: 0, y: 0, width: 1920, height: 1520 }, PANE_W, PANE_H, INSETS, 0.5),
    ).toBeNull()
  })

  it('⭐ pins the model TOP inside the frame when the fit would clamp', () => {
    // 1000x4000 at the 0.5 floor is 2000px tall against a 760px frame.
    const v = topAnchoredViewportWhenClamped(
      { x: 0, y: 0, width: 1000, height: 4000 }, PANE_W, PANE_H, INSETS, 0.5,
    )
    expect(v).not.toBeNull()
    expect(v!.zoom).toBe(0.5)
    // The model's top edge lands exactly on the frame's top inset...
    expect(v!.y).toBe(INSETS.top)
    // ...which is ABOVE where a centred fit would put it. That is the change.
    const centredY = INSETS.top + (760 - 4000 * 0.5) / 2
    expect(v!.y).toBeGreaterThan(centredY)
  })

  it('honours a non-zero bounds origin rather than assuming the graph starts at 0', () => {
    const v = topAnchoredViewportWhenClamped(
      { x: 300, y: 500, width: 1000, height: 4000 }, PANE_W, PANE_H, INSETS, 0.5,
    )
    // y = inset - boundsY*zoom, so the model's own top still lands on the inset.
    expect(v!.y).toBe(INSETS.top - 500 * 0.5)
  })

  it('centres horizontally, as the fit does — this changes the vertical only', () => {
    const v = topAnchoredViewportWhenClamped(
      { x: 0, y: 0, width: 500, height: 4000 }, PANE_W, PANE_H, INSETS, 0.5,
    )
    // 500 wide at 0.5 = 250px in a 960px frame -> centred with 355 each side.
    expect(v!.x).toBe(INSETS.left + (960 - 250) / 2)
  })

  // -------------------------------------------------------------------------
  // ⭐⭐ THE MODEL WIDER THAN THE FRAME — the case every horizontal test above
  // is structurally incapable of observing.
  //
  // Each existing case puts a model NARROWER than the frame (500 -> 250px in a
  // 960px frame), so `(frameW - scaledW)` is positive and the `Math.max(0, …)`
  // that used to wrap it is a NO-OP on every one of them. The suite could
  // therefore be fully green while the clamp dumped 100% of the overflow on a
  // single side (CLAUDE.md trap 22: a corpus that omits a value class the
  // contract admits cannot certify the code over that class).
  //
  // MEASURED, real Chromium, hermetic geometry harness, `8e97879a`, on the two
  // landscape starters at 1280x800 — the shape that overflows:
  //
  //                       visible gaps L / R      cards occluded (true rect
  //                                                intersection, % of card)
  //   before   headcount-allocation  16 / -112    2 cards, 83%  (opt_sales 13%)
  //   after                         -48 / -48     1 card,  30%
  //   before   pricing-model         16 / -112    2 cards, 83%  (opt_status_quo 13%)
  //   after                         -48 / -48     1 card,  30%
  //
  // The option card buried under the OutputsDock is what makes this a defect
  // rather than a preference: #979 — the commit that introduced this function —
  // exists to put "the decision and its options" in the first view.
  // -------------------------------------------------------------------------

  it('⭐ splits the overflow evenly when the model is WIDER than the frame, instead of dumping it all on one side', () => {
    const bounds = { x: 0, y: 0, width: 4000, height: 4000 }
    const v = topAnchoredViewportWhenClamped(bounds, PANE_W, PANE_H, INSETS, 0.5)
    expect(v).not.toBeNull()

    const frameW = PANE_W - INSETS.left - INSETS.right
    const scaledW = bounds.width * v!.zoom
    // PRECONDITION PINNED IN-TEST (trap 13b): this fixture must actually be the
    // overflow case, or the assertion below is a tautology about a case that
    // never arises. If a later edit shrinks these bounds, this REDs here rather
    // than silently passing while testing nothing.
    expect(scaledW).toBeGreaterThan(frameW)

    const modelLeft = v!.x + bounds.x * v!.zoom
    const modelRight = modelLeft + scaledW
    const frameLeft = INSETS.left
    const frameRight = PANE_W - INSETS.right

    const overflowLeft = frameLeft - modelLeft
    const overflowRight = modelRight - frameRight
    // Both sides genuinely overflow...
    expect(overflowLeft).toBeGreaterThan(0)
    expect(overflowRight).toBeGreaterThan(0)
    // ...and by the SAME amount. The old `Math.max(0, …)` produced 0 / 1040.
    expect(overflowLeft).toBe(overflowRight)
  })

  it('⭐ keeps the model centred on the frame when it overflows — binds by the centres, not by a literal', () => {
    // Asymmetric insets, so "centred on the frame" and "centred on the pane"
    // are DIFFERENT answers and this cannot pass by coincidence. These are the
    // measured deployed insets at 1280x800 (left 76 / right 444: the expanded
    // OutputsDock reserves 444, the collapsed rail 76).
    //
    // ⚠ `bottom: 92` is the CURRENT-TIP value and it differs from the `29` in
    // `useFitViewOnLayoutVersion.clampedTopAnchor.spec.tsx`. Both are right at
    // their own tip: 29 is the bare base margin, read on deployed staging
    // `83f20058` (1 Sep); `CanvasOverlayBand` (#1162, `9c94a718`, 3 Sep) then
    // became a bottom contributor, and `overlap 76 + GAP 16 = 92` follows from
    // `OVERLAY_BAND_HEIGHT` 64 + `OVERLAY_BAND_BOTTOM` 12 + `GAP` 16 — pinned
    // by `computeFitPadding.overlayBand.spec.ts`. #1162 is in this branch's
    // base, so 92 is the value here. The sibling spec's header is stale by
    // construction and is rowed, not edited from this lane.
    const asymmetric = { top: 73, right: 444, bottom: 92, left: 76 }
    const paneW = 1280
    // `headcount-allocation`'s MEASURED bbox — see the residual block at the
    // end of this file for the citation. A previous version of this fixture
    // used height 1476, which matches no starter.
    const bounds = { x: 24, y: 24, width: 1776, height: 1527 }
    const v = topAnchoredViewportWhenClamped(bounds, paneW, 800, asymmetric, 0.5)
    expect(v).not.toBeNull()

    const frameW = paneW - asymmetric.left - asymmetric.right
    const scaledW = bounds.width * v!.zoom
    expect(scaledW).toBeGreaterThan(frameW) // precondition: really the overflow case

    const modelCentre = v!.x + (bounds.x + bounds.width / 2) * v!.zoom
    const frameCentre = asymmetric.left + frameW / 2
    expect(modelCentre).toBeCloseTo(frameCentre, 6)
    // And NOT the pane centre — proves the reservation is still respected.
    expect(modelCentre).not.toBeCloseTo(paneW / 2, 0)
  })

  it('the overflow split is horizontal only — the top anchor is untouched by it', () => {
    const bounds = { x: 0, y: 0, width: 4000, height: 4000 }
    const v = topAnchoredViewportWhenClamped(bounds, PANE_W, PANE_H, INSETS, 0.5)
    // Same guarantee as the top-anchor test above, asserted in the OVERFLOW
    // case so a future horizontal change cannot quietly move the vertical.
    expect(v!.y).toBe(INSETS.top - bounds.y * 0.5)
    expect(v!.zoom).toBe(0.5)
  })

  it('never zooms out to fit more in — the floor is the product\'s limit, not the user\'s', () => {
    const v = topAnchoredViewportWhenClamped(
      { x: 0, y: 0, width: 1000, height: 40000 }, PANE_W, PANE_H, INSETS, 0.5,
    )
    // However tall the model, the zoom is the floor and never below it.
    expect(v!.zoom).toBe(0.5)
  })

  it('returns null on an unmeasurable pane or degenerate bounds — fail to the existing fit', () => {
    expect(topAnchoredViewportWhenClamped({ x: 0, y: 0, width: 1000, height: 4000 }, 0, PANE_H, INSETS, 0.5)).toBeNull()
    expect(topAnchoredViewportWhenClamped({ x: 0, y: 0, width: 0, height: 4000 }, PANE_W, PANE_H, INSETS, 0.5)).toBeNull()
    expect(
      topAnchoredViewportWhenClamped({ x: 0, y: 0, width: 1000, height: 4000 }, PANE_W, PANE_H,
        { top: 500, right: 20, bottom: 500, left: 20 }, 0.5),
    ).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// THE PRICED RESIDUAL — what the even split costs at the LEFT edge
//
// Splitting a clamped fit's overflow moves the model's left edge toward the
// pane edge. At the dock's shipped default that leaves a 12px pane margin; at
// the dock's MAXIMUM user-draggable width the edge goes 20px OFF-PANE, which is
// somewhere the old `Math.max(0, …)` never went. Both figures were named in the
// PR body and asserted NOWHERE — a residual that lives only in prose drifts
// silently, and the honest way to ship a known gap is to pin it EXACTLY so the
// suite REDs if it grows OR shrinks (CLAUDE.md trap 22f).
//
// ⭐ THE INSETS ARE DERIVED, NOT RESTATED. They come from calling the real
// `computeFitPadding` on stubbed occluder rects, and the dock's width comes
// from `dockWidth.ts` rather than a literal — so a change to the GAP, the base
// margin, the dock's bounds or its responsive ratio REDs here rather than
// leaving these numbers quietly wrong. The CONTROL arm pins the derivation
// against the insets measured on deployed staging (left 76 / right 444), so
// this block cannot pass by agreeing with itself.
// ---------------------------------------------------------------------------
describe('topAnchoredViewportWhenClamped — the left-edge residual, priced and pinned', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** The 1280x800 laptop every figure in this file is taken at. */
  const PANE = { width: 1280, height: 800 }
  /** `OutputsDock` is positioned `right: 12`; the collapsed rail `left: 12`, 48 wide. */
  const DOCK_RIGHT_OFFSET = 12
  const RAIL = { left: 12, width: 48, height: 191 }
  /**
   * `headcount-allocation`'s MEASURED bounding box in flow units — one of the
   * two starters this change moves. Read in Chromium across the five shipped
   * starters and recorded in `Talchain/olumi-programme-docs` at
   * `artefacts/canvas-lane-2026-09-03/canvas-vertical-fit-2026-09-04.md` §3
   * (`1776 x 1527`; `pricing-model` is `1776 x 1584`, the same width).
   *
   * ⚠ A previous fixture in this file used `1776 x 1476`, a height matching
   * neither starter. The width was always the measured one; the height was not,
   * and an invented fixture dimension in a file that cites measurements is how
   * a corpus stops being evidence. `x`/`y` are non-zero so the
   * `- bounds.x * zoom` term is genuinely exercised.
   */
  const HEADCOUNT_BOUNDS = { x: 24, y: 24, width: 1776, height: 1527 }

  /** The insets the product itself would compute with the dock at `dockWidth`. */
  function insetsForDockWidth(dockWidth: number) {
    const flow = fakeEl({
      left: 0, top: 0, right: PANE.width, bottom: PANE.height,
      width: PANE.width, height: PANE.height,
    })
    const dockLeft = PANE.width - DOCK_RIGHT_OFFSET - dockWidth
    stubSelectors({
      [DOCK_SELECTOR]: fakeEl({
        left: dockLeft, right: PANE.width - DOCK_RIGHT_OFFSET,
        width: dockWidth, top: 14, bottom: 786, height: 772,
      }),
      [SIDEBAR_SELECTOR]: fakeEl({
        left: RAIL.left, right: RAIL.left + RAIL.width, width: RAIL.width,
        top: 300, bottom: 300 + RAIL.height, height: RAIL.height,
      }),
    })
    return paddingToInsets(computeFitPadding(flow))
  }

  /** The model's left edge in pane coordinates, from the function's own output. */
  function modelLeftEdge(insets: ReturnType<typeof insetsForDockWidth>) {
    const v = topAnchoredViewportWhenClamped(
      HEADCOUNT_BOUNDS, PANE.width, PANE.height, insets, 0.5,
    )
    expect(v).not.toBeNull()
    // PRECONDITION PINNED IN-TEST: these arms are about the OVERFLOW case. If a
    // future inset change makes the frame wide enough, this REDs here rather
    // than quietly asserting a margin in a case the defect cannot reach.
    const frameW = PANE.width - insets.left - insets.right
    expect(HEADCOUNT_BOUNDS.width * v!.zoom).toBeGreaterThan(frameW)
    return v!.x + HEADCOUNT_BOUNDS.x * v!.zoom
  }

  it('CONTROL: the stubbed dock and rail reproduce the insets measured on deployed staging', () => {
    // Without this the whole block is a guard agreeing with itself: the stubs
    // would define the geometry AND the expectation. 76 / 444 were read off a
    // real page load at 1280x800 with the dock expanded
    // (`useFitViewOnLayoutVersion.clampedTopAnchor.spec.tsx`).
    expect(responsiveDockWidth(PANE.width)).toBe(416)
    const insets = insetsForDockWidth(responsiveDockWidth(PANE.width))
    expect(insets.left).toBe(76)
    expect(insets.right).toBe(444)
  })

  it('⭐ at the dock SHIPPED default of 416 the model keeps a 12px pane margin', () => {
    // The residual the change buys, stated in the PR body and until now pinned
    // nowhere. Under the reverted `Math.max(0, …)` this was 76.
    expect(modelLeftEdge(insetsForDockWidth(responsiveDockWidth(PANE.width)))).toBe(12)
  })

  it('⚠ KNOWN, PRICED AND UNFIXED: at the dock MAXIMUM width of 480 the left edge goes 20px OFF-PANE', () => {
    const maxDock = dockWidthBounds(PANE.width).max
    expect(maxDock).toBe(480)
    // EXACTLY -20, not `toBeLessThan(0)`. A range assertion would let this
    // deteriorate silently, which is the failure mode being guarded. A user who
    // has widened the dock keeps that width, so this state persists.
    expect(modelLeftEdge(insetsForDockWidth(maxDock))).toBe(-20)
  })

  it('and the trade there is still net-positive — MORE of the model is visible than before', () => {
    // The honest asymmetry: dock-occluded content is recoverable by collapsing
    // the dock, one click; off-pane content is not. This arm says the exchange
    // is still worth making, and REDs if a future change stops it being so.
    const maxDock = dockWidthBounds(PANE.width).max
    const insets = insetsForDockWidth(maxDock)
    const dockLeft = PANE.width - DOCK_RIGHT_OFFSET - maxDock
    const scaledW = HEADCOUNT_BOUNDS.width * 0.5

    // `Math.max(0, …)` of a negative term is 0, so the reverted expression put
    // the model's left edge exactly at `insets.left`. Derived, not restated.
    const before = insets.left
    const after = modelLeftEdge(insets)

    const visible = (left: number) =>
      Math.max(0, Math.min(left + scaledW, dockLeft) - Math.max(left, 0))

    expect(visible(after)).toBeGreaterThan(visible(before))
    expect([visible(before), visible(after)]).toEqual([712, 788])
  })
})

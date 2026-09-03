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
    const asymmetric = { top: 73, right: 444, bottom: 92, left: 76 }
    const paneW = 1280
    const bounds = { x: 24, y: 24, width: 1776, height: 1476 }
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

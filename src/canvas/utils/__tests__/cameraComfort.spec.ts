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
    // Base margin is untouched on the unoccluded left: floor((1440 - 1440/1.2) * 0.5).
    expect(camera?.insets.left).toBe(120)
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

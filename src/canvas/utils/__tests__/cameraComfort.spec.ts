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
import { describe, it, expect } from 'vitest'
import {
  nodesComfortablyVisible,
  paddingToInsets,
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

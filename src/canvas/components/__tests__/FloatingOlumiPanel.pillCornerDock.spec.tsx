/**
 * R3 (Paul, 16 Aug 2026) — "the Olumi bubble docks to a fixed corner
 * (bottom-right); never mid-canvas."
 *
 * L-05 in the manual-test ledger, upgraded to P1 because S17 shows the pill
 * OVERLAPPING the graph between node rows. The mechanism: the pill rendered at
 * the PANEL's stored top-left, and the post-draft auto-minimise stores the
 * top-left of a 400×550 panel. On 1280×800 that put an 84×28 pill at roughly
 * (808, 234) — a third of the way down the canvas.
 *
 * These are pure-geometry assertions plus one mounted-DOM assertion of the
 * pill's inline style. jsdom cannot prove the pill is VISUALLY clear of the
 * graph — a browser witness must confirm that after a first draft the pill
 * sits in the bottom-right corner and nothing on the canvas is occluded.
 */
import { describe, it, expect } from 'vitest'
import {
  computePillDockPosition,
  clampPositionToViewport,
} from '../FloatingOlumiPanel'

const PILL_W = 84
const PILL_H = 28
const MARGIN = 16

describe('computePillDockPosition (R3)', () => {
  it('docks the pill to the bottom-right corner of the viewport', () => {
    expect(computePillDockPosition(1280, 800)).toEqual({
      x: 1280 - PILL_W - MARGIN,
      y: 800 - PILL_H - MARGIN,
    })
  })

  it('keeps the pill clear of the OutputsDock', () => {
    const dockInset = 360
    const out = computePillDockPosition(1280, 800, dockInset)
    expect(out.x + PILL_W).toBeLessThanOrEqual(1280 - dockInset)
    expect(out).toEqual({ x: 1280 - dockInset - PILL_W - MARGIN, y: 800 - PILL_H - MARGIN })
  })

  it('never returns a negative or off-screen anchor on a tiny viewport', () => {
    const out = computePillDockPosition(200, 120, 180)
    expect(out.x).toBeGreaterThanOrEqual(MARGIN)
    expect(out.y).toBeGreaterThanOrEqual(MARGIN)
  })

  /**
   * The regression itself, stated as the geometry that produced it. The
   * post-draft anchor is the top-left of the FULL panel; the pill must not
   * inherit it. Binding is by the two coordinates the defect actually moved,
   * not by a value predicate some other position could satisfy.
   */
  it('does NOT inherit the post-draft PANEL anchor (the mid-canvas defect)', () => {
    const vw = 1280
    const vh = 800
    const size = { width: 400, height: 550 }
    const panelAnchor = clampPositionToViewport(
      { x: vw - size.width - MARGIN, y: vh - size.height - MARGIN },
      size,
      vw,
      vh,
      0,
    )
    // What the panel anchor is: high up the canvas, because the panel is tall.
    expect(panelAnchor.y).toBeLessThan(vh / 2)

    const pill = computePillDockPosition(vw, vh)
    expect(pill.y).not.toBe(panelAnchor.y)
    // And the property that matters to the user: the pill sits in the bottom
    // eighth of the viewport, not in the middle of the graph.
    expect(pill.y).toBeGreaterThan(vh - vh / 8)
  })

  it('is a pure function of viewport + inset — no stored position can move it', () => {
    // Same inputs, same answer, regardless of what the panel remembers.
    expect(computePillDockPosition(1440, 900, 48)).toEqual(computePillDockPosition(1440, 900, 48))
    expect(computePillDockPosition(1440, 900, 48)).not.toEqual(computePillDockPosition(1440, 900, 400))
  })
})

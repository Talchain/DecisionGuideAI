/**
 * FloatingOlumiPanel — all-corner resize geometry.
 *
 * Pure-function tests for `computeCornerResize`. The round-3 UX pass added
 * top-left / top-right / bottom-left handles alongside the existing
 * bottom-right one. Each corner's geometry update must:
 *  - hold the opposite corner fixed at its starting screen coordinate;
 *  - respect MIN_WIDTH (320) and MIN_HEIGHT (300) floors;
 *  - respect computeMaxSize (60% vw, 80% vh) and dock-aware margin caps;
 *  - never produce a position that would leave the panel off-canvas.
 *
 * No DOM rendering needed — these are pure-function assertions composed of
 * the same constants the runtime resize path uses.
 */

import { describe, it, expect, vi } from 'vitest'

// FloatingOlumiPanel's transitive imports pull in supabase and the markdown
// renderer — stub both ahead of the dynamic import below.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import { computeCornerResize } from '../FloatingOlumiPanel'

const VIEWPORT = { w: 1200, h: 800 }
const MARGIN = 16
const MIN_W = 320
const MIN_H = 300

// A typical mid-canvas starting rect, well away from edges and dock.
const START = { left: 400, top: 200, w: 500, h: 400 }

describe('computeCornerResize — bottom-right (BR)', () => {
  it('grows width and height with positive deltas, holds top-left fixed', () => {
    const next = computeCornerResize('br', START.left, START.top, START.w, START.h, 60, 50, VIEWPORT.w, VIEWPORT.h)
    expect(next.x).toBe(START.left)
    expect(next.y).toBe(START.top)
    expect(next.w).toBe(START.w + 60)
    expect(next.h).toBe(START.h + 50)
  })

  it('honours MIN_WIDTH / MIN_HEIGHT floors when delta would shrink past them', () => {
    const next = computeCornerResize('br', START.left, START.top, START.w, START.h, -10000, -10000, VIEWPORT.w, VIEWPORT.h)
    expect(next.w).toBe(MIN_W)
    expect(next.h).toBe(MIN_H)
    expect(next.x).toBe(START.left)
    expect(next.y).toBe(START.top)
  })

  it('caps width at dock-aware available room when rightInset is provided', () => {
    // Dock occupies 360px on the right. The panel's right edge must stay
    // clear of the dock + margin. Max W from left=400: 1200 - 400 - 16 - 360 = 424.
    const next = computeCornerResize('br', START.left, START.top, START.w, START.h, 10000, 0, VIEWPORT.w, VIEWPORT.h, 360)
    expect(next.w).toBe(424)
    expect(next.x).toBe(START.left)
  })
})

describe('computeCornerResize — top-right (TR)', () => {
  it('moves top edge downward and grows width with positive dy / positive dx', () => {
    // dy = +50 should SHRINK height by 50 and move y by +50 (top edge drops).
    const next = computeCornerResize('tr', START.left, START.top, START.w, START.h, 60, 50, VIEWPORT.w, VIEWPORT.h)
    // Left unchanged
    expect(next.x).toBe(START.left)
    // Top drops by dy (height shrinks)
    expect(next.y).toBe(START.top + 50)
    // Width grows by dx
    expect(next.w).toBe(START.w + 60)
    // Height shrinks by dy
    expect(next.h).toBe(START.h - 50)
    // Bottom edge stays put: y + h === startTop + startH
    expect(next.y + next.h).toBe(START.top + START.h)
  })

  it('honours MIN_HEIGHT — dy cannot shrink height below 300', () => {
    const next = computeCornerResize('tr', START.left, START.top, START.w, START.h, 0, 10000, VIEWPORT.w, VIEWPORT.h)
    expect(next.h).toBe(MIN_H)
    // y moves up by exactly (startH - MIN_H) so the bottom edge stays fixed.
    expect(next.y).toBe(START.top + START.h - MIN_H)
  })
})

describe('computeCornerResize — bottom-left (BL)', () => {
  it('moves left edge rightward and grows height with positive dx / positive dy', () => {
    const next = computeCornerResize('bl', START.left, START.top, START.w, START.h, 60, 50, VIEWPORT.w, VIEWPORT.h)
    // Top unchanged
    expect(next.y).toBe(START.top)
    // Left drops by dx (width shrinks)
    expect(next.x).toBe(START.left + 60)
    // Width shrinks by dx
    expect(next.w).toBe(START.w - 60)
    // Height grows by dy
    expect(next.h).toBe(START.h + 50)
    // Right edge stays put: x + w === startLeft + startW
    expect(next.x + next.w).toBe(START.left + START.w)
  })

  it('honours MIN_WIDTH — dx cannot shrink width below 320', () => {
    const next = computeCornerResize('bl', START.left, START.top, START.w, START.h, 10000, 0, VIEWPORT.w, VIEWPORT.h)
    expect(next.w).toBe(MIN_W)
    // x moves right by exactly (startW - MIN_W) so the right edge stays fixed.
    expect(next.x).toBe(START.left + START.w - MIN_W)
  })

  it('honours computeMaxSize cap (60% vw) when dragging outward to the left', () => {
    // Negative dx (drag left) wants to grow width to the viewport margin
    // (884px). But computeMaxSize caps at 60% vw = 720px first. With the
    // right edge fixed at startLeft + startW = 900, the new x lands at
    // 900 - 720 = 180. Both edges remain inside the viewport (margin 16).
    const next = computeCornerResize('bl', START.left, START.top, START.w, START.h, -10000, 0, VIEWPORT.w, VIEWPORT.h)
    expect(next.w).toBe(Math.floor(VIEWPORT.w * 0.6))
    expect(next.x).toBe(START.left + START.w - next.w)
    // Right edge stays put.
    expect(next.x + next.w).toBe(START.left + START.w)
    // Left edge still clears the margin (no underflow).
    expect(next.x).toBeGreaterThanOrEqual(MARGIN)
  })
})

describe('computeCornerResize — top-left (TL)', () => {
  it('moves both edges with negative-mirror deltas, holds bottom-right fixed', () => {
    const next = computeCornerResize('tl', START.left, START.top, START.w, START.h, 60, 50, VIEWPORT.w, VIEWPORT.h)
    // x drops (left edge moves right), width shrinks by dx.
    expect(next.x).toBe(START.left + 60)
    expect(next.w).toBe(START.w - 60)
    // y drops (top edge moves down), height shrinks by dy.
    expect(next.y).toBe(START.top + 50)
    expect(next.h).toBe(START.h - 50)
    // Bottom-right corner stays at (startLeft + startW, startTop + startH).
    expect(next.x + next.w).toBe(START.left + START.w)
    expect(next.y + next.h).toBe(START.top + START.h)
  })

  it('honours both MIN floors simultaneously', () => {
    const next = computeCornerResize('tl', START.left, START.top, START.w, START.h, 10000, 10000, VIEWPORT.w, VIEWPORT.h)
    expect(next.w).toBe(MIN_W)
    expect(next.h).toBe(MIN_H)
    expect(next.x).toBe(START.left + START.w - MIN_W)
    expect(next.y).toBe(START.top + START.h - MIN_H)
  })

  it('respects computeMaxSize caps when dragging outward', () => {
    // Large negative dx/dy: width and height want to grow. Caps:
    //   - width:  min(computeMaxSize=720, marginCap=884) = 720
    //   - height: min(computeMaxSize=640, marginCap=584) = 584
    // x = (startLeft + startW) - w = 900 - 720 = 180.
    // y = (startTop + startH) - h = 600 - 584 = 16 (= MARGIN floor).
    const next = computeCornerResize('tl', START.left, START.top, START.w, START.h, -10000, -10000, VIEWPORT.w, VIEWPORT.h)
    expect(next.w).toBe(Math.floor(VIEWPORT.w * 0.6))         // 720
    expect(next.h).toBe(START.top + START.h - MARGIN)         // 584
    expect(next.x).toBe(START.left + START.w - next.w)        // 180
    expect(next.y).toBe(START.top + START.h - next.h)         // 16 (== MARGIN)
    // Bottom-right still fixed.
    expect(next.x + next.w).toBe(START.left + START.w)
    expect(next.y + next.h).toBe(START.top + START.h)
    // No edge underflows the margin.
    expect(next.x).toBeGreaterThanOrEqual(MARGIN)
    expect(next.y).toBeGreaterThanOrEqual(MARGIN)
  })
})

describe('computeCornerResize — dock-aware caps', () => {
  it('TR: width cap respects rightInset (dock space)', () => {
    // Dock 360 wide → max width from left=400: 1200 - 400 - 16 - 360 = 424.
    const next = computeCornerResize('tr', START.left, START.top, START.w, START.h, 10000, 0, VIEWPORT.w, VIEWPORT.h, 360)
    expect(next.w).toBe(424)
    expect(next.x).toBe(START.left)
  })

  it('BL: dock inset only matters for the right-anchored edge (left edge cap unchanged)', () => {
    // Right edge fixed at 900; left can shrink to MARGIN (16). Dock doesn't
    // affect the BL maxW formula because the panel's right edge is already
    // fixed inside the dock-clear zone (at 900, dock starts at 1200-360=840;
    // we'd need to verify the assertion separately on a wider start). For
    // this case (panel right edge at 900, dock left at 840), the start
    // position itself OVERLAPS the dock — not a normal user state. The
    // helper does NOT relocate the panel; it only caps W on the left side.
    const next = computeCornerResize('bl', START.left, START.top, START.w, START.h, -100, 0, VIEWPORT.w, VIEWPORT.h, 360)
    // x = startLeft + dx = 300; w = startW - dx = 600 (since startW=500, dx=-100 → w=600)
    // But w is capped at MIN floor, computeMaxSize cap, and right-fixed cap.
    // Right-fixed cap = (startLeft + startW) - DEFAULT_MARGIN = 900 - 16 = 884.
    // computeMaxSize.width = 1200 * 0.6 = 720.
    // So w = min(720, 884, 600) = 600.
    expect(next.w).toBe(600)
    expect(next.x).toBe(START.left + (-100))
    expect(next.x + next.w).toBe(START.left + START.w)
  })
})

describe('computeCornerResize — sub-minimum invariant', () => {
  it.each(['tl', 'tr', 'bl', 'br'] as const)('%s never returns a sub-MIN size', (corner) => {
    // Push every direction past extreme. Always expect w >= MIN_W, h >= MIN_H.
    const cases: Array<[number, number]> = [
      [10000, 10000],
      [-10000, -10000],
      [10000, -10000],
      [-10000, 10000],
    ]
    for (const [dx, dy] of cases) {
      const next = computeCornerResize(corner, START.left, START.top, START.w, START.h, dx, dy, VIEWPORT.w, VIEWPORT.h)
      expect(next.w).toBeGreaterThanOrEqual(MIN_W)
      expect(next.h).toBeGreaterThanOrEqual(MIN_H)
    }
  })
})

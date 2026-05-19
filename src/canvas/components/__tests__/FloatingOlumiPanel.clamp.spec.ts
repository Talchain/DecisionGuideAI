/**
 * FloatingOlumiPanel — viewport-clamp helpers.
 *
 * Pure-function tests for clampPositionToViewport / clampPillPositionToViewport.
 * Covers the polish requirement: default, restored, and minimised positions
 * are all clamped to the visible viewport so the panel never lands partially
 * off-canvas (e.g. after the user resizes their window between sessions).
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

import {
  clampPositionToViewport,
  clampPillPositionToViewport,
  computeResizeBudget,
} from '../FloatingOlumiPanel'

const VIEWPORT = { w: 1200, h: 800 }
const SIZE = { width: 400, height: 500 }
const MARGIN = 16

describe('clampPositionToViewport', () => {
  it('passes through a fully visible position unchanged', () => {
    const out = clampPositionToViewport({ x: 200, y: 100 }, SIZE, VIEWPORT.w, VIEWPORT.h)
    expect(out).toEqual({ x: 200, y: 100 })
  })

  it('rightInset (open OutputsDock) shrinks the usable area on the right edge', () => {
    // OutputsDock open at 360px on the right. The floating panel's right
    // edge must stay clear of the dock. Without rightInset the panel
    // (400px wide) could land at x=784 (viewport_w − panel_w − margin),
    // which sits UNDER the dock. With rightInset=360, max x must drop to
    // 1200 − 400 − 16 − 360 = 424.
    const out = clampPositionToViewport({ x: 1000, y: 100 }, SIZE, VIEWPORT.w, VIEWPORT.h, 360)
    expect(out.x).toBe(VIEWPORT.w - SIZE.width - MARGIN - 360)
    expect(out.x).toBe(424)
  })

  it('rightInset of 0 (dock closed/collapsed) preserves the original right edge', () => {
    const without = clampPositionToViewport({ x: 1000, y: 100 }, SIZE, VIEWPORT.w, VIEWPORT.h)
    const withZero = clampPositionToViewport({ x: 1000, y: 100 }, SIZE, VIEWPORT.w, VIEWPORT.h, 0)
    expect(withZero).toEqual(without)
  })

  it('rightInset larger than usable width still keeps the panel at the margin (no negative x)', () => {
    // Dock 1100px on a 1200px viewport: only 100px of usable area remains
    // — less than the 400px panel. Top-left must still be at the margin,
    // not a negative coordinate.
    const out = clampPositionToViewport({ x: 800, y: 100 }, SIZE, VIEWPORT.w, VIEWPORT.h, 1100)
    expect(out.x).toBe(MARGIN)
  })

  it('clamps an x that would push the right edge off-screen', () => {
    // Right edge would be at 1000 + 400 = 1400, viewport is 1200 → x must
    // become 1200 - 400 - 16 = 784.
    const out = clampPositionToViewport({ x: 1000, y: 100 }, SIZE, VIEWPORT.w, VIEWPORT.h)
    expect(out.x).toBe(VIEWPORT.w - SIZE.width - MARGIN)
    expect(out.y).toBe(100)
  })

  it('clamps a y that would push the bottom edge off-screen', () => {
    const out = clampPositionToViewport({ x: 200, y: 700 }, SIZE, VIEWPORT.w, VIEWPORT.h)
    expect(out.x).toBe(200)
    expect(out.y).toBe(VIEWPORT.h - SIZE.height - MARGIN)
  })

  it('clamps negative coordinates to the margin', () => {
    const out = clampPositionToViewport({ x: -50, y: -200 }, SIZE, VIEWPORT.w, VIEWPORT.h)
    expect(out).toEqual({ x: MARGIN, y: MARGIN })
  })

  it('degenerate viewport (smaller than panel) still produces a sane top-left at the margin', () => {
    const out = clampPositionToViewport({ x: 500, y: 500 }, SIZE, 200, 200)
    expect(out).toEqual({ x: MARGIN, y: MARGIN })
  })
})

describe('clampPillPositionToViewport', () => {
  it('passes through a fully visible pill position unchanged', () => {
    const out = clampPillPositionToViewport({ x: 200, y: 100 }, VIEWPORT.w, VIEWPORT.h)
    expect(out).toEqual({ x: 200, y: 100 })
  })

  it('clamps a pill x that would push past the right edge', () => {
    // Pill width 84 + margin 16: max x is 1200 - 84 - 16 = 1100.
    const out = clampPillPositionToViewport({ x: 1180, y: 100 }, VIEWPORT.w, VIEWPORT.h)
    expect(out.x).toBe(VIEWPORT.w - 84 - MARGIN)
  })

  it('clamps a pill y that would push past the bottom edge', () => {
    // Pill height 28 + margin 16: max y is 800 - 28 - 16 = 756.
    const out = clampPillPositionToViewport({ x: 200, y: 790 }, VIEWPORT.w, VIEWPORT.h)
    expect(out.y).toBe(VIEWPORT.h - 28 - MARGIN)
  })

  it('rightInset shrinks the right edge so the pill never lands under the dock', () => {
    // Pill width 84 + margin 16 + dock 360 = 460. Max x on a 1200 viewport
    // becomes 1200 − 460 = 740.
    const out = clampPillPositionToViewport({ x: 1100, y: 100 }, VIEWPORT.w, VIEWPORT.h, 360)
    expect(out.x).toBe(VIEWPORT.w - 84 - MARGIN - 360)
    expect(out.x).toBe(740)
  })
})

describe('computeResizeBudget — bottom-right resize bounds', () => {
  // P1 regression: the previous resize handler grew width without
  // accounting for the dock inset, allowing the right edge to slide
  // under the dock as the user resized. computeResizeBudget caps the
  // available width from the panel's current x to either the viewport
  // right margin (no dock) or the dock's left edge (open dock).

  it('width budget includes dock inset', () => {
    // x=600, dock 360 wide + 12 gap → dockInset 372 on a 1200 viewport.
    // Budget = 1200 - 600 - 16 - 372 = 212.
    const out = computeResizeBudget(600, 100, VIEWPORT.w, VIEWPORT.h, 372)
    expect(out.widthBudget).toBe(212)
  })

  it('width budget falls back to viewport-minus-margin when no dock', () => {
    const out = computeResizeBudget(600, 100, VIEWPORT.w, VIEWPORT.h, 0)
    expect(out.widthBudget).toBe(VIEWPORT.w - 600 - MARGIN)
  })

  it('does NOT floor width budget at MIN_WIDTH — the dock constraint wins', () => {
    // x near the dock: 900, dock 360 → remaining canvas is tiny.
    // 1200 - 900 - 16 - 360 = -76. Floored at 0 (not MIN_WIDTH) so the
    // caller's composed clamp lets the panel shrink below MIN_WIDTH
    // rather than overlap the dock.
    const out = computeResizeBudget(900, 100, VIEWPORT.w, VIEWPORT.h, 360)
    expect(out.widthBudget).toBe(0)
  })

  it('height budget mirrors width budget for the bottom edge', () => {
    const out = computeResizeBudget(0, 500, VIEWPORT.w, VIEWPORT.h, 0)
    expect(out.heightBudget).toBe(VIEWPORT.h - 500 - MARGIN)
  })

  it('caps a resize attempt that would exceed the dock-aware budget', () => {
    // Simulate: panel at x=600, current size 400x500. User drags resize
    // handle far right (dw=1000). Without budget the width would grow
    // to 1400; with the dock-aware cap it must stop at widthBudget.
    const { widthBudget } = computeResizeBudget(600, 100, VIEWPORT.w, VIEWPORT.h, 372)
    const startW = 400
    const dw = 1000
    const wPreCapped = Math.max(startW, startW + dw)
    expect(wPreCapped).toBe(1400) // sanity: pre-cap value would overflow
    const wCapped = Math.min(wPreCapped, widthBudget)
    expect(wCapped).toBe(widthBudget)
    // And the right edge stays clear of the dock left.
    const dockLeft = VIEWPORT.w - 372 // dock.left = vw - inset
    expect(600 + wCapped).toBeLessThanOrEqual(dockLeft)
  })
})

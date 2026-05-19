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
  fitsAtMinSize,
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

describe('computeResizeBudget — raw geometry helper', () => {
  // Contract: computeResizeBudget is a pure geometry helper that returns
  // the raw space available from (x, y) to the dock-aware bottom-right
  // corner. It does NOT enforce MIN_WIDTH / MIN_HEIGHT — those are the
  // caller's responsibility. The composition rule the resize handler
  // uses is `max(MIN_WIDTH, min(max.width, widthBudget, requested))`.
  // When the geometry is so tight that no MIN-sized panel fits, the
  // resize handler (and the layout effect) consult `fitsAtMinSize` and
  // auto-minimise to the pill instead — see the dockInset spec.

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

  it('returns raw geometry, floored at 0 (no MIN_WIDTH floor here)', () => {
    // x near the dock: 900, dock 360 → 1200 - 900 - 16 - 360 = -76.
    // Helper floors at 0 (negative budgets would break consumer math).
    // The caller's MIN_WIDTH floor + `fitsAtMinSize` gate handle the
    // "no room at all" case by auto-minimising.
    const out = computeResizeBudget(900, 100, VIEWPORT.w, VIEWPORT.h, 360)
    expect(out.widthBudget).toBe(0)
  })

  it('height budget mirrors width budget for the bottom edge', () => {
    const out = computeResizeBudget(0, 500, VIEWPORT.w, VIEWPORT.h, 0)
    expect(out.heightBudget).toBe(VIEWPORT.h - 500 - MARGIN)
  })

  it('composes correctly: preserve MIN_WIDTH and clamp to budget', () => {
    // Panel at x=600, current size 400x500. User drags resize handle
    // far right (dw=1000) → requested = 1400. The resize handler
    // composes `max(MIN_WIDTH, min(max.width, widthBudget, requested))`.
    //
    // Here `widthBudget = 1200 - 600 - 16 - 372 = 212`, below MIN_WIDTH.
    // Result: composed width = max(320, min(720, 212, 1400)) = 320.
    // MIN_WIDTH is preserved; the panel does not shrink below it. The
    // layout effect's `fitsAtMinSize` gate decides whether the panel
    // is rendered at all at this viewport — see the dockInset spec.
    const { widthBudget } = computeResizeBudget(600, 100, VIEWPORT.w, VIEWPORT.h, 372)
    const startW = 400
    const dw = 1000
    const max = { width: Math.floor(VIEWPORT.w * 0.6), height: 720 }
    const requestedW = Math.max(320, startW + dw)
    const wCapped = Math.max(320, Math.min(max.width, widthBudget, requestedW))
    expect(wCapped).toBe(320)
  })
})

describe('fitsAtMinSize — auto-minimise gate', () => {
  // P1 follow-up: when the dock + margins leave less room than
  // MIN_WIDTH × MIN_HEIGHT (320 × 300), the panel must auto-minimise
  // to the pill rather than render at a sub-MIN size.

  it('returns true on a wide viewport with no dock', () => {
    expect(fitsAtMinSize(VIEWPORT.w, VIEWPORT.h, 0)).toBe(true)
  })

  it('returns true with an open dock when room remains for a MIN_WIDTH panel', () => {
    // 1200 - 32 (margins) - 400 (dock) = 768 — plenty of room for MIN_WIDTH (320).
    expect(fitsAtMinSize(VIEWPORT.w, VIEWPORT.h, 400)).toBe(true)
  })

  it('returns false when dock + margins leave less than MIN_WIDTH', () => {
    // 1200 - 32 (margins) - 900 (dock) = 268 — below MIN_WIDTH (320).
    expect(fitsAtMinSize(VIEWPORT.w, VIEWPORT.h, 900)).toBe(false)
  })

  it('returns false on a viewport too short for MIN_HEIGHT', () => {
    expect(fitsAtMinSize(VIEWPORT.w, 200, 0)).toBe(false)
  })

  it('boundary: exactly MIN_WIDTH room → fits (≥ comparison)', () => {
    // 800 - 32 = 768 - dockInset. Set inset so available width === 320.
    const inset = 800 - 2 * MARGIN - 320
    expect(fitsAtMinSize(800, 600, inset)).toBe(true)
    // One pixel less and it must NOT fit.
    expect(fitsAtMinSize(800, 600, inset + 1)).toBe(false)
  })
})

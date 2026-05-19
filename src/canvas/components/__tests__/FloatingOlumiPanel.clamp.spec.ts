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
} from '../FloatingOlumiPanel'

const VIEWPORT = { w: 1200, h: 800 }
const SIZE = { width: 400, height: 500 }
const MARGIN = 16

describe('clampPositionToViewport', () => {
  it('passes through a fully visible position unchanged', () => {
    const out = clampPositionToViewport({ x: 200, y: 100 }, SIZE, VIEWPORT.w, VIEWPORT.h)
    expect(out).toEqual({ x: 200, y: 100 })
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
})

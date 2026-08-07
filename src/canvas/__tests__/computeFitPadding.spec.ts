/**
 * Unit tests for computeFitPadding (src/canvas/utils/computeFitPadding.ts).
 *
 * Verifies the panel-aware fitView padding:
 *  - all four sides are returned as `'<n>px'` strings (xyflow v12 object form),
 *  - the no-occluder case reproduces the prior `padding: 0.2` framing,
 *  - a collapsed dock rail / thin sidebar are inert at typical widths but are
 *    legitimately reserved once the base margin shrinks at narrow widths,
 *  - an expanded dock pushes the right side in by overlap + gap,
 *  - overlap is measured against the flow rect, not the window (offset canvas),
 *  - pathological padding is clamped so a fitting area always survives.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { computeFitPadding } from '../utils/computeFitPadding'

function fakeEl(rect: Partial<DOMRect>): HTMLElement {
  const full: DOMRect = {
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

/** Stub document.querySelector to return the given element per selector. */
function stubSelectors(map: Record<string, HTMLElement | null>) {
  vi.spyOn(document, 'querySelector').mockImplementation(
    (sel: string) => (sel in map ? map[sel] : null) as Element | null,
  )
}

const DOCK = 'aside[aria-label="Outputs dock"]'
const SIDEBAR = 'nav[aria-label="Canvas tools"]'

// baseMargin(V) = floor((V - V/1.2) * 0.5).
//   1440 -> 120, 900 -> 75, 1000 -> 83, 600 -> 50.

afterEach(() => {
  vi.restoreAllMocks()
})

describe('computeFitPadding', () => {
  it('returns px strings on all four sides', () => {
    stubSelectors({})
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    for (const side of [p.top, p.right, p.bottom, p.left]) {
      expect(side).toMatch(/^\d+px$/)
    }
  })

  it('with no occluders, reproduces the base 0.2 margin on every side', () => {
    stubSelectors({})
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p).toEqual({ top: '75px', right: '120px', bottom: '75px', left: '120px' })
  })

  it('treats a collapsed dock rail as inert at typical width (overlap < base margin)', () => {
    stubSelectors({
      // Real geometry: dock is `right: 12`, collapsed rail 40px wide.
      // left = 1440 - 12 - 40 = 1388; overlap = 1440 - 1388 = 52.
      [DOCK]: fakeEl({ left: 1388, right: 1428, width: 40, top: 12, bottom: 880, height: 868 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p.right).toBe('120px') // 52 + 16 = 68 < base 120 → unchanged
  })

  it('reserves an expanded dock, including its right gap (overlap + GAP)', () => {
    stubSelectors({
      // Real geometry: dock `right: 12`, expanded 416px. left = 1440 - 12 - 416 = 1012.
      // overlap = 1440 - 1012 = 428 (= dock width 416 + 12px right gap).
      [DOCK]: fakeEl({ left: 1012, right: 1428, width: 416, top: 12, bottom: 880, height: 868 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p.right).toBe('444px') // 428 + 16 gap
    expect(p.left).toBe('120px') // left untouched
    expect(p.top).toBe('75px')
    expect(p.bottom).toBe('75px')
  })

  it('collapsed rail is NOT inert on a narrow canvas (base margin shrinks below overlap+gap)', () => {
    stubSelectors({
      // 600px canvas, collapsed rail `right: 12`, 40px: left = 600 - 12 - 40 = 548.
      // overlap = 600 - 548 = 52; base(600) = 50; 52 + 16 = 68 > 50.
      [DOCK]: fakeEl({ left: 548, right: 588, width: 40, top: 12, bottom: 480, height: 468 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 600, width: 600, top: 0, bottom: 500, height: 500 }))
    expect(p.right).toBe('68px') // rail legitimately reserved
  })

  it('clamps pathological padding so the pane keeps a fitting area (huge dock, tiny viewport)', () => {
    stubSelectors({
      // 200px pane, a dock overlapping almost all of it: overlap ≈ 180.
      [DOCK]: fakeEl({ left: 20, right: 200, width: 180, top: 0, bottom: 300, height: 300 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 200, width: 200, top: 0, bottom: 300, height: 300 }))
    // Un-clamped right would be 180 + 16 = 196; combined with left it must be
    // scaled to ≤ 80% of the 200px pane (160px), so a fitting area survives.
    expect(parseInt(p.left, 10) + parseInt(p.right, 10)).toBeLessThanOrEqual(160)
    expect(parseInt(p.right, 10)).toBeLessThan(196)
  })

  it('treats the thin left sidebar as inert on a wide canvas', () => {
    stubSelectors({
      // sidebar at left:12 width:52 -> right = 64. overlap = 64 < base 120.
      [SIDEBAR]: fakeEl({ left: 12, right: 64, width: 52, top: 100, bottom: 400, height: 300 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p.left).toBe('120px')
  })

  it('reserves the left sidebar when it exceeds the base margin (narrow canvas)', () => {
    stubSelectors({
      [SIDEBAR]: fakeEl({ left: 12, right: 64, width: 52, top: 100, bottom: 400, height: 300 }),
    })
    // 600px-wide canvas -> base 50; sidebar overlap 64 + gap 16 = 80 > 50.
    const p = computeFitPadding(fakeEl({ left: 0, right: 600, width: 600, top: 0, bottom: 500, height: 500 }))
    expect(p.left).toBe('80px')
  })

  it('measures dock overlap against the flow rect, not the window (offset/embedded canvas)', () => {
    stubSelectors({
      // dock left at 1024 (as if window is 1440 wide), but the flow pane ends at 1100.
      [DOCK]: fakeEl({ left: 1024, right: 1440, width: 416, top: 0, bottom: 900, height: 900 }),
    })
    // Flow pane offset: left 100, right 1100, width 1000 -> base 83.
    const p = computeFitPadding(fakeEl({ left: 100, right: 1100, width: 1000, top: 50, bottom: 850, height: 800 }))
    // overlap = flowRect.right(1100) - dock.left(1024) = 76; 76 + 16 = 92 > base 83.
    expect(p.right).toBe('92px')
  })

  it('integration: no-arg call finds the real .react-flow + occluder elements in the DOM', () => {
    // Real DOM (no querySelector stub) — exercises the default `.react-flow`
    // lookup and the real occluder selectors end-to-end.
    const mk = (tag: string, attrs: Record<string, string>, rect: Partial<DOMRect>) => {
      const el = document.createElement(tag)
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v
        else el.setAttribute(k, v)
      }
      const full = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}), ...rect } as DOMRect
      el.getBoundingClientRect = () => full
      document.body.appendChild(el)
      return el
    }
    const created: HTMLElement[] = []
    try {
      created.push(mk('div', { class: 'react-flow' }, { left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
      // Expanded dock, `right: 12`: overlap = 1440 - 1012 = 428.
      created.push(mk('aside', { 'aria-label': 'Outputs dock' }, { left: 1012, right: 1428, width: 416, top: 12, bottom: 880, height: 868 }))
      created.push(mk('nav', { 'aria-label': 'Canvas tools' }, { left: 12, right: 64, width: 52, top: 100, bottom: 400, height: 300 }))

      const p = computeFitPadding() // no arg → real document.querySelector('.react-flow')

      expect(p.right).toBe('444px') // 428 + 16
      expect(p.left).toBe('120px') // sidebar overlap 64 + 16 = 80 < base 120
      expect(p.top).toBe('75px')
    } finally {
      created.forEach((el) => el.remove())
    }
  })
})

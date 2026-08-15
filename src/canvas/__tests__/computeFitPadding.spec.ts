/**
 * Unit tests for computeFitPadding (src/canvas/utils/computeFitPadding.ts).
 *
 * Verifies the panel-aware fitView padding:
 *  - all four sides are returned as `'<n>px'` strings (xyflow v12 object form),
 *  - the no-occluder case reproduces the base margin,
 *  - a collapsed dock rail / thin sidebar reserve their own overlap,
 *  - an expanded dock pushes the right side in by overlap + gap,
 *  - overlap is measured against the flow rect, not the window (offset canvas),
 *  - pathological padding is clamped so a fitting area always survives.
 *
 * ⚠ BASE_RATIO CHANGED 0.2 → 0.08 (15 Aug 2026), and that INVERTS two of the
 * claims this spec used to make. It previously asserted that a collapsed dock
 * rail and the thin left sidebar were "inert" at typical widths — true only
 * because the old base margin (120px at 1440) was larger than what those
 * panels occlude (68px and 80px). With a 53px base they now EXCEED it and
 * reserve their own overlap. That is the documented intent of the function —
 * each side is `max(baseMargin, occluderOverlap + GAP)`, so it clears the
 * panel — it is simply no longer a no-op at those sizes. The two tests are
 * renamed rather than renumbered, so the change of meaning is visible in the
 * test names and not buried in an edited constant.
 *
 * What the change does NOT do, recorded here so this spec is never read as
 * proof the motivating defect is closed: at 1280x800 with the conversation
 * panel and an expanded dock both open, the post-draft `fitView` STILL clamps
 * at the `LABEL_LEGIBLE_ZOOM` floor. Measured 15 Aug 2026 — the enlarged
 * fitting box (843px) is short of the 1008px the drafted graph needs at that
 * floor. This constant buys canvas back; it does not close the gap.
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

// baseMargin(V) = floor((V - V/1.08) * 0.5).
//   1440 -> 53, 900 -> 33, 1000 -> 37, 800 -> 29, 600 -> 22, 500 -> 18, 200 -> 7.
// (Was, at BASE_RATIO 0.2: 1440 -> 120, 900 -> 75, 1000 -> 83, 600 -> 50.)

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

  it('with no occluders, applies the base margin on every side', () => {
    stubSelectors({})
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p).toEqual({ top: '33px', right: '53px', bottom: '33px', left: '53px' })
  })

  it('reserves a collapsed dock rail at typical width (overlap+gap now EXCEEDS the base margin)', () => {
    // ⚠ This assertion INVERTED when BASE_RATIO went 0.2 → 0.08. The rail was
    // previously swallowed by a 120px base and this test asserted '120px';
    // against a 53px base the rail reserves its own 68px. Same function, same
    // rule (`max(base, overlap + GAP)`) — the base simply stopped dominating.
    stubSelectors({
      // Real geometry: dock is `right: 12`, collapsed rail 40px wide.
      // left = 1440 - 12 - 40 = 1388; overlap = 1440 - 1388 = 52.
      [DOCK]: fakeEl({ left: 1388, right: 1428, width: 40, top: 12, bottom: 880, height: 868 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p.right).toBe('68px') // 52 + 16 = 68 > base 53 → reserved
  })

  it('reserves an expanded dock, including its right gap (overlap + GAP)', () => {
    stubSelectors({
      // Real geometry: dock `right: 12`, expanded 416px. left = 1440 - 12 - 416 = 1012.
      // overlap = 1440 - 1012 = 428 (= dock width 416 + 12px right gap).
      [DOCK]: fakeEl({ left: 1012, right: 1428, width: 416, top: 12, bottom: 880, height: 868 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p.right).toBe('444px') // 428 + 16 gap
    expect(p.left).toBe('53px') // left untouched → base margin
    expect(p.top).toBe('33px')
    expect(p.bottom).toBe('33px')
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

  it('reserves the thin left sidebar on a wide canvas (overlap+gap now EXCEEDS the base margin)', () => {
    // ⚠ The second assertion that INVERTED with BASE_RATIO 0.2 → 0.08. It used
    // to assert the sidebar was inert at 1440 ('120px'); against a 53px base
    // its 64px overlap reserves 80px. The graph is now framed clear of the
    // sidebar at every width rather than only at narrow ones.
    stubSelectors({
      // sidebar at left:12 width:52 -> right = 64. overlap = 64; 64 + 16 = 80 > base 53.
      [SIDEBAR]: fakeEl({ left: 12, right: 64, width: 52, top: 100, bottom: 400, height: 300 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1440, width: 1440, top: 0, bottom: 900, height: 900 }))
    expect(p.left).toBe('80px')
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
      expect(p.left).toBe('80px') // sidebar overlap 64 + 16 = 80 > base 53
      expect(p.top).toBe('33px')
    } finally {
      created.forEach((el) => el.remove())
    }
  })

  it('the motivating laptop case: 1280x800 with the responsive 333px dock leaves an 843px fitting box', () => {
    // The exact geometry measured in the browser on 15 Aug 2026, pinned so the
    // constants that produce it cannot drift back silently. Dock `right: 12`,
    // responsive width 333 → left = 1280 - 12 - 333 = 935, overlap = 345.
    stubSelectors({
      [DOCK]: fakeEl({ left: 935, right: 1268, width: 333, top: 12, bottom: 784, height: 772 }),
      [SIDEBAR]: fakeEl({ left: 12, right: 60, width: 48, top: 73, bottom: 300, height: 227 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }))
    expect(p.right).toBe('361px') // 345 + 16
    expect(p.left).toBe('76px') // 60 + 16 > base 47
    expect(p.top).toBe('29px')

    const fitBoxWidth = 1280 - parseInt(p.right, 10) - parseInt(p.left, 10)
    expect(fitBoxWidth).toBe(843)

    // ⚠ And the honest other half, asserted so nobody reads the number above as
    // a fix: the drafted 17-node graph measures 2016 flow-units wide, so at the
    // 0.5 legibility floor it needs 1008px. 843 is NOT enough — the post-draft
    // fit still clamps. Closing that gap needs the dock collapsed, which is a
    // workspace-shell decision, not a padding constant.
    const GRAPH_FLOW_WIDTH = 2016
    const LEGIBILITY_FLOOR = 0.5
    expect(fitBoxWidth).toBeLessThan(GRAPH_FLOW_WIDTH * LEGIBILITY_FLOOR)
  })
})

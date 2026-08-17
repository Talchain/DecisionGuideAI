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
import { computeFitPadding, cheapestReservation } from '../utils/computeFitPadding'

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

  it('the motivating laptop case: 1280x800 with the restored 416px dock leaves a 760px fitting box', () => {
    // ⚠ RE-PINNED 17 Aug 2026 from the 333px dock (fit box 843px) to the
    // restored 416px default. The geometry is the same measurement, taken at
    // the width the dock is actually shipped at. Dock `right: 12`, width 416
    // → left = 1280 - 12 - 416 = 852, overlap = 428.
    stubSelectors({
      [DOCK]: fakeEl({ left: 852, right: 1268, width: 416, top: 12, bottom: 784, height: 772 }),
      [SIDEBAR]: fakeEl({ left: 12, right: 60, width: 48, top: 73, bottom: 300, height: 227 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }))
    expect(p.right).toBe('444px') // 428 + 16
    expect(p.left).toBe('76px') // 60 + 16 > base 47
    expect(p.top).toBe('29px')

    const fitBoxWidth = 1280 - parseInt(p.right, 10) - parseInt(p.left, 10)
    expect(fitBoxWidth).toBe(760)

    // ⚠ THE HONEST OTHER HALF, AND THE WHOLE REASON THE NARROWING WAS REVERTED.
    // The drafted 17-node graph measures 2016 flow-units wide, so at the 0.5
    // legibility floor it needs 1008px. The post-draft fit clamps at that floor
    // at EVERY dock width the product has shipped — the trade of panel width
    // for graph legibility was one-sided from the day it landed.
    const GRAPH_FLOW_WIDTH = 2016
    const LEGIBILITY_FLOOR = 0.5
    const REQUIRED = GRAPH_FLOW_WIDTH * LEGIBILITY_FLOOR // 1008
    expect(fitBoxWidth).toBeLessThan(REQUIRED)
  })

  it('the fit box clamps at the legibility floor at 416, 333 AND 280 — the narrowing bought nothing', () => {
    // THE DECISIVE ARITHMETIC, asserted rather than asserted-about. Each dock
    // width is driven through the REAL `computeFitPadding` (not a formula
    // restated here), and every one of them lands under the 1008px the graph
    // needs. Swept over the three widths the product has actually shipped, so
    // "narrowing the dock fixes the graph clamp" cannot be re-argued from a
    // single unmeasured case.
    const GRAPH_FLOW_WIDTH = 2016
    const LEGIBILITY_FLOOR = 0.5
    const REQUIRED = GRAPH_FLOW_WIDTH * LEGIBILITY_FLOOR // 1008
    const expected: Record<number, number> = { 416: 760, 333: 843, 280: 896 }

    for (const dockWidth of [416, 333, 280]) {
      const dockLeft = 1280 - 12 - dockWidth
      stubSelectors({
        [DOCK]: fakeEl({
          left: dockLeft,
          right: dockLeft + dockWidth,
          width: dockWidth,
          top: 12,
          bottom: 784,
          height: 772,
        }),
        [SIDEBAR]: fakeEl({ left: 12, right: 60, width: 48, top: 73, bottom: 300, height: 227 }),
      })
      const p = computeFitPadding(
        fakeEl({ left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }),
      )
      const fitBoxWidth = 1280 - parseInt(p.right, 10) - parseInt(p.left, 10)
      expect(fitBoxWidth, `dock ${dockWidth}px`).toBe(expected[dockWidth])
      expect(fitBoxWidth, `dock ${dockWidth}px still clamps at the floor`).toBeLessThan(REQUIRED)
    }

    // PIN THE PRECONDITION (trap 13b): the sweep is only evidence if the three
    // widths genuinely produce three DIFFERENT fit boxes. A stub that silently
    // stopped varying would satisfy every assertion above while measuring one
    // case three times — undiscriminated output looks exactly like a result.
    expect(new Set(Object.values(expected)).size).toBe(3)
  })
})

/**
 * A2 (16 Aug 2026) — the FLOATING conversation panel's reservation.
 *
 * The dock and the sidebar are edge-anchored, so "what do they occlude" has one
 * answer. The floating Olumi panel is free-floating, so it does not: these tests
 * are written against the STATED CONTRACT — "the graph must not be framed
 * underneath the panel, at the least cost to the fitting box" — and not against
 * the 1280x800 case that motivated the work. A reservation is correct when the
 * chosen side EXCLUDES the occluder from the fitting box; that postcondition is
 * asserted directly below rather than by pinning the side a particular geometry
 * happens to pick.
 */
describe('computeFitPadding — floating Olumi panel', () => {
  const PANEL = '[data-testid="floating-olumi-panel"]'
  const SIDE_TAB = '[data-testid="floating-olumi-panel-side-tab"]'
  const PILL = '[aria-label="Restore Olumi"]'
  const FLOW = { left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }

  /** The fitting box the returned padding implies, in viewport coordinates. */
  function fitBoxOf(p: { top: string; right: string; bottom: string; left: string }) {
    return {
      left: FLOW.left + parseInt(p.left, 10),
      right: FLOW.right - parseInt(p.right, 10),
      top: FLOW.top + parseInt(p.top, 10),
      bottom: FLOW.bottom - parseInt(p.bottom, 10),
    }
  }

  function overlaps(a: { left: number; right: number; top: number; bottom: number }, b: typeof a) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  }

  it('excludes the panel from the fitting box at every EDGE-RESTING position', () => {
    // The POSTCONDITION, swept over the positions the panel actually rests at in
    // the product: the bottom-right anchor `FirstUseComposer` slides to on the
    // 0→N draft, the left clamp floor (x = DEFAULT_MARGIN + SIDE_TAB_WIDTH = 52,
    // where `clampPositionToViewport` parks it), and the top-left corner. If any
    // of these framed the graph under the panel the reservation would be
    // decorative. The CENTRED case is excluded here on purpose and gets its own
    // test below — it cannot satisfy this postcondition, and pretending
    // otherwise by widening the sweep until it passed would hide that.
    const positions = [
      { name: 'bottom-right anchor', left: 812, top: 234 },
      { name: 'left clamp floor', left: 52, top: 73 },
      { name: 'top-left', left: 52, top: 16 },
    ]
    for (const pos of positions) {
      const panel = { left: pos.left, right: pos.left + 400, top: pos.top, bottom: pos.top + 550 }
      stubSelectors({
        [PANEL]: fakeEl({ ...panel, width: 400, height: 550 }),
        [SIDE_TAB]: fakeEl({ left: panel.left - 36, right: panel.left, top: pos.top, bottom: pos.top + 120, width: 36, height: 120 }),
      })
      const p = computeFitPadding(fakeEl(FLOW))
      const box = fitBoxOf(p)
      const panelWithTab = { ...panel, left: panel.left - 36 }
      // PIN THE PRECONDITION (else this passes for the wrong reason): assert the
      // MAX_PADDING_FRACTION clamp is NOT binding on either axis, so the
      // exclusion below is the reservation's doing and not an accident of a
      // capped padding that happened to land clear.
      const hSum = parseInt(p.left, 10) + parseInt(p.right, 10)
      const vSum = parseInt(p.top, 10) + parseInt(p.bottom, 10)
      expect(hSum, `${pos.name}: horizontal clamp bound`).toBeLessThanOrEqual(1024)
      expect(vSum, `${pos.name}: vertical clamp bound`).toBeLessThanOrEqual(640)
      expect(overlaps(box, panelWithTab), `${pos.name}: fitting box still overlaps the panel`).toBe(false)
      vi.restoreAllMocks()
    }
  })

  it('CANNOT clear a centred panel — the fitting-area clamp binds first', () => {
    // An honest limit, not a pass. A 400x550 panel resting mid-pane needs a
    // 691px reservation on its cheapest side; MAX_PADDING_FRACTION caps the
    // vertical pair at 640px, so the clamp scales the reservation DOWN and the
    // fitting box still overlaps the panel. Recorded rather than papered over:
    // it is the strongest statement of why the hero MINIMISES after the draft
    // (FirstUseComposer) instead of the product trying to fit around it.
    const panel = { left: 440, right: 840, top: 125, bottom: 675 }
    stubSelectors({
      [PANEL]: fakeEl({ ...panel, width: 400, height: 550 }),
      [SIDE_TAB]: fakeEl({ left: 404, right: 440, top: 125, bottom: 245, width: 36, height: 120 }),
    })
    const p = computeFitPadding(fakeEl(FLOW))
    const box = fitBoxOf(p)
    // 639, not 640: `capPair` floors each side after scaling (29→25, 691→614),
    // so the pair lands one below the 0.8 cap. Pinned at the value the code
    // actually produces rather than the value the cap suggests.
    expect(parseInt(p.top, 10) + parseInt(p.bottom, 10)).toBe(639)
    expect(overlaps(box, { ...panel, left: 404 })).toBe(true) // and so it is NOT cleared
  })

  it('unions the side tab, which sits OUTSIDE the panel rect at left:-36', () => {
    // Identity-bound, and deliberately measured on a RIGHT-side reservation.
    // The side tab extends the panel's LEFT edge, and a left-side reservation is
    // `occ.right - flow.left` — which does not read occ.left at all, so the tab
    // is invisible there. Only `right` (= flow.right - occ.left) can observe it.
    // The first draft of this test asserted the difference on a left-resting
    // panel and measured 0: a spec written from the assumption rather than from
    // the formula would have "proved" the union works while testing nothing.
    const panel = { left: 812, right: 1212, top: 234, bottom: 784 }
    stubSelectors({
      [PANEL]: fakeEl({ ...panel, width: 400, height: 550 }),
      [SIDE_TAB]: fakeEl({ left: 776, right: 812, top: 234, bottom: 354, width: 36, height: 120 }),
    })
    const withTab = parseInt(computeFitPadding(fakeEl(FLOW)).right, 10)
    vi.restoreAllMocks()

    stubSelectors({ [PANEL]: fakeEl({ ...panel, width: 400, height: 550 }) })
    const withoutTab = parseInt(computeFitPadding(fakeEl(FLOW)).right, 10)

    expect(withTab - withoutTab).toBe(36)
    expect(withTab).toBe(520) // 1280 - 776 + 16 gap
  })

  it('takes the CHEAPEST side, not a fixed one — a bottom-resting panel costs bottom, not width', () => {
    // A wide, short panel hugging the bottom edge: reserving width would cost
    // far more than reserving height. This is the discriminating case — a
    // right-only implementation passes the first test and fails this one.
    stubSelectors({
      [PANEL]: fakeEl({ left: 300, right: 1000, top: 700, bottom: 790, width: 700, height: 90 }),
    })
    const p = computeFitPadding(fakeEl(FLOW))
    expect(p.bottom).toBe('116px') // 800 - 700 + 16
    expect(p.left).toBe('47px') // untouched base margin
    expect(p.right).toBe('47px')
  })

  it('reserves nothing when the panel does not overlap the flow rect', () => {
    // Positive control for the absence claim: the SAME stub shape that produces
    // a reservation above must produce none here, so a no-op implementation
    // cannot pass both this and the tests above.
    stubSelectors({
      [PANEL]: fakeEl({ left: 1400, right: 1800, top: 73, bottom: 623, width: 400, height: 550 }),
    })
    const p = computeFitPadding(fakeEl(FLOW))
    expect(p.left).toBe('47px')
    expect(p.right).toBe('47px')
    expect(p.top).toBe('29px')
    expect(p.bottom).toBe('29px')
  })

  it('does NOT reserve the minimised pill — the measured reason it is excluded', () => {
    // Deliberate product judgement, pinned so a later tidy-up cannot "restore
    // consistency" by adding the pill selector back without re-reading why.
    // Measured 16 Aug 2026: reserving an 84x28 pill resting mid-pane took 416px
    // of bottom padding, collapsing the vertical fitting box to 355px for a
    // graph needing 524px — clamping the entire first view of the model to
    // avoid a node grazing a draggable affordance.
    stubSelectors({ [PILL]: fakeEl({ left: 640, right: 708, top: 400, bottom: 425, width: 68, height: 25 }) })
    const p = computeFitPadding(fakeEl(FLOW))
    expect(p.bottom).toBe('29px')
    expect(p.top).toBe('29px')
    expect(p.left).toBe('47px')
    expect(p.right).toBe('47px')
  })

  it('reserves the panel ALONGSIDE the dock, taking the larger on a shared side', () => {
    // Both occlude the right at 1280x800 with the dock collapsed: the rail
    // reserves 68, the bottom-right panel 504. The side must carry the larger,
    // never the last one written.
    stubSelectors({
      [DOCK]: fakeEl({ left: 1228, right: 1268, width: 40, top: 12, bottom: 784, height: 772 }),
      [PANEL]: fakeEl({ left: 812, right: 1212, top: 234, bottom: 784, width: 400, height: 550 }),
      [SIDE_TAB]: fakeEl({ left: 776, right: 812, top: 234, bottom: 354, width: 36, height: 120 }),
    })
    const p = computeFitPadding(fakeEl(FLOW))
    expect(p.right).toBe('520px') // 1280 - 776 + 16, beating the rail's 68
  })
})

describe('cheapestReservation', () => {
  const FLOW = { left: 0, top: 0, right: 1280, bottom: 800 }

  it('returns null when the boxes do not intersect', () => {
    expect(cheapestReservation(FLOW, { left: 1400, top: 0, right: 1800, bottom: 550 })).toBeNull()
    expect(cheapestReservation(FLOW, { left: 100, top: 900, right: 500, bottom: 1200 })).toBeNull()
  })

  it('picks the minimum of the four clearing distances', () => {
    // Bottom-right anchored panel: right (504) < bottom (566) < left (1212).
    expect(cheapestReservation(FLOW, { left: 776, top: 234, right: 1212, bottom: 784 })).toEqual({
      side: 'right',
      amount: 504,
    })
    // Same panel moved to hug the top edge: top (262) is now cheapest.
    expect(cheapestReservation(FLOW, { left: 776, top: 0, right: 1212, bottom: 262 })).toEqual({
      side: 'top',
      amount: 262,
    })
  })

  it('never returns a negative amount', () => {
    // Spec-level invariant (not a case): a padding is a non-negative length,
    // whatever pathological rect arrives.
    const boxes = [
      { left: -500, top: -500, right: 2000, bottom: 2000 },
      { left: 0, top: 0, right: 1280, bottom: 800 },
      { left: 1279, top: 799, right: 1281, bottom: 801 },
    ]
    for (const b of boxes) {
      const r = cheapestReservation(FLOW, b)
      if (r) expect(r.amount).toBeGreaterThanOrEqual(0)
    }
  })
})

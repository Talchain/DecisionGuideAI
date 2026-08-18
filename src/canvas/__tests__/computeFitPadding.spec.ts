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
 * STEP 1 (18 Aug 2026) — THE FLOATING PANEL RESERVES NOTHING, EVER.
 *
 * `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md`, built inside the founder's
 * ruling: *"FLOATING AND LAYOUT-RESERVING ARE DIFFERENT CONCEPTS… FIX THE
 * COMPOSITION, NOT THE CAPABILITY."* This module was the one place in the
 * codebase that conflated them: it converted a free-floating overlay into a
 * rectangular fitView inset, and because a rectangular inset cannot express
 * "this box is covered", the only way to clear a 400x550 panel was to give up
 * a whole band of canvas. Measured live at 1280x800: **392px of canvas, 52% of
 * the resulting fit box**, spent so one conversation and one analysis could
 * coexist. Fit box 368x742 with the panel open, 760x742 without it.
 *
 * The tests this replaces asserted the OPPOSITE contract ("the graph must not
 * be framed underneath the panel, at the least cost to the fitting box") and
 * they were correct about the code as it stood. They are deleted rather than
 * skipped, because the contract they pinned is the one being retired — with
 * one exception carried over deliberately: the minimised pill's non-reservation
 * is now a special case of the general rule rather than a judgement of its own.
 *
 * THE NEW RULE, stated once: **ONLY EDGE-ANCHORED, LAYOUT-RESERVING CHROME
 * CONTRIBUTES.** Guard G2(a) of the decision.
 *
 * ⚠ WHAT THIS DOES **NOT** MEAN, and the reason `cameraComfort` changed in the
 * same commit: "the fit must not reserve for the panel" is not "nothing may
 * know the panel is there". `cameraComfort`'s no-churn rule is stated as each
 * target's rect inside the fit frame — "anything less — a target off-screen,
 * UNDER AN OCCLUDING PANEL, or rendered unreadably small — and the caller
 * fits". It derived that frame from THIS function, so deleting the floating
 * branch here alone would have scored a node behind the panel COMFORTABLE and
 * the focus camera would have silently refused to move — a regression in the
 * very capability this change exists to serve, with no error and no red test.
 * See `cameraComfort.spec.ts` → "the floating companion is comfort-visible".
 */
describe('computeFitPadding — the floating panel reserves NOTHING (G2a: padding invariance)', () => {
  const PANEL = '[data-testid="floating-olumi-panel"]'
  const SIDE_TAB = '[data-testid="floating-olumi-panel-side-tab"]'
  const PILL = '[aria-label="Restore Olumi"]'
  const FLOW = { left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }
  // The shipped 1280x800 geometry: dock `right: 12` at 416px, sidebar at 12/52.
  const DOCK_1280 = { left: 852, right: 1268, width: 416, top: 12, bottom: 784, height: 772 }
  const SIDEBAR_1280 = { left: 12, right: 60, width: 48, top: 73, bottom: 300, height: 227 }

  /**
   * Every position the panel actually reaches, INCLUDING the centred case the
   * old suite had to except itself from (`MAX_PADDING_FRACTION` bound first) and
   * the bottom-hugging case that used to take a cheap bottom reservation. Under
   * invariance there is no case to except: the answer is zero everywhere.
   */
  const POSITIONS = [
    { name: 'bottom-right anchor (FirstUseComposer)', left: 812, top: 234, w: 400, h: 550 },
    { name: 'left clamp floor', left: 52, top: 73, w: 400, h: 550 },
    { name: 'top-left', left: 52, top: 16, w: 400, h: 550 },
    { name: 'centred (the old suite could not clear this one)', left: 440, top: 125, w: 400, h: 550 },
    { name: 'wide + bottom-hugging (used to cost bottom)', left: 300, top: 700, w: 700, h: 90 },
    { name: 'fully outside the flow rect', left: 1400, top: 73, w: 400, h: 550 },
  ] as const

  function baseline() {
    stubSelectors({ [DOCK]: fakeEl(DOCK_1280), [SIDEBAR]: fakeEl(SIDEBAR_1280) })
    const p = computeFitPadding(fakeEl(FLOW))
    vi.restoreAllMocks()
    return p
  }

  it('inserting a floating rect ANYWHERE changes the returned padding by exactly zero', () => {
    const before = baseline()
    // PIN THE PRECONDITION (trap 13b): this whole assertion is vacuous unless
    // the baseline is a real, non-degenerate reservation. 444 = dock overlap 428
    // + GAP 16; 76 = sidebar 60 + GAP 16. If either drifted to the base margin
    // the invariance below would pass while measuring nothing.
    expect(before, 'baseline must be the real 1280x800 reservation').toEqual({
      top: '29px',
      right: '444px',
      bottom: '29px',
      left: '76px',
    })

    for (const pos of POSITIONS) {
      const panel = { left: pos.left, right: pos.left + pos.w, top: pos.top, bottom: pos.top + pos.h }
      stubSelectors({
        [DOCK]: fakeEl(DOCK_1280),
        [SIDEBAR]: fakeEl(SIDEBAR_1280),
        [PANEL]: fakeEl({ ...panel, width: pos.w, height: pos.h }),
        // The side tab sits OUTSIDE the panel rect at `left: -36` (overflow
        // visible), so a union-blind implementation used to be 36px short. Both
        // are asserted to cost zero.
        [SIDE_TAB]: fakeEl({
          left: panel.left - 36,
          right: panel.left,
          top: pos.top,
          bottom: pos.top + 120,
          width: 36,
          height: 120,
        }),
      })
      const after = computeFitPadding(fakeEl(FLOW))
      expect(after, `${pos.name}: the floating panel changed the padding`).toEqual(before)
      vi.restoreAllMocks()
    }
  })

  it('the minimised pill still reserves nothing — now a case of the rule, not an exception to it', () => {
    const before = baseline()
    stubSelectors({
      [DOCK]: fakeEl(DOCK_1280),
      [SIDEBAR]: fakeEl(SIDEBAR_1280),
      [PILL]: fakeEl({ left: 640, right: 708, top: 400, bottom: 425, width: 68, height: 25 }),
    })
    expect(computeFitPadding(fakeEl(FLOW))).toEqual(before)
  })

  it('integration: a floating panel in the REAL DOM changes nothing (no-arg call, real selectors)', () => {
    // The invariance above drives a stubbed `querySelector`. This one builds the
    // real elements, so a future implementation that reads the panel through a
    // different selector, a different attribute or a live `document` walk is
    // still covered. Same three-element geometry as the 1280x800 case.
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
      created.push(mk('div', { class: 'react-flow' }, { ...FLOW }))
      created.push(mk('aside', { 'aria-label': 'Outputs dock' }, DOCK_1280))
      created.push(mk('nav', { 'aria-label': 'Canvas tools' }, SIDEBAR_1280))
      const without = computeFitPadding()

      created.push(
        mk('div', { 'data-testid': 'floating-olumi-panel' }, { left: 812, right: 1212, top: 234, bottom: 784, width: 400, height: 550 }),
      )
      created.push(
        mk('div', { 'data-testid': 'floating-olumi-panel-side-tab' }, { left: 776, right: 812, top: 234, bottom: 354, width: 36, height: 120 }),
      )
      const with_ = computeFitPadding()

      expect(without.right).toBe('444px') // precondition: a real reservation exists
      expect(with_).toEqual(without)
    } finally {
      created.forEach((el) => el.remove())
    }
  })

  /**
   * THE DISCRIMINATING PAIR (decision §6, step 1). Invariance alone cannot tell
   * "the panel is ignored" apart from "this function ignores everything". The
   * mutant that removes the invariance REDs the test above; the mutant that
   * changes an EDGE-ANCHORED reservation must RED **this** test instead — a
   * different assertion, on a different rule. Neither alone proves the binding.
   */
  it('an EDGE-ANCHORED reservation still moves the padding — the other half of the pair', () => {
    const expanded = baseline()
    stubSelectors({
      // Same dock, collapsed to its 40px rail: left = 1280 - 12 - 40 = 1228.
      [DOCK]: fakeEl({ left: 1228, right: 1268, width: 40, top: 12, bottom: 784, height: 772 }),
      [SIDEBAR]: fakeEl(SIDEBAR_1280),
    })
    const rail = computeFitPadding(fakeEl(FLOW))
    expect(rail.right).toBe('68px') // 52 overlap + 16 gap
    expect(rail.right).not.toBe(expanded.right)

    // And the win this change buys, asserted as arithmetic on the real function
    // rather than restated: 760px of fit box at the expanded dock (up from the
    // measured 368px with the panel open), 1136px at the rail.
    const boxOf = (p: { left: string; right: string }) => 1280 - parseInt(p.left, 10) - parseInt(p.right, 10)
    expect(boxOf(expanded)).toBe(760)
    expect(boxOf(rail)).toBe(1136)
  })
})

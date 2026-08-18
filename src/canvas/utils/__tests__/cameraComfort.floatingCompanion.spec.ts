/**
 * THE SHARED MISS — no design in the workspace-composition set named it, and it
 * is the one defect that would have shipped silently.
 *
 * `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` §5.1 deletes the floating
 * panel's contribution to `computeFitPadding`, because a free-floating overlay
 * is not layout-reserving chrome and must not cost the graph a band of canvas.
 * `cameraComfort`'s no-churn rule, however, is stated as each target's rect
 * inside the panel-aware fit frame — *"anything less — a target off-screen,
 * UNDER AN OCCLUDING PANEL, or rendered unreadably small — and the caller
 * fits"* — and it derived that frame from `computeFitPadding` alone.
 *
 * **So the deletion, on its own, makes a node behind the floating panel score
 * COMFORTABLE, and the focus camera silently refuses to move.** No error, no
 * red test, no user-visible failure except that "Ask Olumi about this node"
 * stops bringing the node into view — capability 2 of the six, regressed by the
 * fix meant to serve it. That is why the companion-aware comfort frame lands in
 * the SAME COMMIT as the deletion, and why this spec exists.
 *
 * THE TWO FRAMES ARE NOW DELIBERATELY DIFFERENT, and the asymmetry is the
 * contract:
 *   - `FocusCamera.padding` — what the gated fit passes to `fitView`. Derived
 *     from EDGE-ANCHORED, LAYOUT-RESERVING chrome only. The floating companion
 *     contributes nothing, ever.
 *   - `FocusCamera.insets` — the frame the no-churn GATE measures against. The
 *     same padding, then widened by whatever the floating companion occludes.
 *
 * The gate frame is therefore a subset of the fit frame, never a superset, so
 * this change can only make the camera fit MORE often than before — never less.
 * "Comfortable" is strictly harder to earn than it was at pristine, which is
 * the safe direction for a gate whose failure mode is a stranded camera.
 *
 * ⚠ The honest limit, recorded rather than glossed: the clearance is
 * RECTANGULAR (a fitView inset cannot express "this box is covered"), so a node
 * that merely shares the companion's band — beside it, not behind it — also
 * scores uncomfortable. That is the pre-existing shape of the old reservation,
 * carried forward unchanged; the decision's step 6 (fit-then-place) is what
 * removes the occlusion rather than reserving around it.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  cheapestClearance,
  comfortInsets,
  nodesComfortablyVisible,
  paddingToInsets,
  readFloatingCompanionBox,
  readFocusCamera,
  COMFORT_OCCLUSION_GAP,
  FLOATING_COMPANION_SELECTORS,
} from '../cameraComfort'
import { computeFitPadding } from '../computeFitPadding'

const FLOW = { left: 0, top: 0, right: 1280, bottom: 800 }
/** The shipped 1280x800 geometry — dock `right: 12` at 416px, sidebar at 12/52. */
const DOCK_1280 = { left: 852, right: 1268, width: 416, top: 12, bottom: 784, height: 772 }
const SIDEBAR_1280 = { left: 12, right: 60, width: 48, top: 73, bottom: 300, height: 227 }
/** Bottom-right anchor the hero slides to on the 0→N draft (FirstUseComposer). */
const PANEL_ANCHORED = { left: 812, top: 234, right: 1212, bottom: 784 }

function fakeEl(rect: Partial<DOMRect>): HTMLElement {
  const full = {
    x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0,
    toJSON: () => ({}), ...rect,
  } as DOMRect
  return { getBoundingClientRect: () => full } as unknown as HTMLElement
}

function stubSelectors(map: Record<string, HTMLElement | null>) {
  vi.spyOn(document, 'querySelector').mockImplementation(
    (sel: string) => (sel in map ? map[sel] : null) as Element | null,
  )
}

const DOCK = 'aside[aria-label="Outputs dock"]'
const SIDEBAR = 'nav[aria-label="Canvas tools"]'
const PANEL = '[data-testid="floating-olumi-panel"]'
const SIDE_TAB = '[data-testid="floating-olumi-panel-side-tab"]'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cheapestClearance — the geometry, moved here from computeFitPadding', () => {
  // These two assertions are carried over VERBATIM from the deleted
  // `cheapestReservation` suite rather than rewritten: the geometry did not
  // change, only who is allowed to consume it. Deleting evidence because the
  // caller moved would have thrown away the only pins on the four-direction
  // minimum (CLAUDE.md trap 14b — a corpus is evidence, not a fixture).
  it('returns null when the boxes do not intersect', () => {
    expect(cheapestClearance(FLOW, { left: 1400, top: 0, right: 1800, bottom: 550 })).toBeNull()
    expect(cheapestClearance(FLOW, { left: 100, top: 900, right: 500, bottom: 1200 })).toBeNull()
  })

  it('picks the minimum of the four clearing distances', () => {
    expect(cheapestClearance(FLOW, { left: 776, top: 234, right: 1212, bottom: 784 })).toEqual({
      side: 'right',
      amount: 504,
    })
    expect(cheapestClearance(FLOW, { left: 776, top: 0, right: 1212, bottom: 262 })).toEqual({
      side: 'top',
      amount: 262,
    })
  })

  it('never returns a negative amount', () => {
    for (const b of [
      { left: -500, top: -500, right: 2000, bottom: 2000 },
      { left: 0, top: 0, right: 1280, bottom: 800 },
      { left: 1279, top: 799, right: 1281, bottom: 801 },
    ]) {
      const r = cheapestClearance(FLOW, b)
      if (r) expect(r.amount).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('readFloatingCompanionBox — unions the side tab that sits OUTSIDE the panel rect', () => {
  it('is null when no companion is present', () => {
    stubSelectors({})
    expect(readFloatingCompanionBox()).toBeNull()
  })

  it('extends the panel LEFT edge by the side tab at left:-36', () => {
    stubSelectors({
      [PANEL]: fakeEl({ ...PANEL_ANCHORED, width: 400, height: 550 }),
      [SIDE_TAB]: fakeEl({ left: 776, right: 812, top: 234, bottom: 354, width: 36, height: 120 }),
    })
    // Identity-bound on the LEFT edge specifically: the tab is positioned at
    // `left: -36` with the panel `overflow: visible`, so it is absent from the
    // panel's own rect and only the left edge can observe the union.
    expect(readFloatingCompanionBox()).toEqual({ left: 776, top: 234, right: 1212, bottom: 784 })
  })

  it('reads through the recorded selector list, which is the single source', () => {
    // A hand-maintained list of selectors in two modules is the estate's
    // dominant defect (trap 12). After step 1, `computeFitPadding` names the
    // companion nowhere, so this list is the ONLY place it is spelled.
    expect([...FLOATING_COMPANION_SELECTORS]).toEqual([
      '[data-testid="floating-olumi-panel"]',
      '[data-testid="floating-olumi-panel-side-tab"]',
    ])
  })
})

describe('comfortInsets — the fit frame, widened by what the companion occludes', () => {
  const padding = { top: '29px', right: '444px', bottom: '29px', left: '76px' } as const

  it('with no companion, it IS the padding — byte for byte', () => {
    expect(comfortInsets(FLOW, padding, null)).toEqual(paddingToInsets(padding))
  })

  it('widens the cheapest side by clearance + gap when a companion overlaps', () => {
    const insets = comfortInsets(FLOW, padding, { left: 776, top: 234, right: 1212, bottom: 784 })
    // clearance right = flow.right(1280) - occ.left(776) = 504; + GAP.
    expect(insets.right).toBe(504 + COMFORT_OCCLUSION_GAP)
    expect(insets.left).toBe(76)
    expect(insets.top).toBe(29)
    expect(insets.bottom).toBe(29)
  })

  it('is never MORE permissive than the padding alone, at any companion position', () => {
    // The monotonicity claim this change rests on, asserted rather than argued:
    // a smaller gate frame can only make the camera fit more often. If any side
    // ever came back SMALLER than the padding inset, a node could become newly
    // "comfortable" and the camera would newly refuse to move.
    const base = paddingToInsets(padding)
    const positions = [
      { name: 'bottom-right anchor', left: 812, top: 234, w: 400, h: 550 },
      { name: 'left clamp floor', left: 52, top: 73, w: 400, h: 550 },
      { name: 'centred', left: 440, top: 125, w: 400, h: 550 },
      { name: 'wide + bottom-hugging', left: 300, top: 700, w: 700, h: 90 },
      { name: 'fully outside the flow rect', left: 1400, top: 73, w: 400, h: 550 },
    ]
    for (const p of positions) {
      const insets = comfortInsets(FLOW, padding, {
        left: p.left, top: p.top, right: p.left + p.w, bottom: p.top + p.h,
      })
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        expect(insets[side], `${p.name}.${side}`).toBeGreaterThanOrEqual(base[side])
      }
    }
  })
})

describe('THE SHARED MISS — the floating companion is comfort-visible even though it reserves nothing', () => {
  /**
   * ⭐ MEASURED WHILE WRITING THIS TEST, and it sharpens the claim rather than
   * weakening it. The first fixture used the EXPANDED-dock padding (right 444px)
   * and its own precondition refused: at 1280 the expanded dock already excludes
   * every screen x above 844, and the companion's band starts at 776, so only a
   * 68px-wide sliver of the companion sits inside the padding frame at all — no
   * 200px node can be both inside that frame and behind the panel.
   *
   * So the honest scope of the miss is:
   *  - **at the 40px rail it is fully live** — the frame reaches x 1220 and the
   *    companion occupies 776..1212 of it. This is the state the decision
   *    PROMOTES as the one-gesture whole-model view, i.e. exactly where a user
   *    asks about a node they can finally see.
   *  - at the expanded dock it is live only for nodes in that 68px sliver.
   *
   * The fixture below is therefore the rail, named, rather than a width chosen
   * to make the assertion pass. Pinning the sliver case as well would assert
   * almost nothing and would read as broader coverage than it is.
   */
  const PADDING_RAIL = { top: '29px', right: '68px', bottom: '29px', left: '76px' } as const

  /**
   * A node parked under the bottom-right anchored panel: flow (900, 400), so at
   * zoom 1 with the viewport at the origin its screen rect is x 900..1100,
   * y 400..480 — inside the panel's 776..1212 x 234..784 box.
   */
  const NODE_BEHIND_PANEL = { position: { x: 900, y: 400 }, measured: { width: 200, height: 80 } }
  /** Same graph, a node well clear of the companion's band on the left. */
  const NODE_CLEAR_OF_PANEL = { position: { x: 200, y: 400 }, measured: { width: 200, height: 80 } }
  const VIEWPORT = { x: 0, y: 0, zoom: 1 }

  it('scores a node behind the companion as NOT comfortable, so the camera moves', () => {
    // PIN THE PRECONDITION, or this test passes for the wrong reason: with
    // PADDING-ONLY insets — exactly what the step-1 deletion leaves behind — the
    // same node IS comfortable and the camera would refuse to move. That is the
    // regression; the assertion below is the fix.
    const paddingOnly = comfortInsets(FLOW, PADDING_RAIL, null)
    expect(
      nodesComfortablyVisible([NODE_BEHIND_PANEL], VIEWPORT, 1280, 800, paddingOnly),
      'precondition: padding-only insets score the occluded node COMFORTABLE',
    ).toBe(true)

    const companionAware = comfortInsets(FLOW, PADDING_RAIL, PANEL_ANCHORED)
    expect(
      nodesComfortablyVisible([NODE_BEHIND_PANEL], VIEWPORT, 1280, 800, companionAware),
    ).toBe(false)
  })

  it('a node clear of the companion stays comfortable — the contrast control', () => {
    // Without this, "not comfortable" could be the frame collapsing rather than
    // the occlusion being observed: a gate that fails everything is not a gate.
    const companionAware = comfortInsets(FLOW, PADDING_RAIL, PANEL_ANCHORED)
    expect(
      nodesComfortablyVisible([NODE_CLEAR_OF_PANEL], VIEWPORT, 1280, 800, companionAware),
    ).toBe(true)
  })

  it('and the same node is comfortable again once the companion closes', () => {
    // The round trip: the gate is a function of the companion's PRESENCE, not a
    // permanent narrowing of the frame. A `null` companion restores the frame
    // byte-for-byte, so closing the panel does not leave the camera twitchy.
    const companionAware = comfortInsets(FLOW, PADDING_RAIL, PANEL_ANCHORED)
    const closed = comfortInsets(FLOW, PADDING_RAIL, null)
    expect(closed).toEqual(paddingToInsets(PADDING_RAIL))
    expect(closed).not.toEqual(companionAware)
    expect(nodesComfortablyVisible([NODE_BEHIND_PANEL], VIEWPORT, 1280, 800, closed)).toBe(true)
  })
})

describe('readFocusCamera — one measurement, two deliberately different frames', () => {
  function stubLiveDom() {
    const flowEl = fakeEl({ ...FLOW, width: 1280, height: 800 })
    stubSelectors({
      '.react-flow': flowEl,
      [DOCK]: fakeEl(DOCK_1280),
      [SIDEBAR]: fakeEl(SIDEBAR_1280),
      [PANEL]: fakeEl({ ...PANEL_ANCHORED, width: 400, height: 550 }),
      [SIDE_TAB]: fakeEl({ left: 776, right: 812, top: 234, bottom: 354, width: 36, height: 120 }),
    })
    return flowEl
  }

  it('the FIT padding is companion-free — identical to computeFitPadding', () => {
    // The test that REDs if a later lane "restores consistency" by feeding the
    // companion back into the padding. That would re-take the 392px of canvas
    // this change exists to give back.
    const flowEl = stubLiveDom()
    const camera = readFocusCamera(() => ({ x: 0, y: 0, zoom: 1 }))
    expect(camera).not.toBeNull()
    expect(camera!.padding).toEqual(computeFitPadding(flowEl))
    expect(camera!.padding.right).toBe('444px') // dock 428 + gap 16, and nothing else
  })

  it('the GATE insets are companion-aware — and therefore NOT the padding', () => {
    stubLiveDom()
    const camera = readFocusCamera(() => ({ x: 0, y: 0, zoom: 1 }))
    expect(camera).not.toBeNull()
    // Identity-bound on the side the companion actually occludes, and asserted
    // as a DIFFERENCE from the padding, so a future collapse of the two frames
    // into one reds here rather than going quiet.
    expect(camera!.insets.right).toBe(504 + COMFORT_OCCLUSION_GAP)
    expect(camera!.insets).not.toEqual(paddingToInsets(camera!.padding))
  })

  it('with no companion the two frames agree exactly — the no-op case', () => {
    stubSelectors({
      '.react-flow': fakeEl({ ...FLOW, width: 1280, height: 800 }),
      [DOCK]: fakeEl(DOCK_1280),
      [SIDEBAR]: fakeEl(SIDEBAR_1280),
    })
    const camera = readFocusCamera(() => ({ x: 0, y: 0, zoom: 1 }))
    expect(camera).not.toBeNull()
    expect(camera!.insets).toEqual(paddingToInsets(camera!.padding))
  })
})

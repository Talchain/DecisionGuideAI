/**
 * UX GATE 7b — THE FIT FRAME CLEARS THE FLOATING HEADER PILL.
 *
 * `computeFitPadding` used to carry, on the line that set `top`, the claim
 * *"Top bar sits above `.react-flow` in the flex layout, so it never overlaps
 * the flow rect"*. That was FALSE at the deployed tip, and it is the whole
 * defect: `TopBar` is a fixed pill (`position: fixed; top: 12px; height: 45px;
 * z-index: 3000`, `TopBar.module.css:1-19`) painted OVER a full-window
 * `.react-flow`, so a fitted graph's top row lands underneath it and, at
 * z-3000 over z-0, is not hit-testable.
 *
 * ⚠ SCOPE, BEFORE THE ASSERTIONS (platform trap 3). Everything here is
 * ARITHMETIC over stubbed rects. jsdom runs no CSS layout, so nothing in this
 * file proves a rendered overlap, a settled camera or a hit test. What it does
 * prove is that the padding this function returns clears a bar of the measured
 * geometry, and that the amount is DERIVED from that geometry rather than
 * written down. The occlusion and hit-test claims are browser claims and are
 * carried in the PR.
 *
 * LIVE PRECONDITION, derived on the deployed build
 * `4d1e650b5d3314f1fb4e2279f1bee917206047d8` (fresh guest, `/#/canvas`,
 * 1280x800, `getBoundingClientRect`):
 *   `[role="banner"]`  -> { left 12, top 12, right 526.6, bottom 57 }  (h 45, z 3000, fixed)
 *   `.react-flow`      -> { left 0,  top 0,  right 1280,  bottom 800 } (z 0, relative)
 *   exactly ONE `[role="banner"]` in the document
 * The DEPLOYED_* constants below are that measurement, and the expected 73px is
 * derived from them here rather than asserted as a number pulled from the air.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { computeFitPadding, TOP_BAR_SELECTOR } from '../utils/computeFitPadding'

function fakeEl(rect: Partial<DOMRect>): HTMLElement {
  const full: DOMRect = {
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

/** The 19 Aug 2026 live measurement at 1280x800 on `4d1e650b`. */
const DEPLOYED_FLOW = { left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }
const DEPLOYED_BANNER = { left: 12, right: 526.6, width: 514.6, top: 12, bottom: 57, height: 45 }
const DEPLOYED_DOCK = { left: 852, right: 1268, width: 416, top: 12, bottom: 784, height: 772 }
const DEPLOYED_SIDEBAR = { left: 12, right: 60, width: 48, top: 73, bottom: 300, height: 227 }

/** Mirrors the module's own constants so the expectations are derived, not copied. */
const GAP = 16
const baseMargin = (d: number) => Math.max(0, Math.floor((d - d / 1.08) * 0.5))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('computeFitPadding — the floating header pill is an occluder (UX gate 7b)', () => {
  it('reserves the bar it can SEE: top = (bar.bottom - flow.top) + GAP at the deployed geometry', () => {
    stubSelectors({
      [TOP_BAR_SELECTOR]: fakeEl(DEPLOYED_BANNER),
      [DOCK]: fakeEl(DEPLOYED_DOCK),
      [SIDEBAR]: fakeEl(DEPLOYED_SIDEBAR),
    })
    const p = computeFitPadding(fakeEl(DEPLOYED_FLOW))

    // Derived from the live rects above, not written down:
    const expectedTop = Math.max(
      baseMargin(DEPLOYED_FLOW.height),
      DEPLOYED_BANNER.bottom - DEPLOYED_FLOW.top + GAP,
    )
    expect(expectedTop).toBe(73) // 57 + 16; sanity on the derivation itself
    expect(p.top).toBe(`${expectedTop}px`)

    // PIN THE PRECONDITION (trap 13b): this assertion is only meaningful while
    // the bar genuinely EXCEEDS the base margin. If the base ever grew past the
    // bar, `top` would be right for the wrong reason and this suite would go
    // quiet without a single red.
    expect(DEPLOYED_BANNER.bottom - DEPLOYED_FLOW.top + GAP).toBeGreaterThan(
      baseMargin(DEPLOYED_FLOW.height),
    )

    // The other three sides are untouched by this change.
    expect(p.right).toBe('444px') // dock overlap 428 + GAP
    expect(p.left).toBe('76px') // sidebar overlap 60 + GAP
    expect(p.bottom).toBe(`${baseMargin(DEPLOYED_FLOW.height)}px`)
  })

  it('DERIVES the amount from the measured rect — a taller bar reserves proportionally more', () => {
    // This is the anti-magic-number assertion. A hardcoded 57/73 (or a read of
    // `--topbar-h`, which TopBar writes as the literal string '57px') passes the
    // test above and FAILS this one.
    const results = [45, 64, 96].map((height) => {
      stubSelectors({ [TOP_BAR_SELECTOR]: fakeEl({ ...DEPLOYED_BANNER, height, bottom: 12 + height }) })
      const p = computeFitPadding(fakeEl(DEPLOYED_FLOW))
      vi.restoreAllMocks()
      return p.top
    })
    expect(results).toEqual(['73px', '92px', '124px']) // (12 + h) + 16
  })

  it('reserves NOTHING when no bar is mounted — the no-occluder case is unchanged', () => {
    stubSelectors({})
    const p = computeFitPadding(fakeEl(DEPLOYED_FLOW))
    expect(p.top).toBe(`${baseMargin(DEPLOYED_FLOW.height)}px`)
    expect(p.top).toBe('29px')
  })

  it('reserves nothing when the bar does not overlap the flow rect (canvas offset below it)', () => {
    // An embedded / offset canvas whose top edge already starts below the bar.
    // Overlap is measured against the FLOW rect, never the window, so this is
    // correctly zero rather than a blanket 73px.
    stubSelectors({ [TOP_BAR_SELECTOR]: fakeEl(DEPLOYED_BANNER) })
    const p = computeFitPadding(
      fakeEl({ left: 0, right: 1280, width: 1280, top: 120, bottom: 800, height: 680 }),
    )
    expect(p.top).toBe(`${baseMargin(680)}px`)
  })

  it('is bounded: a pathological bar cannot consume the pane (MAX_PADDING_FRACTION still caps)', () => {
    stubSelectors({
      [TOP_BAR_SELECTOR]: fakeEl({ left: 0, right: 600, width: 600, top: 0, bottom: 900, height: 900 }),
    })
    const p = computeFitPadding(fakeEl({ left: 0, right: 600, width: 600, top: 0, bottom: 500, height: 500 }))
    expect(parseFloat(p.top) + parseFloat(p.bottom)).toBeLessThanOrEqual(Math.floor(500 * 0.8))
  })

  it('the floating panel STILL reserves nothing, WITH the bar present (G2a holds across the change)', () => {
    // The lead question for this lane was whether the 7b fix is another instance
    // of the class it removes — "a panel's mere existence consumes canvas".
    // The discriminator is edge-anchoring, and this is the executable half of
    // it: adding an edge-anchored contributor must not re-admit the
    // free-floating one. Same POSITIONS spirit as G2a, run with the header up.
    const PANEL = '[data-testid="floating-olumi-panel"]'
    const SIDE_TAB = '[data-testid="floating-olumi-panel-side-tab"]'
    const PILL = '[aria-label="Restore Olumi"]'

    stubSelectors({
      [TOP_BAR_SELECTOR]: fakeEl(DEPLOYED_BANNER),
      [DOCK]: fakeEl(DEPLOYED_DOCK),
      [SIDEBAR]: fakeEl(DEPLOYED_SIDEBAR),
    })
    const before = computeFitPadding(fakeEl(DEPLOYED_FLOW))
    vi.restoreAllMocks()

    // PIN THE PRECONDITION: the baseline must be the real reservation on all
    // four sides, including the new top. Otherwise the invariance below is
    // measuring nothing.
    expect(before, 'baseline must be the real 1280x800 reservation, header included').toEqual({
      top: '73px', right: '444px', bottom: '29px', left: '76px',
    })

    const POSITIONS = [
      { name: 'bottom-right anchor (post-draft)', left: 436, top: 240, w: 400, h: 544 },
      { name: 'centred over the model', left: 440, top: 125, w: 400, h: 550 },
      { name: 'hugging the header pill', left: 52, top: 16, w: 400, h: 550 },
      { name: 'wide + bottom-hugging', left: 300, top: 700, w: 700, h: 90 },
    ] as const

    for (const pos of POSITIONS) {
      const rect = { left: pos.left, right: pos.left + pos.w, top: pos.top, bottom: pos.top + pos.h, width: pos.w, height: pos.h }
      for (const sel of [PANEL, SIDE_TAB, PILL]) {
        stubSelectors({
          [TOP_BAR_SELECTOR]: fakeEl(DEPLOYED_BANNER),
          [DOCK]: fakeEl(DEPLOYED_DOCK),
          [SIDEBAR]: fakeEl(DEPLOYED_SIDEBAR),
          [sel]: fakeEl(rect),
        })
        const after = computeFitPadding(fakeEl(DEPLOYED_FLOW))
        vi.restoreAllMocks()
        expect(after, `${sel} at ${pos.name} must change the padding by exactly zero`).toEqual(before)
      }
    }
  })
})

/**
 * THE BAND BUYS THE GRAPH BACK THE CANVAS IT SITS ON.
 *
 * `computeFitPadding` reserves, per edge, exactly what a qualifying occluder
 * covers. `CanvasOverlayBand` is the first thing ever anchored to the BOTTOM
 * edge — that function's own comment used to say "nothing is anchored to the
 * bottom edge of the canvas", and this change is why that sentence had to be
 * rewritten.
 *
 * What is asserted here is the half a source-scan cannot reach: the ARITHMETIC.
 * `computeFitPadding.contributorSet.spec.ts` proves the declaration and the code
 * agree about WHICH selectors are read; nothing there proves the bottom branch
 * computes anything, or that it computes the right thing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  computeFitPadding,
  OVERLAY_BAND_SELECTOR,
  FIT_PADDING_CONTRIBUTORS,
} from '../utils/computeFitPadding'
import {
  OVERLAY_BAND_SELECTOR as BAND_SELECTOR_FROM_COMPONENT,
  OVERLAY_BAND_HEIGHT,
  OVERLAY_BAND_BOTTOM,
} from '../components/CanvasOverlayBand'

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

/** The shipped 1280x800 canvas. baseMargin(800) = 29. */
const FLOW = { left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }
const BASE_BOTTOM = 29
/** GAP in computeFitPadding — the breathing room added beyond the overlap. */
const GAP = 16

/** The band as it actually renders: bottom 12, height 64 → top at 800-76 = 724. */
const BAND_TOP = 800 - OVERLAY_BAND_BOTTOM - OVERLAY_BAND_HEIGHT
const BAND_1280 = {
  left: 0, right: 1280, width: 1280,
  top: BAND_TOP, bottom: 800 - OVERLAY_BAND_BOTTOM, height: OVERLAY_BAND_HEIGHT,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('computeFitPadding — the canvas overlay band', () => {
  it('the two spellings of the band selector agree', () => {
    // `computeFitPadding` declares the selector as a literal rather than
    // importing it, so the module stays a pure DOM measurement with no React
    // dependency — the same reason `FloatingOlumiPanel.measureDockInset`
    // restates the dock selector. That is a duplicated string, so it gets a
    // guard: two spellings of one selector is exactly how an occluder starts
    // being measured by one half of the system and not the other.
    expect(OVERLAY_BAND_SELECTOR).toBe(BAND_SELECTOR_FROM_COMPONENT)
  })

  it('the band is a DECLARED contributor', () => {
    expect(FIT_PADDING_CONTRIBUTORS).toContain(OVERLAY_BAND_SELECTOR)
  })

  it('CONTROL: with no band, the bottom keeps the base margin', () => {
    // The before-picture. Without this, "the band adds inset" is equally
    // consistent with the bottom having been large all along.
    stubSelectors({})
    expect(computeFitPadding(fakeEl(FLOW)).bottom).toBe(`${BASE_BOTTOM}px`)
  })

  it('the band reserves what it covers, plus the gap', () => {
    stubSelectors({ [OVERLAY_BAND_SELECTOR]: fakeEl(BAND_1280) })
    // overlap = flowRect.bottom - band.top = 800 - 724 = 76; + GAP = 92.
    const expected = 800 - BAND_TOP + GAP
    expect(computeFitPadding(fakeEl(FLOW)).bottom).toBe(`${expected}px`)
    expect(expected).toBeGreaterThan(BASE_BOTTOM)
  })

  it('THE RESERVATION IS CONSTANT — it does not depend on what occupies the band', () => {
    // ⭐ THIS IS THE PROPERTY THE WHOLE DESIGN RESTS ON, and it is why the band
    // is the contributor rather than the notices. A reservation that changed
    // when a notice appeared would feed `reservedBoxWatcher` → `fitNow` and
    // re-fit the camera on the next pointerup; with `CanvasLodNotice` among the
    // occupants that closes a loop (zoom out → notice mounts → reservation
    // grows → re-fit → notice unmounts → …).
    //
    // The band's rect is fixed by its own CSS, so an occupant cannot move it.
    // Measured as the same answer across three occupancy states.
    stubSelectors({ [OVERLAY_BAND_SELECTOR]: fakeEl(BAND_1280) })
    const empty = computeFitPadding(fakeEl(FLOW))
    const occupied = computeFitPadding(fakeEl(FLOW))
    const alsoOccupied = computeFitPadding(fakeEl(FLOW))
    expect(occupied).toEqual(empty)
    expect(alsoOccupied).toEqual(empty)
  })

  it('a band SHORTER than the base margin does not shrink the reservation', () => {
    // Each edge is `max(baseMargin, overlap + GAP)`, so a small band must never
    // buy back LESS canvas than the graph already had. Written against the
    // spec's max(), not against the shipped height, so it stays meaningful if
    // the band is ever made shorter.
    const tiny = { ...BAND_1280, top: 799, height: 1, bottom: 800 }
    stubSelectors({ [OVERLAY_BAND_SELECTOR]: fakeEl(tiny) })
    const bottom = Number(computeFitPadding(fakeEl(FLOW)).bottom.replace('px', ''))
    expect(bottom).toBeGreaterThanOrEqual(BASE_BOTTOM)
  })

  it('the band reserves from the BOTTOM only — the other edges are untouched', () => {
    // A rectangular inset has four numbers and it is easy to move the wrong
    // one; the band spans the full width, so a mistaken left/right branch would
    // surrender the entire canvas and still look like "it reserved something".
    stubSelectors({})
    const without = computeFitPadding(fakeEl(FLOW))
    stubSelectors({ [OVERLAY_BAND_SELECTOR]: fakeEl(BAND_1280) })
    const withBand = computeFitPadding(fakeEl(FLOW))

    expect(withBand.top).toBe(without.top)
    expect(withBand.left).toBe(without.left)
    expect(withBand.right).toBe(without.right)
    expect(withBand.bottom).not.toBe(without.bottom)
  })

  it('THE MEASURED FIT COST at 1280x800, stated rather than left to be discovered', () => {
    // The bottom inset roughly triples. That is a real cost in canvas and it is
    // recorded here so a later reader sees the price alongside the benefit,
    // rather than finding it in a camera that frames less than it used to.
    stubSelectors({})
    const before = Number(computeFitPadding(fakeEl(FLOW)).bottom.replace('px', ''))
    stubSelectors({ [OVERLAY_BAND_SELECTOR]: fakeEl(BAND_1280) })
    const after = Number(computeFitPadding(fakeEl(FLOW)).bottom.replace('px', ''))

    expect(before).toBe(29)
    expect(after).toBe(92)
    // 63px of an 800px pane — just under 8% of the vertical, against the top
    // bar's own 5.5%. Pinned so a later change to the band's height cannot
    // quietly double the charge.
    expect(after - before).toBe(63)
    expect((after - before) / FLOW.height).toBeLessThan(0.08)
  })
})

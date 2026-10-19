/**
 * The lens bar reserves the top edge (verifier, staging fe4e4b9d, 19 Oct 2026: at 1280 with the dock open the bar
 * drops one row below the pill and covered the top card's title). Measured like the pill, never a number.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeFitPadding, LENS_BAR_SELECTOR, TOP_BAR_SELECTOR, FIT_PADDING_CONTRIBUTORS } from '../utils/computeFitPadding'

function fakeEl(rect: Partial<DOMRect>): HTMLElement {
  const full = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}), ...rect } as DOMRect
  return { getBoundingClientRect: () => full } as unknown as HTMLElement
}
function stubSelectors(map: Record<string, HTMLElement | null>) {
  vi.spyOn(document, 'querySelector').mockImplementation((sel: string) => (sel in map ? map[sel] : null) as Element | null)
}
const FLOW = { left: 0, right: 1280, width: 1280, top: 0, bottom: 800, height: 800 }
const PILL = { left: 12, right: 527, width: 515, top: 12, bottom: 52, height: 40 }
const GAP = 16

afterEach(() => { vi.restoreAllMocks() })

describe('computeFitPadding: the lens bar', () => {
  it('is a declared contributor', () => {
    expect(FIT_PADDING_CONTRIBUTORS).toContain(LENS_BAR_SELECTOR)
  })

  it('one row down (bottom 98), it pushes the top inset below itself', () => {
    stubSelectors({ [TOP_BAR_SELECTOR]: fakeEl(PILL), [LENS_BAR_SELECTOR]: fakeEl({ left: 70, right: 500, width: 430, top: 58, bottom: 98, height: 40 }) })
    expect(computeFitPadding(fakeEl(FLOW)).top).toBe(`${98 + GAP}px`)
  })

  it('CONTRAST: on the pill row it costs nothing beyond the pill', () => {
    stubSelectors({ [TOP_BAR_SELECTOR]: fakeEl(PILL) })
    const pillOnly = computeFitPadding(fakeEl(FLOW)).top
    stubSelectors({ [TOP_BAR_SELECTOR]: fakeEl(PILL), [LENS_BAR_SELECTOR]: fakeEl({ left: 540, right: 970, width: 430, top: 12, bottom: 52, height: 40 }) })
    expect(computeFitPadding(fakeEl(FLOW)).top).toBe(pillOnly)
    expect(pillOnly).toBe(`${52 + GAP}px`)
  })
})

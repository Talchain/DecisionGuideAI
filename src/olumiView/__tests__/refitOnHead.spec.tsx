/**
 * THE FIRST FIT UNDER THE LENS BAR (live first funding draft, 1232x704, 15 Nov): the camera framed the board from the lens bar's foot read
 * before the bar had slid to its place, so the question sat under it, and the fit key never changes when the bar is placed. The camera now
 * frames once more when the bar's slide ends under a different head than the last frame used. jsdom measures no node, so the real canvas
 * never fits here: this drives the real hook (regions.ts useRefitWhenHeadSettles) against a real bar element whose foot is stubbed.
 * Rows bind by identity: the bar's own testid and property, the head's foot in px, the call count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
// regions first: it and the lens bar's module import each other, and the bar's testid is read when regions.ts is evaluated.
import { BAND_GAP, regionsOf, useRefitWhenHeadSettles } from '../regions'
import { LENS_BAR_TESTID } from '../../canvas/artefacts/LensBar'

let foot = 52
const fit = vi.fn()
function Probe({ head, moved }: { head: number | null; moved: boolean }) {
  useRefitWhenHeadSettles({ current: head }, { current: moved }, fit)
  return (
    <div>
      <div data-testid={LENS_BAR_TESTID} />
      <div data-testid="not-the-bar" />
    </div>
  )
}
const slide = (testid: string) => document.querySelector(`[data-testid="${testid}"]`)!.dispatchEvent(new Event('transitionend', { bubbles: true }))

beforeEach(() => {
  fit.mockClear(); foot = 52
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const bar = this.getAttribute('data-testid') === LENS_BAR_TESTID
    return { left: 0, right: 600, top: bar ? foot - 40 : 0, bottom: bar ? foot : 0, width: 600, height: bar ? 40 : 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('the board is framed again once the lens bar has slid to its place', () => {
  it('RED/GREEN: framed under the bar at its start (foot 52), the bar ends at foot 98: fit runs ONCE, and the head it now reads is 98 + BAND_GAP', () => {
    const at = 52 + BAND_GAP
    render(<Probe head={at} moved={false} />)
    foot = 98
    expect(regionsOf().head.bottom).toBe(98 + BAND_GAP)
    slide(LENS_BAR_TESTID)
    expect(fit).toHaveBeenCalledTimes(1)
  })
  it('CONTRAST: the frame already used the bar\'s final foot: the slide ends and nothing is framed again', () => {
    foot = 98
    render(<Probe head={98 + BAND_GAP} moved={false} />)
    slide(LENS_BAR_TESTID)
    expect(fit).not.toHaveBeenCalled()
  })
  it('the person has taken the camera: never moved under their hand', () => {
    render(<Probe head={52 + BAND_GAP} moved />)
    foot = 98
    slide(LENS_BAR_TESTID)
    expect(fit).not.toHaveBeenCalled()
  })
  it('no frame yet (null): the fit loop will read the placed bar itself, so nothing is framed early', () => {
    render(<Probe head={null} moved={false} />)
    foot = 98
    slide(LENS_BAR_TESTID)
    expect(fit).not.toHaveBeenCalled()
  })
  it('another element\'s transition is not the bar\'s: no refit', () => {
    render(<Probe head={52 + BAND_GAP} moved={false} />)
    foot = 98
    slide('not-the-bar')
    expect(fit).not.toHaveBeenCalled()
  })
})

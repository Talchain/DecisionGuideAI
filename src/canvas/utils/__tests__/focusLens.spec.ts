/**
 * focusLens — F3: the rule for WHEN the transient focus lens ends.
 *
 * THE RULE (adversarial review finding 1): any camera move ends the lens
 * EXCEPT the fit focus itself just ordered. The discriminator is NOT the
 * move's event — the app's own zoom/reset/fit buttons move the camera
 * programmatically (event === null) and are exactly the user actions that
 * MUST end the lens. These pin the suppressor's contract; useFocusCamera.spec
 * pins that onMoveStart actually consults it.
 */
import { describe, it, expect } from 'vitest'
import { createFocusFitSuppressor, FOCUS_FIT_SUPPRESS_MS } from '../focusLens'

/** Fake clock so the window is pinned without timers. */
function clockAt(t: { now: number }) {
  return () => t.now
}

describe('createFocusFitSuppressor — F3 lens-end rule', () => {
  it('an unarmed move is NOT focus’s own — the lens ends', () => {
    const s = createFocusFitSuppressor()
    expect(s.consume()).toBe(false)
  })

  it('the move right after focus’s own fit IS claimed — the lens survives', () => {
    const t = { now: 1000 }
    const s = createFocusFitSuppressor(clockAt(t))
    s.begin()
    expect(s.consume()).toBe(true)
  })

  it('claims only ONE move: the SECOND move after a fit ends the lens', () => {
    // The regression this guards: a suppression flag that stays set would make
    // focus's fit swallow the user's next real pan too.
    const t = { now: 1000 }
    const s = createFocusFitSuppressor(clockAt(t))
    s.begin()
    expect(s.consume()).toBe(true)
    expect(s.consume()).toBe(false)
  })

  it('a stale arming does NOT claim a later move (a fit that never moved the camera)', () => {
    // A fit whose camera is already at the target emits no move at all. Without
    // the time box the arming would lie in wait and swallow a genuine user pan.
    const t = { now: 1000 }
    const s = createFocusFitSuppressor(clockAt(t))
    s.begin()
    t.now = 1000 + FOCUS_FIT_SUPPRESS_MS + 1
    expect(s.consume()).toBe(false)
  })

  it('a stale arming is consumed, so it cannot claim any subsequent move either', () => {
    const t = { now: 1000 }
    const s = createFocusFitSuppressor(clockAt(t))
    s.begin()
    t.now = 5000
    expect(s.consume()).toBe(false)
    t.now = 5001
    expect(s.consume()).toBe(false)
  })

  it('the window boundary is inclusive', () => {
    const t = { now: 1000 }
    const s = createFocusFitSuppressor(clockAt(t))
    s.begin()
    t.now = 1000 + FOCUS_FIT_SUPPRESS_MS
    expect(s.consume()).toBe(true)
  })

  it('re-arming refreshes the window — consecutive focuses each keep their own fit', () => {
    const t = { now: 1000 }
    const s = createFocusFitSuppressor(clockAt(t))
    s.begin()
    expect(s.consume()).toBe(true)
    t.now = 9000
    s.begin()
    expect(s.consume()).toBe(true)
  })
})

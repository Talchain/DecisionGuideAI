/**
 * The single width authority for the right-hand OutputsDock.
 *
 * Why this spec exists: the bounds used to be three hand-copied inline
 * literals (mount path, resize path, drag path). They agreed on the day they
 * were written and nothing would have gone red when they stopped — the
 * dominant defect class in this codebase. The rules now live in one module,
 * and this spec pins them against the SPEC as stated in `dockWidth.ts`, not
 * against the single viewport that motivated the change.
 *
 * Assertions bind to the named function and the named viewport, and the
 * property tests sweep the whole admissible input range rather than the two
 * or three sizes a laptop-shaped bug would suggest.
 */
import { describe, it, expect } from 'vitest'
import {
  DOCK_MIN_WIDTH,
  DOCK_RESPONSIVE_MAX_WIDTH,
  DOCK_VIEWPORT_RATIO,
  dockWidthBounds,
  responsiveDockWidth,
  resolveDockWidth,
  parseStoredDockWidth,
} from '../dockWidth'

/** Viewport widths spanning phone → ultrawide, used by the property sweeps. */
const VIEWPORTS = [0, 320, 480, 600, 768, 900, 1024, 1280, 1366, 1440, 1600, 1920, 2560, 3840]

describe('dockWidthBounds — the HARD bounds a user drag may reach', () => {
  it('keeps the pre-existing rule: min 280, max min(480, 40% of viewport)', () => {
    // These are the exact literals the three inline copies used, so an
    // existing persisted width keeps behaving as it did before the refactor.
    expect(dockWidthBounds(1280)).toEqual({ min: 280, max: 480 }) // 40% = 512, capped at 480
    expect(dockWidthBounds(900)).toEqual({ min: 280, max: 360 }) // 40% = 360, under the cap
    expect(dockWidthBounds(1200)).toEqual({ min: 280, max: 480 }) // 40% = 480, exactly the cap
  })

  it('never returns max < min, however narrow the viewport', () => {
    // Ordering matters: a max below min would make the clamp order-dependent,
    // so `resolveDockWidth` could return different answers for the same input
    // depending on which bound it applied first.
    for (const w of VIEWPORTS) {
      const { min, max } = dockWidthBounds(w)
      expect(max, `max >= min at viewport ${w}`).toBeGreaterThanOrEqual(min)
    }
    expect(dockWidthBounds(600)).toEqual({ min: 280, max: 280 }) // 40% = 240 < min
  })

  it('treats a non-finite or negative viewport as zero rather than propagating NaN', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1000]) {
      const { min, max } = dockWidthBounds(bad as number)
      expect(Number.isFinite(max), `finite max for ${String(bad)}`).toBe(true)
      expect(min).toBe(DOCK_MIN_WIDTH)
      expect(max).toBe(DOCK_MIN_WIDTH)
    }
  })
})

describe('responsiveDockWidth — the width when the user has NEVER dragged', () => {
  it('is proportional to the viewport below the historic ceiling', () => {
    // ⚠ RE-PINNED TWICE, AND THE OBSERVATION POINT MOVED BOTH TIMES.
    //
    // 17 Aug 2026: asserted `responsiveDockWidth(1280) === 333` for the 0.26
    // ratio; re-pinned at 1024 when the ratio was restored to 416/1280.
    //
    // 14 Sep 2026: the founder ruled the ceiling to 300, so the TAPER BAND
    // MOVED and 1024 stopped being inside it. With a 280 floor and a 300
    // ceiling the band — where the proportional value sits strictly between
    // them — is roughly 1195..1280px. At 1024 the formula now yields 240 and
    // the FLOOR answers, so the two "strictly between" assertions below would
    // have passed vacuously against a bound rather than against the taper.
    //
    // ⛔ THE PIN IS MOVED, NOT WEAKENED. 1240 is inside the new band and the
    // same four assertions hold there, so a mutant collapsing the taper to
    // either bound is still visible. Deleting the band case — the tempting fix
    // once the ceiling is close to the floor — would have left the taper
    // untested for the first time since the module was written.
    expect(responsiveDockWidth(1240)).toBe(SAFE_MIN(Math.round(1240 * DOCK_VIEWPORT_RATIO)))
    expect(responsiveDockWidth(1240)).toBe(291)
    expect(responsiveDockWidth(1240)).toBeGreaterThan(DOCK_MIN_WIDTH)
    expect(responsiveDockWidth(1240)).toBeLessThan(DOCK_RESPONSIVE_MAX_WIDTH)
    // …and the point that USED to be in the band is now on the floor, which is
    // itself a claim worth pinning: the band narrowed, it did not vanish.
    expect(responsiveDockWidth(1024)).toBe(DOCK_MIN_WIDTH)
  })

  it('never exceeds the historic fixed width, so wide screens are unchanged', () => {
    // 416 is the ceiling in both directions: no viewport gets more than the
    // dock's last known usable width, and (see the containment block below) no
    // desktop viewport gets less.
    for (const w of VIEWPORTS) {
      expect(responsiveDockWidth(w), `viewport ${w}`).toBeLessThanOrEqual(DOCK_RESPONSIVE_MAX_WIDTH)
    }
    expect(responsiveDockWidth(1280)).toBe(DOCK_RESPONSIVE_MAX_WIDTH) // 0.325*1280 = 416 exactly
    expect(responsiveDockWidth(1600)).toBe(DOCK_RESPONSIVE_MAX_WIDTH) // proportional 520, capped
    expect(responsiveDockWidth(2560)).toBe(DOCK_RESPONSIVE_MAX_WIDTH) // proportional 832, capped
    expect(responsiveDockWidth(3840)).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
  })

  it('never drops below the usable minimum, however narrow the viewport', () => {
    for (const w of VIEWPORTS) {
      expect(responsiveDockWidth(w), `viewport ${w}`).toBeGreaterThanOrEqual(DOCK_MIN_WIDTH)
    }
    expect(responsiveDockWidth(600)).toBe(DOCK_MIN_WIDTH) // proportional 156, floored
  })

  it('always lands inside dockWidthBounds for every viewport', () => {
    // The spec-level invariant: the responsive default is a point INSIDE the
    // drag range, never outside it. Written against the contract rather than
    // against the 1280 case that motivated the module.
    for (const w of VIEWPORTS) {
      const { min, max } = dockWidthBounds(w)
      const v = responsiveDockWidth(w)
      expect(v, `>= min at ${w}`).toBeGreaterThanOrEqual(min)
      expect(v, `<= max at ${w}`).toBeLessThanOrEqual(max)
    }
  })
})

describe('resolveDockWidth — explicit user width wins, re-clamped to bounds', () => {
  it('falls back to the responsive default when there is no stored width', () => {
    expect(resolveDockWidth(1280, null)).toBe(responsiveDockWidth(1280))
    expect(resolveDockWidth(1280, null)).toBe(300)
  })

  it('honours an explicit width that is inside the bounds', () => {
    // An explicit drag is a user decision; the responsive default must not
    // override it. 480 is legal at 1280 (max 480) and must survive exactly.
    expect(resolveDockWidth(1280, 480)).toBe(480)
    expect(resolveDockWidth(1280, 416)).toBe(416)
    expect(resolveDockWidth(1280, 300)).toBe(300)
  })

  it('re-clamps a width persisted at a WIDER viewport — the carried-over-width fix', () => {
    // Previously a width persisted on a wide screen was applied unclamped in a
    // narrow window. 480 persisted, then opened at 900px, where the bound says
    // 360: the dock used to stay 480 (53% of the window).
    expect(dockWidthBounds(900).max).toBe(360)
    expect(resolveDockWidth(900, 480)).toBe(360)
    expect(resolveDockWidth(600, 480)).toBe(280)
  })

  it('re-clamps a stored width below the usable minimum', () => {
    expect(resolveDockWidth(1280, 100)).toBe(DOCK_MIN_WIDTH)
    expect(resolveDockWidth(1280, 0)).toBe(DOCK_MIN_WIDTH)
    expect(resolveDockWidth(1280, -50)).toBe(DOCK_MIN_WIDTH)
  })

  it('treats an unparseable stored width as "no preference", not as a number', () => {
    // `null` — not 0, not NaN — is the signal for "never dragged". Anything
    // unparseable must take the responsive default rather than silently
    // becoming a number and pinning the dock at the minimum.
    expect(resolveDockWidth(1280, Number.NaN)).toBe(responsiveDockWidth(1280))
    expect(resolveDockWidth(1280, Number.POSITIVE_INFINITY)).toBe(responsiveDockWidth(1280))
  })

  it('always returns a width inside dockWidthBounds, for every viewport and every stored value', () => {
    // The load-bearing invariant, swept over the whole admissible domain
    // including values the contract admits but a laptop-shaped bug would
    // never suggest (negative, zero, absurdly large).
    const stored = [null, Number.NaN, -1000, 0, 1, 279, 280, 333, 416, 480, 481, 10_000]
    for (const w of VIEWPORTS) {
      const { min, max } = dockWidthBounds(w)
      for (const s of stored) {
        const v = resolveDockWidth(w, s)
        expect(Number.isFinite(v), `finite at viewport ${w}, stored ${String(s)}`).toBe(true)
        expect(v, `>= min at viewport ${w}, stored ${String(s)}`).toBeGreaterThanOrEqual(min)
        expect(v, `<= max at viewport ${w}, stored ${String(s)}`).toBeLessThanOrEqual(max)
      }
    }
  })

  it('returns an integer — a fractional CSS pixel width causes subpixel seams', () => {
    expect(resolveDockWidth(1280, 333.7)).toBe(334)
    expect(Number.isInteger(responsiveDockWidth(1366))).toBe(true)
  })
})

describe('parseStoredDockWidth — localStorage string to number | null', () => {
  it('maps absent / empty / unparseable to null (the "never dragged" signal)', () => {
    expect(parseStoredDockWidth(null)).toBeNull()
    expect(parseStoredDockWidth(undefined)).toBeNull()
    expect(parseStoredDockWidth('')).toBeNull()
    expect(parseStoredDockWidth('not-a-number')).toBeNull()
  })

  it('parses a stored numeric string', () => {
    expect(parseStoredDockWidth('416')).toBe(416)
    expect(parseStoredDockWidth('333.5')).toBe(333.5)
  })

  it('round-trips through resolveDockWidth: a stored 480 at 900px yields the clamped 360', () => {
    // Binds the parse step to the resolve step, so a parse that returned 0
    // instead of null (the defect the null-signal exists to prevent) is
    // visible here as a width of 280 rather than the responsive default.
    expect(resolveDockWidth(900, parseStoredDockWidth('480'))).toBe(360)
    expect(resolveDockWidth(1280, parseStoredDockWidth(null))).toBe(300)
    expect(resolveDockWidth(1280, parseStoredDockWidth('garbage'))).toBe(300)
  })
})

describe('the 300px default — containment pins (ruled 14 Sep 2026)', () => {
  // ⭐ RULED TO 300 ON 14 Sep 2026, and the 17 Aug record is KEPT rather than
  // deleted because it is the strongest argument against this width.
  //
  // What 17 Aug proved: narrowing does NOT lower the clamp — the post-draft fit
  // parks at the 0.5 floor at 416px, 333px AND 280px alike
  // (`computeFitPadding.spec.ts`). Re-confirmed by measurement; not disputed.
  //
  // What it did not measure: how much of the model is VISIBLE at that floor.
  // Measured at 1600x1000 on the five committed starters, the pane offers
  // 1080px against a 3080-unit layout on three of them — about 70% of the
  // width, the rest reached by panning. At 300px the pane offers 1208px, so
  // ~78%. That gain is real and the old experiment never looked for it.
  //
  // ⚠ AND THE COST IS UNCHANGED AND LIVE: ~390px of content budget at 416
  // becomes ~274px at 300, after borders and `px-3`. It was tab FORMATTING
  // that broke last time, not the width. That risk is not addressed by this
  // spec and must be looked at on a real screen.

  it('gives a 1280px laptop exactly the ceiling, and the ceiling is 300', () => {
    // The founder-facing viewport, bound by name so a ratio change reds HERE
    // rather than drifting silently through a proportional formula.
    //
    // ⭐ THE FIRST ASSERTION IS THE MODULE'S DESIGN INVARIANT and it is now
    // structural rather than coincidental: `DOCK_VIEWPORT_RATIO` is DERIVED as
    // `DOCK_RESPONSIVE_MAX_WIDTH / DOCK_REFERENCE_VIEWPORT`, so the reference
    // laptop landing exactly on the ceiling holds for any future ceiling. It
    // used to hold only because 0.325 x 1280 happened to equal 416.
    //
    // ⚠ THE SECOND IS THE RULED NUMBER, deliberately a literal. Both are needed:
    // the invariant alone would pass at ANY ceiling, so it cannot see a width
    // nobody asked for.
    expect(responsiveDockWidth(1280)).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
    expect(responsiveDockWidth(1280)).toBe(300)
  })

  it('gives the ceiling at 1280, 1920 and 3840 — screen size may widen the dock, never narrow it', () => {
    // The three viewports named because #741's clamp was `Math.min(full, min)`
    // against an UNCONDITIONAL 280 constant, so all three answered 280. A
    // per-input probe returning the same answer for every input is evidence
    // about the probe (trap 20) — here it was evidence about the product, and
    // nothing was asking.
    for (const viewport of [1280, 1920, 3840]) {
      expect(responsiveDockWidth(viewport), `viewport ${viewport}`).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
    }
  })

  it('never returns the drag FLOOR as a default at a desktop viewport', () => {
    // 280 is a floor for a manual drag, not a width the product chooses. This
    // is the claim, stated separately from the value above so a future ceiling
    // change cannot quietly satisfy it by lowering both numbers together.
    for (const viewport of [1280, 1440, 1920, 2560, 3840]) {
      expect(responsiveDockWidth(viewport), `viewport ${viewport}`).toBeGreaterThan(DOCK_MIN_WIDTH)
    }
  })

  it('KEEPS 280 as the floor a manual drag clamps to', () => {
    // The other direction, and the reason this is containment rather than a
    // revert of the width authority: the drag bounds are untouched. A user may
    // still choose 280; the product may not choose it for them.
    expect(dockWidthBounds(1280).min).toBe(280)
    expect(dockWidthBounds(3840).min).toBe(280)
    expect(resolveDockWidth(1280, 200)).toBe(280)
    expect(resolveDockWidth(1280, 280)).toBe(280)
    // …and 280 remains REACHABLE by drag, which is what makes it a floor.
    expect(resolveDockWidth(3840, 280)).toBe(280)
  })
})

/** Clamp helper mirroring the module's floor, used only to express an expectation. */
function SAFE_MIN(n: number): number {
  return Math.max(DOCK_MIN_WIDTH, n)
}

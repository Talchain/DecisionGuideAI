/**
 * ⛔ A CUT THAT SAVES NOTHING IS NEVER MADE (S5, 24 Sep 2026).
 *
 * S4 narrowed the option card to 260, which set the row-label budget to 18
 * characters. "Developer headcount" (19) then rendered as "Developer
 * headcoun…" — also 19 characters, one word broken, nothing saved. The
 * ellipsis costs a character, so a label at most ONE over the budget is
 * returned whole; anything longer is cut exactly as before.
 */
import { describe, it, expect } from 'vitest'
import { compactFactorLabel } from '../labelUtils'

describe('compactFactorLabel never makes a cut that is not shorter', () => {
  it('one character over the budget: returned whole, not "Developer headcoun…"', () => {
    expect(compactFactorLabel('Developer headcount', 18)).toBe('Developer headcount')
  })

  it('exactly at the budget: whole (unchanged behaviour)', () => {
    expect(compactFactorLabel('Marketing expertis', 18)).toBe('Marketing expertis')
  })

  it('CONTRAST: two or more over is still cut, at a word where it can be', () => {
    expect(compactFactorLabel('Enterprise revenue risk', 18)).toBe('Enterprise revenue…')
    expect(compactFactorLabel('Usage-based adoption', 18).endsWith('…')).toBe(true)
  })

  it('the result is never longer than the input', () => {
    for (const s of ['Developer headcount', 'Enterprise revenue risk', 'Annual platform cost', 'Localisation and compliance cost']) {
      expect(compactFactorLabel(s, 18).length).toBeLessThanOrEqual(s.length)
    }
  })
})

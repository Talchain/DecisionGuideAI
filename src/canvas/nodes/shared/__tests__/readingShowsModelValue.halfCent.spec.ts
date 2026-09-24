/**
 * The reading check compares against the number the CARD printed — the
 * formatter's own two-decimal rule, never a second one (Codex CHANGES_REQUIRED
 * 5808434181 on #1930).
 *
 * `formatInterventionTargetText` prints a tier reading as "Low (0.15)" for a
 * model value of 0.155 (`parseFloat(v.toFixed(2))`, byte-for-byte with CEE).
 * `Math.round(v*100)/100` gives 0.16 there, so a reader using it would call
 * "Low (0.16)" a match for 0.155 — two different numbers presented as one.
 */
import { describe, it, expect } from 'vitest'
import { readingShowsModelValue } from '../optionTargetDisplay'
import { tierReadingNumber } from '../../../utils/interventionDisplay'

describe("readingShowsModelValue uses the card formatter's own two-decimal number", () => {
  it('0.155: the card prints 0.15, and "Low (0.15)" matches', () => {
    expect(tierReadingNumber(0.155)).toBe(0.15)
    expect(readingShowsModelValue('Low (0.15)', 0.155)).toBe(true)
  })

  it('0.155: "Low (0.16)" does NOT match — the half-cent opposite control', () => {
    expect(readingShowsModelValue('Low (0.16)', 0.155)).toBe(false)
  })

  it('a normal 0.2 reading still matches; the exact-number branch is kept', () => {
    expect(readingShowsModelValue('Low (0.2)', 0.2)).toBe(true)
    expect(readingShowsModelValue('0.2', 0.2)).toBe(true)
  })

  it('a currency or prose reading never matches', () => {
    expect(readingShowsModelValue('£60k', 0.6)).toBe(false)
    expect(readingShowsModelValue('Same as baseline', 0.2)).toBe(false)
  })

  it('IDENTITY: the reader accepts exactly the number the shared helper prints, across half-cent boundaries', () => {
    for (const v of [0.155, 0.245, 0.285, 0.005, 0.995, 0.2]) {
      expect(readingShowsModelValue(`Low (${tierReadingNumber(v)})`, v)).toBe(true)
    }
  })
})

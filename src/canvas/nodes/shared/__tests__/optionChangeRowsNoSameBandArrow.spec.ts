/**
 * ⛔ NEVER "Low → Low" ON A CARD (S5, 24 Sep 2026 — seen on the S3 build's
 * `pricing-model`: "Enterprise revenue… Low → Low · brief").
 *
 * At rest a tier reading sheds its parenthesised internal-scale number (R6:
 * "Low (0.2)" → "Low"), so a real change INSIDE one band — 0.2 → 0.3 — printed
 * the same word twice around an arrow. The row claims a change and shows none.
 * The honest compact form keeps the band word and names the direction:
 * "Low · slightly higher". The full strings stay in `fullChange` (the row's
 * tooltip and accessible text), unchanged.
 */
import { describe, it, expect } from 'vitest'
import { buildOptionChangeRow } from '../optionChangeRows'

const factor = { label: 'Enterprise revenue risk', unit: undefined, factorType: 'risk' }
const row = (from: { value: number; displayValue: string }, to: { value: number; displayValue: string }) =>
  buildOptionChangeRow({
    factorId: 'fac_enterprise_revenue_risk',
    target: { value: to.value, displayValue: to.displayValue, source: 'brief_extraction' },
    factor,
    baselineOptionTarget: { value: from.value, displayValue: from.displayValue },
  })

describe('a change inside one band never prints the same word on both sides of an arrow', () => {
  it('0.2 → 0.3, both "Low": the resting text names the direction, not "Low → Low"', () => {
    const r = row({ value: 0.2, displayValue: 'Low (0.2)' }, { value: 0.3, displayValue: 'Low (0.3)' })
    expect(r.change).not.toMatch(/^(\S.*) → \1$/)
    expect(r.change).toBe('Low · slightly higher')
    expect(r.fullChange, 'the full text keeps both readings').toBe('Low (0.2) → Low (0.3)')
    // The target ALONE — what the inspector prints for this row, so the card and
    // the inspector print one string (S2 #1930 DEFECT 5; `target` is required).
    expect(r.target).toBe('Low (0.3)')
  })

  it('…and "slightly lower" the other way', () => {
    const r = row({ value: 0.3, displayValue: 'Low (0.3)' }, { value: 0.2, displayValue: 'Low (0.2)' })
    expect(r.change).toBe('Low · slightly lower')
  })

  it('CONTRAST: a change ACROSS bands keeps the arrow', () => {
    const r = row({ value: 0.2, displayValue: 'Low (0.2)' }, { value: 0.9, displayValue: 'Very high (0.9)' })
    expect(r.change).toBe('Low → Very high')
    expect(r.before).toBe('Low')
    expect(r.after).toBe('Very high')
  })

  it('CONTRAST: an identical reading is still "same as baseline"', () => {
    const r = row({ value: 0.2, displayValue: 'Low (0.2)' }, { value: 0.2, displayValue: 'Low (0.2)' })
    expect(r.change).toBe('Low · same as baseline')
  })
})

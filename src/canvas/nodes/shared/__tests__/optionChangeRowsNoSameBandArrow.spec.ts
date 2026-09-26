/**
 * ⛔⛔ NEVER "Low → Low" ON A CARD (S5, 24 Sep 2026 — seen on the S3 build's
 * `pricing-model`: "Enterprise revenue… Low → Low · brief"), AND NEVER AN
 * INVENTED COMPARISON WORD EITHER (AUDIT-SYNTH 20260925, item A13).
 *
 * At rest a tier reading sheds its parenthesised internal-scale number (R6:
 * "Low (0.2)" → "Low"), so a real change INSIDE one band — 0.2 → 0.3 — printed
 * the same word twice around an arrow. The row claims a change and shows none.
 *
 * The first fix for that invented "Low · slightly higher" — a judgement about
 * the SIZE of the move that no field of the data states. The audit named this
 * an invented comparison word alongside "same as baseline". The honest fix
 * shows the full carried strings instead: they are the data's own numbers,
 * unabbreviated, and the row no longer claims a magnitude it was never told.
 * `fullChange` and `change` are therefore identical in this case.
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
  it('0.2 → 0.3, both "Low": the full carried strings show, not "Low → Low" and not an invented word', () => {
    const r = row({ value: 0.2, displayValue: 'Low (0.2)' }, { value: 0.3, displayValue: 'Low (0.3)' })
    expect(r.change).not.toMatch(/^(\S.*) → \1$/)
    expect(r.change).not.toMatch(/slightly/)
    expect(r.change).toBe('Low (0.2) → Low (0.3)')
    expect(r.fullChange, 'the full text keeps both readings').toBe('Low (0.2) → Low (0.3)')
    expect(r.before).toBe('Low (0.2)')
    expect(r.after).toBe('Low (0.3)')
    // The target ALONE — what the inspector prints for this row, so the card and
    // the inspector print one string (S2 #1930 DEFECT 5; `target` is required).
    expect(r.target).toBe('Low (0.3)')
  })

  it('…and the same in the other direction, with no "slightly lower" either', () => {
    const r = row({ value: 0.3, displayValue: 'Low (0.3)' }, { value: 0.2, displayValue: 'Low (0.2)' })
    expect(r.change).not.toMatch(/slightly/)
    expect(r.change).toBe('Low (0.3) → Low (0.2)')
  })

  it('CONTRAST: a change ACROSS bands keeps the arrow', () => {
    const r = row({ value: 0.2, displayValue: 'Low (0.2)' }, { value: 0.9, displayValue: 'Very high (0.9)' })
    expect(r.change).toBe('Low → Very high')
    expect(r.before).toBe('Low')
    expect(r.after).toBe('Very high')
  })

  it('CONTRAST: an identical reading carries no invented "same as baseline" wording', () => {
    const r = row({ value: 0.2, displayValue: 'Low (0.2)' }, { value: 0.2, displayValue: 'Low (0.2)' })
    expect(r.change).not.toMatch(/same as baseline/)
    expect(r.change).toBe('→ Low')
    // The signal survives as data, not as baked-in prose (audit D3: one
    // provenance/comparison grammar, never invented text per row).
    expect(r.sameAsReference).toBe(true)
  })
})

/**
 * ⛔ THE MODEL'S INTERNAL 0–1 NUMBER NEVER PRINTS BESIDE A REAL UNIT
 * (canvas audit 27 Sep 2026, paul-models POM-2, board 3f89249e).
 *
 * Served: "Add £99 premium tier" read `£0 / month → 0.495 GBP per month` with
 * `analysis_ready` absent. The option's value 0.495 is on the model scale
 * (CEE's frame, 200, lived only in the undeclared node-level `scale_frame`);
 * observed value 0 / raw 0 and no cap left no recoverable scale, and the
 * formatter appended the money unit to the internal number.
 *
 * Every row below that must NOT change is a control that fires on the same
 * function with one input changed.
 */
import { describe, it, expect } from 'vitest'
import { formatInterventionTargetText } from '../interventionDisplay'

const PREMIUM = { label: 'Premium monthly price', unit: 'GBP per month', observedValue: 0, observedRawValue: 0 }

describe('POM-2 — no scale, a real unit, a model-scale value: nothing is printed', () => {
  it('the served price row: 0.495 with "GBP per month" and no scale is not "0.495 GBP per month"', () => {
    expect(formatInterventionTargetText({ ...PREMIUM, value: 0.495 })).toBe('')
  })

  it('the hidden "+1 more" row: 0.1 with "% of paying subscribers" and no scale is not "0.1 %…"', () => {
    expect(formatInterventionTargetText({ label: 'Premium subscriber share', unit: '% of paying subscribers', observedValue: 0, observedRawValue: 0, value: 0.1 })).toBe('')
  })

  it('a currency symbol and a word unit are covered by the same rule', () => {
    expect(formatInterventionTargetText({ label: 'Price', unit: '£', value: 0.4 })).toBe('')
    expect(formatInterventionTargetText({ label: 'Engineers', unit: 'engineers', value: 0.4 })).toBe('')
  })
})

describe('CONTROLS — every path that CAN state a true figure is unchanged', () => {
  it('a cap recovers the scale: 0.495 × 200 reads £99', () => {
    expect(formatInterventionTargetText({ ...PREMIUM, value: 0.495, cap: 200 })).toMatch(/£99/)
  })

  it('a raw anchor over a non-zero value recovers the scale', () => {
    expect(formatInterventionTargetText({ ...PREMIUM, value: 0.59, observedValue: 0.49, observedRawValue: 49 })).toMatch(/£59/)
  })

  it("an anchor showing raw EQUALS the model value keeps the figure (a real quantity ≤ 1)", () => {
    expect(formatInterventionTargetText({ label: 'Price per call', unit: '£', value: 0.45, observedValue: 0.4, observedRawValue: 0.4 })).toMatch(/0\.45/)
  })

  it('zero is zero in any proportional frame', () => {
    expect(formatInterventionTargetText({ ...PREMIUM, value: 0 })).not.toBe('')
  })

  it('a value above 1 cannot be on the model scale and is printed', () => {
    expect(formatInterventionTargetText({ ...PREMIUM, value: 59 })).toMatch(/59/)
  })

  it("the producer's own reading still wins — its figure, in the carried unit's notation", () => {
    // Re-pinned 28 Sep (served 08323c77): a glyph-led reading of the carried unit takes the one
    // compact notation; the figure is still the producer's "99", never the model value 0.495.
    expect(formatInterventionTargetText({ ...PREMIUM, value: 0.495, displayValue: '£99/month' })).toBe('£99 / month')
    // CONTROL: producer prose that is not the carried unit stays verbatim.
    expect(formatInterventionTargetText({ ...PREMIUM, value: 0.495, displayValue: 'about £99' })).toBe('about £99')
  })

  it('the plain percent class keeps its declared 0–1 → % convention', () => {
    expect(formatInterventionTargetText({ label: 'Churn', unit: '%', value: 0.1 })).toMatch(/10\s?%/)
  })

  it('an unframed placeholder-unit value keeps its tier reading', () => {
    expect(formatInterventionTargetText({ label: 'Friction', unit: 'scale', value: 0.4 })).not.toMatch(/scale/)
  })
})

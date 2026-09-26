/**
 * ⭐⭐ A CHANGE INSIDE ONE BAND SHOWS NO MODEL NUMBERS — design audit #3 (26 Sep
 * 2026), contract v3.1 `checks.factor` "no bare internal model scale"; ruling
 * "omit, never invent".
 *
 * SERVED (`853feeb7`, pricing starter, card `opt_new_logos`): the row for
 * `fac_enterprise_revenue_risk` read **"Low (0) → Low (0.1) · brief"**. The
 * producer's readings are `intervention_details[...].display_value` "Low (0)"
 * on the baseline option `opt_status_quo` and "Low (0.1)" on `opt_new_logos`
 * (captured in the audit's run payload); the factor card itself reads
 * "Low (0)". Both sides share one band, so the A13 arm printed the full carried
 * strings — the model's 0–1 numbers — to avoid "Low → Low".
 *
 * The row now says what the data states and nothing more: the DIRECTION (from
 * the two model values) and the band both readings share. No size word
 * ("slightly", A13) and no number. The full carried strings remain the row's
 * hover text (`fullChange`), as on every other row (R6).
 */
import { describe, it, expect } from 'vitest'
import { buildOptionChangeRow, isConcreteChangeRow } from '../optionChangeRows'

// The served shapes, verbatim.
const FACTOR_ID = 'fac_enterprise_revenue_risk'
const factor = {
  label: 'Enterprise Revenue Cannibalization Risk',
  unit: undefined,
  factorType: 'other',
  observedValue: 0,
  factorData: {
    label: 'Enterprise Revenue Cannibalization Risk',
    display_value: 'Low (0)',
    observedState: { value: 0, source: 'cee_inference', factor_type: 'other' },
  },
}
const newLogosTarget = { value: 0.1, displayValue: 'Low (0.1)', source: 'brief_extraction' }
const statusQuoTarget = { value: 0, displayValue: 'Low (0)' }

const MODEL_NUMBER = /\(\s*-?\d+(?:\.\d+)?\s*\)/

describe('served opt_new_logos · fac_enterprise_revenue_risk: "Low (0) → Low (0.1)" loses its model numbers', () => {
  it('from the baseline option: the row reads "Increases, stays Low" — direction and band, no number', () => {
    const r = buildOptionChangeRow({ factorId: FACTOR_ID, target: newLogosTarget, factor, baselineOptionTarget: statusQuoTarget })
    expect(r.factorId).toBe(FACTOR_ID)
    expect(r.reference).toBe('baseline_option')
    expect(r.change).toBe('Increases, stays Low')
    expect(r.change).not.toMatch(MODEL_NUMBER)
    expect(r.change).not.toMatch(/slightly/)
    // Rendered whole: no split `before → after` that would print "Low → Low".
    expect(r.before).toBeUndefined()
    expect(r.after).toBeUndefined()
    // The hover keeps the producer's full readings (R6: detail on hover).
    expect(r.fullChange).toBe('Low (0) → Low (0.1)')
    // Still a concrete change — the card keeps spending a resting row on it.
    expect(isConcreteChangeRow(r, newLogosTarget, factor)).toBe(true)
  })

  it('from the factor’s current value (no baseline option): the same words', () => {
    const r = buildOptionChangeRow({ factorId: FACTOR_ID, target: newLogosTarget, factor, baselineOptionTarget: null })
    expect(r.reference).toBe('current_value')
    expect(r.change).toBe('Increases, stays Low')
    expect(r.fullChange).toBe('Low (0) → Low (0.1)')
  })

  it('the other direction says "Decreases"', () => {
    const r = buildOptionChangeRow({
      factorId: FACTOR_ID,
      target: { value: 0, displayValue: 'Low (0)', source: 'brief_extraction' },
      factor,
      baselineOptionTarget: { value: 0.1, displayValue: 'Low (0.1)' },
    })
    expect(r.change).toBe('Decreases, stays Low')
  })

  it('CONTRAST — a change across bands keeps its arrow and its two words (served "Very high → High")', () => {
    const r = buildOptionChangeRow({
      factorId: 'fac_adoption_friction',
      target: { value: 0.6, displayValue: 'High (0.6)', source: 'brief_extraction' },
      factor: { label: 'Bottom-Up Adoption Friction', unit: undefined, factorType: 'other' },
      baselineOptionTarget: { value: 0.8, displayValue: 'Very high (0.8)' },
    })
    expect(r.change).toBe('Very high → High')
    expect(r.before).toBe('Very high')
    expect(r.after).toBe('High')
  })
})

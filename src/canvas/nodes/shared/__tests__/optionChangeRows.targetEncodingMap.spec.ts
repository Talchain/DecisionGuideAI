/**
 * A13 (AUDIT-SYNTH 20260925) — an option row must resolve BOTH ends of a
 * change through the factor's own `encoding_map`, exactly as the factor card
 * on the same screen does — never a magnitude word.
 *
 * THE DEFECT. `Account Executives Added` carries
 * `encoding_map: {0: "No AEs added", 1: "Three AEs added"}`. The factor card
 * (`formatFactorDisplayValue`, via `carriedFactorCardReading`) already resolves
 * through it. The option row's TARGET did not: `formatInterventionTargetText`
 * never received the factor's `encoding_map` at all — its `targetInput` built
 * `label`/`value`/`raw_value`/`unit`/`factor_type`/`cap` and stopped there — so
 * a row showed the produced magnitude word (or a numeric fallback) beside a
 * card that, for the SAME value, spelled out the producer's own words.
 *
 * `carriedFactorCardReading` (the "from" via the ACTUAL factor node data)
 * already resolves this correctly and is unchanged here — see
 * `optionRowFromIsTheFactorCardText.spec.tsx`. This file pins the target side,
 * and the baseline-option "from" side, which both flow through the same
 * `formatInterventionTargetText` call.
 */
import { describe, it, expect } from 'vitest'
import { buildOptionChangeRow } from '../optionChangeRows'

describe('an option row resolves both ends through the factor\'s encoding_map', () => {
  const factor = {
    label: 'Account Executives Added',
    unit: undefined,
    factorType: undefined,
    factorData: {
      label: 'Account Executives Added',
      encoding_map: { '0': 'No AEs added', '1': 'Three AEs added' },
      observedState: { value: 0 },
    },
  }

  it('the TARGET reads the map\'s own words, not the magnitude word CEE composed', () => {
    const r = buildOptionChangeRow({
      factorId: 'fac_aes_added',
      target: { value: 1, displayValue: 'High', source: 'brief_extraction' },
      factor,
      baselineOptionTarget: { value: 0, displayValue: 'Low' },
    })
    expect(r.target).toBe('Three AEs added')
    expect(r.target).not.toBe('High')
    expect(r.change).toBe('No AEs added → Three AEs added')
    expect(r.change).not.toContain('Low')
    expect(r.change).not.toContain('High')
  })

  it('the BASELINE-OPTION "from" resolves through the same map (both ends, not just the target)', () => {
    const r = buildOptionChangeRow({
      factorId: 'fac_aes_added',
      target: { value: 1, displayValue: 'High', source: 'brief_extraction' },
      factor,
      baselineOptionTarget: { value: 0, displayValue: 'Low' },
    })
    expect(r.before).toBe('No AEs added')
  })

  it('a value the map does not cover falls through unaffected', () => {
    const r = buildOptionChangeRow({
      factorId: 'fac_aes_added',
      target: { value: 0.5, displayValue: 'Two AEs added', source: 'brief_extraction' },
      factor,
      baselineOptionTarget: { value: 0, displayValue: 'Low' },
    })
    // 0.5 has no key in the map above — CEE's own display_value is kept,
    // exactly the "thin layer" contract for a value the map does not name.
    expect(r.target).toBe('Two AEs added')
  })

  it('CONTRAST: with no encoding_map at all, CEE\'s display_value still wins verbatim', () => {
    const priceFactor = {
      label: 'Monthly price',
      unit: undefined,
      factorType: undefined,
      factorData: { label: 'Monthly price', observedState: { value: 0.245 } },
    }
    const r = buildOptionChangeRow({
      factorId: 'f-price',
      target: { value: 0.295, displayValue: '£59', source: 'brief_extraction' },
      factor: priceFactor,
      baselineOptionTarget: null,
    })
    expect(r.target).toBe('£59')
  })
})

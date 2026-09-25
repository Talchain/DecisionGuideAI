/**
 * "NEEDS INPUT" ONLY WHEN THERE IS NEITHER A NUMBER NOR A READING (#1984 review
 * 5825619572: the display-value guard survived a mutant — nothing pinned it).
 *
 * `resolveUnsetOptionTargets` feeds the option card's `Needs input` rows. An
 * intervention CEE sent with `display_value` but no usable number is a reading
 * the producer stated ("£69 a month"), not an absent target; calling it
 * "Needs input" would tell the user the model lacks something it holds. The
 * contrast — no number and no reading — is the row's whole reason to exist.
 * Bound by factor id (identity), in both wire shapes the resolver reads.
 */
import { describe, expect, it } from 'vitest'
import { resolveUnsetOptionTargets } from '../optionTargetDisplay'

describe('resolveUnsetOptionTargets — a stated reading is not a missing target', () => {
  it('CEE interventions: a display_value with no number is NOT unset; no number and no reading IS', () => {
    const unset = resolveUnsetOptionTargets(null, {
      interventions: {
        fac_price: { value: null, display_value: '£69 a month', source: 'user_specified' },
        fac_tier: { value: null, source: 'cee_inference' },
      },
    } as never)
    expect(unset.has('fac_price'), 'a stated reading must not read as "Needs input"').toBe(false)
    expect(unset.has('fac_tier'), 'CONTRAST: nothing stated → "Needs input"').toBe(true)
    expect(unset.get('fac_tier')).toBe('cee_inference')
  })

  it('canvas option data (no CEE option): the same rule', () => {
    const unset = resolveUnsetOptionTargets(
      { interventions: { fac_price: { value: null, display_value: '£69 a month' }, fac_tier: { value: null } } },
      null,
    )
    expect(unset.has('fac_price')).toBe(false)
    expect(unset.has('fac_tier')).toBe(true)
  })

  it('CONTRAST: a usable number is never unset, with or without a reading', () => {
    const unset = resolveUnsetOptionTargets(null, {
      interventions: { fac_price: { value: 0.69 }, fac_seats: { value: 4, display_value: '4 seats' } },
    } as never)
    expect(unset.size).toBe(0)
  })
})

/**
 * The tipping-point sentence must place a unit where the reader reads it.
 *
 * ── MEASURED ON THE DEPLOYED BUILD `e6551858`, from Paul's manual test ──────
 *
 * The Reasoning tab rendered:
 *
 *     "Monthly Churn Rate would have to rise from %0.03 to %0.04 before
 *      Gradual Price Step to £54 Now comes out ahead."
 *
 * The producer's row for that factor (debug bundle `9077a1e3`):
 * `current_value: 0.02763, flip_value: 0.04475, unit: '%'`. `COPY.disclosure.
 * tippingPoint` interpolated the unit as an unconditional PREFIX, so a percent
 * rendered as `%0.03`.
 *
 * ⛔ THIS IS THE THIRD TIME THIS CLASS HAS SHIPPED, AND THE FILE SAYS SO.
 * `glanceCondition` already holds the rule — `unit === '%' ? `${v}%` :
 * `${unit}${v}`` — added after the deployed build printed
 * "Customer demand passes index0.361111". Its header names the cause exactly:
 * *"a rule that only one of two threshold sites can reach is a rule this
 * surface does not have."* This is the site that could not reach it.
 *
 * ⚠ THE SAME RUN RENDERS BOTH SPELLINGS EIGHT INCHES APART: the At-a-Glance
 * line said "passes 0.04%" (correct) while this one said "%0.04". One datum,
 * one producer unit, two renderings — which is the defect `flipThresholdDisplay`
 * was created to stop.
 *
 * ⚠ Currency STAYS a prefix. `£53.86` is right and `53.86£` is not, so the rule
 * is not "always suffix" — it is the sibling's rule, reproduced exactly rather
 * than re-decided here.
 */
import { describe, expect, it } from 'vitest'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const tp = COPY.disclosure.tippingPoint

describe('the tipping-point sentence places its unit where the reader reads it', () => {
  it('⛔ PINS THE SHIPPED DEFECT: a percent is a SUFFIX, not a prefix', () => {
    // The producer's own numbers from bundle `9077a1e3`.
    const s = tp('Monthly Churn Rate', 0.02763, 0.04475, 'Gradual Price Step to £54 Now', '%')
    expect(s).not.toContain('%0.03')
    expect(s).not.toContain('%0.04')
  })

  it('renders the sentence the reader should have seen', () => {
    const s = tp('Monthly Churn Rate', 0.02763, 0.04475, 'Gradual Price Step to £54 Now', '%')
    expect(s).toContain('from 0.03% to 0.04%')
  })

  it('CONTRAST CONTROL: currency stays a PREFIX — the rule is not "always suffix"', () => {
    const s = tp('Pro Plan Monthly Price', 49, 59, 'Hold Price', '£')
    expect(s).toContain('from £49 to £59')
  })

  it('CONTRAST CONTROL: a unitless row is unchanged by this fix', () => {
    const s = tp('Vendor Adoption', 0.2, 0.66, 'Build In-House', '')
    expect(s).toContain('from 0.2 to 0.66')
  })

  it('agrees with the sibling site on the SAME datum — one datum, one rendering', () => {
    // `glanceCondition` renders this factor as "passes 0.04%". This sentence
    // must spell the same number the same way.
    const s = tp('Monthly Churn Rate', 0.02763, 0.04475, 'X', '%')
    expect(s).toContain('0.04%')
  })
})

/**
 * ⭐ THE ROOT CAUSE, NOT THE SYMPTOM. Both threshold sites now route through
 * ONE owner (`applyUnitPlacement`), so a unit cannot be placed two ways on one
 * screen. These pin the cases the hand-rolled spellings got wrong.
 */
describe('one owner places every unit — the sites cannot disagree', () => {
  it('⛔ PINS A LATENT DEFECT: a compound unit is no longer jammed on the front', () => {
    // `£/month` is in Paul's own bundle (`current_value: 53.86`). It was only
    // unreachable because that row's flip_value is null — one producer change
    // away from rendering "£/month53.86".
    const s = tp('Pro Plan Monthly Price', 49, 53.86, 'Hold', '£/month')
    expect(s).not.toContain('£/month49')
    expect(s).toContain('49 £/month')
  })

  it('a placeholder unit prints NO unit — "index0.36" cannot come back', () => {
    const s = tp('Customer demand', 0.2, 0.36, 'X', 'index')
    expect(s).not.toContain('index')
  })

  it('an ISO code takes a space, not a jam', () => {
    const s = tp('Price', 49, 59, 'X', 'USD')
    expect(s).toContain('USD 49')
  })
})

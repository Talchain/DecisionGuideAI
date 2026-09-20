/**
 * ⭐⭐ A VALUE THE USER STATED MUST NEVER BE HIDDEN.
 *
 * MEASURED ON THE FOUNDER'S BOARD, 19 Sep 2026 (`olumi-debug-12928b8c`). He
 * stated a value and the card rendered nothing:
 *
 *   Round Oversubscription Likelihood
 *     value 4 · raw_value 4 · unit 'scale' · source 'user' · NO cap
 *     rendered_factors[].value_displayed = null
 *
 * ⛔ THE SUPPRESSION'S OWN PREMISE IS FALSE FOR THIS INPUT. Pattern 1 skips a
 * placeholder unit because *"raw_value is just the denormalised normalised
 * value (value x cap) — not a real-world measurement."* Here there is no `cap`,
 * `raw_value` IS what he typed, and `value: 4` is outside [0,1] so it is not a
 * normalised value at all. Every clause of the premise fails.
 *
 * ⚠ TWO QUESTIONS UNDER ONE PREDICATE (CLAUDE.md trap 21). Declining to assert
 * an uncalibrated MACHINE estimate is a claim about what Olumi may say, and it
 * is right. Hiding what the PERSON said is a different act, and nobody asked
 * that question — its answer is always no. The contrast in the same capture:
 * `Capital Raised`, also `source: 'user'`, renders `£20,000` because its unit
 * happens to be real.
 *
 * ⛔ NOTHING IS INVENTED. No band, no tier, no rescaling, no rounding, and the
 * placeholder UNIT WORD is still withheld — `scale` asserts a scale nobody
 * defined. Only the figure the person stated survives.
 */
import { describe, it, expect } from 'vitest'
import { formatFactorDisplayValue, factorDisplayText } from '../formatFactorDisplayValue'

/** The founder's factor, verbatim from the capture. */
const OVERSUBSCRIPTION = {
  label: 'Round Oversubscription Likelihood',
  value: 4,
  raw_value: 4,
  unit: 'scale',
  value_source: 'user',
} as const

describe('a value you stated is never hidden', () => {
  it("⭐ the founder's own factor renders its figure", () => {
    expect(formatFactorDisplayValue({ ...OVERSUBSCRIPTION })).toBe('4')
  })

  it('⛔ and the placeholder unit word is STILL withheld', () => {
    const out = formatFactorDisplayValue({ ...OVERSUBSCRIPTION })!
    expect(out).not.toContain('scale')
    // No band word either — the constraint independent review imposed stands.
    expect(out.toLowerCase()).not.toMatch(/very|low|medium|moderate|high/)
  })

  it('⛔ DISCRIMINATION: the SAME shape from the MACHINE is still suppressed', () => {
    // This is the whole distinction. If this rendered too, the fix would have
    // reopened the defect it was written beside.
    expect(formatFactorDisplayValue({
      ...OVERSUBSCRIPTION, value_source: 'cee_inference',
    })).toBeNull()
  })

  it('⛔ DISCRIMINATION: no source at all is still suppressed', () => {
    expect(formatFactorDisplayValue({
      label: 'Team Capability', value: 0.3, raw_value: 0.3, unit: 'scale',
    })).toBeNull()
  })

  it('a user value with NO raw_value is not hidden either (the second path)', () => {
    // Pattern 2's `isMeaningless` branch suppressed independently, so fixing
    // only Pattern 1 would have left this shape hiding the person's number.
    expect(formatFactorDisplayValue({
      label: 'Confidence', value: 0.8, raw_value: null, unit: 'scale', value_source: 'user',
    })).toBe('0.8')
  })

  it('`user_confirmed` counts as stated — ratifying a figure makes it yours', () => {
    expect(formatFactorDisplayValue({
      ...OVERSUBSCRIPTION, value_source: 'user_confirmed',
    })).toBe('4')
  })

  it('⛔ a REAL unit from the user is unchanged — the contrast in the same capture', () => {
    // Capital Raised: source 'user', raw_value 20000, unit '£' -> £20,000.
    expect(formatFactorDisplayValue({
      label: 'Capital Raised', value: 0.01, raw_value: 20000, unit: '£', value_source: 'user',
    })).toBe('£20,000')
  })

  it('factorDisplayText carries `source` through from observedState', () => {
    // The wiring, bound by behaviour: without it the flag never reaches the
    // formatter and every assertion above passes in isolation while the
    // product still hides the value.
    expect(factorDisplayText({
      label: 'Round Oversubscription Likelihood',
      observedState: { value: 4, raw_value: 4, unit: 'scale', source: 'user' },
    })).toBe('4')
    expect(factorDisplayText({
      label: 'Round Oversubscription Likelihood',
      observedState: { value: 4, raw_value: 4, unit: 'scale', source: 'cee_inference' },
    })).toBeNull()
  })
})

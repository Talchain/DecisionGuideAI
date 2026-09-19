/**
 * A PLACEHOLDER UNIT MUST NEVER REACH THE USER AS IF IT WERE MEASURED —
 * INCLUDING WHEN THE PRODUCER SPELLS IT INTO `display_value`.
 *
 * ⭐ THE DEFECT, MEASURED ON THE FOUNDER'S OWN BOARD. Debug bundle
 * `olumi-debug-b3d5806d-20260919`, `client_build: fd65f971` (the served staging
 * build): the graph is `scale`-dominated — 54 raw occurrences over 8 distinct
 * values (0, 0.2, 0.3, 0.5, 0.55, 0.75, 0.8, 0.85) — and factor cards read
 * `0.3 scale est.` and `0.5 scale est.` on their faces. His words: *"things
 * like a 0.4 ratio aren't something that most onboarding users will
 * understand."*
 *
 * ⭐⭐ WHY IT SURVIVED TWO CORRECT GUARDS, WHICH IS THE WHOLE POINT OF THIS FILE.
 * `scale` is in `GENERIC_PLACEHOLDER_UNITS`, and this module already suppresses
 * it on BOTH of its numeric paths:
 *   · Pattern 1 (`raw_value` + unit) skips placeholder units outright — a
 *     denormalised normalised value is not a measurement;
 *   · Pattern 2 (value-only) treats a placeholder unit as `isMeaningless` and
 *     returns `null` rather than render a bare normalised figure.
 * Both are right, and neither is on the path the founder is looking at.
 * MEASURED AT THIS TIP by rendering `FactorNode` with
 * `observed_state = { value: 0.3, unit: 'scale' }` and NO `display_value`: the
 * card body is EMPTY — the gates hold. `0.3 scale` reaches the face only
 * through the third path, the **`display_value` verbatim passthrough**, whose
 * own docblock justifies itself with CONTEXTUAL PROSE ("No dedicated tech
 * lead", "No acquisition pursued") and never contemplated a magnitude summary
 * spelled in a placeholder unit.
 *
 * So the module's header promise — *"Never returns generic placeholders"* — was
 * true of everything the module COMPOSES and false of what it FORWARDS. Two
 * gates on the numeric paths, none on the passthrough: the same shape as this
 * estate's trap 21, one predicate answering "may I compose this?" while nothing
 * answered "may I forward this?".
 *
 * THE POLICY APPLIED HERE is not minted; it is the one `formatValueWithUnit`
 * already states and this estate has already ruled: a placeholder unit with a
 * value in [0,1] renders a QUALITATIVE WORD; outside that range the unit is
 * SUPPRESSED and the bare number renders, because "placeholder units carry no
 * real-world scale, so '0 score' / '50 index' are misleading".
 *
 * ⛔ SCOPE, DELIBERATELY NARROW — `ratio` IS NOT TOUCHED. An independent review
 * ruled: *"Undefined scales do not justify labels such as 'moderate'. Use
 * qualitative bands only when their meaning is defined."* `scale` IS defined —
 * as a placeholder, which is exactly the case the ruling permits. `ratio` is
 * NOT a placeholder (it classifies as a proportion unit and keeps its word);
 * its meaning is an open producer question, and it renders here exactly as it
 * does today. That distinction is pinned below so a later tidy-up cannot
 * quietly widen this.
 *
 * ⛔ DISPLAY ONLY. Nothing here writes. Pinned explicitly below.
 */
import { describe, it, expect } from 'vitest'
import { formatFactorDisplayValue, factorDisplayText } from '../formatFactorDisplayValue'
import { GENERIC_PLACEHOLDER_UNITS } from '../unitClassifier'

/** The founder's own eight distinct `scale` values, from the debug bundle. */
const FOUNDER_SCALE_VALUES = [0, 0.2, 0.3, 0.5, 0.55, 0.75, 0.8, 0.85] as const

describe('placeholder magnitude summaries never render as if measured', () => {
  describe('the founder\'s board: "<number> scale" is replaced by a qualitative word', () => {
    it.each([
      ['0 scale', 0, 'Very low'],
      ['0.2 scale', 0.2, 'Very low'],
      ['0.3 scale', 0.3, 'Low'],
      ['0.5 scale', 0.5, 'Medium'],
      ['0.55 scale', 0.55, 'Medium'],
      ['0.75 scale', 0.75, 'High'],
      ['0.8 scale', 0.8, 'High'],
      ['0.85 scale', 0.85, 'Very high'],
    ])('display_value %s (value %s) renders %s', (displayValue, value, expected) => {
      expect(formatFactorDisplayValue({
        label: 'Team Capability',
        value,
        raw_value: null,
        unit: 'scale',
        display_value: displayValue,
      })).toBe(expected)
    })

    it('not one of the founder\'s eight values leaves the word "scale" on screen', () => {
      for (const v of FOUNDER_SCALE_VALUES) {
        const out = formatFactorDisplayValue({
          label: 'Team Capability',
          value: v,
          raw_value: null,
          unit: 'scale',
          display_value: `${v} scale`,
        })
        expect(out, `value ${v}`).not.toBeNull()
        expect(out!, `value ${v}`).not.toContain('scale')
        expect(out!, `value ${v}`).not.toMatch(/\d/)
      }
    })
  })

  describe('both ends of the [0,1] range are correct', () => {
    it('0 is IN range and renders the bottom band, never "0 scale"', () => {
      expect(formatFactorDisplayValue({
        label: 'Germany Market Entry', value: 0, raw_value: null,
        unit: 'scale', display_value: '0 scale',
      })).toBe('Very low')
    })

    it('1 is IN range and renders the top band', () => {
      expect(formatFactorDisplayValue({
        label: 'Team Capability', value: 1, raw_value: null,
        unit: 'scale', display_value: '1 scale',
      })).toBe('Very high')
    })

    it('ABOVE 1 is OUT of range: the unit is suppressed and the bare number renders', () => {
      // "placeholder units carry no real-world scale, so '50 index' is
      // misleading" — but 50 is not a 0–1 band, so a band word would be a
      // fabrication. The number is the producer's; only the empty unit goes.
      expect(formatFactorDisplayValue({
        label: 'Readiness', value: 0.5, raw_value: null,
        unit: 'index', display_value: '50 index',
      })).toBe('50')
    })

    it('BELOW 0 is OUT of range: the unit is suppressed, the sign is kept', () => {
      expect(formatFactorDisplayValue({
        label: 'Drift', value: -0.4, raw_value: null,
        unit: 'score', display_value: '-0.4 score',
      })).toBe('-0.4')
    })
  })

  describe('every generic placeholder unit is covered, not just "scale"', () => {
    // Derived from the canonical set so a unit added there cannot silently
    // escape this rule — the hand-maintained-mirror defect this estate pays for.
    it.each([...GENERIC_PLACEHOLDER_UNITS])('unit %s at 0.3 renders "Low"', (unit) => {
      expect(formatFactorDisplayValue({
        label: 'Team Capability', value: 0.3, raw_value: null,
        unit, display_value: `0.3 ${unit}`,
      })).toBe('Low')
    })
  })

  describe('⛔ the narrowness IS the design — everything else renders byte-for-byte as today', () => {
    it('`ratio` is NOT a placeholder and is left exactly as it renders today', () => {
      // Ruled: qualitative bands only where the scale's meaning is defined.
      // `ratio`'s meaning is an open producer question. Untouched.
      expect(GENERIC_PLACEHOLDER_UNITS.has('ratio')).toBe(false)
      expect(formatFactorDisplayValue({
        label: 'Conversion', value: 0.4, raw_value: null,
        unit: 'ratio', display_value: '0.4 ratio',
      })).toBe('0.4 ratio')
    })

    it('contextual PROSE passes through verbatim — the passthrough keeps its purpose', () => {
      expect(formatFactorDisplayValue({
        label: 'Tech Lead', value: 0, raw_value: null,
        unit: 'scale', display_value: 'No dedicated tech lead',
      })).toBe('No dedicated tech lead')
    })

    it('a producer magnitude summary with a parenthesised figure is untouched', () => {
      // "Moderate (0.5)" is already a qualitative word; FactorNode collapses the
      // parenthetical at rest. Not this rule's business.
      expect(formatFactorDisplayValue({
        label: 'Team Capability', value: 0.5, raw_value: null,
        unit: 'scale', display_value: 'Moderate (0.5)',
      })).toBe('Moderate (0.5)')
    })

    it('a REAL unit keeps its number and its unit', () => {
      expect(formatFactorDisplayValue({
        label: 'Budget', value: 0.2, raw_value: 40000, unit: '£', cap: 200000,
      })).toBe('£40,000')
    })

    it('a real unit spelled into display_value is untouched (e.g. "42 days")', () => {
      expect(formatFactorDisplayValue({
        label: 'Lead Time', value: 0.42, raw_value: null,
        unit: 'days', display_value: '42 days',
      })).toBe('42 days')
    })

    it('a placeholder unit with NO display_value still returns null (Pattern 2 unchanged)', () => {
      expect(formatFactorDisplayValue({
        label: 'Team Capability', value: 0.3, raw_value: null, unit: 'scale',
      })).toBeNull()
    })

    it('a bare number with no unit word is NOT reinterpreted', () => {
      expect(formatFactorDisplayValue({
        label: 'Team Capability', value: 0.3, raw_value: null,
        unit: 'scale', display_value: '0.3',
      })).toBe('0.3')
    })
  })

  describe('⛔ DISPLAY ONLY — no stored value moves', () => {
    it('formatFactorDisplayValue does not mutate its input', () => {
      const input = {
        label: 'Team Capability', value: 0.3, raw_value: null,
        unit: 'scale', display_value: '0.3 scale',
      }
      const before = JSON.stringify(input)
      formatFactorDisplayValue(input)
      expect(JSON.stringify(input)).toBe(before)
    })

    it('factorDisplayText leaves node data — and observedState — byte-identical', () => {
      const data = {
        label: 'Team Capability',
        display_value: '0.3 scale',
        observedState: { value: 0.3, unit: 'scale', raw_value: null, extractionType: 'inferred' },
      }
      const before = JSON.stringify(data)
      expect(factorDisplayText(data)).toBe('Low')
      // The stored value, its unit and the producer's own string all survive.
      expect(JSON.stringify(data)).toBe(before)
      expect(data.observedState.value).toBe(0.3)
      expect(data.observedState.unit).toBe('scale')
      expect(data.display_value).toBe('0.3 scale')
    })
  })
})

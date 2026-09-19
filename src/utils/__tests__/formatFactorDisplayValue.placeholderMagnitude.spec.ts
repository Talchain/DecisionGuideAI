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
 * ⛔⛔ THE FIRST VERSION OF THIS FIX BANDED THE NUMBER, AND THAT WAS WRONG.
 * It mapped the figure to a qualitative word ("0.3 scale" → "Low"). Independent
 * review refused it on this module's own ruling: calling `scale` a defined
 * PLACEHOLDER does not define what "Low" MEANS. The consequential case it
 * derived is pinned below as a regression — `value: 0` with
 * `encoding_map {0: "Not pursued"}` returned "Very low", manufacturing a
 * magnitude for a CATEGORICAL state, which is the exact category error
 * `encodingMapPhrase` exists to refuse. Two things follow, and both are tested
 * here: a declared encoding wins wherever the producer stated one, and where it
 * did not, the rendering is WITHHELD rather than reworded.
 *
 * ⛔ SCOPE, DELIBERATELY NARROW — `ratio` IS NOT TOUCHED. It is not a
 * placeholder (it classifies as a proportion unit), its frame is an open
 * producer question, and it renders here exactly as it does today. That
 * distinction is pinned below so a later tidy-up cannot quietly widen this.
 *
 * ⛔ DISPLAY ONLY. No number is rounded, rescaled or invented. Pinned below.
 */
import { describe, it, expect } from 'vitest'
import { formatFactorDisplayValue, factorDisplayText } from '../formatFactorDisplayValue'
import { GENERIC_PLACEHOLDER_UNITS } from '../unitClassifier'

/** The founder's own eight distinct `scale` values, from the debug bundle. */
const FOUNDER_SCALE_VALUES = [0, 0.2, 0.3, 0.5, 0.55, 0.75, 0.8, 0.85] as const

describe('placeholder magnitude summaries never render as if measured', () => {
  describe('the founder\'s board: the FALSE UNIT goes, the figure stays', () => {
    it.each(FOUNDER_SCALE_VALUES.map(v => [`${v} scale`, v, String(v)] as const))(
      'display_value %s (value %s) renders %s', (displayValue, value, expected) => {
        expect(formatFactorDisplayValue({
          label: 'Team Capability',
          value,
          raw_value: null,
          unit: 'scale',
          display_value: displayValue,
        })).toBe(expected)
      })

    it('⛔ not one of the founder\'s eight values leaves the word "scale" on screen', () => {
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
      }
    })

    it('⭐ AND NOTHING IS INVENTED — no band word ever appears', () => {
      // The constraint independent review imposed, pinned so a later lane
      // cannot quietly reintroduce a tier taxonomy over an undefined scale.
      for (const v of FOUNDER_SCALE_VALUES) {
        const out = formatFactorDisplayValue({
          label: 'Team Capability', value: v, raw_value: null,
          unit: 'scale', display_value: `${v} scale`,
        })!
        expect(out.toLowerCase()).not.toMatch(/very|low|medium|moderate|high/)
      }
    })
  })

  describe('⛔ REGRESSION: a declared encoding is never replaced by a magnitude', () => {
    // The exact reproduction from the independent review that refused the first
    // version of this fix. Under that version this returned "Very low".
    it('value 0 + display "0 scale" + map {0: "Not pursued"} resolves the MAP', () => {
      expect(formatFactorDisplayValue({
        label: 'Germany Market Entry',
        value: 0,
        raw_value: null,
        unit: 'scale',
        display_value: '0 scale',
        encoding_map: { '0': 'Not pursued', '1': 'Pursued' },
      })).toBe('Not pursued')
    })

    it('and the same map still resolves the OTHER declared level', () => {
      expect(formatFactorDisplayValue({
        label: 'Germany Market Entry',
        value: 1,
        raw_value: null,
        unit: 'scale',
        display_value: '1 scale',
        encoding_map: { '0': 'Not pursued', '1': 'Pursued' },
      })).toBe('Pursued')
    })

    it('DISCRIMINATION: the SAME input with no map renders the bare figure', () => {
      // Pins that the map — not the unit-stripping rule — is what produced the
      // words above. Without this, both tests could pass on one mechanism.
      expect(formatFactorDisplayValue({
        label: 'Germany Market Entry',
        value: 0,
        raw_value: null,
        unit: 'scale',
        display_value: '0 scale',
      })).toBe('0')
    })

    it('the already-working parenthesised form is unchanged by the widening', () => {
      expect(formatFactorDisplayValue({
        label: 'Germany Market Entry',
        value: 0,
        raw_value: null,
        unit: 'scale',
        display_value: 'Low (0)',
        encoding_map: { '0': 'Not pursued' },
      })).toBe('Not pursued')
    })

    it('a map whose key does NOT match the value cannot be forced to speak', () => {
      // The producer contradicting itself is reported by silence, not guessed.
      expect(formatFactorDisplayValue({
        label: 'GDPR EU Data Residency Compliance',
        value: 0.5,
        raw_value: null,
        unit: 'scale',
        display_value: '0.5 scale',
        encoding_map: { '0': 'Non-compliant', '1': 'Fully compliant' },
      })).toBe('0.5')
    })
  })

  describe('out of the [0,1] range is the same rule — one rule, no boundary', () => {
    it('"50 index" keeps its 50 and loses its "index"', () => {
      expect(GENERIC_PLACEHOLDER_UNITS.has('index')).toBe(true)
      expect(formatFactorDisplayValue({
        label: 'Market Index', value: 50, raw_value: null,
        unit: 'index', display_value: '50 index',
      })).toBe('50')
    })

    it('a negative figure keeps its sign and its magnitude', () => {
      expect(formatFactorDisplayValue({
        label: 'Drift', value: -0.4, raw_value: null,
        unit: 'score', display_value: '-0.4 score',
      })).toBe('-0.4')
    })
  })

  describe('⛔ everything else keeps today\'s behaviour byte-for-byte', () => {
    it('`ratio` is NOT a placeholder and is left exactly as it renders today', () => {
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
      expect(formatFactorDisplayValue({
        label: 'Capability', value: 0.5, raw_value: null,
        unit: 'scale', display_value: 'Moderate (0.5)',
      })).toBe('Moderate (0.5)')
    })

    it('a REAL unit keeps its number and its unit', () => {
      // Pattern 1 (fresh raw_value + meaningful unit) outranks display_value and
      // composes the string itself — measured, not assumed: this reads
      // "GBP 40,000", not the producer's "£40,000". Unchanged by this fix.
      expect(formatFactorDisplayValue({
        label: 'Budget', value: null, raw_value: 40000,
        unit: 'GBP', display_value: '£40,000',
      })).toBe('GBP 40,000')
    })

    it('a real unit spelled into display_value is untouched (e.g. "42 days")', () => {
      expect(formatFactorDisplayValue({
        label: 'Lead time', value: null, raw_value: 42,
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

  describe('⛔ DISPLAY ONLY — nothing on this path writes', () => {
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
        observedState: { value: 0.3, unit: 'scale', raw_value: null },
      }
      const before = JSON.stringify(data)
      expect(factorDisplayText(data)).toBe('0.3')
      expect(JSON.stringify(data)).toBe(before)
      expect(data.observedState.value).toBe(0.3)
      expect(data.observedState.unit).toBe('scale')
      expect(data.display_value).toBe('0.3 scale')
    })
  })
})

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
  describe('the founder\'s board: "<number> scale" is withheld, not reworded', () => {
    it.each(FOUNDER_SCALE_VALUES.map(v => [`${v} scale`, v] as const))(
      'display_value %s (value %s) is withheld', (displayValue, value) => {
        expect(formatFactorDisplayValue({
          label: 'Team Capability',
          value,
          raw_value: null,
          unit: 'scale',
          display_value: displayValue,
        })).toBeNull()
      })

    it('not one of the founder\'s eight values leaves a placeholder figure on screen', () => {
      for (const v of FOUNDER_SCALE_VALUES) {
        expect(formatFactorDisplayValue({
          label: 'Team Capability',
          value: v,
          raw_value: null,
          unit: 'scale',
          display_value: `${v} scale`,
        }), `value ${v}`).toBeNull()
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

    it('DISCRIMINATION: the SAME input with no map is withheld, not banded', () => {
      // Pins that the map — not the suppression rule — is what produced the
      // words above. Without this, both tests could pass on one mechanism.
      expect(formatFactorDisplayValue({
        label: 'Germany Market Entry',
        value: 0,
        raw_value: null,
        unit: 'scale',
        display_value: '0 scale',
      })).toBeNull()
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
      })).toBeNull()
    })
  })

  describe('out of the [0,1] range is withheld too — one rule, no boundary', () => {
    it('"50 index" does not render', () => {
      expect(GENERIC_PLACEHOLDER_UNITS.has('index')).toBe(true)
      expect(formatFactorDisplayValue({
        label: 'Market Index', value: 50, raw_value: null,
        unit: 'index', display_value: '50 index',
      })).toBeNull()
    })

    it('a negative figure does not render', () => {
      expect(formatFactorDisplayValue({
        label: 'Drift', value: -0.4, raw_value: null,
        unit: 'score', display_value: '-0.4 score',
      })).toBeNull()
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
      expect(factorDisplayText(data)).toBeNull()
      expect(JSON.stringify(data)).toBe(before)
      expect(data.observedState.value).toBe(0.3)
      expect(data.observedState.unit).toBe('scale')
      expect(data.display_value).toBe('0.3 scale')
    })
  })
})

/**
 * ⭐⭐ CONFIRMING A CATEGORICAL STATE MUST NOT DELETE ITS DECLARED MEANING.
 *
 * ⚠⚠ THIS IS A REGRESSION THIS PR INTRODUCED, found by independent review, not
 * by this file. The user-stated rescue opened Pattern 1 to a PLACEHOLDER unit —
 * correctly, for the founder's unmapped `4 scale` — but Pattern 1 sits ABOVE
 * `display_value` and above `encoding_map` in the precedence this module
 * documents at its own line 427. So a value the producer had already GIVEN A
 * MEANING lost it the moment the user confirmed it:
 *
 *   {display_value:"0 scale", encoding_map:{"0":"Not pursued"},
 *    observedState:{value:0, raw_value:0, unit:"scale", source:"user_confirmed"}}
 *
 *   before this PR → "Not pursued"      (the exact-encoding rule)
 *   at cfc8ad63     → "0"               ← the meaning is gone
 *
 * The rescue's premise is *"the product may decline to assert its OWN estimate;
 * it may not hide his"*. A declared `encoding_map` is not a hidden value — it is
 * that value, said in words. Rescuing it into a bare digit is the same loss the
 * rescue was written to prevent, pointed the other way.
 *
 * ⛔ SO THE RESCUE IS NARROWED, NOT REVERTED: it fires only where NO declared
 * meaning applies. The founder's `4 scale` with no map and no contextual prose
 * still renders — that case is asserted below as the positive control, because
 * a narrowing that quietly swallowed it would pass every test here.
 */
describe('a confirmed categorical value keeps the meaning the producer declared', () => {
  const germany = (source: string) => ({
    label: 'Germany Market Entry',
    display_value: '0 scale',
    encoding_map: { '0': 'Not pursued', '1': 'Pursued' },
    observedState: { value: 0, raw_value: 0, unit: 'scale', source },
  })

  it.each(['user_confirmed', 'user'])(
    'an encoded 0 keeps its phrase when the user states it (source: %s)',
    (source) => {
      expect(factorDisplayText(germany(source))).toBe('Not pursued')
    },
  )

  it('CONTROL — the machine-sourced arm is unchanged, so this is not a blanket revert', () => {
    expect(factorDisplayText(germany('cee_estimate'))).toBe('Not pursued')
  })

  it('contextual prose survives a user-stated value too', () => {
    // `display_value` that is NOT a magnitude summary keeps its place above the
    // numeric fallback — the `fac_acquisition` shape this module's header names.
    expect(
      factorDisplayText({
        label: 'Acquisition',
        display_value: 'No acquisition pursued',
        observedState: { value: 0, raw_value: 0, unit: 'scale', source: 'user_confirmed' },
      }),
    ).toBe('No acquisition pursued')
  })

  it('⭐ POSITIVE CONTROL — the founder’s UNMAPPED stated value is still visible', () => {
    expect(
      factorDisplayText({
        label: 'Team Capability',
        observedState: { value: 4, raw_value: 4, unit: 'scale', source: 'user' },
      }),
    ).toBe('4')
  })

  /**
   * ⭐⭐⭐ THE ASSERTION THAT ACTUALLY BINDS TO THE RESCUE — and the file did not
   * have it until a mutant proved so.
   *
   * ⚠ HOW THIS WAS FOUND. A mutant deleting the Pattern-1 rescue outright left
   * ALL 31 assertions here green, and all 410 in `src/utils/__tests__`. The
   * obvious reading was that the limb is redundant — Pattern 2's own
   * `value_source` awareness returns "4" for the case above, so the control
   * above passes either way and proves nothing about the code it was written for.
   *
   * ⛔ THE OBVIOUS READING WAS WRONG, and the only reason I know is that I
   * enumerated the whole class the rescue can reach (placeholder unit +
   * raw_value + user-stated) and DIFFED the two builds across it. 282 cases,
   * and they differ on exactly one shape — the one that matters:
   *
   *   {display_value:"0 scale", observedState:{value:V, raw_value:V,
   *    unit:"scale", source:"user"}}
   *     with the rescue → "V"     ← the user's own number
   *     without it      → null    ← THE CARD RENDERS NOTHING
   *
   * `isPlaceholderMagnitudeSummary` suppresses the stale "0 scale" summary — it
   * must, that is its job — and with the rescue gone nothing remains to show.
   * That is PRECISELY the defect this PR exists to close, re-opened. CEE sends a
   * placeholder magnitude summary alongside a raw value routinely, so this is
   * not a corner.
   *
   * The lesson is the kit's: a surviving mutant is a claim about the SPEC first.
   * Here it was right about the spec and wrong about the code.
   */
  it.each([0, 0.5, 1, 4])(
    'a user-stated %s still shows when a placeholder magnitude summary is all CEE sent',
    (v) => {
      expect(
        factorDisplayText({
          label: 'Team Capability',
          display_value: '0 scale',
          observedState: { value: v, raw_value: v, unit: 'scale', source: 'user' },
        }),
      ).toBe(String(v))
    },
  )

  it('CONTROL — an unmapped MACHINE value is still suppressed, as before', () => {
    expect(
      factorDisplayText({
        label: 'Team Capability',
        observedState: { value: 4, raw_value: 4, unit: 'scale', source: 'cee_estimate' },
      }),
    ).not.toBe('4')
  })
})

/**
 * The factor card stops contradicting CEE about the same number.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MEASURED ON THE DEPLOYED BUILD — guest, `usage-based-billing`, hovering
 * `opt_vendor`, whose `fac_eng_capacity` target is `0.2`:
 *
 *     the OPTION card said     → Low (0.2)     ← CEE's own `display_value`
 *     the FACTOR card said     → Very low       ← the UI's own band table
 *
 * **One datum, two surfaces, the product contradicting its producer eight
 * pixels apart.** `qualitativeTierLabel` puts `0.2` in *Very low* (its bound is
 * `<= 0.2`); CEE put it in *Low*. Neither table is wrong — only one of them is
 * the producer's, and the canvas is a thin layer over what the producer said.
 * On the same hover a third factor rendered the bare `→ 0.2`, so the surface
 * was not even self-consistent with itself.
 *
 * THE CAUSE, at the bytes: `ceeAnalysisReady.options[]` carries `interventions`
 * as a FLAT map of numbers and the authored strings in a SIBLING
 * `intervention_details` map. Both readers took the flat numbers and never
 * looked at the words.
 *
 * ⭐ NOTHING NEW IS BUILT. `joinInterventionDetails` shipped in #1793 for
 * `OptionNode` — which is why that card has been right all along. This binds
 * the surfaces that were left out to the SAME owner.
 *
 * ⚠ THE FIXTURES ARE THE CAPTURE. Every shape below was read from
 * `window.useCanvasStore` on the deployed build, not composed from a type.
 */
import { describe, it, expect } from 'vitest'
import {
  factorOptionSetting,
  getFactorOptionRows,
  resolveOptionInterventionsForDisplay,
} from '../factorOptionSetting'

const F_CAP = 'fac_eng_capacity'
const F_TIME = 'fac_dev_time'
const F_VENDOR = 'fac_vendor_indicator'

/** `ceeAnalysisReady.options[]` exactly as staging sends it. */
const ceeVendorOption = {
  id: 'opt_vendor',
  option_id: 'opt_vendor',
  label: 'Buy Vendor Solution (Metronome or Orb)',
  status: 'ready',
  interventions: { [F_TIME]: 0.2, [F_CAP]: 0.2, [F_VENDOR]: 1 },
  intervention_details: {
    [F_TIME]: { display_value: 'Low (0.2)', normalised_value: 0.2 },
    [F_CAP]: { display_value: 'Low (0.2)', normalised_value: 0.2, raw_value: 0.2 },
    [F_VENDOR]: { display_value: 'Very high (1)', normalised_value: 1 },
  },
}

/** The node's own map — nested, and what `OptionNode` has always read. */
const vendorNode = {
  id: 'opt_vendor',
  type: 'option',
  data: {
    label: 'Buy Vendor Solution (Metronome or Orb)',
    interventions: {
      [F_CAP]: { value: 0.2, source: 'brief_extraction', display_value: 'Low (0.2)' },
    },
  },
}

/** `fac_eng_capacity` on that board: no unit, `factor_type: 'other'`. */
const observedState = { value: 0.62, factor_type: 'other', source: 'cee_inference' } as never

describe('the words CEE wrote reach the factor card', () => {
  it('⭐ prints "Low (0.2)" where the card printed "Very low" — RED at pristine', () => {
    const joined = resolveOptionInterventionsForDisplay(undefined, ceeVendorOption)
    const shown = factorOptionSetting(joined?.[F_CAP], observedState)
    expect(shown).toBe('Low (0.2)')
    // The precise contradiction, pinned by name so a future band-table change
    // cannot quietly reintroduce it.
    expect(shown).not.toBe('Very low')
  })

  it('⛔ PINS THE DISAGREEMENT ITSELF — the UI table and CEE genuinely differ on this number', () => {
    // Without this, the test above could pass on a board where both tables
    // happen to agree, and would then be certifying nothing (trap 13b: a
    // discriminator must pin its own precondition).
    const bare = factorOptionSetting(0.2, observedState)
    expect(bare, 'the UI table no longer disagrees — this corpus is now vacuous').toBe('Very low')
  })

  it('stops rendering a bare number where CEE supplied a sentence', () => {
    const joined = resolveOptionInterventionsForDisplay(undefined, ceeVendorOption)
    expect(factorOptionSetting(joined?.[F_TIME], observedState)).toBe('Low (0.2)')
  })

  it('carries the join into the option-comparison rows, not only the hover', () => {
    const rows = getFactorOptionRows(
      F_CAP,
      [vendorNode as never],
      [ceeVendorOption as never],
      observedState,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].displayValue).toBe('Low (0.2)')
  })

  it('⚠ THE CEE MAP STILL WINS — the node is the fallback, never the override', () => {
    /*
     * The analysis ran on CEE's payload. A node value that disagrees would be a
     * target the run did not use, and showing it would be a different lie.
     *
     * ⚠⚠ A MUTANT PROVED THE FIRST VERSION OF THIS TEST COULD NOT FAIL. It gave
     * CEE an `intervention_details` entry, so the authored string came from CEE
     * either way and swapping the precedence of the NUMBER maps changed
     * nothing. Precedence is only observable where the details are ABSENT and
     * the two maps carry different values — which is this fixture.
     */
    const cee = { id: 'opt_vendor', interventions: { [F_CAP]: 0.9 } }
    const joined = resolveOptionInterventionsForDisplay(vendorNode as never, cee as never)
    // CEE's 0.9 through the UI's own table, NOT the node's authored 'Low (0.2)'.
    expect(factorOptionSetting(joined?.[F_CAP], observedState)).toBe('Very high')
  })

  it('CONTRAST — with no CEE payload at all it reads the node, which already carried the words', () => {
    const joined = resolveOptionInterventionsForDisplay(vendorNode as never, undefined)
    expect(factorOptionSetting(joined?.[F_CAP], observedState)).toBe('Low (0.2)')
  })

  it('CONTRAST — a CEE map with NO details is passed through untouched, not wrapped', () => {
    const cee = { id: 'opt_x', interventions: { [F_CAP]: 0.2 } }
    const joined = resolveOptionInterventionsForDisplay(undefined, cee as never)
    // No authored string exists, so the UI's own table is the honest fallback
    // and must still be reached.
    expect(factorOptionSetting(joined?.[F_CAP], observedState)).toBe('Very low')
  })
})

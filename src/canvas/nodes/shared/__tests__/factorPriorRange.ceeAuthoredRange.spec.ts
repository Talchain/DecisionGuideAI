/**
 * ⭐⭐⭐ A FACTOR WITH NO VALUE SHOWED THE RAW NORMALISED RANGE WHILE CEE'S OWN
 * AUTHORED STRING SAT UNUSED BESIDE IT.
 *
 * ## Measured on Paul's own run — bundle `ebc6e31a`, served UI `1f77130d`
 *
 * `full_graph.factors[ab78e513]` (*Monthly Churn Rate*):
 *
 *     observed_state: null
 *     display_value:  "0% to 13%"     ← CEE authored this
 *     prior:          0 → 0.13
 *
 * The card rendered **`Range: 0 to 0.13`**. A monthly churn rate of "0 to 0.13"
 * is the normalised prior printed raw; "0% to 13%" is the same fact in the
 * reader's own units, and it was already in the payload.
 *
 * ## ⛔ THE RULE IS THIS MODULE'S OWN, APPLIED WHERE IT COULD NOT REACH
 *
 * The no-calibration arm already states it: *"the node body already shows this
 * same range via the CEE-authored `display_value` … The `display_value` line
 * wins because it is CEE-authored copy."* But that dedupe is gated on
 * `valueDisplay != null` — the value the CALLER renders — and a factor with no
 * observed value renders no value, so `valueDisplay` is `null` and the branch
 * is unreachable for exactly the cards that need it most.
 *
 * ⚠ THIS IS A PREFERENCE, NOT A NEW CLAIM. Nothing is invented: CEE's string is
 * rendered verbatim under the same `Range:` caption. Where CEE authored
 * nothing, the normalised fallback is unchanged — the canvas stays the thin
 * layer, and the absence of a legible unit stays an upstream gap rather than
 * becoming a sentence this surface makes up.
 */
import { describe, it, expect } from 'vitest'
import { resolveFactorPriorRange } from '../factorPriorRange'

/** Paul's own record, verbatim from the bundle. */
const CHURN = {
  prior: { range_min: 0, range_max: 0.13 },
  display_value: '0% to 13%',
}

describe('a valueless external factor prefers CEE’s authored range string', () => {
  it('renders CEE’s own units rather than the raw normalised prior', () => {
    const line = resolveFactorPriorRange({
      data: CHURN,
      nodeCategory: 'external',
      observedState: undefined,
      valueDisplay: null,
    })
    expect(line).toBe('Range: 0% to 13%')
  })

  it('does NOT print the raw normalised endpoints when a better string exists', () => {
    const line = resolveFactorPriorRange({
      data: CHURN,
      nodeCategory: 'external',
      observedState: undefined,
      valueDisplay: null,
    })
    expect(line).not.toContain('0.13')
  })

  it('CONTRAST CONTROL — with no authored string, the normalised fallback is unchanged', () => {
    // The pre-existing behaviour, pinned so the preference cannot quietly
    // become a requirement. If this REDs, the change removed a line rather
    // than improving one.
    const line = resolveFactorPriorRange({
      data: { prior: { range_min: 0, range_max: 0.13 } },
      nodeCategory: 'external',
      observedState: undefined,
      valueDisplay: null,
    })
    expect(line).toBe('Range: 0 to 0.13')
  })

  it('CONTRAST CONTROL — an empty or non-string display_value falls back', () => {
    for (const bad of ['', '   ', 42, null, undefined, {}]) {
      expect(
        resolveFactorPriorRange({
          data: { prior: { range_min: 0, range_max: 0.13 }, display_value: bad },
          nodeCategory: 'external',
          observedState: undefined,
          valueDisplay: null,
        }),
      ).toBe('Range: 0 to 0.13')
    }
  })

  it('never duplicates: an authored string equal to the caption’s own text is not doubled', () => {
    const line = resolveFactorPriorRange({
      data: { prior: { range_min: 0, range_max: 0.13 }, display_value: 'Range: 0% to 13%' },
      nodeCategory: 'external',
      observedState: undefined,
      valueDisplay: null,
    })
    expect(line).toBe('Range: 0% to 13%')
  })

  it('leaves the VALUED case alone — the existing dedupe still owns it', () => {
    // `valueDisplay` non-null is the branch that already worked; the preference
    // must not reach into it, or a card showing a value would gain a second
    // copy of it under a Range caption.
    const line = resolveFactorPriorRange({
      data: CHURN,
      nodeCategory: 'external',
      observedState: { unit: null, cap: null },
      valueDisplay: '0.07',
    })
    expect(line).not.toBe('Range: 0% to 13%')
  })
})

/**
 * ⭐⭐ WHERE A CARD MINTED A SENTENCE OVER THE PRODUCER'S OWN.
 *
 * ⛔ MEASURED, NOT REASONED — the shipped formatter run against the real staging
 * payload for the risk labelled "Budget Overrun" (`golden-path-staging-2026-04-05`):
 *
 *     CEE authored : "£400,000 budget cap"
 *     the card said: "No cost allocated"
 *
 * `raw_value: 0` with `factor_type: 'cost'` took a fallback branch that returns a
 * hardcoded English sentence, discarding the producer's own statement. **That is
 * a fabrication, not a formatting choice**: "No cost allocated" is a claim about
 * the user's model, minted in the UI, that no producer supplied — the same class
 * as every invented metric this estate has removed, arriving through a fallback
 * string instead of through a number. CLAUDE.md trap 13c: derive the expectation
 * from the producer's declared semantics, never from this lane's reading of what
 * a field ought to mean.
 *
 * ⚠ THE OBJECTION THAT COULD HAVE SUNK THE FIX, settled at the bytes rather than
 * assumed. Pattern 1 outranks `display_value` for STALE-VALUE PROTECTION: a user
 * edits `raw_value` to 26000 while CEE's old "£20,000" lingers, and the fresh
 * number must win. Deferring at zero cannot reopen that, because the commit path
 * CLEARS the string — `useInspectorMutations.setObservedValue` writes
 * `display_value: undefined` at BOTH locations on every commit, saying *"this
 * string is the server's to author"*. So a zero sitting beside an authored
 * sentence is one CEE wrote together with it. The precondition test below pins
 * that, because if the clearing ever stops, this deference becomes unsafe and
 * this file is what should notice.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { factorDisplayText, formatFactorDisplayValue } from '../formatFactorDisplayValue'

/** The exact payload, from the capture committed to this repo. */
const BUDGET_OVERRUN = {
  label: 'Budget Overrun',
  display_value: '£400,000 budget cap',
  observedState: {
    value: 0, unit: '£', source: 'brief_extraction',
    raw_value: 0, cap: 0, extractionType: 'explicit', factor_type: 'cost',
  },
}

describe("the producer's own sentence outranks ours", () => {
  it('⭐ THE MUTANT TARGET: a cost at zero renders what CEE authored, not our fallback', () => {
    expect(factorDisplayText(BUDGET_OVERRUN)).toBe('£400,000 budget cap')
  })

  it('⛔ and specifically NOT the sentence the UI used to mint', () => {
    // Stated as its own assertion because it is the defect, not a side effect.
    // An absence alone could pass on a null render, so the case above supplies
    // the contrast in the same run (CLAUDE.md trap 13e).
    expect(factorDisplayText(BUDGET_OVERRUN)).not.toBe('No cost allocated')
  })

  it('CONTRAST: with no authored sentence, the fallback still speaks — nothing was deleted', () => {
    const { display_value: _dropped, ...noSentence } = BUDGET_OVERRUN
    expect(factorDisplayText(noSentence)).toBe('No cost allocated')
  })

  it('CONTRAST: an empty or blank authored string is not a sentence, and does not win', () => {
    expect(factorDisplayText({ ...BUDGET_OVERRUN, display_value: '' })).toBe('No cost allocated')
    expect(factorDisplayText({ ...BUDGET_OVERRUN, display_value: '   ' })).toBe('No cost allocated')
  })

  it('⛔ NARROW: stale-value protection is untouched — a fresh NON-ZERO magnitude still beats the sentence', () => {
    // The whole reason Pattern 1 outranks `display_value`. If this ever returns
    // the sentence, the deference has widened past zero and the defect the
    // precedence exists to stop is back.
    expect(formatFactorDisplayValue({
      label: 'Annual Platform Cost', value: 0.4, raw_value: 26000, unit: '£',
      factor_type: 'cost', category: null, display_value: '£20,000',
    })).toBe('£26,000')
  })

  it('⛔ NARROW: a non-cost zero is unchanged — this change touches one branch', () => {
    // "No onboarding time" rendering "0 months" was measured in the same run and
    // is deliberately NOT fixed here: there the card and the producer agree about
    // the magnitude and differ only in register, and widening the deference would
    // route a much larger class around `isDisplayValueContradicted`. Pinned so
    // the narrowness is a decision on the record, not an oversight.
    expect(formatFactorDisplayValue({
      label: 'Onboarding Ramp Duration', value: 0, raw_value: 0, unit: 'months',
      factor_type: 'time', category: null, display_value: 'No onboarding time',
    })).toBe('0 months')
  })

  it('⚠ PRECONDITION THIS FIX RESTS ON: the commit path still clears `display_value`', () => {
    // Pinned in-test rather than trusted (CLAUDE.md trap 21's corollary). If
    // `setObservedValue` stops clearing the string, a user edit to zero could
    // leave a stale sentence that this deference would then render — and this
    // assertion is the only thing positioned to notice.
    const src = readFileSync(
      resolve(__dirname, '../../canvas/ui/inspector-v2/useInspectorMutations.ts'),
      'utf8',
    )
    const clears = src.match(/display_value:\s*undefined/g) ?? []
    expect(
      clears.length,
      'setObservedValue no longer clears display_value at both locations; deferring to an authored ' +
        'sentence at raw_value 0 is no longer safe, because the sentence may now be stale',
    ).toBeGreaterThanOrEqual(2)
  })
})

/**
 * `factorDisplaysValue` must agree with what the MOUNTED Model row renders.
 *
 * ⚠ THIS FILE EXISTS BECAUSE ITS OWN DOCBLOCK PROMISED IT AND IT DID NOT EXIST.
 * `model-tab/utils.ts` claimed "`__tests__/factorDisplaysValue.spec.ts` pins the
 * two against a shared corpus so a change to either REDs" while no such file was
 * in the tree — a comment asserting a red that could not happen. Caught in review.
 * The agreement it described did hold; the guarantee was theatre. Now it is real.
 *
 * WHAT IS BEING PINNED. The predicate chooses the WORDING of the act ("review"
 * vs "set"). It must answer the same question the destination answers: will the
 * row display a value? The destination composes `getPrimaryValue` over an observed
 * state narrowed by `model-tab-v2/adapters.ts` `narrowObservedState`. This spec
 * runs a shared corpus through BOTH and asserts they never disagree — so if either
 * side's rule moves, this REDs rather than the wording silently drifting from what
 * the user finds when they arrive.
 */
import { describe, it, expect } from 'vitest'
import { factorDisplaysValue, getPrimaryValue } from '../utils'

/** The destination's narrowing, applied to the two fields `getPrimaryValue` reads. */
const destinationRenders = (obs: Record<string, unknown> | undefined): boolean => {
  if (!obs) return false
  const raw = obs.raw_value
  const unit = obs.unit
  return (
    getPrimaryValue({
      raw_value: typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined,
      unit: typeof unit === 'string' ? unit : undefined,
    }) !== null
  )
}

/**
 * Corpus deliberately drawn from OUTSIDE the predicate's own shape (CLAUDE.md 22):
 * the classes the contract admits, not the ones the implementation happens to
 * handle. `{value, no raw_value}` is the staging-witnessed capped-factor shape
 * recorded at `conversation/factorValueEdit.ts`; the non-finite and string cases
 * are what `narrowObservedState` exists to reject.
 */
const CORPUS: Array<{ name: string; obs: Record<string, unknown> | undefined }> = [
  { name: 'capped factor: model value only, NO raw_value', obs: { value: 0.7 } },
  { name: 'uncapped: raw === value, with unit', obs: { value: 40000, raw_value: 40000, unit: '£' } },
  { name: 'raw_value present, no unit', obs: { value: 12, raw_value: 12 } },
  { name: 'raw_value zero (a measurement, not absence)', obs: { value: 0, raw_value: 0, unit: '%' } },
  { name: 'raw_value negative', obs: { value: -3, raw_value: -3, unit: 'pts' } },
  { name: 'raw_value NaN', obs: { value: 1, raw_value: Number.NaN } },
  { name: 'raw_value Infinity', obs: { value: 1, raw_value: Number.POSITIVE_INFINITY } },
  { name: 'raw_value as a STRING (the cast hazard)', obs: { value: 1, raw_value: '40000' } },
  { name: 'raw_value null', obs: { value: 1, raw_value: null } },
  { name: 'unit non-string', obs: { value: 1, raw_value: 1, unit: 7 } },
  { name: 'empty observed state', obs: {} },
  { name: 'no observed state at all', obs: undefined },
]

describe('factorDisplaysValue agrees with the mounted row, over a shared corpus', () => {
  it('the corpus exercises BOTH outcomes (a corpus with one answer proves nothing)', () => {
    const outcomes = new Set(CORPUS.map(c => destinationRenders(c.obs)))
    expect(outcomes.has(true), 'no corpus case renders — the agreement would be vacuous').toBe(true)
    expect(outcomes.has(false), 'no corpus case withholds — the agreement would be vacuous').toBe(true)
  })

  it.each(CORPUS)('agrees on: $name', ({ obs }) => {
    const expected = destinationRenders(obs)
    expect(factorDisplaysValue(obs === undefined ? {} : { observedState: obs })).toBe(expected)
  })

  it('reads BOTH spellings — canvas stores observedState, the wire uses observed_state', () => {
    const withValue = { value: 5, raw_value: 5, unit: '%' }
    expect(factorDisplaysValue({ observedState: withValue })).toBe(true)
    expect(factorDisplaysValue({ observed_state: withValue })).toBe(true)
  })

  it('the capped-factor class is the one that DIVERGES from confirmability', () => {
    // The point of the whole split: the authority would accept this factor
    // (finite `value`), and the row shows nothing. That is why the wording
    // differs and why nothing is hidden on its account.
    expect(factorDisplaysValue({ observedState: { value: 0.7 } })).toBe(false)
  })
})

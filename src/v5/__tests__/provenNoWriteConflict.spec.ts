/**
 * The closed set that decides whether a failed turn PROVED it wrote nothing.
 *
 * ⚠ THIS FILE EXISTS BECAUSE THE SET WAS WIDENED. Its own header says a member
 * may be added only with the producer line that states the guarantee, and that
 * "widening a set is safe only if the OUTSIDE of the set is pinned too" — and
 * until now nothing pinned either side directly. The consumers' specs exercise
 * individual members in passing, which cannot see a member silently added, a
 * member silently dropped, or the fail-closed default quietly becoming
 * fail-open.
 *
 * The two directions are both assertions here, deliberately: membership decides
 * a REVERT (and, for the non-optimistic option-effect sender, whether a row may
 * say "not saved" rather than "could not confirm"). Getting it wrong in one
 * direction destroys the user's data; in the other it lies about the model.
 */
import { describe, it, expect } from 'vitest'

import {
  PROVEN_NO_WRITE_CONFLICT_CATEGORIES,
  isProvenNoWriteConflict,
} from '../provenNoWriteConflict'

describe('the set is exactly these members', () => {
  it('holds the three categories whose producer states a no-write guarantee', () => {
    // Exact, not superset: a member added without its producer line would be a
    // revert this estate cannot justify, and this is where that shows up.
    expect([...PROVEN_NO_WRITE_CONFLICT_CATEGORIES].sort()).toEqual([
      'BASE_HASH_DIVERGED',
      'rpc_cas_conflict',
      'stale_base_graph_hash',
    ])
  })

  it.each([...PROVEN_NO_WRITE_CONFLICT_CATEGORIES])('%s is a proven no-write', category => {
    expect(isProvenNoWriteConflict(category)).toBe(true)
  })
})

describe('⚠ THE OUTSIDE OF THE SET, which is the half a widening endangers', () => {
  it.each([
    // Stated in the module header, and worth pinning because both are
    // non-retryable — the trap the header names. Non-retryable means
    // "re-sending cannot work"; it says NOTHING about whether bytes landed.
    ['INGRESS_CONTRACT_VIOLATION', 'non-retryable, but carries no no-write guarantee'],
    ['TURN_BUDGET_EXCEEDED', 'non-retryable, but carries no no-write guarantee'],
    // A turn-fence verdict and any future category are unknowns.
    ['fence_refusal', 'an unknown category takes the cannot-confirm line'],
    ['BASE_HASH_DIVERGED_v2', 'a near-miss name must not match by prefix or similarity'],
    ['base_hash_diverged', 'the comparison is exact — case is part of the identity'],
  ])('%s is NOT a proven no-write — %s', category => {
    expect(isProvenNoWriteConflict(category)).toBe(false)
  })

  it('fails CLOSED on absent, empty and non-string input', () => {
    expect(isProvenNoWriteConflict(undefined)).toBe(false)
    expect(isProvenNoWriteConflict(null)).toBe(false)
    expect(isProvenNoWriteConflict('')).toBe(false)
    expect(isProvenNoWriteConflict('   ')).toBe(false)
  })

  it('POSITIVE CONTROL: the refusals above are not a predicate that returns false', () => {
    // Without this, every assertion in this block would pass against
    // `() => false` — which is exactly what a dropped set would look like.
    expect(isProvenNoWriteConflict('BASE_HASH_DIVERGED')).toBe(true)
  })
})

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
  PROVEN_NO_WRITE_REASONS,
  isProvenNoWriteConflict,
  isProvenNoWriteReason,
} from '../provenNoWriteConflict'

describe('the set is exactly these members', () => {
  it('holds the five categories whose producer states a no-write guarantee', () => {
    // Exact, not superset: a member added without its producer line would be a
    // revert this estate cannot justify, and this is where that shows up.
    expect([...PROVEN_NO_WRITE_CONFLICT_CATEGORIES].sort()).toEqual([
      'BASE_HASH_DIVERGED',
      'rpc_cas_conflict',
      'stale_base_graph_hash',
      'turn_fence_stopped',
      'turn_fence_superseded',
    ])
  })

  /**
   * ⭐ THE TWO FENCE VERDICTS THE PRODUCER ANSWERS WITH A NO-WRITE 409 (CEE
   * #1868, `013fae8d`, served `92b1bf8`): `system-events/dispatch.ts`, the
   * `factor_value_edit` arm, returns 409 `GRAPH_DIVERGED` with
   * `commitPerformed: false` for a `TurnFenceRejectedError` whose verdict is
   * `superseded` or `stopped` — "The turn fence refused the write inside the
   * append transaction, so nothing of this edit landed."
   */
  it.each(['turn_fence_superseded', 'turn_fence_stopped'])(
    '%s is a proven no-write (the producer states it in the 409 arm)',
    category => {
      expect(isProvenNoWriteConflict(category)).toBe(true)
    },
  )

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
    // The two fence verdicts the producer does NOT answer with a no-write 409
    // on the edit path: CEE #1868 deliberately keeps `unclaimed` and
    // `unavailable` as the retryable 500 (infrastructure refusals, "until their
    // code is decided"). Pinned by name, because they share the members' prefix
    // and a prefix gate would sweep them in.
    ['turn_fence_unclaimed', 'an infrastructure refusal the producer has not decided a code for'],
    ['turn_fence_unavailable', 'an infrastructure refusal the producer has not decided a code for'],
    ['turn_fence_quarantined', 'an unknown future fence verdict is an unknown, not a member'],
    ['turn_fence_', 'the bare prefix is not a verdict'],
    // Any other future category is an unknown.
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

/**
 * ⭐ THE SECOND FIELD — `details.reason`. Same rules, pinned the same two ways.
 *
 * The member is the one CEE (`3f412be1`) emits ONLY for
 * `commitSkippedReason === 'refused_no_write'` (`route-v2.ts:3516-3530`),
 * defined as "a gate declined and NOTHING was written" (`dispatch.ts:97`).
 */
describe('the REASON set is exactly its members', () => {
  it('holds only the reason whose producer line states a no-write', () => {
    expect([...PROVEN_NO_WRITE_REASONS].sort()).toEqual(['system_event_refused_no_write'])
  })

  it('system_event_refused_no_write is a proven no-write', () => {
    expect(isProvenNoWriteReason('system_event_refused_no_write')).toBe(true)
  })
})

describe('⚠ THE OUTSIDE OF THE REASON SET', () => {
  it.each([
    // The opposite guarantee on the SAME envelope shape: the writer could not
    // confirm its commit, so a write MAY have landed (retryable 500).
    ['system_event_commit_failed', 'a commit may have landed — the opposite guarantee'],
    // Non-retryable, but about ownership, not about bytes.
    ['scenario_ownership_unverifiable', 'non-retryable is not no-write'],
    ['draft_graph_cee_timeout', 'an unrelated machine reason'],
    ['system_event_refused_no_write_v2', 'a near-miss must not match by prefix'],
    ['SYSTEM_EVENT_REFUSED_NO_WRITE', 'the comparison is exact — case is identity'],
    // A category is not a reason: the two sets answer on different fields.
    ['BASE_HASH_DIVERGED', 'a conflict category is not a reason'],
  ])('%s is NOT a proven no-write reason — %s', reason => {
    expect(isProvenNoWriteReason(reason)).toBe(false)
  })

  it('fails CLOSED on absent, empty and whitespace input', () => {
    expect(isProvenNoWriteReason(undefined)).toBe(false)
    expect(isProvenNoWriteReason(null)).toBe(false)
    expect(isProvenNoWriteReason('')).toBe(false)
    expect(isProvenNoWriteReason('   ')).toBe(false)
  })

  it('the category predicate does NOT accept the reason — two fields, two sets', () => {
    expect(isProvenNoWriteConflict('system_event_refused_no_write')).toBe(false)
  })
})

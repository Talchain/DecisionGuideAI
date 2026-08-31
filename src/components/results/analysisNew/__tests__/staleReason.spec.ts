/**
 * The mapping the Reasoning tab's first line depends on.
 *
 * ⚠ WRITTEN BECAUSE ITS FIRST VERSION WAS INLINE IN THE DOCK AND A MUTANT
 * SURVIVED: replacing the whole expression with the constant `'changed'` left
 * every suite GREEN. An untested replacement for an untested collapse is the
 * same defect wearing a new name.
 */
import { describe, expect, it } from 'vitest'
import { staleReasonFromFreshness } from '../staleReason'

describe('staleReasonFromFreshness', () => {
  it("licenses the stronger claim ONLY on the producer's own 'stale'", () => {
    expect(staleReasonFromFreshness('stale')).toBe('changed')
  })

  /**
   * ⚠ THE DIRECTION THAT WAS BROKEN. 'unknown' means CEE could not determine
   * freshness — an absence of evidence, never evidence of a change.
   */
  it("never claims a change from 'unknown'", () => {
    expect(staleReasonFromFreshness('unknown')).toBe('unconfirmed')
  })

  it('fails closed on every other value, including ones this build does not know', () => {
    for (const v of ['fresh', 'none', '', 'STALE', 'changed', null, undefined]) {
      expect(staleReasonFromFreshness(v)).toBe('unconfirmed')
    }
  })
})

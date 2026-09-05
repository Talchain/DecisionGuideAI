/**
 * The mapping the Reasoning tab's first line depends on.
 *
 * ⚠ WRITTEN BECAUSE ITS FIRST VERSION WAS INLINE IN THE DOCK AND A MUTANT
 * SURVIVED: replacing the whole expression with the constant `'changed'` left
 * every suite GREEN. An untested replacement for an untested collapse is the
 * same defect wearing a new name.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { staleReasonFromFreshness, staleReasonFromTrustSemantic } from '../staleReason'

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

/**
 * ⭐⭐ THE LIVE FUNCTION, WHICH HAD NO COVERAGE AT ALL.
 *
 * ⚠ A REVIEWER RAN THE SAME MUTATION AGAINST BOTH AND GOT OPPOSITE ANSWERS:
 *
 *   mutate `staleReasonFromTrustSemantic` → 'changed'   788/788 GREEN
 *   mutate `staleReasonFromFreshness`     → 'changed'   REDs 2 by name
 *
 * Same file, same mutation, same 61-file / 788-test net. **All of the coverage
 * sat on the function nothing calls.** `OutputsDock.tsx:1018` uses
 * `staleReasonFromTrustSemantic`; `staleReasonFromFreshness` has no production
 * caller on this path, and it is the one every existing case exercised.
 *
 * ⚠⚠ AND THIS SPEC'S OWN HEADER ALREADY RECORDS THIS MUTANT SURVIVING ONCE
 * BEFORE — which is why the file exists. It was written to stop exactly this
 * and then pinned the wrong function.
 */
describe('staleReasonFromTrustSemantic — the one the dock actually calls', () => {
  it("'changed' is the only input that licenses the CHANGED sentence", () => {
    expect(staleReasonFromTrustSemantic('changed')).toBe('changed')
  })

  /**
   * ⚠ THE CASE THAT KILLS THE MUTANT. A version returning 'changed'
   * unconditionally passes the arm above and fails here — which is the
   * difference between covering a function and pinning it.
   */
  it.each(['unknown', 'stale', 'fresh', '', null, undefined])(
    'refuses to claim a CHANGE it cannot see: %s → unconfirmed',
    (v) => {
      expect(staleReasonFromTrustSemantic(v as never)).toBe('unconfirmed')
    },
  )

  /**
   * ⚠ AND THE WIRING, because a correct function called by nobody is the
   * defect this whole PR is about. If the dock is switched back to the
   * freshness reader — which cannot see a local dirty edit — the panel goes
   * back to disagreeing with its own footer, and every case above still
   * passes.
   */
  it('the dock reads the TRUST semantic, not the freshness one', () => {
    const dock = fs.readFileSync(
      path.resolve(__dirname, '../../../../canvas/components/OutputsDock.tsx'),
      'utf8',
    )
    expect(dock).toContain('staleReasonFromTrustSemantic(')
    expect(
      dock.includes('staleReasonFromFreshness('),
      'the dock must not read freshness — it cannot see a local dirty edit',
    ).toBe(false)
  })
})

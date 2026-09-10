/**
 * `resolveEffectiveDraftCoaching` — WHICH ABSENCE IS THIS, AND WHICH WAY ROUND.
 *
 * Two separate properties are pinned here, and they are separate on purpose
 * because the two mutants that break them are different mutants:
 *
 *   RETENTION  — an absent live payload falls back to the retained one.
 *   DIRECTION  — a PRESENT live payload always beats the retained one.
 *
 * A single `toBe(...)` on one input cannot distinguish `live ?? retained` from
 * `retained ?? live`; only the pair can. Inverting the fallback must fail on the
 * DIRECTION signature specifically, never on the RETENTION one.
 *
 * Every assertion binds by IDENTITY — object identity, and a marker string unique
 * to each fixture — never by "some coaching came back", which both arms satisfy.
 */
import { describe, it, expect } from 'vitest'
import { resolveEffectiveDraftCoaching } from '../effectiveDraftCoaching'
import type { CEEDraftCoaching } from '../../../adapters/cee/types'

function coaching(marker: string): CEEDraftCoaching {
  return {
    summary: `summary::${marker}`,
    strengthenItems: [],
    wideningLog: [],
    biasSignals: [{ type: 'narrow_framing', detail: `detail::${marker}` }],
  }
}

const LIVE = coaching('live-turn')
const RETAINED = coaching('retained-pre-edit')

describe('resolveEffectiveDraftCoaching — which absence is this?', () => {
  it('no producer has ever coached -> null, and absence stays absence', () => {
    expect(resolveEffectiveDraftCoaching(null, null, 2, 2)).toBeNull()
    expect(resolveEffectiveDraftCoaching(undefined, undefined, 2, 2)).toBeNull()
    expect(resolveEffectiveDraftCoaching(undefined, null, 2, 2)).toBeNull()
  })

  /**
   * RETENTION. Mutant (a) — dropping `retainedDraftCoaching` from
   * `readinessClearFields` — is caught in the store lifecycle spec; this arm
   * catches the resolver simply ignoring its second argument.
   */
  it('the live payload is absent and something is retained -> the retained copy answers', () => {
    const out = resolveEffectiveDraftCoaching(null, RETAINED, 2, 2)
    expect(out, 'the retained object itself must come back, by identity').toBe(RETAINED)
    expect(out?.biasSignals[0]?.detail).toBe('detail::retained-pre-edit')
  })

  /**
   * ⭐ DIRECTION — THE DOWNGRADE-ONLY GUARANTEE, AND THE MUTANT THAT MUST LAND
   * HERE AND NOWHERE ELSE.
   *
   * Invert the resolver to `retained ?? live` and this is the assertion that
   * fails: the panel would be pinned to the FIRST thing CEE ever said, and a
   * current turn's coaching — including one that coaches about something
   * completely different — would be outranked by stale prose. Note that the
   * RETENTION arm above still passes under that mutant, which is exactly why both
   * arms exist.
   */
  it('a live payload ALWAYS supersedes the retained copy — the fallback is downgrade-only', () => {
    const out = resolveEffectiveDraftCoaching(LIVE, RETAINED, 2, 1)
    expect(out, 'live must win by identity, not merely return "some" coaching').toBe(LIVE)
    expect(
      out?.biasSignals[0]?.detail,
      'a retained copy outranking a live turn would pin the panel to the first thing CEE said',
    ).toBe('detail::live-turn')
    expect(out?.summary).not.toBe('summary::retained-pre-edit')
  })

  /**
   * ⭐⭐ FRESHNESS — THE OTHER DIRECTION OF THE PREDICATE, AND THE MUTANT THAT MUST
   * LAND HERE AND NOWHERE ELSE.
   *
   * The consumer's live gate (`optionCount >= 3`) bounds WIDENING only. Narrowing
   * is the direction the harm lives in: coached at two options, delete one, and
   * the retained sentence asserts a two-option frame over a one-option graph while
   * REPLACING the accurate `optionBreadthOne` line. Delete the count comparison
   * from the resolver and this arm reds; the RETENTION and DIRECTION arms above
   * both stay green under that mutant, which is why this arm is separate.
   */
  it('the retained copy is refused once the option count it was authored against has moved', () => {
    // Precondition, in-test: the counts being compared are genuinely different,
    // or "refused because it moved" is not an observation.
    expect(2).not.toBe(1)
    expect(
      resolveEffectiveDraftCoaching(null, RETAINED, 2, 1),
      'narrowed 2 -> 1: the retained sentence describes a graph that no longer exists',
    ).toBeNull()
    expect(
      resolveEffectiveDraftCoaching(null, RETAINED, 2, 3),
      'widened 2 -> 3: refused for the same reason, without a second threshold to keep in sync',
    ).toBeNull()
    // And it still answers where the count is unchanged, so the arm above is a
    // discrimination rather than the resolver simply having stopped retaining.
    expect(resolveEffectiveDraftCoaching(null, RETAINED, 2, 2)).toBe(RETAINED)
  })

  /**
   * An unknown count is the ABSENCE of evidence that the prose still applies, not
   * evidence that it does. Fail closed.
   */
  it('an unknown option count refuses the retained copy', () => {
    expect(resolveEffectiveDraftCoaching(null, RETAINED, null, 2)).toBeNull()
    expect(resolveEffectiveDraftCoaching(null, RETAINED, 2, null)).toBeNull()
    expect(resolveEffectiveDraftCoaching(null, RETAINED, undefined, undefined)).toBeNull()
    // Contrast in the same arm: with both counts known and equal it answers.
    expect(resolveEffectiveDraftCoaching(null, RETAINED, 0, 0)).toBe(RETAINED)
  })

  /**
   * The precondition this whole file rests on: the two fixtures are genuinely
   * distinguishable. If they ever became equal, every arm above would agree under
   * either direction and the file would stop discriminating while staying green.
   */
  it('pins its own precondition — the two fixtures are distinguishable', () => {
    expect(LIVE).not.toBe(RETAINED)
    expect(LIVE.biasSignals[0]?.detail).not.toBe(RETAINED.biasSignals[0]?.detail)
  })
})

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
    expect(resolveEffectiveDraftCoaching(null, null)).toBeNull()
    expect(resolveEffectiveDraftCoaching(undefined, undefined)).toBeNull()
    expect(resolveEffectiveDraftCoaching(undefined, null)).toBeNull()
  })

  /**
   * RETENTION. Mutant (a) — dropping `retainedDraftCoaching` from
   * `readinessClearFields` — is caught in the store lifecycle spec; this arm
   * catches the resolver simply ignoring its second argument.
   */
  it('the live payload is absent and something is retained -> the retained copy answers', () => {
    const out = resolveEffectiveDraftCoaching(null, RETAINED)
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
    const out = resolveEffectiveDraftCoaching(LIVE, RETAINED)
    expect(out, 'live must win by identity, not merely return "some" coaching').toBe(LIVE)
    expect(
      out?.biasSignals[0]?.detail,
      'a retained copy outranking a live turn would pin the panel to the first thing CEE said',
    ).toBe('detail::live-turn')
    expect(out?.summary).not.toBe('summary::retained-pre-edit')
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

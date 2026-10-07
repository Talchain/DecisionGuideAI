/**
 * The factor chip reads the analysis, instead of the node's kind.
 *
 * THE DEFECT, measured on deployed `b6673341` (guest, `usage-based-billing`,
 * post-analysis): 23 coaching chips across 16 of 19 nodes, **12 distinct
 * strings**, keyed on node KIND plus "does a scalar value exist" — nothing
 * else. Every risk drew the same two questions, every outcome the same one.
 *
 * ⛔ The damning pair: `fac_eng_capacity` is the model's MOST INFLUENTIAL
 * factor AND an unconfirmed estimate — the highest-value thing on the board to
 * act on — and it drew the IDENTICAL chip to `fac_build_indicator` at 5%
 * influence. `NodeCoachingRequest`'s `factor` variant carried no analysis field
 * at all, while its `option` variant carried four. The science was computed and
 * the coaching was structurally unable to see it.
 *
 * ⚠ SCOPE. This adds ONE arm that refines the pre-existing `isInferred` chip.
 * It never displaces `needsInput` or `isExternalCategory`, and it mints no new
 * rank notion — `influenceScaleCopy.ts:347-361` forbids that, so the caller
 * passes the LICENSED readout's own verdict and phrase.
 */
import { describe, it, expect } from 'vitest'
import { resolveNodeCoaching } from '../resolveNodeCoaching'

const PHRASE = 'Most influential of 8 factors compared in this model'

const factor = (over: Partial<{
  needsInput: boolean
  isExternalCategory: boolean
  isInferred: boolean
  leadsInfluence: boolean
  influencePhrase?: string
}> = {}) =>
  resolveNodeCoaching({
    kind: 'factor',
    surface: 'card',
    state: {
      needsInput: over.needsInput ?? false,
      isExternalCategory: over.isExternalCategory ?? false,
      isInferred: over.isInferred ?? true,
      leadsInfluence: over.leadsInfluence ?? true,
    },
    context: {
      label: 'Engineering Capacity',
      influencePhrase: 'influencePhrase' in over ? over.influencePhrase : PHRASE,
    },
  })

describe('the factor chip reads the analysis', () => {
  it('⭐ the top-influence unconfirmed factor gets the sharper question — RED at pristine', () => {
    const chips = factor()
    expect(chips).not.toBeNull()
    expect(chips).toHaveLength(1)
    expect(chips![0].id).toBe('factor_confirm_top_influence')
    expect(chips![0].label).toBe('Confirm this first?')
  })

  it('⭐ and the message QUOTES the licensed phrase verbatim, rather than re-wording the rank', () => {
    // Trap 12 in prose: a second vocabulary for one fact. The rank sentence has
    // exactly one owner (`influenceRankReadout`), and this asserts containment
    // rather than re-typing a wording that a later copy edit could break.
    expect(factor()![0].message).toContain(PHRASE)
    expect(factor()![0].message).toContain('unconfirmed estimate')
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR. Each conjunct is someone else's fact, and
   * deleting either must RED a DIFFERENT case — one biting mutant would only
   * show sensitivity to *something*.
   */
  it('DISCRIMINATOR A — a factor that is inferred but NOT the leader keeps the generic chip', () => {
    const chips = factor({ leadsInfluence: false })
    expect(chips![0].id).toBe('factor_evidence_supports')
    expect(chips![0].label).toBe('What’s the evidence?')
  })

  it('DISCRIMINATOR B — the leader whose value is CONFIRMED gets the deliberate silence, not a chip', () => {
    // There is nothing to confirm, so the resolver's `null` must survive.
    // Without the `isInferred` conjunct this arm would invent a question here.
    expect(factor({ isInferred: false })).toBeNull()
  })

  it('⭐ a WITHHELD readout collapses to the generic chip — the licence is not re-decided here', () => {
    // The caller passes `leadsInfluence: false` whenever `influenceRankReadout`
    // returns null (ties, rank > MAX_BADGED_RANK, stale results). This pins
    // that a withheld licence degrades gracefully rather than going silent.
    const chips = factor({ leadsInfluence: false, influencePhrase: undefined })
    expect(chips).not.toBeNull()
    expect(chips![0].id).toBe('factor_evidence_supports')
  })

  it('⭐ the message still reads if the phrase is absent, so a missing licence cannot emit a dangling sentence', () => {
    const chips = factor({ influencePhrase: undefined })
    expect(chips![0].id).toBe('factor_confirm_top_influence')
    expect(chips![0].message).toBe(
      "Engineering Capacity's value is still an unconfirmed estimate. What would it take to confirm it?",
    )
    expect(chips![0].message).not.toContain('—')
  })

  /** PRECEDENCE — the new arm is bounded to ONE pre-existing branch. */
  it('does NOT displace the no-value chip', () => {
    expect(factor({ needsInput: true })![0].id).toBe('factor_help_estimate')
  })

  it('does NOT displace the external-factor chip', () => {
    expect(factor({ isExternalCategory: true })![0].id).toBe('factor_what_if_changes')
  })
})

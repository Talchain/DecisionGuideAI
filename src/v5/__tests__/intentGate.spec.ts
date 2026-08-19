/**
 * Intent send-gate — the two-signal discipline (published AND CEE-accepted),
 * mirroring the action_type gate. Publication alone (or acceptance alone) must
 * never open the gate; the accept registry is the SECOND, independent signal.
 */
import { describe, it, expect } from 'vitest'
import { Intent } from '@talchain/schemas/boundary'
import {
  KNOWN_INTENTS,
  CEE_ACCEPTED_INTENTS,
  isSendableToken,
} from '../buildPayload'

describe('intent wire allowlist — schema parity (derive-don\'t-mirror)', () => {
  it('KNOWN_INTENTS equals the @talchain/schemas Intent enum EXACTLY (drift = red)', () => {
    expect(new Set(KNOWN_INTENTS)).toEqual(new Set(Intent.options))
  })

  it('every CEE-accepted intent is published in the vendored enum (no inert entries)', () => {
    for (const v of CEE_ACCEPTED_INTENTS) {
      expect(KNOWN_INTENTS.has(v)).toBe(true)
    }
  })

  /**
   * ⭐ THE ACCEPTED SET IS THE UI HALF OF A TWO-REPO GATE, so it is pinned by
   * EXACT IDENTITY rather than by spot checks. CEE's arm routes exactly
   * `ROUTED_COACHING_INTENTS` (`orchestrator-v5/coaching/typed-intent-directive.ts`)
   * plus the pre-existing `add_option` rail; widening either half alone
   * re-creates the silent-drop bug the gate exists to prevent — in one
   * direction the chip degrades to prose, in the other CEE is told it routes
   * something it does not.
   *
   * `toEqual` on the whole set, not `.has()` per member: a `.has()` list cannot
   * see an entry that should NOT be there, which is the failure mode with a
   * cross-repo cost.
   */
  it('the accepted set is EXACTLY add_option plus the four CEE routes', () => {
    expect(new Set(CEE_ACCEPTED_INTENTS)).toEqual(
      new Set(['add_option', 'challenge_frame', 'define_success', 'elicit_options', 'challenge_assumption']),
    )
  })

  it('the intents CEE does NOT route are still withheld — the gate has not been opened wholesale', () => {
    // Paired with the assertion above: that one alone is satisfied by a build
    // that accepts everything AND happens to list these five. These four are
    // published `Intent` members with mounted sparks and no CEE arm; a build
    // that accepted them would send an intent the service cannot serve.
    for (const withheld of ['outside_view', 'pre_mortem', 'elicit_risks', 'discuss'] as const) {
      expect(KNOWN_INTENTS.has(withheld), `${withheld} must be published`).toBe(true)
      expect(CEE_ACCEPTED_INTENTS.has(withheld), `${withheld} must be withheld`).toBe(false)
    }
  })
})

describe('isSendableToken — the AND actually bites', () => {
  const published = new Set(['add_option', 'elicit_options'])
  const accepted = new Set(['add_option'])

  it('sends only when BOTH signals hold', () => {
    expect(isSendableToken('add_option', published, accepted)).toBe(true)
  })

  it('publication ALONE does not open the gate', () => {
    // elicit_options is published but not accepted → withheld.
    expect(isSendableToken('elicit_options', published, accepted)).toBe(false)
  })

  it('acceptance ALONE (unpublished) does not open the gate', () => {
    const acceptedOnly = new Set(['ghost_intent'])
    expect(isSendableToken('ghost_intent', new Set<string>(), acceptedOnly)).toBe(false)
  })

  it('an unknown value is never sendable', () => {
    expect(isSendableToken('nonsense', published, accepted)).toBe(false)
  })
})

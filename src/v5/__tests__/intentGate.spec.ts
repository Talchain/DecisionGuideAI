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

  it('add_option is the currently-accepted intent; coaching intents are withheld', () => {
    expect(CEE_ACCEPTED_INTENTS.has('add_option')).toBe(true)
    // The coaching/elicitation arm is not confirmed deployed — withheld until
    // the registry-stamping lane adds them with deploy provenance.
    expect(CEE_ACCEPTED_INTENTS.has('challenge_frame')).toBe(false)
    expect(CEE_ACCEPTED_INTENTS.has('elicit_options')).toBe(false)
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

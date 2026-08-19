/**
 * Intent send-gate — the two-signal discipline (published AND CEE-accepted),
 * mirroring the action_type gate. Publication alone (or acceptance alone) must
 * never open the gate; the accept registry is the SECOND, independent signal.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Intent } from '@talchain/schemas/boundary'
import {
  KNOWN_INTENTS,
  CEE_ACCEPTED_INTENTS,
  isSendableToken,
  buildV5Payload,
  type BuildV5PayloadInput,
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

/**
 * ⭐ THE WITHHOLD IS OBSERVABLE IN DEV — the silence is what made the original
 * defect invisible.
 *
 * A declared intent that fails the gate is dropped and the `intent` key is
 * simply absent from the payload. That is the CORRECT behaviour and these tests
 * re-assert it. What they add is that the drop is no longer SECRET: in a dev
 * build nothing distinguished "no intent declared" from "intent declared and
 * withheld", so four mounted affordances degraded to anonymous prose for weeks
 * with every signal reading healthy.
 *
 * Assertions bind to the EXACT intent string, not to a loose "warn was called"
 * predicate — a warning about some other token would satisfy the loose form.
 */
describe('withheld intents are visible in DEV — the drop is not silent', () => {
  const TURN_ID = '33333333-3333-4333-8333-333333333333'
  const SCENARIO_ID = '44444444-4444-4444-8444-444444444444'

  /** A published Intent that CEE does NOT route. */
  const WITHHELD_INTENT = 'pre_mortem'
  /** A published Intent that CEE DOES route. */
  const ACCEPTED_INTENT = 'challenge_frame'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function payloadForIntent(intent: string) {
    const input: BuildV5PayloadInput = {
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'analyse',
      turnClass: 'frame',
      mode: 'user',
      message: 'typed chip click',
      source: 'chip',
      chipMeta: { id: 'spark-under-test', intent },
    }
    const build = buildV5Payload(input)
    if (!build.ok) throw new Error('payload build failed: ' + JSON.stringify(build))
    return build.payload as { chip?: { id?: string; intent?: string } }
  }

  /**
   * PRECONDITION PIN (trap 13b): the warning is DEV-gated, so a suite running
   * with DEV false would pass every assertion below by never exercising the
   * branch at all. Assert the gate condition itself so a non-DEV run REDs here
   * instead of silently certifying nothing.
   */
  it('the suite runs in DEV, so the DEV-gated branch is actually reachable', () => {
    expect(import.meta.env.DEV).toBe(true)
  })

  /**
   * PRECONDITION PIN: prove this fixture is withheld BY THE GATE — published in
   * the vendored enum but absent from the acceptance registry. Without this the
   * test would still pass if `pre_mortem` were simply an unknown token, and it
   * would stop discriminating the moment CEE started routing it.
   */
  it('warns, naming the exact withheld intent, when a published-but-unrouted intent is declared', () => {
    expect(KNOWN_INTENTS.has(WITHHELD_INTENT as never)).toBe(true)
    expect(CEE_ACCEPTED_INTENTS.has(WITHHELD_INTENT as never)).toBe(false)

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const payload = payloadForIntent(WITHHELD_INTENT)

    // Behaviour is UNCHANGED: the key is still omitted, identity still travels.
    expect(payload.chip && 'intent' in payload.chip).toBe(false)
    expect(payload.chip?.id).toBe('spark-under-test')

    // ...but the drop is now visible, and named.
    expect(spy).toHaveBeenCalledTimes(1)
    const message = String(spy.mock.calls[0]?.[0] ?? '')
    expect(message).toContain(WITHHELD_INTENT)
    expect(message).toContain('CEE_ACCEPTED_INTENTS')
    spy.mockRestore()
  })

  /**
   * ⭐ THE CONTRAST. Without this, the assertion above is satisfied by a build
   * that warns on EVERY turn — which would spam the console and teach every
   * developer to ignore it, i.e. the broken-alarm failure one level up.
   */
  it('does NOT warn for an ACCEPTED intent — the warning is specific to a withhold', () => {
    expect(CEE_ACCEPTED_INTENTS.has(ACCEPTED_INTENT as never)).toBe(true)

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const payload = payloadForIntent(ACCEPTED_INTENT)

    expect(payload.chip?.intent).toBe(ACCEPTED_INTENT)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  /**
   * ⭐ THE OTHER CONTRAST, and the one that stops this becoming console spam:
   * the ordinary chip carries NO intent at all. That path must stay silent, or
   * the warning fires on essentially every turn in the product.
   */
  it('does NOT warn when no intent is declared — the ordinary no-intent turn stays silent', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const input: BuildV5PayloadInput = {
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'analyse',
      turnClass: 'frame',
      mode: 'user',
      message: 'plain chip click',
      source: 'chip',
      chipMeta: { id: 'spark-without-intent' },
    }
    const build = buildV5Payload(input)
    if (!build.ok) throw new Error('payload build failed: ' + JSON.stringify(build))
    const payload = build.payload as { chip?: { id?: string; intent?: string } }

    expect(payload.chip && 'intent' in payload.chip).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

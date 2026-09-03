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
import { ACTIONS_MENU } from '../../canvas/components/pre-analysis-v3/constants'

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
  it('the accepted set is EXACTLY add_option plus the seven CEE routes', () => {
    // ⭐⭐ HAND-AUTHORED COMPLETENESS PIN — DELIBERATELY NOT DERIVED, and this
    // comment is the reason.
    //
    // A test that iterated a list of routed intents could not have caught the
    // defect this lane exists to close. Before it, `outside_view`, `pre_mortem`
    // and `elicit_risks` were UNROUTED and every derived `it.each` over the
    // routed set passed — the loop simply iterated a SHORTER ARRAY. Derivation
    // proves the copies AGREE; it can never prove the list is COMPLETE, because
    // a missing entry removes the very case that would have failed.
    //
    // So this is written out by hand, as an EXACT set. It REDs if the set grows
    // (a UI half claiming a route CEE does not serve) AND if it shrinks (a
    // silently switched-off capability). `toEqual` on the whole set, never
    // `.has()` per member: a `.has()` list is structurally blind to an entry
    // that should NOT be there, which is the direction with a cross-repo cost.
    //
    // Provenance: `ROUTED_COACHING_INTENTS` at CEE `staging` `f4c8f501`, read
    // from `src/orchestrator-v5/coaching/typed-intent-directive.ts:212` in a
    // fresh clone checked out at that SHA on 2026-09-03, is exactly the seven
    // below, plus the independent `add_option` rail. That SHA is DEPLOYED
    // (`cee-staging.onrender.com/healthz` → `build: "f4c8f50"`), which is what
    // makes this list a claim about the running service rather than about a
    // branch. Earlier revisions cited `2b9b95d7` and `266b1d4f`, both heads of
    // the now-merged PR #1321; membership is identical across all three, but
    // cite the deployed authority, not a closed PR branch.
    expect(new Set(CEE_ACCEPTED_INTENTS)).toEqual(
      new Set([
        'add_option',
        'challenge_frame',
        'define_success',
        'elicit_options',
        'challenge_assumption',
        'outside_view',
        'pre_mortem',
        'elicit_risks',
      ]),
    )
  })

  it('the intents CEE does NOT route are still withheld — the gate has not been opened wholesale', () => {
    // Paired with the assertion above: that one alone is satisfied by a build
    // that accepts everything AND happens to list these eight. These three are
    // published `Intent` members with no CEE arm; a build that accepted them
    // would send an intent the service cannot serve.
    for (const withheld of ['estimate_help', 'mitigation_help', 'discuss'] as const) {
      expect(KNOWN_INTENTS.has(withheld), `${withheld} must be published`).toBe(true)
      expect(CEE_ACCEPTED_INTENTS.has(withheld), `${withheld} must be withheld`).toBe(false)
    }
  })

  /**
   * ⭐⭐ `estimate_help` IS NOT AN ORDINARY "AWAITING CEE" WITHHOLD, and
   * collapsing it into that class is the mistake this test exists to stop.
   *
   * Its spark (`calibrate_estimates`, "Check estimates") carries BOTH a typed
   * intent AND `action_type: 'analysis_readiness'`. That action_type IS live and
   * IS accepted — it fires a DETERMINISTIC pre-route in CEE that claims the turn
   * and skips the LLM entirely. The typed coaching arm runs AT the LLM call, so
   * a routed `estimate_help` directive would be built and then never reached:
   * wired-looking and dead, with nothing red anywhere. CEE #1321 excludes it for
   * exactly this reason, and `turn-executor.ts` pins the matching invariant that
   * no affordance carries both authorities.
   *
   * The failure message carries the WHY, because the tempting fix when this REDs
   * is to add the missing member — which is precisely the wrong move.
   */
  it('estimate_help stays UN-sendable even though its spark is mounted and its action_type is live', () => {
    // Precondition: this is a real gate decision, not an unpublished token
    // failing the other conjunct.
    expect(
      KNOWN_INTENTS.has('estimate_help' as never),
      'estimate_help must be PUBLISHED, or this test proves nothing about the acceptance half',
    ).toBe(true)

    expect(
      CEE_ACCEPTED_INTENTS.has('estimate_help' as never),
      'estimate_help has been added to CEE_ACCEPTED_INTENTS. Do NOT "fix" this by ' +
        'keeping it: its spark `calibrate_estimates` also carries ' +
        "action_type: 'analysis_readiness', a deterministic pre-route that claims the " +
        'turn and skips the LLM — so the coaching directive would be built and never ' +
        'reached. Two authorities on one affordance. Routing it requires deciding WHICH ' +
        'authority owns the turn (see CEE turn-executor.ts, "no affordance carries both"), ' +
        'not a registry edit. Revert the addition.',
    ).toBe(false)

    // ⭐ BOUND BY IDENTITY TO THE REAL MOUNTED AFFORDANCE, not to hand-typed
    // strings. The spark is looked up from the shipped registry by its exact
    // id, so if `calibrate_estimates` ever stops declaring BOTH authorities
    // this test REDs here rather than continuing to assert a fixture that no
    // longer describes anything a user can click.
    const spark = ACTIONS_MENU.find(s => s.id === 'calibrate_estimates')
    expect(spark, 'the calibrate_estimates spark is not mounted — this guard has no subject').toBeDefined()
    expect(
      spark?.intent,
      'calibrate_estimates no longer declares estimate_help — re-point this guard',
    ).toBe('estimate_help')
    expect(
      spark?.action_type,
      'calibrate_estimates no longer carries the analysis_readiness pre-route, which is the ' +
        'ENTIRE reason its intent is withheld — re-adjudicate before changing the registry',
    ).toBe('analysis_readiness')

    // The behavioural half: prove the gate actually drops it on the wire, not
    // merely that the set omits it. A registry assertion alone would not notice
    // a second, bypassing send path.
    const build = buildV5Payload({
      turnId: '55555555-5555-4555-8555-555555555555',
      scenarioId: '66666666-6666-4666-8666-666666666666',
      stage: 'analyse',
      turnClass: 'frame',
      mode: 'user',
      message: spark?.prompt ?? '',
      source: 'chip',
      chipMeta: {
        id: spark?.id,
        intent: spark?.intent ?? undefined,
        action_type: spark?.action_type ?? undefined,
      },
    })
    if (!build.ok) throw new Error('payload build failed: ' + JSON.stringify(build))
    const payload = build.payload as {
      chip?: { id?: string; intent?: string; action_type?: string }
    }

    expect(
      payload.chip && 'intent' in payload.chip,
      'estimate_help reached the wire — the readiness pre-route would claim this turn and ' +
        'the coaching directive would never fire',
    ).toBe(false)
    // The spark is NOT disabled by this: its identity and its live action_type
    // still travel, so "Check estimates" behaves exactly as it does today.
    expect(payload.chip?.id).toBe('calibrate_estimates')
    expect(payload.chip?.action_type).toBe('analysis_readiness')
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

  /**
   * A published Intent that CEE does NOT route.
   *
   * ⚠ This fixture has now moved TWICE (`challenge_frame` → `pre_mortem` →
   * `mitigation_help`), each time because the intent it named became routed.
   * That is a decay pattern, not a coincidence: the withhold arm silently stops
   * discriminating the moment its subject is accepted. The precondition pin
   * below is what turns that decay into a RED instead of a tautology — keep it.
   */
  const WITHHELD_INTENT = 'mitigation_help'
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
   * test would still pass if `mitigation_help` were simply an unknown token,
   * and it would stop discriminating the moment CEE started routing it.
   *
   * ⚠ Name the CURRENT fixture here, never the one it replaced. This sentence
   * said `pre_mortem` — the token the very PR that moved the fixture made
   * ACCEPTED — so the comment warning about decay had itself decayed, and cited
   * as its example of a token that "would stop discriminating" the one that
   * just had. When `WITHHELD_INTENT` moves again, move this name with it.
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

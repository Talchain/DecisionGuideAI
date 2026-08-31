/**
 * A technique chip that names a method and never asks CEE to RUN it.
 *
 * ⭐⭐ WHAT WAS MISSING. CEE turns an accepted intent on a CHIP turn into
 * decision science: it resolves a DSK protocol for the intent
 * (`resolveApplicableProtocol`) and builds a coaching-method directive from it
 * (`buildCoachingMethodDirective`). Without an intent, `resolveCoachingIntent`
 * returns undefined and the turn is an ordinary chat that happens to open with
 * a good prompt.
 *
 * `AskOlumiPayload` had no `intent` field at all. So the product could name a
 * technique, prefill its prompt, carry `method_id` in chip metadata — and still
 * never ask CEE to apply that method. The science was in the text and nowhere
 * else.
 *
 * ⚠ THE MAP IS DELIBERATELY SHORT. A technique is mapped only where an accepted
 * intent names the SAME move. Three of seven qualify. Mapping by rough
 * resemblance would ask CEE to run the wrong protocol under a science label,
 * which is the fabrication this catalogue exists to refuse.
 */
import { describe, expect, it } from 'vitest'
import { METHOD_CATALOGUE } from '../actionsCatalogue'
import { CEE_ACCEPTED_INTENTS } from '../../../../v5/buildPayload'

const byId = (id: string) => {
  const m = METHOD_CATALOGUE.find((x) => x.id === id)
  expect(m, `technique '${id}' must exist in the catalogue`).toBeDefined()
  return m!
}

describe('a technique carries the CEE intent that names the same move', () => {
  it('reframing the problem IS challenging the frame', () => {
    expect(byId('reframe_problem').intent).toBe('challenge_frame')
  })

  it('generating a materially different option IS option elicitation', () => {
    expect(byId('different_option').intent).toBe('elicit_options')
  })

  it('considering the opposite IS challenging an assumption', () => {
    expect(byId('consider_opposite').intent).toBe('challenge_assumption')
  })
})

/**
 * ⭐⭐ THE DRIFT GUARD, AND IT IS THE POINT OF THIS FILE.
 *
 * The gate that decides whether an intent reaches the wire is
 * `KNOWN_INTENTS ∧ CEE_ACCEPTED_INTENTS`, and it FAILS CLOSED. So a technique
 * mapped to an intent CEE does not route is not an error — it is SILENCE. The
 * chip would look identical, dispatch identically, and simply never invoke the
 * method, with nothing red anywhere.
 *
 * This asserts every mapped intent against the REAL exported set rather than a
 * copy of it, so removing a member from `CEE_ACCEPTED_INTENTS` turns this red
 * instead of quietly switching a technique off. Derived, never mirrored.
 */
describe('every mapped intent is one CEE actually routes', () => {
  it('no technique maps to an intent the wire gate would withhold', () => {
    const mapped = METHOD_CATALOGUE.filter((m) => m.intent)
    expect(mapped.length, 'at least one technique must be mapped').toBeGreaterThan(0)
    for (const m of mapped) {
      expect(
        CEE_ACCEPTED_INTENTS.has(m.intent as never),
        `technique '${m.id}' maps to '${m.intent}', which CEE_ACCEPTED_INTENTS does not contain — the chip would silently stop invoking the method`,
      ).toBe(true)
    }
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. Without it the guard above could pass by
   * mapping EVERYTHING, which would be the rough-resemblance fabrication the
   * restraint rule forbids. Absence must stay the common case.
   */
  it('leaves a technique unmapped when no accepted intent names its move', () => {
    // Withheld by CEE today (see the note on CEE_ACCEPTED_INTENTS), so a
    // mapping would be silence dressed as science.
    expect(byId('pre_mortem').intent).toBeUndefined()
    expect(byId('outside_view').intent).toBeUndefined()
    // No accepted intent means "review this reasoning for bias".
    expect(byId('review_bias').intent).toBeUndefined()
    expect(byId('explore_tradeoffs').intent).toBeUndefined()

    const unmapped = METHOD_CATALOGUE.filter((m) => !m.intent)
    expect(unmapped.length, 'most techniques are correctly unmapped').toBeGreaterThan(2)
  })
})


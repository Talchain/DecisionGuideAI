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
 * intent names the SAME move. Mapping by rough resemblance would ask CEE to run
 * the wrong protocol under a science label, which is the fabrication this
 * catalogue exists to refuse.
 *
 * ⚠ NO COUNT IS QUOTED HERE, DELIBERATELY, AND ONE USED TO BE. This line read
 * "Three of seven qualify" and went stale the moment a fourth technique was
 * mapped — a hand-maintained mirror inside the file whose own drift guard exists
 * to abolish them (CLAUDE.md trap 12). The membership is derived below from
 * `METHOD_CATALOGUE` itself; read that, never a number in this comment.
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

  /**
   * ⭐⭐ THE REASONING TAB ALREADY ATTACHES THIS TECHNIQUE TO TWO TRIGGERS, AND
   * THAT IS WHAT SETTLES THE QUESTION THE TWIN BELOW LEFT OPEN.
   *
   * The twin's comment held `pre_mortem` unmapped on the grounds that these are
   * "DECISION-OVERVIEW techniques — a different surface from the pre-analysis
   * sparks", and that whether a click here means the same move "has not been
   * adjudicated". That reasoning was sound for the surface it was written about
   * and INCOMPLETE about this catalogue, because `METHOD_CATALOGUE` has a SECOND
   * consumer the comment does not account for: `recommendationMethod.ts`, on the
   * Reasoning tab (`WORKSPACE_SURFACES.analysisNew.label === 'Reasoning'`).
   *
   * That consumer does not merely list the technique — it ATTACHES it to two
   * findings, each with its own written justification:
   *   · `recommendationMethod.ts:54`  `['strengthen:robustness', 'pre_mortem']`
   *   · `recommendationMethod.ts:97`  `['PRE_MORTEM', 'pre_mortem']` — the
   *     producer's OWN signal code, i.e. upstream already named this move.
   *
   * So the adjudication the twin was waiting for has in effect already happened,
   * in the module whose header says a row is "a PRODUCT CLAIM, not a
   * convenience". This is not rough resemblance: the catalogue's description
   * ("imagine failure and capture plausible causes") and the producer's
   * `PRE_MORTEM` card are the same move under the same name.
   *
   * `StrengthenTheReasoning.tsx:799` already forwards `method.intent` verbatim,
   * so the whole dispatch chain was wired and waiting on this one field. Without
   * it the chip reading "Run a pre-mortem" named the technique, prefilled its
   * prompt, carried `method_id` — and asked CEE for ordinary chat.
   */
  it('running a pre-mortem IS the pre_mortem intent', () => {
    expect(byId('pre_mortem').intent).toBe('pre_mortem')
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
    // No accepted intent means "review this reasoning for bias", nor
    // "explore the trade-offs" — these are the honest unmapped cases and they
    // carry this assertion's weight.
    expect(byId('review_bias').intent).toBeUndefined()
    expect(byId('explore_tradeoffs').intent).toBeUndefined()

    // ⚠ `outside_view` IS UNMAPPED FOR A DIFFERENT REASON AND THE TWO MUST NOT
    // BE COLLAPSED. It is NOT "withheld by CEE": `outside_view` IS routed
    // (`ROUTED_COACHING_INTENTS`, CEE `8449e54e`) and IS in
    // `CEE_ACCEPTED_INTENTS`, which is why the guard above would pass for it.
    //
    // It stays unmapped on a MEASURED scope ground. This catalogue feeds two
    // surfaces, and `outside_view` reaches only ONE of them: it has zero
    // consumers under `analysisNew/` (the Reasoning tab) — measured with a
    // `pre_mortem` contrast control in the same sweep, 0 hits against 8, so the
    // absence is real and not instrument blindness. Its only surface is
    // `ActionsMenu` on the Analysis tab, which is out of scope under Paul's
    // standing Reasoning+Model ruling. Whether a menu click there means the same
    // move as a pre-analysis spark is still unadjudicated, and mapping it on the
    // strength of a matching NAME would be the rough-resemblance pattern the
    // restraint rule forbids.
    //
    // ⭐ `pre_mortem` is deliberately ABSENT from this list now, and the
    // assertion above replaces it: the Reasoning tab ATTACHES that technique to
    // two triggers, so the surface-equivalence question the boundary was holding
    // does not arise there. Do not re-add it here without first checking
    // `recommendationMethod.ts` for a trigger.
    expect(byId('outside_view').intent).toBeUndefined()

    const unmapped = METHOD_CATALOGUE.filter((m) => !m.intent)
    expect(unmapped.length, 'most techniques are correctly unmapped').toBeGreaterThan(2)
  })
})


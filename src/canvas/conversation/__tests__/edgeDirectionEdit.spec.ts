/**
 * `buildEdgeDirectionEditEvent` — "this link helps rather than hurts", as a wire
 * event, carried by the DEPLOYED `edge_strength_edit` member's own
 * `direction_intent` field.
 *
 * ⭐ EVERY ASSERTION BINDS BY IDENTITY, NEVER BY A VALUE PREDICATE ANOTHER
 * OBJECT COULD SATISFY (CLAUDE.md trap 19): the event is checked field-by-field
 * against an exact literal, and each refusal case starts from the SAME fixture
 * and changes exactly one thing, so a refusal cannot be produced by two rules at
 * once and credited to either.
 *
 * ⭐⭐ THE LOAD-BEARING CASE IS `magnitude === 0`, and it is the reason this
 * builder takes an explicit direction rather than a signed number. `-0 >= 0` is
 * `true` in JavaScript, so a direction routed through the sign of a mean is
 * SILENTLY INVERTED on exactly the edges where direction is the only thing left
 * to state. That test is written first below and is the one to break when
 * checking this suite bites.
 */
import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'

import {
  buildEdgeDirectionEditEvent,
  edgeDirectionEditIsAssertable,
} from '../edgeStrengthEdit'

/**
 * An edge whose strength AND direction both come from a named producer source,
 * so both halves of `expected` are assertable. `strength_mean` is CEE's
 * pre-signed strength and `effect_direction` the raw CEE direction spelling —
 * both producer-only, so their presence PROVES a server-stated value rather
 * than a canvas default.
 *
 * ⚠ THIS FIXTURE PINS ITS OWN PRECONDITION (trap 13b). Every "the event is
 * built" case would also pass against an edge the resolver refuses — by
 * building `null` for the wrong reason — so the happy path asserts the FULL
 * event and `assertable` is checked explicitly below.
 */
function producerEdge(overrides: Record<string, unknown> = {}): Edge {
  return {
    id: 'e1',
    source: 'fac_price',
    target: 'goal_revenue',
    data: {
      strength_mean: 0.4,
      weight: 0.4,
      effect_direction: 'positive',
      direction: 'positive',
      ...overrides,
    },
  } as unknown as Edge
}

describe('buildEdgeDirectionEditEvent', () => {
  it('states a NEGATIVE direction at ZERO magnitude — the sign of a mean cannot carry this', () => {
    // ⭐⭐ THE DISCRIMINATING CASE. The server holds a zero-magnitude edge, so
    // there is no sign for a signed encoding to carry: `-0 >= 0` is `true` and
    // any `requestedMean`-derived direction reads `'positive'` here. The user
    // chose `negative`; the wire must say `negative`.
    const event = buildEdgeDirectionEditEvent({
      edge: producerEdge({ strength_mean: 0, weight: 0, effect_direction: 'positive', direction: 'positive' }),
      direction: 'negative',
    })
    expect(event).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0,
        direction_intent: 'negative',
        expected: { mean: 0, effect_direction: 'positive' },
        intent: 'set',
      },
    })
  })

  it('builds the full wire event for a positive→negative flip, magnitude untouched', () => {
    const event = buildEdgeDirectionEditEvent({
      edge: producerEdge(),
      direction: 'negative',
    })
    expect(event).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0.4,
        direction_intent: 'negative',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
  })

  it('flips negative→positive and sends the ABSOLUTE server magnitude, never the signed one', () => {
    // `magnitude: z.number().finite().min(0).max(1)` — a negative magnitude is
    // a 422 for the WHOLE turn, so `Math.abs` here is contract compliance, not
    // tidiness.
    const event = buildEdgeDirectionEditEvent({
      edge: producerEdge({ strength_mean: -0.6, weight: 0.6, effect_direction: 'negative', direction: 'negative' }),
      direction: 'positive',
    })
    expect(event?.payload).toEqual({
      from: 'fac_price',
      to: 'goal_revenue',
      magnitude: 0.6,
      direction_intent: 'positive',
      expected: { mean: -0.6, effect_direction: 'negative' },
      intent: 'set',
    })
  })

  it('takes the magnitude from the SERVER-stated tuple, not from the canvas `weight`', () => {
    // ⭐ The canvas may hold a locally-edited `weight` the server has never
    // seen. CEE compares `expected` with a bare `!==` and answers
    // `edge_expected_tuple_mismatch` on any disagreement, so sending the local
    // number would manufacture a phantom concurrent edit. `0.9` must not appear.
    const event = buildEdgeDirectionEditEvent({
      edge: producerEdge({ strength_mean: 0.4, weight: 0.9 }),
      direction: 'negative',
    })
    expect(event?.payload).toMatchObject({ magnitude: 0.4, expected: { mean: 0.4 } })
  })

  // ── The refusals. Each changes exactly ONE thing from `producerEdge()`. ────

  it('REFUSES an edge with no server-stated tuple — `expected` must not assert a UI default', () => {
    // `DEFAULT_EDGE_DATA.weight = 0.5` with no producer-only raw field and no
    // recorded `serverStrength`: nothing proves what the server holds.
    const edge = {
      id: 'e1',
      source: 'fac_price',
      target: 'goal_revenue',
      data: { weight: 0.5, direction: 'positive' },
    } as unknown as Edge
    expect(buildEdgeDirectionEditEvent({ edge, direction: 'negative' })).toBeNull()
  })

  it('REFUSES a delimiter-bearing composite endpoint id', () => {
    const edge = producerEdge()
    ;(edge as { source: string }).source = 'fac_price→goal_revenue'
    expect(buildEdgeDirectionEditEvent({ edge, direction: 'negative' })).toBeNull()
  })
})

describe('edgeDirectionEditIsAssertable', () => {
  it('is TRUE for an edge carrying a server-stated tuple', () => {
    expect(edgeDirectionEditIsAssertable(producerEdge())).toBe(true)
  })

  // The title used to end "— the affordance must render disabled (design §2 F6)".
  // The ASSERTION was and is correct; the TITLE asserted a rendering nothing
  // performs, because this predicate has no product consumer yet (see
  // `contracts.ts` §1). Corrected 10 Sep 2026 to describe the predicate, which
  // is what the case actually pins. Restore the rendering clause when a surface
  // asks this gate.
  it('is FALSE for a defaulted edge — no server-stated tuple to assert (design §2 F6)', () => {
    const edge = {
      id: 'e1',
      source: 'fac_price',
      target: 'goal_revenue',
      data: { weight: 0.5, direction: 'positive' },
    } as unknown as Edge
    expect(edgeDirectionEditIsAssertable(edge)).toBe(false)
  })

  it('is FALSE for a missing edge', () => {
    expect(edgeDirectionEditIsAssertable(undefined)).toBe(false)
    expect(edgeDirectionEditIsAssertable(null)).toBe(false)
  })

  /**
   * ⚠ THE PROBE'S OWN PRECONDITION, pinned so this gate cannot decay into a
   * tautology (trap 13b). The probe passes `direction: 'positive'`; if the
   * builder ever started refusing on the direction argument the gate would read
   * `false` everywhere and still "pass" its other cases. Both members must be
   * buildable on the same assertable edge.
   */
  it('answers about the EDGE, not about the direction argument', () => {
    expect(buildEdgeDirectionEditEvent({ edge: producerEdge(), direction: 'positive' })).not.toBeNull()
    expect(buildEdgeDirectionEditEvent({ edge: producerEdge(), direction: 'negative' })).not.toBeNull()
  })
})

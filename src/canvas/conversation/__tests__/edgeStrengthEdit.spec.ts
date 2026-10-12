/**
 * `buildEdgeStrengthEditEvent` — the edge-strength slider's wire event.
 *
 * ⭐ EVERY ASSERTION BINDS BY IDENTITY, NEVER BY A VALUE PREDICATE ANOTHER
 * OBJECT COULD SATISFY (CLAUDE.md trap 19). The event is checked field-by-field
 * against the exact literal expected, and the refusal cases each name the ONE
 * rule they are exercising — a refusal that could be produced by two different
 * rules proves nothing about either.
 */
import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'

import { buildEdgeStrengthEditEvent } from '../edgeStrengthEdit'

/**
 * An edge whose strength AND direction both come from a named source, so both
 * halves of `expected` are assertable. `strength_mean` is CEE's pre-signed
 * strength (producer-only, so it PROVES a producer value) and
 * `effect_direction` is the raw CEE direction spelling (likewise).
 *
 * ⚠ THIS FIXTURE PINS ITS OWN PRECONDITION. Every "the event is built" case
 * below would also pass against an edge the resolvers refuse — by building
 * `null` for the wrong reason — so the happy path asserts the FULL event, and
 * each refusal case starts from THIS fixture and changes exactly one thing.
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

describe('buildEdgeStrengthEditEvent', () => {
  it('builds the full wire event for a signed edit on a producer-valued edge', () => {
    const event = buildEdgeStrengthEditEvent({
      edge: producerEdge(),
      requestedMean: 0.75,
    })
    expect(event).toEqual({
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_price',
        to: 'goal_revenue',
        magnitude: 0.75,
        direction_intent: 'positive',
        expected: { mean: 0.4, effect_direction: 'positive' },
        intent: 'set',
      },
    })
  })

  it('a NEGATIVE signed edit states a negative direction_intent and sends the ABSOLUTE magnitude', () => {
    const event = buildEdgeStrengthEditEvent({
      edge: producerEdge({ strength_mean: -0.6, weight: 0.6, effect_direction: 'negative', direction: 'negative' }),
      requestedMean: -0.9,
    })
    expect(event?.payload).toEqual({
      from: 'fac_price',
      to: 'goal_revenue',
      magnitude: 0.9,
      direction_intent: 'negative',
      expected: { mean: -0.6, effect_direction: 'negative' },
      intent: 'set',
    })
  })

  it('preserveDirection states `preserve` and NEVER re-derives a sign from the magnitude', () => {
    // The proven regression this guards: `-0 >= 0` is `true`, so a magnitude-only
    // edit on a NEGATIVE edge must not come out as `direction_intent: 'positive'`.
    const event = buildEdgeStrengthEditEvent({
      edge: producerEdge({ strength_mean: -0.6, weight: 0.6, effect_direction: 'negative', direction: 'negative' }),
      requestedMean: 0,
      preserveDirection: true,
    })
    expect(event?.payload).toEqual({
      from: 'fac_price',
      to: 'goal_revenue',
      magnitude: 0,
      direction_intent: 'preserve',
      expected: { mean: -0.6, effect_direction: 'negative' },
      intent: 'set',
    })
  })

  // ── The refusals. Each changes exactly ONE thing from `producerEdge()`. ────

  it('REFUSES a DEFAULTED weight — `expected` must never assert a UI fabrication', () => {
    // `DEFAULT_EDGE_DATA.weight = 0.5` with no source stamp and no
    // producer-only raw field. `resolveEdgeSignedStrengthDisplay` answers
    // `show: false`, so we do not know what the server holds.
    const edge = {
      id: 'e1',
      source: 'fac_price',
      target: 'goal_revenue',
      data: { weight: 0.5, direction: 'positive' },
    } as unknown as Edge
    expect(buildEdgeStrengthEditEvent({ edge, requestedMean: 0.75 })).toBeNull()
  })

  it('REFUSES a DEFAULTED direction even when the weight is producer-sourced', () => {
    // Weight is assertable (`strength_mean` present); `direction` is the
    // fall-through `'positive'` with no stamp and no `effect_direction`.
    const edge = {
      id: 'e1',
      source: 'fac_price',
      target: 'goal_revenue',
      data: { strength_mean: 0.4, weight: 0.4, direction: 'positive' },
    } as unknown as Edge
    expect(buildEdgeStrengthEditEvent({ edge, requestedMean: 0.75 })).toBeNull()
  })

  it("REFUSES a producer's explicit `effect_direction: 'unknown'`", () => {
    const edge = producerEdge({ effect_direction: 'unknown' })
    expect(buildEdgeStrengthEditEvent({ edge, requestedMean: 0.75 })).toBeNull()
  })

  it('REFUSES a magnitude above 1 rather than CLAMPING it', () => {
    // The Model tab weight chip accepts 0–2; the wire is `[0, 1]`. A clamp
    // would send 1 and CEE would persist it as the user's stated number.
    expect(
      buildEdgeStrengthEditEvent({ edge: producerEdge(), requestedMean: 1.5, preserveDirection: true }),
    ).toBeNull()
  })

  it('ACCEPTS exactly 1 — the boundary is inclusive, as the contract states', () => {
    const event = buildEdgeStrengthEditEvent({
      edge: producerEdge(),
      requestedMean: 1,
      preserveDirection: true,
    })
    expect(event?.payload).toMatchObject({ magnitude: 1 })
  })

  it('REFUSES a non-finite requested mean', () => {
    expect(buildEdgeStrengthEditEvent({ edge: producerEdge(), requestedMean: NaN })).toBeNull()
    expect(buildEdgeStrengthEditEvent({ edge: producerEdge(), requestedMean: Infinity })).toBeNull()
  })

  it('REFUSES an `expected` whose non-zero mean DISAGREES with its direction', () => {
    // Reachable: a producer-signed negative mean beside a user-stamped positive
    // direction. The contract's own `refineEdgeStrengthEdit` would 422 this.
    const edge = producerEdge({
      strength_mean: -0.4,
      weight: 0.4,
      effect_direction: undefined,
      direction: 'positive',
      directionSource: 'user',
    })
    expect(buildEdgeStrengthEditEvent({ edge, requestedMean: 0.75 })).toBeNull()
  })

  it('ACCEPTS a ZERO expected mean with EITHER direction — sign cannot recover direction at zero', () => {
    const edge = producerEdge({
      strength_mean: 0,
      weight: 0,
      effect_direction: 'negative',
      direction: 'negative',
    })
    const event = buildEdgeStrengthEditEvent({ edge, requestedMean: 0.5, preserveDirection: true })
    expect(event?.payload).toMatchObject({
      expected: { mean: 0, effect_direction: 'negative' },
    })
  })

  it('REFUSES a blank or whitespace-padded endpoint id', () => {
    expect(
      buildEdgeStrengthEditEvent({
        edge: { ...producerEdge(), source: '' } as unknown as Edge,
        requestedMean: 0.5,
      }),
    ).toBeNull()
    expect(
      buildEdgeStrengthEditEvent({
        edge: { ...producerEdge(), target: ' goal_revenue ' } as unknown as Edge,
        requestedMean: 0.5,
      }),
    ).toBeNull()
  })

  it('REFUSES a delimiter-bearing COMPOSITE endpoint id', () => {
    // `CanonicalEdgeEndpointIdSchema` excludes the two delimiters the existing
    // canonical writer's composite adapter uses.
    expect(
      buildEdgeStrengthEditEvent({
        edge: { ...producerEdge(), source: 'fac_price->goal_revenue' } as unknown as Edge,
        requestedMean: 0.5,
      }),
    ).toBeNull()
    expect(
      buildEdgeStrengthEditEvent({
        edge: { ...producerEdge(), source: 'fac_price→goal_revenue' } as unknown as Edge,
        requestedMean: 0.5,
      }),
    ).toBeNull()
  })

  it('never sends the CLIENT edge id — the (from, to) pair IS the identity', () => {
    const event = buildEdgeStrengthEditEvent({ edge: producerEdge(), requestedMean: 0.5 })
    expect(Object.keys(event?.payload ?? {}).sort()).toEqual([
      'direction_intent',
      'expected',
      'from',
      'intent',
      'magnitude',
      'to',
    ])
  })
})

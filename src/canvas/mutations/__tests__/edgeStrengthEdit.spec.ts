/**
 * edgeStrengthEdit — the capture/build half of the durable link-strength write.
 *
 * WHAT THIS PINS, and why each case exists rather than being a shape assertion:
 * every member of `SystemEventSchema` is `.strict()` inside a discriminated
 * union, so ONE malformed field does not lose the field — it loses the WHOLE
 * TURN at CEE's ingress (422). Each fail-closed case below is therefore a turn
 * this module refuses to spend, checked against the CONTRACT's own rule rather
 * than against a shape invented here.
 */
import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'

import {
  captureEdgeStrengthEdit,
  buildEdgeStrengthEditWirePayload,
  buildEdgeStrengthRevertPatch,
  readEdgeStrengthExpected,
  readRefusedCurrentStrength,
  edgeStrengthDivergedNotice,
  isWireUsableEndpointId,
  EDGE_STRENGTH_NOTICE,
} from '../edgeStrengthEdit'

/**
 * The edge under test, and a DECOY that shares its weight and direction but
 * sits between different endpoints.
 *
 * ⚠ THE DECOY IS THE POINT. An assertion that found "the edge with weight 0.4"
 * would pass on either, so a capture that resolved by value rather than by id
 * would ship a wire event naming the WRONG endpoints — a mutation applied to an
 * edge the user never touched. Binding is asserted by identity throughout.
 */
const TARGET: Edge = {
  id: 'e_price_demand',
  source: 'fac_price',
  target: 'fac_demand',
  data: { weight: 0.4, direction: 'negative', weightSource: 'cee', directionSource: 'cee' },
}
const DECOY: Edge = {
  id: 'e_other_pair',
  source: 'fac_supply',
  target: 'fac_margin',
  data: { weight: 0.4, direction: 'negative' },
}
const EDGES = [DECOY, TARGET]

const makeId = () => 'intent_1'
const base = {
  edgesBefore: EDGES,
  edgeId: 'e_price_demand',
  externalMutationActive: false,
  makeId,
} as const

describe('captureEdgeStrengthEdit — identity and the contract’s own rules', () => {
  it('⭐ addresses the edge by its OWN endpoints, not a value-matched sibling', () => {
    const r = captureEdgeStrengthEdit({
      ...base,
      magnitude: 0.7,
      directionIntent: 'negative',
      intent: 'set',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Bound by identity: the DECOY carries the identical weight/direction, so a
    // value-keyed resolution would satisfy every numeric assertion below while
    // naming `fac_supply`/`fac_margin`.
    expect(r.intent.from).toBe('fac_price')
    expect(r.intent.to).toBe('fac_demand')
    expect(r.intent.edgeId).toBe('e_price_demand')
  })

  it('⭐ reconstructs the SIGNED expected mean from the store’s split representation', () => {
    // The store holds an ABSOLUTE `weight` plus a separate `direction`; the wire
    // asserts a signed mean. A capture that shipped `weight` verbatim would
    // assert +0.4 about an edge CEE holds at −0.4 and refuse forever.
    const r = captureEdgeStrengthEdit({
      ...base,
      magnitude: 0.7,
      directionIntent: 'negative',
      intent: 'set',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.intent.expected).toEqual({ mean: -0.4, effect_direction: 'negative' })
  })

  it('prefers a SUPPLIED baseline over re-reading the edge', () => {
    // The slider writes on every tick, so by commit time the edge holds the NEW
    // value. Re-reading it there would assert the number we are about to send —
    // a tautology CEE compares against itself and always accepts.
    const r = captureEdgeStrengthEdit({
      ...base,
      magnitude: 0.9,
      directionIntent: 'positive',
      intent: 'set',
      expected: { mean: 0.2, effect_direction: 'positive' },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.intent.expected).toEqual({ mean: 0.2, effect_direction: 'positive' })
  })

  it('captures the restore bytes, distinguishing ABSENT from present-and-undefined', () => {
    const noDirection: Edge = {
      id: 'e_bare',
      source: 'a',
      target: 'b',
      data: { weight: 0.5 },
    }
    const r = captureEdgeStrengthEdit({
      ...base,
      edgesBefore: [noDirection],
      edgeId: 'e_bare',
      magnitude: 0.6,
      directionIntent: 'positive',
      intent: 'set',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.intent.restore.weightWasPresent).toBe(true)
    expect(r.intent.restore.directionWasPresent).toBe(false)
    // …and the revert patch OMITS the absent key rather than writing undefined
    // over a real value, because the store merges `{...e.data, ...patch}`.
    expect(Object.keys(buildEdgeStrengthRevertPatch(r.intent))).toEqual(['weight'])
  })

  describe('fail-closed — each of these would cost the WHOLE turn at ingress', () => {
    it('stands down when the edge is not on the canvas', () => {
      const r = captureEdgeStrengthEdit({
        ...base,
        edgeId: 'e_missing',
        magnitude: 0.5,
        directionIntent: 'positive',
        intent: 'set',
      })
      expect(r).toEqual({ ok: false, reason: 'edge_not_found' })
    })

    it('stands down rather than fabricating a zero when the weight is unreadable', () => {
      const r = captureEdgeStrengthEdit({
        ...base,
        edgesBefore: [{ id: 'e_x', source: 'a', target: 'b', data: {} }],
        edgeId: 'e_x',
        magnitude: 0.5,
        directionIntent: 'positive',
        intent: 'set',
      })
      expect(r).toEqual({ ok: false, reason: 'expected_unreadable' })
    })

    it('refuses a magnitude outside the contract’s [0,1] — the Model tab allows 2', () => {
      const r = captureEdgeStrengthEdit({
        ...base,
        magnitude: 1.5,
        directionIntent: 'positive',
        intent: 'set',
      })
      expect(r).toEqual({ ok: false, reason: 'unusable_for_wire' })
    })

    it('refuses a delimiter-bearing endpoint id (CanonicalEdgeEndpointIdSchema)', () => {
      const composite: Edge = {
        id: 'e_c',
        source: 'fac_a→fac_b',
        target: 'fac_c',
        data: { weight: 0.3, direction: 'positive' },
      }
      const r = captureEdgeStrengthEdit({
        ...base,
        edgesBefore: [composite],
        edgeId: 'e_c',
        magnitude: 0.5,
        directionIntent: 'positive',
        intent: 'set',
      })
      expect(r).toEqual({ ok: false, reason: 'unusable_for_wire' })
    })

    it('⭐ refuses a confirm_current that does not restate abs(expected.mean)', () => {
      // `refineEdgeStrengthEdit`: confirmation is provenance-only. A magnitude
      // that differs is a VALUE CHANGE wearing a confirmation's name.
      const r = captureEdgeStrengthEdit({
        ...base,
        magnitude: 0.9,
        directionIntent: 'preserve',
        intent: 'confirm_current',
      })
      expect(r).toEqual({ ok: false, reason: 'contradictory_confirmation' })
    })

    it('⭐ refuses a confirm_current that does not preserve direction', () => {
      const r = captureEdgeStrengthEdit({
        ...base,
        magnitude: 0.4,
        directionIntent: 'negative',
        intent: 'confirm_current',
      })
      expect(r).toEqual({ ok: false, reason: 'contradictory_confirmation' })
    })

    it('accepts the confirm_current that DOES restate the current magnitude', () => {
      // The opposite-direction twin of the two refusals above: without this the
      // rule could be satisfied by refusing every confirmation.
      const r = captureEdgeStrengthEdit({
        ...base,
        magnitude: 0.4,
        directionIntent: 'preserve',
        intent: 'confirm_current',
      })
      expect(r.ok).toBe(true)
    })

    it('stands down on a producer write, not a user gesture', () => {
      const r = captureEdgeStrengthEdit({
        ...base,
        magnitude: 0.5,
        directionIntent: 'positive',
        intent: 'set',
        externalMutationActive: true,
      })
      expect(r).toEqual({ ok: false, reason: 'external_mutation' })
    })
  })
})

describe('buildEdgeStrengthEditWirePayload', () => {
  it('⭐ emits the CONTRACT’s field names and NO client-local edge id', () => {
    const r = captureEdgeStrengthEdit({
      ...base,
      magnitude: 0.7,
      directionIntent: 'negative',
      intent: 'set',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const payload = buildEdgeStrengthEditWirePayload(r.intent)
    // Exact equality, not a subset match: the member is `.strict()`, so an
    // EXTRA key is as fatal as a missing one. `edgeId` in particular is
    // unresolvable against CEE's persisted graph — `EdgeV3Schema` declares no
    // `id` field at all.
    expect(payload).toEqual({
      from: 'fac_price',
      to: 'fac_demand',
      magnitude: 0.7,
      direction_intent: 'negative',
      expected: { mean: -0.4, effect_direction: 'negative' },
      intent: 'set',
    })
  })
})

describe('readEdgeStrengthExpected', () => {
  it('reads an absent direction as positive — matching what the user was shown', () => {
    const e: Edge = { id: 'x', source: 'a', target: 'b', data: { weight: 0.25 } }
    expect(readEdgeStrengthExpected(e)).toEqual({ mean: 0.25, effect_direction: 'positive' })
  })

  it('returns null when there is no readable magnitude to assert', () => {
    const e: Edge = { id: 'x', source: 'a', target: 'b', data: { weight: 'heavy' } }
    expect(readEdgeStrengthExpected(e)).toBeNull()
  })
})

describe('readRefusedCurrentStrength — the field that makes a refusal an EXIT', () => {
  it('reads the server’s own current value off a 409 details block', () => {
    expect(
      readRefusedCurrentStrength({
        conflict_category: 'edge_expected_tuple_mismatch',
        edge: {
          from: 'fac_price',
          to: 'fac_demand',
          expected: { mean: -0.4, effect_direction: 'negative' },
          current: { mean: -0.65, std: 0.1, effect_direction: 'negative' },
          match_count: 1,
        },
      }),
    ).toEqual({ mean: -0.65, effect_direction: 'negative' })
  })

  it('fails closed on any shape it cannot read, rather than inventing a value', () => {
    expect(readRefusedCurrentStrength(undefined)).toBeNull()
    expect(readRefusedCurrentStrength({ edge: {} })).toBeNull()
    expect(readRefusedCurrentStrength({ edge: { current: { mean: 0.5 } } })).toBeNull()
    expect(
      readRefusedCurrentStrength({ edge: { current: { mean: 'x', effect_direction: 'positive' } } }),
    ).toBeNull()
  })
})

describe('edgeStrengthDivergedNotice — no affordance terminating in refusal', () => {
  it('⭐ names the value the model actually holds, so the next move is bounded', () => {
    const copy = edgeStrengthDivergedNotice({ mean: -0.65, effect_direction: 'negative' })
    expect(copy).toContain('0.65')
    expect(copy).toContain('decreasing')
    // "Try again" would re-send the same stale `expected` and refuse forever.
    expect(copy).not.toContain('Try again')
  })

  it('claims nothing about the current value when the server named none', () => {
    expect(edgeStrengthDivergedNotice(null)).toBe(EDGE_STRENGTH_NOTICE.diverged_unknown_current)
  })
})

describe('isWireUsableEndpointId', () => {
  it('applies CanonicalEdgeEndpointIdSchema’s exact constraints', () => {
    expect(isWireUsableEndpointId('fac_price')).toBe(true)
    expect(isWireUsableEndpointId('')).toBe(false)
    expect(isWireUsableEndpointId(' fac_price')).toBe(false)
    expect(isWireUsableEndpointId('a→b')).toBe(false)
    expect(isWireUsableEndpointId('a->b')).toBe(false)
    expect(isWireUsableEndpointId(42)).toBe(false)
  })
})

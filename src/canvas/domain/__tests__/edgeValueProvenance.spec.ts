/**
 * Edge value provenance — the set-vs-defaulted invariant.
 *
 * The whole point of this marker is that ABSENT MEANS DEFAULTED. Every test
 * here is paired: an absence assertion is worthless unless the same shape with
 * a stamp demonstrably reads as SET, so each "not set" case sits next to the
 * positive control that proves the reader can see a presence at all.
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS, EdgeDataSchema } from '../edges'
import {
  edgeValueSource,
  isEdgeValueSet,
  edgeValueSourcePatch,
  EDGE_PROVENANCED_FIELDS,
} from '../edgeValueProvenance'

describe('edgeValueProvenance — the UI defaults are NOT a source', () => {
  it.each(EDGE_PROVENANCED_FIELDS)(
    'DEFAULT_EDGE_DATA carries a number for %s but no source, so it reads as NOT SET',
    (field) => {
      // The number IS there — this is exactly the trap: the value is present
      // and plausible, which is why presence could never have been the test.
      expect(typeof (DEFAULT_EDGE_DATA as Record<string, unknown>)[field]).toBe('number')
      expect(edgeValueSource(DEFAULT_EDGE_DATA as Record<string, unknown>, field)).toBeNull()
      expect(isEdgeValueSet(DEFAULT_EDGE_DATA as Record<string, unknown>, field)).toBe(false)
    },
  )

  it.each(EDGE_PROVENANCED_FIELDS)(
    'USER_EDGE_DEFAULTS carries a number for %s but no source, so it reads as NOT SET',
    (field) => {
      expect(typeof (USER_EDGE_DEFAULTS as Record<string, unknown>)[field]).toBe('number')
      expect(isEdgeValueSet(USER_EDGE_DEFAULTS as Record<string, unknown>, field)).toBe(false)
    },
  )

  // POSITIVE CONTROL for both blocks above: without this, `isEdgeValueSet`
  // could be `() => false` and every assertion so far would still pass.
  it('reads a stamped edge as SET (positive control)', () => {
    const stamped = { ...USER_EDGE_DEFAULTS, beliefExistsSource: 'user', weightSource: 'user' }
    expect(edgeValueSource(stamped, 'beliefExists')).toBe('user')
    expect(edgeValueSource(stamped, 'weight')).toBe('user')
    expect(isEdgeValueSet(stamped, 'beliefExists')).toBe(true)
    expect(isEdgeValueSet(stamped, 'weight')).toBe(true)
  })
})

describe('edgeValueProvenance — back-compat evidence from producer-only fields', () => {
  it('treats exists_probability as CEE evidence for beliefExists', () => {
    expect(edgeValueSource({ beliefExists: 0.65, exists_probability: 0.65 }, 'beliefExists')).toBe('cee')
  })

  it('treats strength_mean as CEE evidence for weight', () => {
    expect(edgeValueSource({ weight: 0.4, strength_mean: -0.4 }, 'weight')).toBe('cee')
  })

  // Discriminating case: the back-compat fallbacks must be FIELD-SPECIFIC.
  // exists_probability says nothing about weight, and vice versa — if it did,
  // every CEE edge would claim a set weight it never received.
  it('does not let one field’s producer evidence vouch for the other', () => {
    expect(edgeValueSource({ exists_probability: 0.65, weight: 0.5 }, 'weight')).toBeNull()
    expect(edgeValueSource({ strength_mean: 0.4, beliefExists: 0.8 }, 'beliefExists')).toBeNull()
  })

  it('does NOT accept a bare beliefExists/weight number as evidence', () => {
    // These are precisely the fields the defaults fabricate.
    expect(edgeValueSource({ beliefExists: 0.8 }, 'beliefExists')).toBeNull()
    expect(edgeValueSource({ weight: 0.5 }, 'weight')).toBeNull()
  })
})

describe('edgeValueProvenance — fail closed on a bad marker', () => {
  it('rejects an unrecognised source value rather than trusting it', () => {
    expect(edgeValueSource({ beliefExistsSource: 'guessed' }, 'beliefExists')).toBeNull()
    expect(edgeValueSource({ weightSource: true }, 'weight')).toBeNull()
    expect(edgeValueSource({ weightSource: '' }, 'weight')).toBeNull()
  })

  it('handles a missing data bag', () => {
    expect(edgeValueSource(undefined, 'weight')).toBeNull()
    expect(edgeValueSource(null, 'beliefExists')).toBeNull()
  })
})

describe('edgeValueSourcePatch — omits, never writes undefined', () => {
  it('produces an empty patch when nothing was supplied', () => {
    expect(edgeValueSourcePatch({})).toEqual({})
  })

  it('omits the unsupplied key so spreading cannot erase an existing stamp', () => {
    const patch = edgeValueSourcePatch({ beliefExists: 'cee' })
    expect(Object.prototype.hasOwnProperty.call(patch, 'weightSource')).toBe(false)
    // The real hazard, demonstrated: an explicit `undefined` DOES override a
    // spread, so a patch that wrote `weightSource: undefined` would silently
    // wipe a user's stamp on every CEE turn.
    const merged = { weightSource: 'user', ...patch }
    expect(merged.weightSource).toBe('user')
    expect(merged.beliefExistsSource).toBe('cee')
  })
})

describe('EdgeDataSchema — the markers survive a parse', () => {
  it('round-trips both source fields', () => {
    const parsed = EdgeDataSchema.parse({
      ...USER_EDGE_DEFAULTS,
      beliefExistsSource: 'cee',
      weightSource: 'template',
    })
    expect(parsed.beliefExistsSource).toBe('cee')
    expect(parsed.weightSource).toBe('template')
  })

  it('parses an unstamped edge without inventing a source', () => {
    const parsed = EdgeDataSchema.parse({ ...USER_EDGE_DEFAULTS })
    expect(parsed.beliefExistsSource).toBeUndefined()
    expect(parsed.weightSource).toBeUndefined()
  })
})

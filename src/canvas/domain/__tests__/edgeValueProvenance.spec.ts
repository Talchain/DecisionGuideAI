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
  resolveEdgeValueDisplay,
  resolveEdgeSignedStrengthDisplay,
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

// ---------------------------------------------------------------------------
// resolveEdgeValueDisplay — the read-side gate
// ---------------------------------------------------------------------------
//
// Paired throughout: every "hidden" assertion sits next to the stamped twin
// that proves the resolver CAN show a value. Without the positive control the
// hidden assertions would pass on a resolver that returned `show: false`
// unconditionally.
describe('resolveEdgeValueDisplay', () => {
  it.each(EDGE_PROVENANCED_FIELDS)(
    'hides %s on a freshly drawn edge — the number is there, the source is not',
    (field) => {
      const drawn = { ...USER_EDGE_DEFAULTS } as Record<string, unknown>
      expect(typeof drawn[field]).toBe('number')
      expect(resolveEdgeValueDisplay(drawn, field)).toEqual({ show: false, reason: 'not_set' })
    },
  )

  it.each(EDGE_PROVENANCED_FIELDS)('POSITIVE CONTROL: shows %s once stamped', (field) => {
    const stamped = {
      ...USER_EDGE_DEFAULTS,
      ...edgeValueSourcePatch({ [field]: 'user' } as never),
    } as Record<string, unknown>
    const got = resolveEdgeValueDisplay(stamped, field)
    expect(got.show).toBe(true)
    expect(got).toMatchObject({ source: 'user', value: (USER_EDGE_DEFAULTS as Record<string, number>)[field] })
  })

  it('distinguishes "not set" from "absent" — they are different sentences', () => {
    expect(resolveEdgeValueDisplay({ weight: 0.3 }, 'weight')).toEqual({ show: false, reason: 'not_set' })
    expect(resolveEdgeValueDisplay({}, 'weight')).toEqual({ show: false, reason: 'absent' })
    expect(resolveEdgeValueDisplay(undefined, 'weight')).toEqual({ show: false, reason: 'absent' })
  })

  it('honours the legacy `belief` field, and back-compat producer evidence', () => {
    // exists_probability is written ONLY by CEE ingestion, so it proves a producer value
    // on graphs saved before the marker existed.
    expect(resolveEdgeValueDisplay({ belief: 0.42, exists_probability: 0.42 }, 'beliefExists')).toEqual({
      show: true,
      value: 0.42,
      source: 'cee',
    })
    // ...but a bare legacy number with no evidence stays hidden.
    expect(resolveEdgeValueDisplay({ belief: 0.42 }, 'beliefExists')).toEqual({
      show: false,
      reason: 'not_set',
    })
  })

  it('never returns a value without a source (the type-level guarantee, checked at runtime)', () => {
    const samples: Array<Record<string, unknown>> = [
      { ...DEFAULT_EDGE_DATA },
      { ...USER_EDGE_DEFAULTS },
      { weight: 0.9, direction: 'negative' },
      { beliefExists: 0.8 },
      {},
    ]
    for (const sample of samples) {
      for (const field of EDGE_PROVENANCED_FIELDS) {
        const got = resolveEdgeValueDisplay(sample, field)
        if (got.show) expect(got.source).toBeTruthy()
      }
    }
  })
})

describe('resolveEdgeSignedStrengthDisplay', () => {
  it('hides the signed strength of a freshly drawn edge — the DIRECTION is defaulted too', () => {
    // USER_EDGE_DEFAULTS pins direction 'positive'. Rendering "Raises" for an
    // edge nobody characterised is the same fabrication as rendering "30%".
    expect(resolveEdgeSignedStrengthDisplay({ ...USER_EDGE_DEFAULTS })).toEqual({
      show: false,
      reason: 'not_set',
    })
  })

  it('POSITIVE CONTROL: shows it once the weight is stamped, and carries the sign', () => {
    expect(
      resolveEdgeSignedStrengthDisplay({ weight: 0.4, direction: 'negative', weightSource: 'user' }),
    ).toEqual({ show: true, value: -0.4, source: 'user' })
    expect(
      resolveEdgeSignedStrengthDisplay({ weight: 0.4, direction: 'positive', weightSource: 'cee' }),
    ).toEqual({ show: true, value: 0.4, source: 'cee' })
  })

  it('prefers CEE pre-signed strength_mean, which is itself back-compat evidence', () => {
    expect(resolveEdgeSignedStrengthDisplay({ strength_mean: -0.62, weight: 0.62 })).toEqual({
      show: true,
      value: -0.62,
      source: 'cee',
    })
  })

  it('reports absent when there is no number at all', () => {
    expect(resolveEdgeSignedStrengthDisplay({})).toEqual({ show: false, reason: 'absent' })
  })
})

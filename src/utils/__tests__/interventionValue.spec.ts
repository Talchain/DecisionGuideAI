/**
 * Unit spec for the one intervention-validity predicate.
 *
 * The cross-module agreement pin (that flattenInterventions and
 * unwrapInterventionValue both defer to this) lives in
 * src/adapters/plot/v2/__tests__/interventionFiniteness.spec.ts. This file
 * pins the rule itself.
 */

import { describe, it, expect } from 'vitest'
import { interventionNumericValue, looksLikeIntervention } from '../interventionValue'

describe('interventionNumericValue', () => {
  it.each([
    ['bare finite', 0.5, 0.5],
    ['zero', 0, 0],
    ['negative', -2, -2],
    ['very small', 1e-12, 1e-12],
    ['wrapped finite', { value: 0.5 }, 0.5],
    ['wrapped zero', { value: 0 }, 0],
    ['wrapped with metadata', { value: 3, unit: '%', source: 'user_specified' }, 3],
  ])('resolves %s', (_label, input, expected) => {
    expect(interventionNumericValue(input)).toBe(expected)
  })

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['wrapped NaN', { value: NaN }],
    ['wrapped Infinity', { value: Infinity }],
    ['wrapped null', { value: null }],
    ['wrapped undefined', { value: undefined }],
    ['wrapped string', { value: 'tbd' }],
    ['wrapped numeric string', { value: '0.5' }],
    ['wrapped boolean', { value: true }],
    ['object with no value key', { unit: '%' }],
    ['empty object', {}],
    ['null', null],
    ['undefined', undefined],
    ['numeric string', '0.5'],
    ['empty string', ''],
    ['boolean', true],
    ['array', []],
  ])('rejects %s', (_label, input) => {
    expect(interventionNumericValue(input)).toBeNull()
  })

  it('does not coerce — the two coercions that caused live defects stay dead', () => {
    // Number(null) === 0 rendered "Intervention: £0" for unset interventions.
    expect(interventionNumericValue({ value: null })).toBeNull()
    // Number('') === 0 is the same trap one type over.
    expect(interventionNumericValue({ value: '' })).toBeNull()
  })

  it('distinguishes a resolved 0 from a rejection', () => {
    // The whole reason the return type is `number | null` and not a falsy
    // sentinel: 0 is a legitimate intervention value.
    expect(interventionNumericValue(0)).toBe(0)
    expect(interventionNumericValue({ value: 0 })).toBe(0)
    expect(interventionNumericValue(null)).toBeNull()
  })
})

describe('looksLikeIntervention', () => {
  it.each([
    ['bare finite', 0.5],
    ['bare zero', 0],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['wrapped finite', { value: 1 }],
    ['wrapped null', { value: null }],
    ['wrapped string', { value: 'tbd' }],
    ['wrapped undefined', { value: undefined }],
  ])('is true for %s — authored, whether or not usable', (_label, input) => {
    expect(looksLikeIntervention(input)).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'nope'],
    ['boolean', true],
    ['array', []],
    ['object with no value key', { unit: '%' }],
  ])('is false for %s — nothing was authored here', (_label, input) => {
    expect(looksLikeIntervention(input)).toBe(false)
  })

  it('separates "authored but unusable" from "absent", which is what the disposal doctrine turns on', () => {
    // Both are unusable...
    expect(interventionNumericValue({ value: null })).toBeNull()
    expect(interventionNumericValue(undefined)).toBeNull()
    // ...but only the first is a defect the user must be told about.
    expect(looksLikeIntervention({ value: null })).toBe(true)
    expect(looksLikeIntervention(undefined)).toBe(false)
  })
})

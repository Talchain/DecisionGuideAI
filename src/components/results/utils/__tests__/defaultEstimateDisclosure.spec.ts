/**
 * F10 — the disclosure that existed and was wired to nothing.
 */
import { describe, it, expect } from 'vitest'
import { deriveDefaultEstimateDisclosure } from '../defaultEstimateDisclosure'

describe('deriveDefaultEstimateDisclosure', () => {
  it('POSITIVE CONTROL: counts the defaulted factors against the total', () => {
    expect(
      deriveDefaultEstimateDisclosure([
        { isDefaultedConfidence: true },
        { isDefaultedConfidence: false },
        { isDefaultedConfidence: true },
      ]),
    ).toEqual({ defaultEstimateCount: 2, totalFactorCount: 3 })
  })

  it('reports zero defaults honestly (AdvancedSection then omits the sentence)', () => {
    expect(deriveDefaultEstimateDisclosure([{ isDefaultedConfidence: false }])).toEqual({
      defaultEstimateCount: 0,
      totalFactorCount: 1,
    })
  })

  it('emits NOTHING for an empty or absent driver set — never "0 of 0"', () => {
    expect(deriveDefaultEstimateDisclosure([])).toEqual({})
    expect(deriveDefaultEstimateDisclosure(null)).toEqual({})
    expect(deriveDefaultEstimateDisclosure(undefined)).toEqual({})
  })

  it('is STRICT: an absent flag is silence, not a claim of defaultedness', () => {
    expect(deriveDefaultEstimateDisclosure([{}, {}])).toEqual({
      defaultEstimateCount: 0,
      totalFactorCount: 2,
    })
  })
})

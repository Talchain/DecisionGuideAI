import { describe, it, expect } from 'vitest'
import { getExtractionLabel } from '../inspectorStrings'

// A4a: an absent source must never be labelled with an origin the data does
// not carry. `getExtractionLabel(undefined)` used to return 'Estimated by
// Olumi' — a fabricated provenance claim.
describe('getExtractionLabel — absent source', () => {
  it('returns "Source not recorded" for an undefined source', () => {
    expect(getExtractionLabel(undefined)).toBe('Source not recorded')
  })

  it('does not fabricate "Estimated by Olumi" for an undefined source', () => {
    expect(getExtractionLabel(undefined)).not.toBe('Estimated by Olumi')
  })
})

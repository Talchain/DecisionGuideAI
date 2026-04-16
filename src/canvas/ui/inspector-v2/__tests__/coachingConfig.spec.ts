/**
 * QA Brief H-series — coachingConfig structure and content tests.
 *
 * H2: COACHING object is typed with all expected keys.
 * H3: Every panel entity type has a corresponding coaching key.
 * H4: No known coaching phrases remain as inline strings in panel files.
 *     (Tested by verifying COACHING contains the canonical versions.)
 */
import { describe, it, expect } from 'vitest'
import { COACHING, resolveCoaching, type CoachingKey } from '../coachingConfig'

/** Every panel type (plus goal variants) must have a coaching entry. */
const REQUIRED_KEYS: CoachingKey[] = [
  'edgeWeight',
  'decisionOptions',
  'optionCoverage',
  'factorControllableEvidence',
  'factorObservableData',
  'factorExternalUncertainty',
  'outcomeCompleteness',
  'riskControlLevers',
  'goalConnections',
  'goalEvidence',
  'goalNoTarget',
]

describe('coachingConfig (H-series)', () => {
  // H2: Structure — all required keys present and non-empty
  it('H2: COACHING object has all required keys', () => {
    for (const key of REQUIRED_KEYS) {
      expect(COACHING).toHaveProperty(key)
      expect(typeof COACHING[key]).toBe('string')
      expect(COACHING[key].length).toBeGreaterThan(0)
    }
  })

  // H3: Structural — every COACHING entry is a required key (no orphans)
  it('H3: every COACHING key is in the required set', () => {
    const requiredSet = new Set<string>(REQUIRED_KEYS)
    for (const key of Object.keys(COACHING)) {
      expect(requiredSet.has(key)).toBe(true)
    }
  })

  // H4: Canonical phrase verification — these exact strings must live in COACHING, not inline
  it('H4: "pull different levers" phrase is in COACHING.decisionOptions', () => {
    expect(COACHING.decisionOptions).toContain('pull different levers')
  })

  it('H4: "source of uncertainty" phrase is in COACHING.factorExternalUncertainty', () => {
    expect(COACHING.factorExternalUncertainty).toContain('source of uncertainty')
  })

  it('H4: "Consider whether" phrase is in COACHING.optionCoverage', () => {
    expect(COACHING.optionCoverage).toContain('Consider whether')
  })

  it('H4: edge weight coaching contains "generated automatically"', () => {
    expect(COACHING.edgeWeight).toContain('generated automatically')
  })

  it('H4: "more recent data" phrase is in COACHING.factorObservableData', () => {
    expect(COACHING.factorObservableData).toContain('more recent data')
  })

  // All values must be strings (TypeScript enforces at compile time, but runtime check is belt-and-suspenders)
  it('all COACHING values are non-empty strings', () => {
    for (const [key, value] of Object.entries(COACHING)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
      expect(key.length).toBeGreaterThan(0)
    }
  })

  // H5: No em-dashes in source strings — guards against re-introducing the broken
  // sentence pattern that Brief 2.5 was created to fix. Also checks resolved templates.
  it('H5: no COACHING source string contains an em-dash', () => {
    const EM_DASH = '\u2014'
    for (const [key, value] of Object.entries(COACHING)) {
      expect(value, `COACHING.${key} contains em-dash`).not.toContain(EM_DASH)
    }
  })

  it('H5: no resolved coaching template contains an em-dash', () => {
    const EM_DASH = '\u2014'
    const templateKeys: CoachingKey[] = [
      'factorControllableEvidence',
      'factorExternalUncertainty',
      'factorObservableData',
    ]
    for (const key of templateKeys) {
      const resolved = resolveCoaching(key, { factorName: 'Test Factor' })
      expect(resolved, `resolveCoaching('${key}') contains em-dash`).not.toContain(EM_DASH)
    }
  })
})

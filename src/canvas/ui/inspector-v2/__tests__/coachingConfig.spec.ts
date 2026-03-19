/**
 * QA Brief H-series — coachingConfig structure and content tests.
 *
 * H2: COACHING object is typed with all expected keys.
 * H3: Verify count of coaching entries matches panel count (9 panels + 1 goal).
 * H4: No known coaching phrases remain as inline strings in panel files.
 *     (Tested by verifying COACHING contains the canonical versions.)
 */
import { describe, it, expect } from 'vitest'
import { COACHING, type CoachingKey } from '../coachingConfig'

describe('coachingConfig (H-series)', () => {
  // H2: Structure — all expected keys present and non-empty
  it('H2: COACHING object has all expected keys', () => {
    const expectedKeys: CoachingKey[] = [
      'edgeWeight',
      'decisionOptions',
      'optionCoverage',
      'factorControllableEvidence',
      'factorObservableData',
      'factorExternalUncertainty',
      'outcomeCompleteness',
      'riskControlLevers',
      'goalConnections',
      'goalNoTarget',
    ]
    for (const key of expectedKeys) {
      expect(COACHING).toHaveProperty(key)
      expect(typeof COACHING[key]).toBe('string')
      expect(COACHING[key].length).toBeGreaterThan(0)
    }
  })

  // H3: Count check — 10 coaching strings (9 panels + 1 goal variant)
  it('H3: COACHING object has exactly 10 entries (9 panels + goalNoTarget)', () => {
    expect(Object.keys(COACHING)).toHaveLength(10)
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
})

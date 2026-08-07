/**
 * QA Brief H-series — coachingConfig structure and content tests.
 *
 * H2: COACHING object is typed with all expected keys.
 * H3: Every panel entity type has a corresponding coaching key.
 * H4: No known coaching phrases remain as inline strings in panel files.
 *     (Tested by verifying COACHING contains the canonical versions.)
 */
import { describe, it, expect } from 'vitest'
import { COACHING, resolveCoaching, resolveEdgeValuesCoaching, type CoachingKey } from '../coachingConfig'

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

  // ⚠ REPLACED, NOT DELETED. This test used to assert
  //     expect(COACHING.edgeWeight).toContain('generated automatically')
  // — i.e. it PINNED the over-claim. `COACHING.edgeWeight` was rendered
  // unconditionally beneath the edge panel's strength control and the
  // "Does this connection exist?" slider, including on a freshly drawn edge
  // where both numbers are `USER_EDGE_DEFAULTS` and nothing generated
  // anything, and including on a value the user had just typed. The test was
  // doing its job (H4 is about copy living in COACHING rather than inline) but
  // it had welded a specific false sentence into the contract. It now pins the
  // inverse: no static entry may assert an origin at all.
  it('H4: NO static coaching entry asserts a provenance it cannot establish', () => {
    // Verbs of origin. Static copy cannot know where a number came from —
    // that sentence is derived per edge by `resolveEdgeValuesCoaching`.
    const ORIGIN_CLAIMS = [
      'generated automatically',
      'was generated',
      'was estimated',
      'was calculated',
      'was computed',
      'we generated',
      'we estimated',
    ]
    for (const [key, text] of Object.entries(COACHING)) {
      for (const claim of ORIGIN_CLAIMS) {
        expect(`${key}: ${text.toLowerCase()}`).not.toContain(claim)
      }
    }
  })

  // POSITIVE CONTROL for the rule above: the derived resolver DOES speak an
  // origin, and speaks a different one per source — so the absence assertion
  // in the static set is a real constraint, not a vacuous one.
  describe('resolveEdgeValuesCoaching — the derived disclosure', () => {
    it('makes NO origin claim when neither value was set', () => {
      const text = resolveEdgeValuesCoaching({ strength: null, existence: null })
      expect(text).toContain('No strength has been set')
      expect(text).toContain('Nobody has said how likely')
      expect(text.toLowerCase()).not.toContain('generated')
      expect(text.toLowerCase()).not.toContain('estimated this strength')
    })

    it('names Olumi only when the value actually came from a producer', () => {
      const text = resolveEdgeValuesCoaching({ strength: 'cee', existence: 'cee' })
      expect(text).toContain('Olumi estimated this strength')
      expect(text).toContain('Olumi estimated how likely')
    })

    it('attributes a user-set value to the user, never to a generator', () => {
      const text = resolveEdgeValuesCoaching({ strength: 'user', existence: 'user' })
      expect(text).toContain('You set this strength')
      expect(text).toContain('You set how likely')
      expect(text).not.toContain('Olumi estimated')
    })

    it('distinguishes a template value from an estimate of THIS decision', () => {
      const text = resolveEdgeValuesCoaching({ strength: 'template', existence: 'template' })
      expect(text).toContain('came with the template')
      expect(text).toContain('not estimated for your decision')
    })

    it('resolves the two fields INDEPENDENTLY (a set strength does not vouch for the belief)', () => {
      const text = resolveEdgeValuesCoaching({ strength: 'user', existence: null })
      expect(text).toContain('You set this strength')
      expect(text).toContain('Nobody has said how likely')
    })

    it('always carries the advice half, whatever the provenance', () => {
      for (const source of [null, 'user', 'cee', 'template'] as const) {
        const text = resolveEdgeValuesCoaching({ strength: source, existence: source })
        expect(text).toContain(COACHING.edgeWeight)
      }
    })
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

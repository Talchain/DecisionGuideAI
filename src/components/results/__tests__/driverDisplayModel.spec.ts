/**
 * driverDisplayModel — the shared complete-metric-set policy (Codex R3-B1).
 *
 * This pins the EXACT partial-coverage scenario from the review that recreated
 * the "#1 with a lower displayed influence" contradiction, and proves the one
 * policy resolves it identically regardless of which surface (panel or graph
 * badge) maps its data into it — because both now consume THIS function.
 */
import { describe, it, expect } from 'vitest'
import {
  selectDriverDisplayModel,
  compareByDisplayModel,
  computeNormalisedInfluences,
} from '../driverDisplayModel'

describe('selectDriverDisplayModel — the exact Codex R3-B1 partial-coverage scenario', () => {
  // Investor Confidence: elasticity 0.1, influence 90%.
  // Revenue Potential:   elasticity 0.2, influence ABSENT.
  // Before the fix: panel ranked Revenue #1 at normalised 100% while the graph
  // showed Revenue's raw 0.2 as "20%" and Investor's raw 0.9 as "90%" — the
  // same factor displayed two different numbers and the crown looked wrong.
  const factors = [
    { key: 'investor_confidence', influenceScore: 0.9, rawElasticity: 0.1 },
    { key: 'revenue_potential', rawElasticity: 0.2 }, // influenceScore absent
  ]

  it('partial coverage → EVERY factor on the normalised-elasticity basis, provenance marked', () => {
    const model = selectDriverDisplayModel(factors)
    // max |elasticity| = 0.2 → Revenue normalises to 1.0, Investor to 0.5.
    expect(model.get('revenue_potential')).toEqual({ value: 1.0, provenance: 'normalised_elasticity' })
    expect(model.get('investor_confidence')).toEqual({ value: 0.5, provenance: 'normalised_elasticity' })
    // The producer 0.9 is NOT displayed for Investor — that was the contradiction.
    expect(model.get('investor_confidence')!.value).not.toBe(0.9)
  })

  it('rank via the shared comparator crowns Revenue #1 on the same single basis', () => {
    const model = selectDriverDisplayModel(factors)
    const ranked = factors
      .map((f) => ({
        key: f.key,
        elasticity: Math.abs(f.rawElasticity),
        value: model.get(f.key)!.value,
      }))
      .sort(compareByDisplayModel)
    expect(ranked.map((r) => r.key)).toEqual(['revenue_potential', 'investor_confidence'])
  })

  it('complete coverage → producer influence for all, provenance marked', () => {
    const model = selectDriverDisplayModel([
      { key: 'a', influenceScore: 0.9, rawElasticity: 0.1 },
      { key: 'b', influenceScore: 0.2, rawElasticity: 0.2 },
    ])
    expect(model.get('a')).toEqual({ value: 0.9, provenance: 'influence_score' })
    expect(model.get('b')).toEqual({ value: 0.2, provenance: 'influence_score' })
  })

  it('a non-finite influence_score does NOT count as coverage (fails closed to normalised)', () => {
    const model = selectDriverDisplayModel([
      { key: 'a', influenceScore: Number.NaN, rawElasticity: 0.2 },
      { key: 'b', influenceScore: 0.5, rawElasticity: 0.1 },
    ])
    expect(model.get('a')!.provenance).toBe('normalised_elasticity')
    expect(model.get('b')!.provenance).toBe('normalised_elasticity')
  })

  it('degenerate near-zero elasticities map to 0 (direction-only), never fabricated bars', () => {
    const model = selectDriverDisplayModel([
      { key: 'a', rawElasticity: 0.0001 },
      { key: 'b', rawElasticity: 0.0002 },
    ])
    expect(model.get('a')!.value).toBe(0)
    expect(model.get('b')!.value).toBe(0)
  })
})

describe('compareByDisplayModel', () => {
  it('value desc, then |elasticity|, then key', () => {
    const rows = [
      { key: 'z', value: 0.5, elasticity: 0.5 },
      { key: 'a', value: 0.5, elasticity: 0.5 },
      { key: 'b', value: 0.9, elasticity: 0.1 },
      { key: 'c', value: 0.5, elasticity: 0.9 },
    ]
    expect([...rows].sort(compareByDisplayModel).map((r) => r.key)).toEqual(['b', 'c', 'a', 'z'])
  })
})

describe('computeNormalisedInfluences (re-homed, behaviour unchanged)', () => {
  it('normalises to the max magnitude', () => {
    const m = computeNormalisedInfluences([
      { key: 'a', rawElasticity: 0.8 },
      { key: 'b', rawElasticity: 8.0 },
    ])
    expect(m.get('a')).toBeCloseTo(0.1)
    expect(m.get('b')).toBeCloseTo(1.0)
  })
})

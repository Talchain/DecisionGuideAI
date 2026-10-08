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
  extractPolicyRow,
  readDriverLevel,
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
    expect(model.get('revenue_potential')).toEqual({ value: 1.0, provenance: 'normalised_elasticity', importanceBasis: null })
    expect(model.get('investor_confidence')).toEqual({ value: 0.5, provenance: 'normalised_elasticity', importanceBasis: null })
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

  it('complete producer coverage still uses normalised elasticity for all, provenance marked', () => {
    const model = selectDriverDisplayModel([
      { key: 'a', influenceScore: 0.9, rawElasticity: 0.1 },
      { key: 'b', influenceScore: 0.2, rawElasticity: 0.2 },
    ])
    expect(model.get('a')).toEqual({ value: 0.5, provenance: 'normalised_elasticity', importanceBasis: null })
    expect(model.get('b')).toEqual({ value: 1, provenance: 'normalised_elasticity', importanceBasis: null })
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

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'omits missing/non-finite rawElasticity (%s) before normalising the surviving rows',
    (rawElasticity) => {
      const model = selectDriverDisplayModel([
        { key: 'unranked', influenceScore: 1, rawElasticity },
        { key: 'leader', rawElasticity: 0.5 },
        { key: 'smaller', rawElasticity: 0.25 },
        { key: 'measured_zero', rawElasticity: 0 },
      ])

      expect(model.has('unranked')).toBe(false)
      expect([...model.keys()]).toEqual(['leader', 'smaller', 'measured_zero'])
      expect(model.get('leader')!.value).toBe(1)
      expect(model.get('smaller')!.value).toBe(0.5)
      expect(model.get('measured_zero')!.value).toBe(0)
    },
  )
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

describe('extractPolicyRow — panel-parity field semantics (Lane 2 review fold)', () => {
  it('reads snake_case influence_score only — camelCase does not decide coverage', () => {
    expect(extractPolicyRow({ factor_id: 'a', influenceScore: 0.9, elasticity: 0.2 })).toEqual({
      key: 'a',
      influenceScore: null,
      rawElasticity: 0.2,
      importanceBasis: null,
    })
  })

  it('magnitude chain matches the panel: elasticity → sensitivity_score → sensitivity → importance_score', () => {
    expect(extractPolicyRow({ factor_id: 'a', sensitivity: 0.5 })!.rawElasticity).toBe(0.5)
    expect(
      extractPolicyRow({ factor_id: 'a', sensitivity: 0.5, sensitivity_score: 0.3 })!.rawElasticity,
    ).toBe(0.3)
    expect(extractPolicyRow({ factor_id: 'a', elasticity: -0.7, sensitivity: 0.5 })!.rawElasticity).toBe(0.7)
    expect(extractPolicyRow({ factor_id: 'a', importance_score: 0.1 })!.rawElasticity).toBe(0.1)
  })

  it('returns null for id-less or metric-less rows (absence never defaulted)', () => {
    expect(extractPolicyRow({ elasticity: 0.4 })).toBeNull()
    expect(extractPolicyRow({ factor_id: 'a' })).toBeNull()
    expect(extractPolicyRow(null)).toBeNull()
  })

  it.each([
    { elasticity: undefined, expected: Number.NaN },
    { elasticity: null, expected: Number.NaN },
    { elasticity: Number.NaN, expected: Number.NaN },
    { elasticity: Number.POSITIVE_INFINITY, expected: Number.POSITIVE_INFINITY },
    { elasticity: Number.NEGATIVE_INFINITY, expected: Number.POSITIVE_INFINITY },
  ])(
    'keeps missing/non-finite elasticity ($elasticity) invalid, never a manufactured zero',
    ({ elasticity, expected }) => {
      const row = extractPolicyRow({ factor_id: 'unranked', influence_score: 1, elasticity })
      expect(row).not.toBeNull()
      expect(row!.rawElasticity).toBe(expected)
      expect(selectDriverDisplayModel([row!]).has('unranked')).toBe(false)
    },
  )
})

describe('factor level — undefined elasticity remains unranked across wire aliases', () => {
  const levelFields: Array<{ field: string; wire: (level: number) => Record<string, unknown> }> = [
    { field: 'level', wire: level => ({ level }) },
    { field: 'baseline', wire: baseline => ({ baseline }) },
    { field: 'baseline_value', wire: baseline_value => ({ baseline_value }) },
    { field: 'observed_value', wire: observed_value => ({ observed_value }) },
    { field: 'observedValue', wire: observedValue => ({ observedValue }) },
    { field: 'observed_state.value', wire: value => ({ observed_state: { value } }) },
    { field: 'observedState.value', wire: value => ({ observedState: { value } }) },
    { field: 'value', wire: value => ({ value }) },
  ]
  const invalidLevels = [0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

  it.each(levelFields.flatMap(({ field, wire }) => invalidLevels.map(level => ({ field, wire, level }))))(
    '$field level $level cannot become the leader even with the largest |elasticity|',
    ({ wire, level }) => {
      const raw = { factor_id: 'unranked', elasticity: 10, ...wire(level) }
      // A supplied graph fallback cannot overwrite an explicit wire level.
      expect(readDriverLevel(raw)).toBe(level)
      const row = extractPolicyRow(raw, 5)!
      expect(row.level).toBe(level)
      const model = selectDriverDisplayModel([
        row,
        extractPolicyRow({ factor_id: 'leader', elasticity: 1, baseline: 2 })!,
      ])

      expect(model.has('unranked')).toBe(false)
      expect([...model.keys()]).toEqual(['leader'])
      expect(model.get('leader')!.value).toBe(1)
    },
  )

  it('uses a graph observedLevel only when the wire level is absent', () => {
    const raw = { factor_id: 'a', elasticity: 10 }
    expect(readDriverLevel(raw)).toBeUndefined()
    expect(extractPolicyRow(raw, 5)!.level).toBe(5)
    expect(extractPolicyRow({ ...raw, baseline: 2 }, 5)!.level).toBe(2)
  })

  it.each(invalidLevels)('an invalid graph observedLevel (%s) also withholds the largest row', level => {
    const row = extractPolicyRow({ factor_id: 'unranked', elasticity: 10 }, level)!
    expect(row.level).toBe(level)
    const model = selectDriverDisplayModel([
      row,
      { key: 'leader', rawElasticity: 1, level: 2 },
    ])
    expect(model.has('unranked')).toBe(false)
    expect(model.get('leader')!.value).toBe(1)
  })

  it('keeps a valid negative level eligible and accepts legacy rows without a known level', () => {
    const negative = extractPolicyRow({ factor_id: 'negative', elasticity: -2, baseline: -3 })!
    const absent = extractPolicyRow({ factor_id: 'unknown_level', elasticity: 1 })!
    expect(negative.level).toBe(-3)
    expect(absent).not.toHaveProperty('level')
    const model = selectDriverDisplayModel([negative, absent])
    expect(model.get('negative')!.value).toBe(1)
    expect(model.get('unknown_level')!.value).toBe(0.5)
  })
})

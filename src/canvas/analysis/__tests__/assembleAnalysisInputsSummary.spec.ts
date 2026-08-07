import { describe, it, expect } from 'vitest'
import { assembleAnalysisInputsSummary } from '../assembleAnalysisInputsSummary'
import { ANALYSIS_INPUTS_CONTRACT_VERSION } from '../../../types/analysis-inputs-summary'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeValidResponse(overrides?: Partial<V2RunResponse>): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt_a',
        option_label: 'Option A',
        confidence_interval: [0.3, 0.7] as [number, number],
        win_probability: 0.65,
        expected_outcome: 1.2,
      },
      {
        option_id: 'opt_b',
        option_label: 'Option B',
        confidence_interval: [0.2, 0.6] as [number, number],
        win_probability: 0.35,
        expected_outcome: 0.8,
      },
    ],
    critiques: [],
    // ROADMAP 1.30b: `drivers[]` is a legacy field the V2 wire never
    // populates (see the fix comment in assembleAnalysisInputsSummary.ts) —
    // real driver data ships as `factor_sensitivity[]`.
    factor_sensitivity: [
      { factor_id: 'f1', factor_label: 'Revenue growth', elasticity: 0.45, direction: 'positive' as const },
      { factor_id: 'f2', factor_label: 'Market share', elasticity: 0.30, direction: 'positive' as const },
      { factor_id: 'f3', factor_label: 'Customer churn', elasticity: -0.15, direction: 'negative' as const },
      { factor_id: 'f4', factor_label: 'Brand value', elasticity: 0.10, direction: 'positive' as const },
    ],
    robustness: {
      fragile_edges: [],
      robust_edges: ['e1'],
      recommendation_stability: 0.82,
    },
    response_hash: 'test-hash-123',
    meta: {
      seed_used: '42',
      n_samples: 10000,
      detail_level: 'deep',
      latency_ms: 1200,
    },
    ...overrides,
  } as V2RunResponse
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('assembleAnalysisInputsSummary', () => {
  it('returns a conformant AnalysisInputsSummary from a valid V2RunResponse', () => {
    const result = assembleAnalysisInputsSummary(makeValidResponse())

    expect(result).not.toBeNull()
    expect(result!.contract_version).toBe(ANALYSIS_INPUTS_CONTRACT_VERSION)
    expect(result!.contract_version).toBe('1.0.0')
    expect(result!.recommendation.option_id).toBe('opt_a')
    expect(result!.recommendation.win_probability).toBe(0.65)
    expect(result!.options).toHaveLength(2)
    expect(result!.top_drivers).toHaveLength(3) // capped at 3
    expect(result!.robustness!.level).toBe('moderate') // 0.82 >= 0.70 but < 0.85
    expect(result!.robustness!.recommendation_stability).toBe(0.82)
  })

  it('serialised output is ≤ 2048 bytes', () => {
    const result = assembleAnalysisInputsSummary(makeValidResponse())
    expect(result).not.toBeNull()

    const bytes = new TextEncoder().encode(JSON.stringify(result)).length
    expect(bytes).toBeLessThanOrEqual(2048)
  })

  it('returns null when option_comparison_status is not computed', () => {
    const response = makeValidResponse({ option_comparison_status: 'unavailable' })
    expect(assembleAnalysisInputsSummary(response)).toBeNull()
  })

  it('returns null when option_comparison is empty', () => {
    const response = makeValidResponse({ option_comparison: [] })
    expect(assembleAnalysisInputsSummary(response)).toBeNull()
  })

  it('returns summary without robustness when robustness_status is not computed', () => {
    const response = makeValidResponse({ robustness_status: 'unavailable' })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.robustness).toBeUndefined()
  })

  it('returns summary without robustness when robustness is missing', () => {
    const response = makeValidResponse({ robustness: undefined })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.robustness).toBeUndefined()
  })

  it('caps top_drivers at 3', () => {
    const result = assembleAnalysisInputsSummary(makeValidResponse())
    expect(result).not.toBeNull()
    expect(result!.top_drivers).toHaveLength(3)
    // The 4th driver (brand value) should be excluded
    expect(result!.top_drivers.map(d => d.factor_id)).not.toContain('f4')
  })

  it('uses actual response metadata, no fabrication', () => {
    const result = assembleAnalysisInputsSummary(makeValidResponse())
    expect(result).not.toBeNull()

    // seed comes from meta.seed_used (string → string)
    expect(result!.run_metadata.seed).toBe('42')
    // quality_mode comes from meta.detail_level
    expect(result!.run_metadata.quality_mode).toBe('deep')
  })

  it('sets run_metadata fields to null when meta is absent', () => {
    const response = makeValidResponse({ meta: undefined })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()

    expect(result!.run_metadata.seed).toBeNull()
    expect(result!.run_metadata.quality_mode).toBeNull()
    expect(result!.run_metadata.timestamp).toBeNull()
  })

  it('handles oversized payload via progressive truncation', () => {
    // Create a response with many drivers having very long labels
    const longDrivers = Array.from({ length: 3 }, (_, i) => ({
      factor_id: `f${i}`,
      factor_label: `A very long factor label that is designed to push the payload over the 2KB limit ${'x'.repeat(200)}`,
      elasticity: 0.3 - i * 0.05,
      direction: 'positive' as const,
    }))

    const response = makeValidResponse({ factor_sensitivity: longDrivers })
    const result = assembleAnalysisInputsSummary(response)

    // Should either truncate successfully or return null, but never exceed 2KB
    if (result) {
      const bytes = new TextEncoder().encode(JSON.stringify(result)).length
      expect(bytes).toBeLessThanOrEqual(2048)
    }
  })

  it('computes sensitivity_concentration correctly', () => {
    const result = assembleAnalysisInputsSummary(makeValidResponse())
    expect(result).not.toBeNull()

    // Top driver elasticity magnitude = 0.45, total = 0.45 + 0.30 + 0.15 + 0.10 = 1.0
    expect(result!.sensitivity_concentration).toBe(0.45)
  })

  it('derives moderate robustness for stability between 0.70 and 0.85', () => {
    const response = makeValidResponse({
      robustness: {
        fragile_edges: [],
        robust_edges: [],
        recommendation_stability: 0.75,
      },
    })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.robustness!.level).toBe('moderate')
  })

  it('derives fragile robustness for stability below 0.70', () => {
    const response = makeValidResponse({
      robustness: {
        fragile_edges: ['e1', 'e2'],
        robust_edges: [],
        recommendation_stability: 0.55,
      },
    })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.robustness!.level).toBe('fragile')
  })

  it('handles empty drivers gracefully', () => {
    const response = makeValidResponse({ factor_sensitivity: [] })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.top_drivers).toEqual([])
    expect(result!.sensitivity_concentration).toBe(0)
  })

  // ── ROADMAP 1.30b — structurally-empty reads (wire-accuracy fix) ─────────
  //
  // The V2 wire never carries the legacy `drivers[]` field (verified against
  // the captured staging fixture src/test/fixtures/golden-path-staging-
  // 2026-04-05.json: `drivers: null` while `factor_sensitivity[]` is
  // populated — factor_sensitivity is the field useResultsSectionData.ts
  // already treats as the authoritative PLoT v2 source), a top-level
  // `completed_at` (real field is nested at `meta.computed_at` — confirmed
  // against the same fixture's `plot_response.meta.computed_at`), or a
  // `decision_quality.overall` (the real CEE field is `.level`, enum
  // 'ready'|'caution'|'not_ready' — DecisionQualityV3 in types/cee.ts; the
  // function's OWN doc comment already said "if decision_quality provides a
  // level" while the code checked for `overall`). Before this fix all three
  // silently produced empty/fallback output on every real response.
  describe('wire-accurate field reads (ROADMAP 1.30b)', () => {
    it('builds top_drivers from factor_sensitivity (the field the V2 wire actually carries), not the never-populated legacy drivers field', () => {
      const response = makeValidResponse({
        drivers: undefined,
        factor_sensitivity: [
          { factor_id: 'fac_a', factor_label: 'Factor A', elasticity: 0.5, importance_rank: 1 },
          { factor_id: 'fac_b', factor_label: 'Factor B', sensitivity_score: 0.3, importance_rank: 2 },
          { factor_id: 'fac_c', factor_label: 'Factor C', sensitivity: 0.1, importance_rank: 3 },
        ],
      })
      const result = assembleAnalysisInputsSummary(response)
      expect(result).not.toBeNull()
      expect(result!.top_drivers).toEqual([
        { factor_id: 'fac_a', factor_label: 'Factor A', elasticity: 0.5 },
        { factor_id: 'fac_b', factor_label: 'Factor B', elasticity: 0.3 },
        { factor_id: 'fac_c', factor_label: 'Factor C', elasticity: 0.1 },
      ])
    })

    it('computes sensitivity_concentration from factor_sensitivity magnitudes', () => {
      const response = makeValidResponse({
        drivers: undefined,
        factor_sensitivity: [
          { factor_id: 'fac_a', factor_label: 'Factor A', elasticity: 0.6 },
          { factor_id: 'fac_b', factor_label: 'Factor B', elasticity: 0.3 },
          { factor_id: 'fac_c', factor_label: 'Factor C', elasticity: 0.1 },
        ],
      })
      const result = assembleAnalysisInputsSummary(response)
      expect(result).not.toBeNull()
      // top magnitude 0.6 / total 1.0
      expect(result!.sensitivity_concentration).toBe(0.6)
    })

    it('returns empty top_drivers and zero concentration when factor_sensitivity is absent (never fabricates from the dead drivers field)', () => {
      const response = makeValidResponse({ drivers: undefined, factor_sensitivity: undefined })
      const result = assembleAnalysisInputsSummary(response)
      expect(result).not.toBeNull()
      expect(result!.top_drivers).toEqual([])
      expect(result!.sensitivity_concentration).toBe(0)
    })

    it('reads run_metadata.timestamp from meta.computed_at (the real V2 wire field)', () => {
      const response = makeValidResponse({
        meta: {
          seed_used: '42',
          n_samples: 10000,
          detail_level: 'deep',
          latency_ms: 1200,
          computed_at: '2026-07-08T12:00:00.000Z',
        } as any,
      })
      const result = assembleAnalysisInputsSummary(response)
      expect(result).not.toBeNull()
      expect(result!.run_metadata.timestamp).toBe('2026-07-08T12:00:00.000Z')
    })

    it('leaves run_metadata.timestamp null when meta carries no computed_at (honest absence, no fabrication)', () => {
      const response = makeValidResponse({
        meta: { seed_used: '42', n_samples: 10000, detail_level: 'deep', latency_ms: 1200 },
      })
      const result = assembleAnalysisInputsSummary(response)
      expect(result).not.toBeNull()
      expect(result!.run_metadata.timestamp).toBeNull()
    })

    it.each([
      ['ready', 'high'],
      ['caution', 'medium'],
      ['not_ready', 'low'],
    ] as const)('derives confidence_band=%s from decision_quality.level=%s (the real CEE field)', (level, band) => {
      const response = makeValidResponse({
        decision_quality: { level, headline: 'x' } as any,
      })
      const result = assembleAnalysisInputsSummary(response)
      expect(result).not.toBeNull()
      expect(result!.confidence_band).toBe(band)
    })

    it('falls back to data-availability derivation when decision_quality is absent', () => {
      const response = makeValidResponse({ decision_quality: undefined })
      const result = assembleAnalysisInputsSummary(response)
      expect(result).not.toBeNull()
      // robustness_status + drivers_status both 'computed' on the default fixture
      expect(result!.confidence_band).toBe('medium')
    })
  })

  it('returns up to MAX_CONSTRAINTS valid constraints even when empty-label entries appear before them', () => {
    // 2 invalid entries in first 3 positions, then 4 valid ones.
    // filter-before-slice must yield 4; slice-before-filter would yield only 1.
    const response = makeValidResponse({
      option_comparison: [
        {
          option_id: 'opt_a',
          option_label: 'Option A',
          confidence_interval: [0.3, 0.7] as [number, number],
          win_probability: 0.65,
          expected_outcome: 1.2,
          constraint_analysis: {
            constraints: [
              { label: '', prob_satisfied: 0.9 },
              { label: null as unknown as string, prob_satisfied: 0.8 },
              { label: 'Budget', prob_satisfied: 0.85 },
              { label: 'Timeline', prob_satisfied: 0.75 },
              { label: 'Headcount', prob_satisfied: 0.6 },
              { label: 'Scope', prob_satisfied: 0.5 },
            ],
          },
        },
      ],
    })

    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    // 4 valid constraints, all within MAX_CONSTRAINTS (5) — should all be included
    expect(result!.constraints_status).toHaveLength(4)
    expect(result!.constraints_status.map(c => c.label)).toEqual(['Budget', 'Timeline', 'Headcount', 'Scope'])
  })

  it('filters out constraints with missing or empty labels instead of fabricating', () => {
    const response = makeValidResponse({
      option_comparison: [
        {
          option_id: 'opt_a',
          option_label: 'Option A',
          confidence_interval: [0.3, 0.7] as [number, number],
          win_probability: 0.65,
          expected_outcome: 1.2,
          constraint_analysis: {
            constraints: [
              { label: 'Budget limit', prob_satisfied: 0.8 },
              { label: null as unknown as string, prob_satisfied: 0.5 },
              { label: '', prob_satisfied: 0.9 },
              { label: 'Timeline', prob_satisfied: 0.7 },
            ],
          },
        },
      ],
    })

    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    // Should only include constraints with valid labels
    expect(result!.constraints_status).toHaveLength(2)
    expect(result!.constraints_status.map(c => c.label)).toEqual(['Budget limit', 'Timeline'])
  })

  // ── No-fabrication contract ───────────────────────────────────────────────

  it('excludes options with missing win_probability rather than defaulting to 0', () => {
    const response = makeValidResponse({
      option_comparison: [
        {
          option_id: 'opt_a',
          option_label: 'Option A',
          confidence_interval: [0.3, 0.7] as [number, number],
          win_probability: 0.65,
          expected_outcome: 1.2,
        },
        {
          option_id: 'opt_b',
          option_label: 'Option B (no probability)',
          confidence_interval: [0.2, 0.6] as [number, number],
          // win_probability intentionally absent
          expected_outcome: 0.8,
        },
      ],
    })

    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    // opt_b excluded — no fabricated 0
    expect(result!.options).toHaveLength(1)
    expect(result!.options[0].id).toBe('opt_a')
    expect(result!.options[0].win_probability).toBe(0.65)
  })

  it('returns null when no options have win_probability (cannot determine recommendation)', () => {
    const response = makeValidResponse({
      option_comparison: [
        {
          option_id: 'opt_a',
          option_label: 'Option A',
          confidence_interval: [0.3, 0.7] as [number, number],
          // win_probability absent on all
          expected_outcome: 1.2,
        },
      ],
    })

    const result = assembleAnalysisInputsSummary(response)
    // No recommendation can be determined without fabricating — null is correct
    expect(result).toBeNull()
  })

  it('omits robustness when neither recommendation_stability nor ranking_stability present', () => {
    const response = makeValidResponse({
      robustness: {
        fragile_edges: [],
        robust_edges: [],
        // Neither stability field present — no fabrication allowed
      } as any,
    })

    const result = assembleAnalysisInputsSummary(response)
    // Summary is still returned (for analysis_state propagation) but without robustness
    expect(result).not.toBeNull()
    expect(result!.robustness).toBeUndefined()
  })

  it('accepts ranking_stability as a legitimate alias for recommendation_stability', () => {
    const response = makeValidResponse({
      robustness: {
        fragile_edges: [],
        robust_edges: [],
        ranking_stability: 0.75,
        // recommendation_stability absent — ranking_stability is the fallback
      },
    })

    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.robustness!.recommendation_stability).toBe(0.75)
    expect(result!.robustness!.level).toBe('moderate') // 0.75 >= 0.70 but < 0.85
  })
})

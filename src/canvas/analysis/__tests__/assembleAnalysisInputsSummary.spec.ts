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
    drivers: [
      { node_id: 'f1', label: 'Revenue growth', contribution: 0.45, direction: 'positive' as const },
      { node_id: 'f2', label: 'Market share', contribution: 0.30, direction: 'positive' as const },
      { node_id: 'f3', label: 'Customer churn', contribution: 0.15, direction: 'negative' as const },
      { node_id: 'f4', label: 'Brand value', contribution: 0.10, direction: 'positive' as const },
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
    expect(result!.robustness.level).toBe('robust') // 0.82 >= 0.7
    expect(result!.robustness.recommendation_stability).toBe(0.82)
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

  it('returns null when robustness_status is not computed', () => {
    const response = makeValidResponse({ robustness_status: 'unavailable' })
    expect(assembleAnalysisInputsSummary(response)).toBeNull()
  })

  it('returns null when robustness is missing', () => {
    const response = makeValidResponse({ robustness: undefined })
    expect(assembleAnalysisInputsSummary(response)).toBeNull()
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
      node_id: `f${i}`,
      label: `A very long factor label that is designed to push the payload over the 2KB limit ${'x'.repeat(200)}`,
      contribution: 0.3 - i * 0.05,
      direction: 'positive' as const,
    }))

    const response = makeValidResponse({ drivers: longDrivers })
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

    // Top driver contribution = 0.45, total = 0.45 + 0.30 + 0.15 + 0.10 = 1.0
    expect(result!.sensitivity_concentration).toBe(0.45)
  })

  it('derives moderate robustness for stability between 0.4 and 0.7', () => {
    const response = makeValidResponse({
      robustness: {
        fragile_edges: [],
        robust_edges: [],
        recommendation_stability: 0.55,
      },
    })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.robustness.level).toBe('moderate')
  })

  it('derives fragile robustness for stability below 0.4', () => {
    const response = makeValidResponse({
      robustness: {
        fragile_edges: ['e1', 'e2'],
        robust_edges: [],
        recommendation_stability: 0.25,
      },
    })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.robustness.level).toBe('fragile')
  })

  it('handles empty drivers gracefully', () => {
    const response = makeValidResponse({ drivers: [] })
    const result = assembleAnalysisInputsSummary(response)
    expect(result).not.toBeNull()
    expect(result!.top_drivers).toEqual([])
    expect(result!.sensitivity_concentration).toBe(0)
  })
})

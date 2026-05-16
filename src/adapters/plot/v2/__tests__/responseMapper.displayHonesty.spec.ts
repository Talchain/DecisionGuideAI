/**
 * responseMapper display-honesty tests.
 *
 * Pins that the per-option outcome sample counts and the PLoT
 * `flip_thresholds_status` survive the V2-response → ReportV1 mapping.
 *
 * Background: without this guarantee, only fresh-run raw responses
 * could supply `nValidSamples` to the resolution-aware formatter and
 * `flipThresholdsStatus` to the all-no-effect UX. Saved or rehydrated
 * results that flow through `mapV2ResponseToReportV1` would silently
 * lose the new display-honesty signals, even though the original PLoT
 * response carried them.
 */

import { describe, it, expect } from 'vitest'
import { mapV2ResponseToReportV1 } from '../responseMapper'
import type { V2RunResponse } from '../types'

function makeResponse(overrides: Partial<V2RunResponse> = {}): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt_a',
        option_label: 'Option A',
        confidence_interval: [30, 70],
        win_probability: 0.65,
        outcome: {
          mean: 50,
          std: 12,
          p10: 30,
          p50: 50,
          p90: 70,
          n_samples: 1000,
          n_valid_samples: 1000,
          validity_ratio: 1,
        },
      },
      {
        option_id: 'opt_b',
        option_label: 'Option B',
        confidence_interval: [20, 60],
        win_probability: 0,
        outcome: {
          mean: 35,
          std: 14,
          p10: 20,
          p50: 35,
          p90: 60,
          n_samples: 1000,
          n_valid_samples: 998,
          validity_ratio: 0.998,
        },
      },
    ],
    critiques: [],
    drivers: [{ node_id: 'd', label: 'D', contribution: 0.5, direction: 'positive' }],
    edge_sensitivity: [],
    factor_sensitivity: [],
    robustness: { fragile_edges: [], robust_edges: [] },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
    ...overrides,
  }
}

describe('responseMapper display-honesty', () => {
  describe('per-option outcome sample counts', () => {
    it('preserves outcome.n_samples on option_probabilities entries', () => {
      const report = mapV2ResponseToReportV1(makeResponse(), { seed: 42 })

      expect(report.option_probabilities?.opt_a?.outcome?.n_samples).toBe(1000)
      expect(report.option_probabilities?.opt_b?.outcome?.n_samples).toBe(1000)
    })

    it('preserves outcome.n_valid_samples on option_probabilities entries (used by resolution-aware formatter)', () => {
      const report = mapV2ResponseToReportV1(makeResponse(), { seed: 42 })

      expect(report.option_probabilities?.opt_a?.outcome?.n_valid_samples).toBe(1000)
      expect(report.option_probabilities?.opt_b?.outcome?.n_valid_samples).toBe(998)
    })

    it('preserves outcome.validity_ratio on option_probabilities entries', () => {
      const report = mapV2ResponseToReportV1(makeResponse(), { seed: 42 })

      expect(report.option_probabilities?.opt_a?.outcome?.validity_ratio).toBe(1)
      expect(report.option_probabilities?.opt_b?.outcome?.validity_ratio).toBe(0.998)
    })

    it('omits the sample fields when the V2 response does not carry them (no fabricated values)', () => {
      const response = makeResponse({
        option_comparison: [
          {
            option_id: 'opt_a',
            option_label: 'Option A',
            confidence_interval: [30, 70],
            win_probability: 0.65,
            // outcome present but without sample-count fields
            outcome: { mean: 50, std: 12, p10: 30, p50: 50, p90: 70 },
          },
        ],
      })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })
      const outcome = report.option_probabilities?.opt_a?.outcome

      expect(outcome).toBeDefined()
      expect(outcome?.mean).toBe(50)
      expect(outcome?.n_samples).toBeUndefined()
      expect(outcome?.n_valid_samples).toBeUndefined()
      expect(outcome?.validity_ratio).toBeUndefined()
    })
  })

  describe('flip_thresholds_status pass-through', () => {
    it('passes flip_thresholds_status from V2 response onto the mapped report (saved/hydrated UX survives)', () => {
      const response = makeResponse({ flip_thresholds_status: 'all_no_effect' })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })

      expect((report as { flip_thresholds_status?: string }).flip_thresholds_status).toBe('all_no_effect')
    })

    it('passes flip_thresholds_status_reason when present (unresolved case)', () => {
      const response = makeResponse({
        flip_thresholds_status: 'unresolved',
        flip_thresholds_status_reason: 'timeout',
      })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })

      expect((report as { flip_thresholds_status?: string }).flip_thresholds_status).toBe('unresolved')
      expect((report as { flip_thresholds_status_reason?: string }).flip_thresholds_status_reason).toBe('timeout')
    })

    it('omits flip_thresholds_status when the V2 response does not carry it (older PLoT builds)', () => {
      const report = mapV2ResponseToReportV1(makeResponse(), { seed: 42 })

      expect((report as { flip_thresholds_status?: string }).flip_thresholds_status).toBeUndefined()
      expect((report as { flip_thresholds_status_reason?: string }).flip_thresholds_status_reason).toBeUndefined()
    })
  })
})

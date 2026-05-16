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
    // Non-empty factor_sensitivity AND at least one robust edge keep the
    // mapper's `computed-but-empty` anomaly detector quiet so failure
    // output isn't drowned in stderr noise from unrelated anomalies.
    factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.4, importance_rank: 1 }],
    robustness: { fragile_edges: [], robust_edges: ['e1'] },
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

    it('rejects NaN / Infinity on sample fields', () => {
      const response = makeResponse({
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
              // Upstream regression simulation: NaN / Infinity must NOT
              // reach the UI as undefined-or-bad sample counts.
              n_samples: NaN as unknown as number,
              n_valid_samples: Infinity as unknown as number,
              validity_ratio: -Infinity as unknown as number,
            },
          },
        ],
      })

      const outcome = mapV2ResponseToReportV1(response, { seed: 42 })
        .option_probabilities?.opt_a?.outcome

      expect(outcome).toBeDefined()
      expect(outcome?.n_samples).toBeUndefined()
      expect(outcome?.n_valid_samples).toBeUndefined()
      expect(outcome?.validity_ratio).toBeUndefined()
    })

    it('rejects sample counts that are zero, negative, or non-integer (positive-integer guard)', () => {
      const response = makeResponse({
        option_comparison: [
          {
            option_id: 'opt_a',
            option_label: 'Option A',
            confidence_interval: [30, 70],
            win_probability: 0.65,
            outcome: {
              mean: 50, std: 12, p10: 30, p50: 50, p90: 70,
              n_samples: 0,         // not positive
              n_valid_samples: -5,  // negative
              // validity_ratio omitted for this case
            },
          },
          {
            option_id: 'opt_b',
            option_label: 'Option B',
            confidence_interval: [20, 60],
            win_probability: 0.35,
            outcome: {
              mean: 35, std: 14, p10: 20, p50: 35, p90: 60,
              n_samples: 999.5,      // non-integer
              n_valid_samples: 100,  // valid; must survive
            },
          },
        ],
      })

      const optA = mapV2ResponseToReportV1(response, { seed: 42 }).option_probabilities?.opt_a?.outcome
      const optB = mapV2ResponseToReportV1(response, { seed: 42 }).option_probabilities?.opt_b?.outcome

      expect(optA?.n_samples).toBeUndefined()       // zero rejected
      expect(optA?.n_valid_samples).toBeUndefined() // negative rejected
      expect(optB?.n_samples).toBeUndefined()       // non-integer rejected
      expect(optB?.n_valid_samples).toBe(100)       // valid count preserved
    })

    it('rejects validity_ratio values outside [0, 1] (bounded-ratio guard)', () => {
      const out = (vr: number) => makeResponse({
        option_comparison: [
          {
            option_id: 'opt_a',
            option_label: 'Option A',
            confidence_interval: [30, 70],
            win_probability: 0.65,
            outcome: { mean: 50, std: 12, p10: 30, p50: 50, p90: 70, validity_ratio: vr },
          },
        ],
      })

      expect(mapV2ResponseToReportV1(out(-0.1), { seed: 42 })
        .option_probabilities?.opt_a?.outcome?.validity_ratio).toBeUndefined()
      expect(mapV2ResponseToReportV1(out(1.5), { seed: 42 })
        .option_probabilities?.opt_a?.outcome?.validity_ratio).toBeUndefined()
      // Boundary cases must survive: 0 and 1 are valid ratios.
      expect(mapV2ResponseToReportV1(out(0), { seed: 42 })
        .option_probabilities?.opt_a?.outcome?.validity_ratio).toBe(0)
      expect(mapV2ResponseToReportV1(out(1), { seed: 42 })
        .option_probabilities?.opt_a?.outcome?.validity_ratio).toBe(1)
    })
  })

  describe('top-level flip_thresholds[] pass-through', () => {
    it('passes top-level flip_thresholds[] from V2 response onto the mapped report (PLoT v2/run wire shape)', () => {
      const flips = [
        { factor_id: 'f1', factor_label: 'F1', flip_value: 0.4, flip_reason: 'found', current_value: 0.5, direction: 'decrease' },
      ]
      const response = makeResponse({ flip_thresholds: flips })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })

      expect((report as { flip_thresholds?: unknown }).flip_thresholds).toEqual(flips)
    })

    it('falls back to robustness.flip_thresholds when the V2 response only nests them there (legacy shape)', () => {
      const nested = [
        { factor_id: 'f2', factor_label: 'F2', flip_value: null, flip_reason: 'no_effect_within_bounds', current_value: 0.5, direction: 'increase' },
      ]
      const response = makeResponse({
        flip_thresholds: undefined,
        robustness: { fragile_edges: [], robust_edges: ['e1'], flip_thresholds: nested as unknown as never },
      })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })

      expect((report as { flip_thresholds?: unknown }).flip_thresholds).toEqual(nested)
    })

    it('omits report.flip_thresholds when neither source is present', () => {
      const report = mapV2ResponseToReportV1(makeResponse(), { seed: 42 })

      expect((report as { flip_thresholds?: unknown }).flip_thresholds).toBeUndefined()
    })
  })

  describe('flip_thresholds_status pass-through', () => {
    it('passes flip_thresholds_status from V2 response onto the mapped report (saved/hydrated UX survives)', () => {
      const response = makeResponse({ flip_thresholds_status: 'all_no_effect' })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })

      expect((report as { flip_thresholds_status?: string }).flip_thresholds_status).toBe('all_no_effect')
    })

    it('passes flip_thresholds_status_reason when PLoT emits it (unresolved case)', () => {
      const response = makeResponse({
        flip_thresholds_status: 'unresolved',
        flip_thresholds_status_reason: 'timeout',
      })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })

      expect((report as { flip_thresholds_status?: string }).flip_thresholds_status).toBe('unresolved')
      expect((report as { flip_thresholds_status_reason?: string }).flip_thresholds_status_reason).toBe('timeout')
    })

    it('passes flip_thresholds_status_reason when PLoT emits it on partial_no_effect+unresolved (mixed-with-unresolved case)', () => {
      // Per the PLoT classifier contract, status_reason is also emitted
      // on 'partial_no_effect' when unresolved entries are present
      // alongside computed and no_effect ones. The mapper must surface
      // it in BOTH cases so DGAI can soften copy that would otherwise
      // imply every non-computed factor was a harmless no_effect case.
      const response = makeResponse({
        flip_thresholds_status: 'partial_no_effect',
        flip_thresholds_status_reason: 'insufficient_precision',
      })

      const report = mapV2ResponseToReportV1(response, { seed: 42 })

      expect((report as { flip_thresholds_status?: string }).flip_thresholds_status).toBe('partial_no_effect')
      expect((report as { flip_thresholds_status_reason?: string }).flip_thresholds_status_reason).toBe('insufficient_precision')
    })

    it('omits flip_thresholds_status when the V2 response does not carry it (older PLoT builds)', () => {
      const report = mapV2ResponseToReportV1(makeResponse(), { seed: 42 })

      expect((report as { flip_thresholds_status?: string }).flip_thresholds_status).toBeUndefined()
      expect((report as { flip_thresholds_status_reason?: string }).flip_thresholds_status_reason).toBeUndefined()
    })
  })
})

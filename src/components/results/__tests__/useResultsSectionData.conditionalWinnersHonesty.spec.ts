/**
 * useResultsSectionData — conditional-winners projection honesty
 * (V6 Science-to-Reasoning slice).
 *
 * The projection at the report→VM seam must CARRY the producer's contract
 * (schemas 0.46 EnrichmentConditionalWinnerSchema) instead of stripping it:
 *   - `winner_id` / `runner_up_id` / `runner_up_label` / `winner_flips` /
 *     `mean_outcome` travel verbatim;
 *   - absence is preserved as absence (withheld-projection rows keep their
 *     identity-stripped shape; nothing is coerced to '' or 0);
 *   - a row with a non-finite split_value is DROPPED (PLoT's own disposal
 *     rule, run.ts:681-689 ConditionalWinnerDraft) — never defaulted to 0;
 *   - a present-but-corrupt win_probability poisons its row (PLoT's
 *     numeric-egress rule); an ABSENT one stays absent (the pre-0.44
 *     persisted wire shape carries none, and 0% must not be minted for it);
 *   - `recommendedOptionId` is the robustness recommended_option_id VERBATIM
 *     (never the UI's tie-breaker fallback chain) — absent stays absent.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option B' } },
]

const fullWireRow = (overrides: Record<string, unknown> = {}) => ({
  factor_id: 'fac_growth',
  factor_label: 'Market growth',
  split_value: 42.5,
  split_unit: '%',
  winner_flips: true,
  high_bucket: {
    winner_id: 'opt_b',
    winner_label: 'Option B',
    runner_up_id: 'opt_a',
    runner_up_label: 'Option A',
    win_probability: 0.7,
    mean_outcome: 120.5,
  },
  low_bucket: {
    winner_id: 'opt_a',
    winner_label: 'Option A',
    runner_up_id: 'opt_b',
    runner_up_label: 'Option B',
    win_probability: 0.6,
    mean_outcome: 88.25,
  },
  ...overrides,
})

function setStoreWithReport(reportOverrides: Record<string, unknown>): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        analysis_status: 'computed',
        robustness: { fragile_edges: [], robust_edges: [] },
        ...reportOverrides,
      },
    } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

beforeEach(() => {
  useCanvasStore.setState({
    results: null,
    runMeta: null,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: false,
    rawV2Response: null,
  } as any)
})

describe('useResultsSectionData — conditional winners carry the producer contract', () => {
  it('carries winner_id, runner_up_*, winner_flips and mean_outcome verbatim (identity bound by id, not label)', () => {
    setStoreWithReport({
      conditional_winners: [fullWireRow()],
      robustness: { fragile_edges: [], robust_edges: [], recommended_option_id: 'opt_a' },
    })
    const { result } = renderHook(() => useResultsSectionData())
    const winners = result.current.confidence.conditionalWinners
    expect(winners).toHaveLength(1)
    const w = winners![0]
    // Identity binding: assert by id on the exact row (trap 19).
    expect(w.factor_id).toBe('fac_growth')
    expect(w.high_bucket.winner_id).toBe('opt_b')
    expect(w.high_bucket.runner_up_id).toBe('opt_a')
    expect(w.high_bucket.runner_up_label).toBe('Option A')
    expect(w.high_bucket.mean_outcome).toBe(120.5)
    expect(w.low_bucket.winner_id).toBe('opt_a')
    expect(w.winner_flips).toBe(true)
    expect(w.split_value).toBe(42.5)
    expect(w.high_bucket.win_probability).toBe(0.7)
  })

  it('preserves the withheld-projection shape: stripped identity stays ABSENT, not ""', () => {
    // Exactly the shape CEE's projectConditionalWinnersForWithheldClaim emits
    // (withheld-claim-projection.ts:914-937 @ fa8bacc5): bucket identity
    // members deleted, probabilities kept, row-level factor fields kept.
    setStoreWithReport({
      conditional_winners: [
        fullWireRow({
          high_bucket: { win_probability: 0.7 },
          low_bucket: { win_probability: 0.6 },
        }),
      ],
    })
    const { result } = renderHook(() => useResultsSectionData())
    const w = result.current.confidence.conditionalWinners![0]
    // Absence preserved as absence — the old projection minted '' here.
    expect('winner_label' in w.high_bucket).toBe(false)
    expect('winner_id' in w.high_bucket).toBe(false)
    expect(w.high_bucket.winner_label).toBeUndefined()
    expect(w.high_bucket.win_probability).toBe(0.7)
    expect(w.winner_flips).toBe(true)
  })

  it('drops a row with a non-finite split_value; keeps a producer-sent 0 (positive control)', () => {
    setStoreWithReport({
      conditional_winners: [
        fullWireRow({ factor_id: 'fac_absent', factor_label: 'Absent split' , split_value: undefined }),
        fullWireRow({ factor_id: 'fac_nan', factor_label: 'NaN split', split_value: Number.NaN }),
        fullWireRow({ factor_id: 'fac_zero', factor_label: 'Zero split', split_value: 0 }),
      ],
    })
    const { result } = renderHook(() => useResultsSectionData())
    const winners = result.current.confidence.conditionalWinners
    // Identity-bound: the surviving row is the zero-split row, by id.
    expect(winners).toHaveLength(1)
    expect(winners![0].factor_id).toBe('fac_zero')
    expect(winners![0].split_value).toBe(0)
  })

  it('keeps absent win_probability ABSENT (pre-0.44 persisted rows) and drops a present-but-corrupt one', () => {
    setStoreWithReport({
      conditional_winners: [
        // The real persisted staging shape (15 rows, Apr–Jun 2026): identity +
        // attestation, no probabilities anywhere.
        fullWireRow({
          factor_id: 'fac_historic',
          factor_label: 'Historic shape',
          high_bucket: { winner_id: 'opt_b', winner_label: 'Option B', runner_up_id: 'opt_a', runner_up_label: 'Option A' },
          low_bucket: { winner_id: 'opt_a', winner_label: 'Option A', runner_up_id: 'opt_b', runner_up_label: 'Option B' },
        }),
        // A corrupt probability poisons its row (PLoT prob01 egress rule).
        fullWireRow({
          factor_id: 'fac_corrupt',
          factor_label: 'Corrupt probability',
          high_bucket: { winner_id: 'opt_b', winner_label: 'Option B', win_probability: 1.7 },
          low_bucket: { winner_id: 'opt_a', winner_label: 'Option A', win_probability: 0.6 },
        }),
      ],
    })
    const { result } = renderHook(() => useResultsSectionData())
    const winners = result.current.confidence.conditionalWinners
    expect(winners).toHaveLength(1)
    const w = winners![0]
    expect(w.factor_id).toBe('fac_historic')
    // Absent probability stays absent — no minted 0.
    expect('win_probability' in w.high_bucket).toBe(false)
    expect(w.high_bucket.win_probability).toBeUndefined()
    // Identity still travels.
    expect(w.high_bucket.winner_id).toBe('opt_b')
    expect(w.winner_flips).toBe(true)
  })

  it('exposes recommendedOptionId from robustness.recommended_option_id verbatim; absent stays absent', () => {
    setStoreWithReport({
      conditional_winners: [fullWireRow()],
      robustness: { fragile_edges: [], robust_edges: [], recommended_option_id: 'opt_a' },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.confidence.recommendedOptionId).toBe('opt_a')
  })

  it('leaves recommendedOptionId undefined when robustness carries no recommended_option_id — never the tie-breaker', () => {
    // The report-level fallback chain (recommendation.option_id etc.) and the
    // UI tie-breaker must NOT leak into the identity used for direction
    // binding: a UI-invented recommendation would be a guess wearing an ID.
    setStoreWithReport({
      conditional_winners: [fullWireRow()],
      recommendation: { option_id: 'opt_b' },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.confidence.recommendedOptionId).toBeUndefined()
  })
})

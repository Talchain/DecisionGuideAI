/**
 * Hero rows × first-run ordinal registration — rank coherence.
 *
 * End-to-end half of the option-rank-coherence contract (hook half in
 * `../../__tests__/useResultsSectionData.optionRankCoherence.spec.ts`;
 * this file lives inside the analysis-hero module because the inertness
 * guard forbids importing the hero from anywhere else).
 *
 * Production screenshot bug: badge "4" rendered ABOVE badge "3" because
 * ordinals were seeded from an expected-value order while the rows sort by
 * win probability (sortOptionsForDisplay). Pinned here: driving the REAL
 * hook (mapped report → registration effect → store numbering) and building
 * the hero model from its output yields stable numbers that ascend strictly
 * top-to-bottom on a first run.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useCanvasStore } from '../../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../../adapters/plot/v2/types'

/**
 * The verified screenshot shape: expected-value order (launch, partner,
 * outsource, solo) diverges from win-probability order (launch, partner,
 * solo, outsource).
 */
const SCREENSHOT_OPTIONS = [
  { id: 'opt_launch', label: 'Launch Course', mean: 36, winProbability: 0.78 },
  { id: 'opt_partner', label: 'Partner Up', mean: 30, winProbability: 0.12 },
  { id: 'opt_outsource', label: 'Outsource', mean: 18, winProbability: 0.02 },
  { id: 'opt_solo', label: 'Continue Solo', mean: 12, winProbability: 0.08 },
]

function makeV2Response(): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: SCREENSHOT_OPTIONS.map((o) => ({
      option_id: o.id,
      option_label: o.label,
      confidence_interval: [o.mean - 10, o.mean + 10],
      win_probability: o.winProbability,
      outcome: {
        mean: o.mean, std: 5, p10: o.mean - 10, p50: o.mean, p90: o.mean + 10,
        n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1,
      },
    })),
    critiques: [],
    drivers: [{ node_id: 'd', label: 'D', contribution: 0.5, direction: 'positive' }],
    edge_sensitivity: [],
    factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.4, importance_rank: 1 }],
    robustness: { fragile_edges: [], robust_edges: ['e1'] },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  }
}

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

beforeEach(() => {
  const report = mapV2ResponseToReportV1(makeV2Response(), { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as any,
    runMeta: {} as any,
    nodes: SCREENSHOT_OPTIONS.map((o) => ({
      id: o.id,
      type: 'option',
      position: { x: 0, y: 0 },
      data: { kind: 'option', label: o.label },
    })) as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
    optionNumbering: {},
  } as any)
})

describe('hero rows × first-run registration — rank coherence', () => {
  it('stable numbers ascend strictly top-to-bottom on a first-run registration (no "4 above 3")', () => {
    const { result } = renderHook(() => useResultsSectionData())
    const model = chart(
      buildHeroModel(result.current, useCanvasStore.getState().optionNumbering),
    )

    const stableNumbers = model.rows.map((r) => r.stableNumber)
    expect(stableNumbers).toEqual([1, 2, 3, 4])
    for (let i = 1; i < stableNumbers.length; i += 1) {
      expect(stableNumbers[i]!).toBeGreaterThan(stableNumbers[i - 1]!)
    }
  })

  it('row order and badge order agree with the win-probability ranking', () => {
    const { result } = renderHook(() => useResultsSectionData())
    const model = chart(
      buildHeroModel(result.current, useCanvasStore.getState().optionNumbering),
    )

    expect(model.rows.map((r) => r.id)).toEqual([
      'opt_launch', // 78%
      'opt_partner', // 12%
      'opt_solo', // 8%
      'opt_outsource', // 2%
    ])
  })
})

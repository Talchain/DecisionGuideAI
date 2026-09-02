/**
 * Hero rows × first-run ordinal registration — RANK and IDENTITY are different.
 *
 * End-to-end half of the option-numbering contract (hook half in
 * `../../__tests__/useResultsSectionData.optionRankCoherence.spec.ts`; this
 * file lives inside the analysis-hero module because the inertness guard
 * forbids importing the hero from anywhere else).
 *
 * ⭐ THE CONTRACT CHANGED, 31 Aug 2026. It used to be "stable numbers ascend
 * strictly top-to-bottom on a first run" — i.e. `Option N` WAS the first run's
 * rank. Paul's canvas screenshot showed what that costs: the option cards read
 * `1, 2, 4, 5, 3` left to right, because a rank minted in the results panel
 * was printed on a row ordered by ELK.
 *
 * `Option N` is now POSITIONAL IDENTITY — the Nth option card in canvas
 * reading order (row-major: y-row, then x). So on a first run the hero's two
 * numbers are DIFFERENT QUANTITIES and are expected to disagree:
 *
 *   `row.index`       RANK — where this option placed in this run. Re-ranks
 *                     on every run.
 *   `row.stableNumber` IDENTITY — which card on the canvas this is. Frozen at
 *                     first mint, never renumbered.
 *
 * That they differ from the FIRST run (not merely after a leader flip, which
 * `rerunFlipNumbering.rankCoherence.spec.tsx` already pins) is the property
 * this file now exists to hold.
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

/**
 * Canvas geometry, chosen so reading order contradicts BOTH the array order
 * and the win-probability order — otherwise a badge could match a rank by
 * coincidence and this file would assert nothing.
 *
 *   row 1 (y=100):  opt_solo (x=40)     opt_outsource (x=340)
 *   row 2 (y=520):  opt_partner (x=40)  opt_launch (x=340)
 */
const CANVAS_POSITION: Record<string, { x: number; y: number }> = {
  opt_solo: { x: 40, y: 100 },
  opt_outsource: { x: 340, y: 100 },
  opt_partner: { x: 40, y: 520 },
  opt_launch: { x: 340, y: 520 },
}

/** Canvas reading order → the ordinal each id must be minted with. */
const CANVAS_ORDINAL: Record<string, number> = {
  opt_solo: 1,
  opt_outsource: 2,
  opt_partner: 3,
  opt_launch: 4,
}

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
    // ROADMAP 1.267: this spec pins BADGE-METRIC == SORT-METRIC coherence,
    // which is a property of a PERMITTED run — on a withheld run there is no
    // ranking to be coherent with, and rows/ordinals go canonical instead
    // (see withheldDesignations.spec). The fixture therefore has to carry a
    // producer leader claim; without one `deriveDecisionVerdict` returns
    // `unknown` (silence is meaningful post-CEE-#711) and this spec would
    // silently become a withheld-run test asserting the old order.
    // `near_tie` is PLoT's own "is there a clear leader?" answer and is
    // passed through verbatim by the V2 responseMapper.
    robustness: {
      fragile_edges: [],
      robust_edges: ['e1'],
      near_tie: { is_tie: false, top_option_id: 'opt_launch' },
    },
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
      position: CANVAS_POSITION[o.id],
      data: { kind: 'option', label: o.label },
    })) as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
    optionNumbering: {},
  } as any)
})

describe('hero rows × first-run registration — rank coherence', () => {
  it('⭐ rank and identity are different quantities from the FIRST run — index ranks, stableNumber identifies', () => {
    const { result } = renderHook(() => useResultsSectionData())
    const model = chart(
      buildHeroModel(result.current, useCanvasStore.getState().optionNumbering),
    )

    // RANK: the rows are the run's ranking, so index counts 1..N down the panel.
    expect(model.rows.map((r) => r.index)).toEqual([1, 2, 3, 4])

    // IDENTITY: each row's stableNumber is ITS OWN id's canvas ordinal — bound
    // by identity, never by position in this array (trap 19: another row could
    // satisfy a value predicate).
    for (const row of model.rows) {
      expect(row.stableNumber).toBe(CANVAS_ORDINAL[row.id])
    }

    // ⭐ AND THEY DISAGREE. Without this the two assertions above would both
    // hold on the old first-run-rank behaviour, and this file would still be
    // pinning the defect. Rows run launch(4), partner(3), solo(1), outsource(2).
    expect(model.rows.map((r) => r.stableNumber)).not.toEqual(model.rows.map((r) => r.index))
    expect(model.rows.map((r) => r.stableNumber)).toEqual([4, 3, 1, 2])
  })

  it('ROW order follows the win-probability ranking (the badge no longer does, by design)', () => {
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

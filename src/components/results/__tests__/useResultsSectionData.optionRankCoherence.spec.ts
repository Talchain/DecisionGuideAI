/**
 * useResultsSectionData — option rank coherence (badge metric = sort metric).
 *
 * Production screenshot bug: the options list rendered badge "4" ABOVE
 * badge "3". Mechanism: the hook sorted `allOptions` by EXPECTED VALUE and
 * registered stable ordinals in that order (append-only, never re-sorted),
 * but every list surface orders rows via `sortOptionsForDisplay`, which
 * ranks by WIN PROBABILITY whenever all options carry one. With expected
 * +36/+30/+18/+12 (ordinals 1/2/3/4) and win probs 78/12/2/8, the display
 * order was 78/12/8/2 — so the 8% option (badge 4) sat above the 2% option
 * (badge 3).
 *
 * Contract pinned here: registration order = display order = allOptions
 * order (one metric per surface), while the append-only stability of
 * `assignStableOptionNumbers` is preserved (ordinals freeze after first
 * registration; later reruns and lens switches never renumber).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
import { buildHeroModel } from '../analysis-hero/buildHeroModel'
import type { HeroChartModel } from '../analysis-hero/heroTypes'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

/**
 * The verified screenshot shape: expected-value order (launch, partner,
 * outsource, solo) DIVERGES from win-probability order (launch, partner,
 * solo, outsource).
 */
interface OptionShape {
  id: string
  label: string
  mean: number
  winProbability: number
}

const SCREENSHOT_OPTIONS: OptionShape[] = [
  { id: 'opt_launch', label: 'Launch Course', mean: 36, winProbability: 0.78 },
  { id: 'opt_partner', label: 'Partner Up', mean: 30, winProbability: 0.12 },
  { id: 'opt_outsource', label: 'Outsource', mean: 18, winProbability: 0.02 },
  { id: 'opt_solo', label: 'Continue Solo', mean: 12, winProbability: 0.08 },
]

/** Display order (win probability descending): 78%, 12%, 8%, 2%. */
const DISPLAY_ORDER_IDS = ['opt_launch', 'opt_partner', 'opt_solo', 'opt_outsource']

function makeV2Response(options: OptionShape[]): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: options.map((o) => ({
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

function optionNodesFor(options: OptionShape[]) {
  return options.map((o) => ({
    id: o.id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label: o.label },
  }))
}

function setStoreWithMappedReport(options: OptionShape[]): void {
  const report = mapV2ResponseToReportV1(makeV2Response(options), { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as any,
    runMeta: {} as any,
    nodes: optionNodesFor(options) as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

beforeEach(() => {
  useCanvasStore.setState({
    results: null,
    rawV2Response: null,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: false,
    optionNumbering: {},
  } as any)
})

describe('useResultsSectionData — option rank coherence', () => {
  it('registers stable ordinals in the shared display order (win probability), not expected value', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)

    renderHook(() => useResultsSectionData())

    // 1 = 78%, 2 = 12%, 3 = 8%, 4 = 2% — the order every list renders in.
    expect(useCanvasStore.getState().optionNumbering).toEqual({
      opt_launch: 1,
      opt_partner: 2,
      opt_solo: 3,
      opt_outsource: 4,
    })
  })

  it('presents allOptions in the shared display order (one metric per surface)', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)

    const { result } = renderHook(() => useResultsSectionData())
    const allOptions = result.current.recommendation?.allOptions ?? []

    expect(allOptions.map((o) => o.id)).toEqual(DISPLAY_ORDER_IDS)
    // Self-consistency: the array is already a fixed point of the shared sort.
    expect(sortOptionsForDisplay(allOptions).map((o) => o.id)).toEqual(
      allOptions.map((o) => o.id),
    )
  })

  it('hero rows carry strictly ascending stable numbers on a first-run registration (no "4 above 3")', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)

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

  it('keeps ordinals frozen when a later run re-registers in a different order (append-only)', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)
    renderHook(() => useResultsSectionData())
    const firstRun = { ...useCanvasStore.getState().optionNumbering }

    // Rerun: win probabilities flip AND a new option appears. Existing ids
    // must keep their first-run ordinals; only the new id gets the next one.
    const rerun: OptionShape[] = [
      { id: 'opt_launch', label: 'Launch Course', mean: 36, winProbability: 0.05 },
      { id: 'opt_partner', label: 'Partner Up', mean: 30, winProbability: 0.1 },
      { id: 'opt_outsource', label: 'Outsource', mean: 18, winProbability: 0.6 },
      { id: 'opt_solo', label: 'Continue Solo', mean: 12, winProbability: 0.05 },
      { id: 'opt_new', label: 'New Idea', mean: 40, winProbability: 0.2 },
    ]
    setStoreWithMappedReport(rerun)
    renderHook(() => useResultsSectionData())

    expect(useCanvasStore.getState().optionNumbering).toEqual({
      ...firstRun,
      opt_new: 5,
    })
  })

  it('re-rendering with unchanged options leaves the numbering map reference-equal (no renumbering churn)', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)
    const { rerender } = renderHook(() => useResultsSectionData())
    const before = useCanvasStore.getState().optionNumbering

    rerender()

    expect(useCanvasStore.getState().optionNumbering).toBe(before)
  })

  it('falls back to expected-value order for registration when win-probability coverage is partial', () => {
    // Mixed coverage must not fabricate a win-probability ranking —
    // sortOptionsForDisplay falls back to expected descending, and the
    // registration follows the same rule.
    const partial: OptionShape[] = [
      { id: 'opt_launch', label: 'Launch Course', mean: 36, winProbability: 0.78 },
      { id: 'opt_partner', label: 'Partner Up', mean: 30, winProbability: undefined as unknown as number },
      { id: 'opt_solo', label: 'Continue Solo', mean: 12, winProbability: 0.08 },
    ]
    setStoreWithMappedReport(partial)

    renderHook(() => useResultsSectionData())

    expect(useCanvasStore.getState().optionNumbering).toEqual({
      opt_launch: 1,
      opt_partner: 2,
      opt_solo: 3,
    })
  })
})

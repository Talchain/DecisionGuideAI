/**
 * useResultsSectionData — what `Option N` MEANS, and what it does not.
 *
 * Two production screenshots, one seam.
 *
 *  1. (earlier) The options LIST rendered badge "4" above badge "3", because
 *     ordinals were minted in an expected-value order while the list sorts by
 *     win probability.
 *  2. (Paul, 31 Aug 2026) The option CARDS ON THE CANVAS carried badges
 *     reading `1, 2, 4, 5, 3` left to right: "Either order the row by rank or
 *     stop putting ordinals on a non-ordered row."
 *
 * Fix 1 made the badge a first-run PROBABILITY RANK. That is what defect 2 is
 * — a rank frozen from the results panel, printed on a row whose left-to-right
 * order is ELK's. The two agreed only by coincidence.
 *
 * ⭐ THE CONTRACT PINNED HERE, and it is a DIFFERENT one from the old file:
 * `Option N` is POSITIONAL IDENTITY — the Nth option card in canvas reading
 * order (row-major: y-row, then x) at the moment the numbers are first minted.
 * It is not a rank and never was entitled to be one. RANK is `row.index` on
 * the hero rows, a separate quantity that re-ranks freely on every run
 * (`../analysis-hero/__tests__/rerunFlipNumbering.rankCoherence.spec.tsx` and
 * `./ResultsBody.crossSurfaceOptionNumbering.spec.tsx` pin that the two are
 * different quantities and stay different).
 *
 * The store now owns ORDER (it sorts by canvas position); callers own
 * MEMBERSHIP (which ids exist). `sortOptionsForDisplay` is therefore GONE from
 * the registration path — it still authors the display ranking everywhere
 * else, which is the whole point: one order per question.
 *
 * The append-only stability of `assignStableOptionNumbers` is unchanged:
 * ordinals freeze after first registration, so later reruns and lens switches
 * never renumber, and an option added mid-row gets `max+1` wherever it lands.
 *
 * The hero-row half lives in
 * `../analysis-hero/__tests__/firstRunNumbering.rankCoherence.spec.ts` — the
 * inertness guard allows analysis-hero imports only inside the module.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
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

/**
 * Canvas geometry, chosen so reading order contradicts BOTH the array order
 * and the probability order. Two rows, and within each row the LEFT card is
 * the one the other two orders put LAST — a function that ignored position
 * could not produce the expected result by coincidence.
 *
 *   row 1 (y=100):  opt_solo (x=40)     opt_outsource (x=340)
 *   row 2 (y=520):  opt_partner (x=40)  opt_launch (x=340)
 *
 * Reading order: solo, outsource, partner, launch.
 */
const CANVAS_POSITION: Record<string, { x: number; y: number }> = {
  opt_solo: { x: 40, y: 100 },
  opt_outsource: { x: 340, y: 100 },
  opt_partner: { x: 40, y: 520 },
  opt_launch: { x: 340, y: 520 },
}

/** Canvas reading order of the four screenshot options (row-major). */
const CANVAS_ORDER_IDS = ['opt_solo', 'opt_outsource', 'opt_partner', 'opt_launch']

function optionNodesFor(options: OptionShape[]) {
  return options.map((o) => ({
    id: o.id,
    type: 'option',
    position: CANVAS_POSITION[o.id] ?? { x: 0, y: 0 },
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
  it('⭐ registers stable ordinals in CANVAS READING ORDER — not array order, not probability order', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)

    // PRECONDITION, asserted in-test (trap 13b): all THREE orders must genuinely
    // differ, or this test would pass for a function that picked any of them.
    const arrayOrder = SCREENSHOT_OPTIONS.map((o) => o.id)
    const probabilityOrder = DISPLAY_ORDER_IDS
    expect(CANVAS_ORDER_IDS).not.toEqual(arrayOrder)
    expect(CANVAS_ORDER_IDS).not.toEqual(probabilityOrder)
    expect(arrayOrder).not.toEqual(probabilityOrder)

    renderHook(() => useResultsSectionData())

    // Row-major: solo and outsource share the top row (solo is left of it),
    // then partner and launch on the row below. Left to right, top to bottom,
    // the badges now read 1, 2, 3, 4 — which is the whole defect.
    expect(useCanvasStore.getState().optionNumbering).toEqual({
      opt_solo: 1,
      opt_outsource: 2,
      opt_partner: 3,
      opt_launch: 4,
    })
  })

  it('⭐ THE USER-VISIBLE PROPERTY: ordinals ascend 1..N along the canvas reading order', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)

    renderHook(() => useResultsSectionData())
    const numbering = useCanvasStore.getState().optionNumbering

    // Stated as the property rather than the literal map, so it keeps meaning
    // the same thing if the fixture geometry is ever changed: read the cards
    // in canvas order and the badges count up without a gap or a jump back.
    expect(CANVAS_ORDER_IDS.map((id) => numbering[id])).toEqual([1, 2, 3, 4])
  })

  it('presents allOptions in the shared display order (one metric per surface)', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)

    const { result } = renderHook(() => useResultsSectionData())
    const allOptions = result.current.recommendation?.allOptions ?? []

    expect(allOptions.map((o) => o.id)).toEqual(DISPLAY_ORDER_IDS)
    // Self-consistency: the array is already a fixed point of the shared sort.
    expect(sortOptionsForDisplay(allOptions, { designationsWithheld: false }).map((o) => o.id)).toEqual(
      allOptions.map((o) => o.id),
    )
  })

  it('keeps ordinals frozen when a later run re-registers in a different order (append-only)', () => {
    setStoreWithMappedReport(SCREENSHOT_OPTIONS)
    renderHook(() => useResultsSectionData())
    const firstRun = { ...useCanvasStore.getState().optionNumbering }

    // Rerun: win probabilities flip AND a new option appears. Existing ids
    // must keep their first-run ordinals; only the new id gets the next one —
    // `max + 1`, WHEREVER it lands on the canvas. That residual is deliberate
    // and documented: identity is append-only, so a card inserted mid-row
    // carries the next free number rather than renumbering its neighbours.
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

  it('registers in canvas order regardless of win-probability COVERAGE — the metric no longer decides', () => {
    // Mixed coverage used to change the registration order, because the
    // registration rode `sortOptionsForDisplay` and that function falls back
    // from win probability to expected value when coverage is partial. Canvas
    // position is not a metric, so partial coverage cannot move a badge at all.
    const partial: OptionShape[] = [
      { id: 'opt_launch', label: 'Launch Course', mean: 36, winProbability: 0.78 },
      { id: 'opt_partner', label: 'Partner Up', mean: 30, winProbability: undefined as unknown as number },
      { id: 'opt_solo', label: 'Continue Solo', mean: 12, winProbability: 0.08 },
    ]

    // PRECONDITION: with this coverage the OLD rule (expected descending:
    // launch, partner, solo) and the canvas order genuinely disagree, so a
    // regression to metric-ordered registration REDs here.
    const expectedValueOrder = ['opt_launch', 'opt_partner', 'opt_solo']
    const canvasOrder = ['opt_solo', 'opt_partner', 'opt_launch']
    expect(canvasOrder).not.toEqual(expectedValueOrder)

    setStoreWithMappedReport(partial)

    renderHook(() => useResultsSectionData())

    // solo alone on the top row; partner (x=40) then launch (x=340) below it.
    expect(useCanvasStore.getState().optionNumbering).toEqual({
      opt_solo: 1,
      opt_partner: 2,
      opt_launch: 3,
    })
  })
})

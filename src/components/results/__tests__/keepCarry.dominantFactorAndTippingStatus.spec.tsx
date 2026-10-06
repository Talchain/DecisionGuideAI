/**
 * KEEP-CARRY, UI leg (science census 6 Oct 2026, §2d C3 + C5, §4 rank 4).
 *
 * PLoT emits `dominant_factor` and `flip_thresholds_status` (+ `_reason`) on
 * every /v2/run. The Results hook ALREADY reads all three off `report`
 * (`useResultsSectionData`: the "B2" dominant-factor reads and the
 * `flipThresholdsStatus` fallback chain), but `mapV5AnalysisToReport` — the
 * only writer of `results.report` on the V5 path, turn and reload — never
 * wrote them. So on every V5 run:
 *   - the Reasoning tab's "<factor> dominates the model" insight could not
 *     appear (the recommendation memo has no other live source: its only
 *     fallback, `m1_coaching`, is not transported either), and
 *   - the tornado's status note ("No single tested factor changed …") could
 *     not appear, and the Reasoning tipping-point gate ran blind.
 *
 * READER FIRST. CEE drops all three at its keep-list today, so this leg is a
 * no-op on the served wire until schemas 0.80.0 keep-lists them and CEE
 * transports them. Each row below therefore drives a SYNTHESISED block shaped
 * like PLoT's producer types (`engine-v3.ts` `dominant_factor`,
 * `flip_thresholds_status`) — a claim about this mapper and the readers it
 * feeds, NOT a live-wire claim.
 *
 * BOUND BY IDENTITY: the field name, the factor id, and the exact words the
 * reader renders. Every positive row has a same-block control without the
 * field, and the control must show the reader's absent branch.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { useAnalysisNewViewModel } from '../analysisNew/useAnalysisNewViewModel'
import { flipThresholdStatusNote } from '../utils/flipThresholdStatusNote'

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>
type StoreState = ReturnType<typeof useCanvasStore.getState>

const FACTOR_ID = 'fac_customer_demand'
const FACTOR_LABEL = 'Customer demand'
const DOMINANT_INSIGHT_ID = 'insight:dominant-factor'

function block(extra: Record<string, unknown>): AnalysisResultBlock {
  return {
    type: 'analysis_result',
    summary: 'Analysis complete',
    leading_option_id: 'opt_a',
    win_probabilities: { opt_a: 0.62, opt_b: 0.38 },
    enrichment: {
      option_comparison: [
        { option_id: 'opt_a', option_label: 'Expand online', win_probability: 0.62 },
        { option_id: 'opt_b', option_label: 'Open a shop', win_probability: 0.38 },
      ],
      factor_sensitivity: [
        { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL, sensitivity: 0.8, influence_score: 0.8 },
        { factor_id: 'fac_price', factor_label: 'Price', sensitivity: 0.2, influence_score: 0.2 },
      ],
      flip_thresholds: [],
      ...extra,
    },
  } as unknown as AnalysisResultBlock
}

function mapped(extra: Record<string, unknown>): WidenedReport {
  return mapV5AnalysisToReport(block(extra)) as WidenedReport
}

/** The Results hook and the Reasoning view model over the mapped report, through the real store. */
function readersOver(extra: Record<string, unknown>) {
  const report = mapped(extra)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report, hash: 'h-keep-carry' } as unknown as StoreState['results'],
    hasCompletedFirstRun: true,
  } as Partial<StoreState>)
  const { result } = renderHook(() => {
    const data = useResultsSectionData()
    const vm = useAnalysisNewViewModel({
      data,
      isPreRun: false,
      isRunning: false,
      isStale: false,
      responseHash: 'h-keep-carry',
    })
    return { data, vm }
  })
  return result.current
}

beforeEach(() => {
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as unknown as StoreState['results'],
    runMeta: {} as StoreState['runMeta'],
    nodes: [
      { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Expand online' } },
      { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Open a shop' } },
      { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: FACTOR_LABEL } },
      { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Price' } },
    ] as unknown as StoreState['nodes'],
    edges: [],
    hasCompletedFirstRun: false,
    currentScenarioFraming: null,
    ceeAnalysisReady: undefined,
  } as Partial<StoreState>)
})

describe('mapV5AnalysisToReport carries the three fields its readers already read', () => {
  it('dominant_factor reaches the report under its own name, bound to the factor id and label', () => {
    const report = mapped({ dominant_factor: { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL } })
    expect(report.dominant_factor).toEqual({ factor_id: FACTOR_ID, factor_label: FACTOR_LABEL })
  })

  it('flip_thresholds_status and its reason reach the report verbatim', () => {
    const report = mapped({
      flip_thresholds_status: 'partial_no_effect',
      flip_thresholds_status_reason: 'one factor could not be resolved',
    })
    expect(report.flip_thresholds_status).toBe('partial_no_effect')
    expect(report.flip_thresholds_status_reason).toBe('one factor could not be resolved')
  })

  it('CONTROL — absent on the wire, absent on the report (never a default)', () => {
    const report = mapped({})
    expect('dominant_factor' in report).toBe(false)
    expect('flip_thresholds_status' in report).toBe(false)
    expect('flip_thresholds_status_reason' in report).toBe(false)
  })

  it.each([
    ['an empty label', { factor_id: FACTOR_ID, factor_label: '' }],
    ['a missing label', { factor_id: FACTOR_ID }],
    ['a non-string id', { factor_id: 7, factor_label: FACTOR_LABEL }],
    ['an array', [FACTOR_ID, FACTOR_LABEL]],
    ['a bare string', FACTOR_ID],
  ])('a malformed dominant_factor (%s) is left absent, never half-written', (_name, value) => {
    expect('dominant_factor' in mapped({ dominant_factor: value })).toBe(false)
  })

  it.each([
    ['a token outside the vocabulary', 'banana'],
    ['an empty string', ''],
    ['a number', 3],
    ['the right word in the wrong case', 'All_No_Effect'],
  ])('a flip_thresholds_status that is %s is left absent', (_name, value) => {
    expect('flip_thresholds_status' in mapped({ flip_thresholds_status: value })).toBe(false)
  })

  it.each(['computed', 'all_no_effect', 'partial_no_effect', 'unresolved', 'unavailable'])(
    'every word of the producer vocabulary is carried: %s',
    (status) => {
      expect(mapped({ flip_thresholds_status: status }).flip_thresholds_status).toBe(status)
    },
  )
})

describe('the carried fields reach the words the readers render', () => {
  it('⭐ dominant_factor → Reasoning tab insight "Customer demand dominates the model", targeting that factor', () => {
    const { data, vm } = readersOver({ dominant_factor: { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL } })
    expect(data.recommendation.dominantFactorId).toBe(FACTOR_ID)
    expect(data.recommendation.dominantFactorLabel).toBe(FACTOR_LABEL)
    const insight = vm.keyInsights.insights.find((i) => i.id === DOMINANT_INSIGHT_ID)
    expect(insight?.headline).toBe('Customer demand dominates the model')
    expect(insight?.targetId).toBe(FACTOR_ID)
  })

  it('CONTROL — the same run without dominant_factor shows no dominance insight at all', () => {
    const { data, vm } = readersOver({})
    expect(data.recommendation.dominantFactorLabel).toBeUndefined()
    expect(vm.keyInsights.insights.find((i) => i.id === DOMINANT_INSIGHT_ID)).toBeUndefined()
  })

  it('⭐ flip_thresholds_status "all_no_effect" → the tornado note the panel renders', () => {
    const { data } = readersOver({ flip_thresholds_status: 'all_no_effect' })
    expect(data.recommendation.flipThresholdsStatus).toBe('all_no_effect')
    expect(
      flipThresholdStatusNote({
        status: data.recommendation.flipThresholdsStatus,
        hasUnresolved: data.recommendation.flipThresholdsHasUnresolved === true,
        designationsWithheld: false,
      }),
    ).toBe('No single tested factor changed the leading option within the current range.')
  })

  it('⭐ the reason is what turns "partial" into "… and others could not be resolved"', () => {
    const { data } = readersOver({
      flip_thresholds_status: 'partial_no_effect',
      flip_thresholds_status_reason: 'one factor could not be resolved',
    })
    expect(data.recommendation.flipThresholdsHasUnresolved).toBe(true)
    expect(
      flipThresholdStatusNote({
        status: data.recommendation.flipThresholdsStatus,
        hasUnresolved: data.recommendation.flipThresholdsHasUnresolved === true,
        designationsWithheld: true,
      }),
    ).toBe('Some factors did not change the comparison within the current range, and others could not be resolved.')
  })

  it('CONTROL — without the status the panel renders no note', () => {
    const { data } = readersOver({})
    expect(data.recommendation.flipThresholdsStatus).toBeUndefined()
    expect(
      flipThresholdStatusNote({
        status: data.recommendation.flipThresholdsStatus,
        hasUnresolved: data.recommendation.flipThresholdsHasUnresolved === true,
        designationsWithheld: false,
      }),
    ).toBeNull()
  })
})

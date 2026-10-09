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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import { useAnalysisNewViewModel } from '../analysisNew/useAnalysisNewViewModel'
import { ResultsBody } from '../ResultsBody'
import { leaderDesignationPermitted } from '../leaderDesignation'
import type { TornadoRow } from '../TornadoChart'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

type WidenedReport = ReturnType<typeof mapV5AnalysisToReport> & Record<string, unknown>
type StoreState = ReturnType<typeof useCanvasStore.getState>

const FACTOR_ID = 'fac_customer_demand'
const FACTOR_LABEL = 'Customer demand'
const DOMINANT_INSIGHT_ID = 'insight:dominant-factor'

/** PLoT order: Customer demand first by influence AND by sensitivity, so the card's Driver 1 agrees. */
const AGREEING_ROWS = [
  { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL, sensitivity: 0.8, influence_score: 0.8 },
  { factor_id: 'fac_price', factor_label: 'Price', sensitivity: 0.2, influence_score: 0.2 },
]
/** PLoT's structural order still puts Customer demand first, but the card's sensitivity basis ranks Price first. */
const DISAGREEING_ROWS = [
  { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL, sensitivity: 0.1, influence_score: 0.8 },
  { factor_id: 'fac_price', factor_label: 'Price', sensitivity: 0.9, influence_score: 0.2 },
]

function block(extra: Record<string, unknown>, leadingOptionId: string | null = 'opt_a'): AnalysisResultBlock {
  return {
    type: 'analysis_result',
    summary: 'Analysis complete',
    leading_option_id: leadingOptionId,
    win_probabilities: { opt_a: 0.62, opt_b: 0.38 },
    enrichment: {
      option_comparison: [
        { option_id: 'opt_a', option_label: 'Expand online', win_probability: 0.62 },
        { option_id: 'opt_b', option_label: 'Open a shop', win_probability: 0.38 },
      ],
      factor_sensitivity: AGREEING_ROWS,
      flip_thresholds: [],
      ...extra,
    },
  } as unknown as AnalysisResultBlock
}

function mapped(extra: Record<string, unknown>, leadingOptionId: string | null = 'opt_a'): WidenedReport {
  return mapV5AnalysisToReport(block(extra, leadingOptionId)) as WidenedReport
}

/** The Results hook and the Reasoning view model over the mapped report, through the real store. */
function readersOver(extra: Record<string, unknown>, leadingOptionId: string | null = 'opt_a') {
  const report = mapped(extra, leadingOptionId)
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

afterEach(() => cleanup())

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
      flip_thresholds_status_reason: 'timeout',
    })
    expect(report.flip_thresholds_status).toBe('partial_no_effect')
    expect(report.flip_thresholds_status_reason).toBe('timeout')
  })

  it('dominant_factor naming a factor that is NOT the first row this mapper kept is left absent', () => {
    // PLoT's dominant factor is rank 1 of its order; the mapper keeps that order. Disagreement = two readings.
    expect('dominant_factor' in mapped({ dominant_factor: { factor_id: 'fac_price', factor_label: 'Price' } })).toBe(false)
  })

  it('dominant_factor with NO factor rows kept (e.g. a goal-identity withhold) is left absent', () => {
    const report = mapped({
      factor_sensitivity: [],
      dominant_factor: { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL },
    })
    expect('dominant_factor' in report).toBe(false)
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

/**
 * The producer's own separation signal for opt_a (PLoT's `decision_brief.headline_banded`) — what licenses naming a
 * leading option in `deriveDecisionVerdict`. Without it the same run withholds the leader.
 */
const SEPARATED = { decision_brief: { headline_banded: { band: 'clearly_ahead', leader_option_id: 'opt_a' } } }

const TORNADO = {
  rows: [
    {
      factorKey: FACTOR_ID,
      label: FACTOR_LABEL,
      lowOutcome: 0.4,
      highOutcome: 0.9,
      canFocus: true,
      matchedNodeId: FACTOR_ID,
      direction: 'positive' as const,
    } satisfies TornadoRow,
  ],
  expectedOutcome: 0.7,
}

/** Mount the real Analysis-tab body over the hook's own data for this wire block. */
function mountPanelOver(extra: Record<string, unknown>) {
  const { data } = readersOver(extra)
  render(<ResultsBody resultsSectionData={data} tornadoData={TORNADO} onSendMessage={() => {}} />)
  return data
}

describe('the carried fields reach the words the readers render', () => {
  it('⭐ dominant_factor → Reasoning tab insight "Customer demand dominates the model", targeting that factor', () => {
    const { data, vm } = readersOver({ dominant_factor: { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL } })
    // PRECONDITION: the card's own Driver 1 is the same factor, with a clear lead.
    expect(data.drivers.driverLeader).toEqual({ key: FACTOR_ID, leadIsClear: true })
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

  it('⛔ ONE DRIVER AUTHORITY — PLoT names Customer demand but the card ranks Price first: no dominance insight', () => {
    const { data, vm } = readersOver({
      factor_sensitivity: DISAGREEING_ROWS,
      dominant_factor: { factor_id: FACTOR_ID, factor_label: FACTOR_LABEL },
    })
    // PRECONDITION: the producer claim arrived, and the card's Driver 1 is a DIFFERENT factor.
    expect(data.recommendation.dominantFactorId).toBe(FACTOR_ID)
    expect(data.drivers.driverLeader?.key).toBe('fac_price')
    expect(vm.keyInsights.insights.find((i) => i.id === DOMINANT_INSIGHT_ID)).toBeUndefined()
  })

  it('⭐ flip_thresholds_status "all_no_effect" → the mounted Analysis panel renders the note (leader permitted)', () => {
    const data = mountPanelOver({ ...SEPARATED, flip_thresholds_status: 'all_no_effect' })
    expect(data.recommendation.flipThresholdsStatus).toBe('all_no_effect')
    // PRECONDITION: this run's own verdict permits naming a leader — derived from the producer's near_tie.
    expect(leaderDesignationPermitted(data.recommendation)).toBe(true)
    expect(screen.getByTestId('flip-thresholds-status-note').textContent).toBe(
      'No single tested factor changed the leading option within the current range.',
    )
  })

  it('⭐ on a WITHHELD run the same status says "the comparison", never "the leading option"', () => {
    // The same run WITHOUT the producer's separation signal: nothing licenses a leader.
    const data = mountPanelOver({ flip_thresholds_status: 'all_no_effect' })
    // PRECONDITION: this run's own verdict withholds the leader — derived, not supplied.
    expect(leaderDesignationPermitted(data.recommendation)).toBe(false)
    expect(screen.getByTestId('flip-thresholds-status-note').textContent).toBe(
      'No single tested factor changed the comparison within the current range.',
    )
  })

  it('⭐ the reason is what turns "partial" into "… and others could not be resolved" on the mounted panel', () => {
    const data = mountPanelOver({
      ...SEPARATED,
      flip_thresholds_status: 'partial_no_effect',
      flip_thresholds_status_reason: 'timeout',
    })
    expect(leaderDesignationPermitted(data.recommendation)).toBe(true)
    expect(data.recommendation.flipThresholdsHasUnresolved).toBe(true)
    expect(screen.getByTestId('flip-thresholds-status-note').textContent).toBe(
      'Some factors did not change the leading option within the current range, and others could not be resolved.',
    )
  })

  it('CONTROL — without the status the mounted panel renders no note', () => {
    const data = mountPanelOver({ ...SEPARATED })
    expect(data.recommendation.flipThresholdsStatus).toBeUndefined()
    expect(screen.queryByTestId('flip-thresholds-status-note')).toBeNull()
  })
})

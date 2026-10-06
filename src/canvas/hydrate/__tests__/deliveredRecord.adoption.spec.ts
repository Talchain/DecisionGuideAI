/**
 * SD-1 Slice R (CEE #2654, schemas 0.79 `run_delivery`): a reload or a second device shows the "Olumi model review"
 * cards the Run's turn showed. J1 record 4b (run 37402501132): after a reload the Run's cards were gone — composed for
 * the turn and kept only in this browser's session storage.
 *
 * CEE serves the Run's delivered record on `current_read.delivered_record` (with `current_read.run_id`) only while the
 * Run is `complete_current`. This file pins the four links of the read leg: the adapter carries it, the applier binds
 * it (Run, graph, contract), the guidance store adopts it without overwriting a live turn, and the delivered blocks
 * become the SAME items the live turn makes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { maximalCoachingBlock, maximalReviewCardBlock } from '@talchain/schemas/fixtures'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { readCurrentReadDelivered } from '../../../adapters/cee/scenarioGraph'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../applyScenarioAnalysisRead'
import { adoptDeliveredRecord } from '../deliveredGuidanceSink'
import { setGuidancePersistenceContext, useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { extractPhase3FromV5Response, guidanceItemsFromDeliveredBlocks, toStoreGuidanceItem } from '../../../v5/extractPhase3FromV5Response'

const SCENARIO = 'scn-slice-r'
const RUN = 'run_slice_r_1'
const GRAPH = 'b1a2c3d4e5f60718'

const card = { ...(maximalReviewCardBlock as Record<string, unknown>), block_id: '11111111-1111-4111-8111-111111111111', body: 'Most of this result rests on a single factor.' }
const coaching = { ...(maximalCoachingBlock as Record<string, unknown>), block_id: '22222222-2222-4222-8222-222222222222' }
const record = (over: Record<string, unknown> = {}) => ({
  record_version: 1,
  run_id: RUN,
  graph_hash: GRAPH,
  phase3_blocks: [card, coaching],
  analysis_ready_options: [{ option_id: 'opt_60', label: 'Raise to £60', status: 'ready', interventions: { fac_price: 60 } }],
  ...over,
})

const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-10-06T06:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true, separation: 'separated' },
  robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1
const STALE = { ...CURRENT, run_state: { kind: 'complete_stale', cause: 'graph_changed', computed_at: '2026-10-06T06:00:00.000Z' } } as unknown as AnalysisStateV1

const BLOCK = {
  type: 'analysis_result', summary: 'Comparison on the current model.', leading_option_id: null,
  win_probabilities: { opt_60: 0.44, opt_49: 0.56 }, computed_against_hash: GRAPH,
  enrichment: { analysis_status: 'ok', option_comparison: [
    { option_id: 'opt_60', option_label: 'Raise to £60', win_probability: 0.44, outcome_mean: 0.5 },
    { option_id: 'opt_49', option_label: 'Keep £49', win_probability: 0.56, outcome_mean: 0.52 },
  ] },
}

function harness(currentResultsHash: string | null = null) {
  const adopt = vi.fn()
  const store = {
    setAnalysisStateV1: vi.fn(), resultsComplete: vi.fn(), setLimitVerdicts: vi.fn(), setRunDelta: vi.fn(), setRunDeltaAbsence: vi.fn(),
    adoptDeliveredRecord: adopt, currentResultsHash, currentScenarioId: SCENARIO,
  } as unknown as ScenarioAnalysisApplyStore
  return { store, adopt, resultsComplete: store.resultsComplete as ReturnType<typeof vi.fn> }
}

describe('Slice R · the adapter carries current_read.delivered_record only for a current read that names its Run', () => {
  it('complete_current + run_id + record → carried raw, with the Run', () => {
    expect(readCurrentReadDelivered({ run_state: { kind: 'complete_current' }, run_id: RUN, delivered_record: record() }))
      .toStrictEqual({ runId: RUN, record: record() })
  })

  it.each([
    ['a stale read', { run_state: { kind: 'complete_stale' }, run_id: RUN, delivered_record: record() }],
    ['no run_id', { run_state: { kind: 'complete_current' }, delivered_record: record() }],
    ['an empty run_id', { run_state: { kind: 'complete_current' }, run_id: '', delivered_record: record() }],
    ['no record', { run_state: { kind: 'complete_current' }, run_id: RUN }],
    ['no current_read', null],
  ])('%s → nothing', (_name, raw) => {
    expect(readCurrentReadDelivered(raw)).toBeNull()
  })
})

describe('Slice R · the applier adopts only a record bound to the served Run and the displayed graph', () => {
  it('⭐ a NEW analysis read adopts the parsed record, bound to its Run, in this scenario', () => {
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, delivered: { runId: RUN, record: record() }, store: h.store })
    expect(h.resultsComplete).toHaveBeenCalledTimes(1)
    expect(h.adopt).toHaveBeenCalledTimes(1)
    expect(h.adopt).toHaveBeenCalledWith({ runId: RUN, scenarioId: SCENARIO, record: record() })
  })

  it('⭐ a re-read of the analysis ALREADY on screen still adopts (a same-browser reload dedupes the report here)', () => {
    const first = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, store: first.store })
    const held = harness(first.resultsComplete.mock.calls[0][0].hash)
    const outcome = applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, delivered: { runId: RUN, record: record() }, store: held.store })
    expect(outcome.outcome).toBe('alreadyHeld')
    expect(held.adopt).toHaveBeenCalledWith({ runId: RUN, scenarioId: SCENARIO, record: record() })
  })

  it.each([
    ['a stale read', { state: STALE, delivered: { runId: RUN, record: record() } }],
    ['a record naming another Run', { state: CURRENT, delivered: { runId: RUN, record: record({ run_id: 'run_other' }) } }],
    ['a record over another graph', { state: CURRENT, delivered: { runId: RUN, record: record({ graph_hash: 'ffffffffffffffff' }) } }],
    ['a record the contract refuses (unknown key)', { state: CURRENT, delivered: { runId: RUN, record: record({ blocks: [] }) } }],
    ['no record', { state: CURRENT, delivered: null }],
  ])('%s → nothing adopted', (_name, c) => {
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: c.state, analysisResult: BLOCK, delivered: c.delivered, store: h.store })
    expect(h.adopt).not.toHaveBeenCalled()
  })

  it('a displayed block with no computed_against_hash cannot be bound → nothing adopted (CONTROL: with it, adopted)', () => {
    const { computed_against_hash: _drop, ...unbound } = BLOCK
    const h = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: unbound, delivered: { runId: RUN, record: record() }, store: h.store })
    expect(h.adopt).not.toHaveBeenCalled()
    const control = harness()
    applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, delivered: { runId: RUN, record: record() }, store: control.store })
    expect(control.adopt).toHaveBeenCalledTimes(1)
  })
})

describe('Slice R · the delivered blocks become the SAME items the live turn makes', () => {
  it('parity with the live extractor over the same blocks', () => {
    const live = extractPhase3FromV5Response({
      blocks: [],
      __additive__: { phase3_blocks_from_blocks_array: [card, coaching] },
    } as never).guidanceItems
    expect(live.length).toBeGreaterThan(0)
    expect(guidanceItemsFromDeliveredBlocks([card, coaching])).toStrictEqual(live)
  })
})

describe('Slice R · the guidance store adopts a delivered record without overwriting a live turn', () => {
  const items = (): GuidanceItem[] => guidanceItemsFromDeliveredBlocks([card, coaching]).map(toStoreGuidanceItem)
  const turnItem: GuidanceItem = { item_id: 'turn_1', source: 'analysis', title: 'From the live turn', primary_action: { type: 'discuss', prompt: 'more' }, priority: 50 }

  beforeEach(() => {
    sessionStorage.clear()
    useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null, deliveredFrom: null, liveGuidanceAuthored: false })
    setGuidancePersistenceContext(() => ({ scenarioId: SCENARIO, graphHash: 'ui-hash-1' }))
  })
  afterEach(() => setGuidancePersistenceContext(null))

  const reload = () => {
    // Page memory disappears; the sessionStorage blob written by the real store survives.
    useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null, deliveredFrom: null, liveGuidanceAuthored: false })
    return useGuidanceStore.getState().rehydrateGuidance({ scenarioId: SCENARIO, currentAnalysisHash: null, currentGraphHash: 'ui-hash-1' })
  }

  it.each([
    ['non-empty', [turnItem]],
    ['empty', []],
  ] as const)('reload restores delivery origin and a different Run replaces it with a %s record', (_label, incoming) => {
    useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })
    expect(JSON.parse(sessionStorage.getItem('guidance.items.v1')!)).toMatchObject({
      scenarioId: SCENARIO, deliveredFrom: { scenarioId: SCENARIO, runId: RUN }, items: items(),
    })
    expect(reload()).toBe(items().length)
    expect(useGuidanceStore.getState().deliveredFrom).toStrictEqual({ scenarioId: SCENARIO, runId: RUN })
    expect(useGuidanceStore.getState().liveGuidanceAuthored).toBe(false)

    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: 'run_newer', items: [...incoming] })).toBe(incoming.length)
    expect(useGuidanceStore.getState().guidanceItems).toStrictEqual(incoming)
    expect(useGuidanceStore.getState().deliveredFrom).toStrictEqual({ scenarioId: SCENARIO, runId: 'run_newer' })
    // The replacement (including zero cards) also survives a second reload with its identity.
    expect(reload()).toBe(incoming.length)
    expect(useGuidanceStore.getState().guidanceItems).toStrictEqual(incoming)
    expect(useGuidanceStore.getState().deliveredFrom).toStrictEqual({ scenarioId: SCENARIO, runId: 'run_newer' })
  })

  it('a live turn delivering zero cards prevents an older delivered record from resurrecting cards', () => {
    useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })
    useGuidanceStore.getState().setGuidanceItems([])
    expect(useGuidanceStore.getState().liveGuidanceAuthored).toBe(true)
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })).toBe(0)
    expect(useGuidanceStore.getState().guidanceItems).toStrictEqual([])
    expect(useGuidanceStore.getState().deliveredFrom).toBeNull()
  })

  it('rehydrated session guidance is not a live turn authored in this page (including older blobs without origin)', () => {
    sessionStorage.setItem('guidance.items.v1', JSON.stringify({ version: 1, scenarioId: SCENARIO, graphHashAtWrite: 'ui-hash-1', items: [turnItem] }))
    expect(reload()).toBe(1)
    expect(useGuidanceStore.getState().liveGuidanceAuthored).toBe(false)
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })).toBe(items().length)
    expect(useGuidanceStore.getState().guidanceItems).toStrictEqual(items())
  })

  it('page unmount resets empty live-turn precedence', () => {
    useGuidanceStore.getState().setGuidanceItems([])
    setGuidancePersistenceContext(null)
    setGuidancePersistenceContext(() => ({ scenarioId: SCENARIO, graphHash: 'ui-hash-1' }))
    expect(useGuidanceStore.getState().liveGuidanceAuthored).toBe(false)
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })).toBe(items().length)
    expect(useGuidanceStore.getState().guidanceItems).toStrictEqual(items())
  })

  it('⭐ RED: an EMPTY store (a second device) adopts the Run\'s cards and persists them', () => {
    const n = useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })
    expect(n).toBe(items().length)
    expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toStrictEqual(items().map((i) => i.item_id))
    expect(useGuidanceStore.getState().deliveredFrom).toStrictEqual({ scenarioId: SCENARIO, runId: RUN })
    // Persisted like a turn, so this browser's next reload restores them.
    useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null, deliveredFrom: null })
    expect(useGuidanceStore.getState().rehydrateGuidance({ scenarioId: SCENARIO, currentAnalysisHash: null, currentGraphHash: 'ui-hash-1' })).toBeGreaterThan(0)
  })

  it('a LIVE TURN\'s guidance is never overwritten', () => {
    useGuidanceStore.getState().setGuidanceItems([turnItem])
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })).toBe(0)
    expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toStrictEqual(['turn_1'])
  })

  it('the same Run again is idempotent; ANOTHER Run\'s record replaces an adopted one', () => {
    const s = useGuidanceStore.getState()
    s.adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: [turnItem] })).toBe(items().length)
    expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toStrictEqual(items().map((i) => i.item_id))
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: 'run_newer', items: [turnItem] })).toBe(1)
    expect(useGuidanceStore.getState().deliveredFrom).toStrictEqual({ scenarioId: SCENARIO, runId: 'run_newer' })
  })

  it('another scenario\'s record never lands on the one on screen', () => {
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: 'scn-other', runId: RUN, items: items() })).toBe(0)
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('a live turn after an adoption takes over (deliveredFrom resets)', () => {
    useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: RUN, items: items() })
    useGuidanceStore.getState().setGuidanceItems([turnItem])
    expect(useGuidanceStore.getState().deliveredFrom).toBeNull()
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: SCENARIO, runId: 'run_newer', items: items() })).toBe(0)
  })

  it('⭐ end to end through the leaf sink: the read leg\'s hand-off reaches the store the guidance store registered', () => {
    adoptDeliveredRecord({ runId: RUN, scenarioId: SCENARIO, record: record() as never })
    expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toStrictEqual(items().map((i) => i.item_id))
  })
})

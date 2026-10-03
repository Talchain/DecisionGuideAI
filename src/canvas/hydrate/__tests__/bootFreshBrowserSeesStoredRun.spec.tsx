/**
 * ⭐ A FRESH BROWSER SEES THE STORED RUN — the Shared Data closure row (Canonical #72 5889440955; measured by Canvas
 * 5889420398 on served `b865151d` × CEE `bbbc1db`: the read carried `analysis_result` + `analysis_goal_certainty` +
 * `run_state: complete_current`, and a new browser showed the PRE-analysis state because boot restored currency and the
 * Run fact but never built the report from the read's block).
 *
 * Canonical's rows:
 *   1. fresh session + a current read → the report is the READ's block, and its certainty goes through the one
 *      validating reader (an unrecorded/refused record never shows a raw 0/1);
 *   2. fresh session + a stale read → no report is shown as current;
 *   3. same-browser reload of the held Run → nothing is re-written (the applier's own dedupe);
 *   4. a held report from another Run → the read wins.
 * Plus the proof contrast: a read the canvas does not match restores nothing.
 *
 * CLAIM TYPE: jsdom store + the real hydration path. The read is the composed served DL turn-3 read (fixture
 * `_provenance`), with `run_state` set to `complete_current` and an `analysis_result` block (the served Pro-price rows)
 * supplied by this spec — the fixture's own block is null. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import composed from './fixtures/served-admitted-reload.06bdf585.composed.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import type { AnalysisResultBlock, AnalysisStateV1 } from '@talchain/schemas/boundary'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { selectWinSharesWithheld } from '../../state/winShareGate'

type Body = {
  scenario_id: string
  graph_hash: string
  graph: { nodes: unknown[]; edges: unknown[] }
  analysis_state: AnalysisStateV1
  analysis_admission: { admitted: boolean; graph_hash: string } | null
  analysis_result?: unknown
  analysis_goal_certainty?: unknown
}
const SERVED = (composed as unknown as { body: Body }).body
const SCENARIO_ID = SERVED.scenario_id

const BLOCK = {
  type: 'analysis_result',
  computed_against_hash: SERVED.graph_hash,
  summary: 's',
  leading_option_id: 'raise_to_59',
  enrichment: {
    option_comparison: [
      { id: 'keep_49_price', option_id: 'keep_49_price', label: 'Keep £49 price', option_label: 'Keep £49 price', status: 'computed', probability_of_goal: 0, win_probability: 0.0001 },
      { id: 'raise_to_59', option_id: 'raise_to_59', label: 'Raise to £59', option_label: 'Raise to £59', status: 'computed', probability_of_goal: 1, win_probability: 0.9994 },
      { id: 'raise_to_54', option_id: 'raise_to_54', label: 'Raise to £54', option_label: 'Raise to £54', status: 'computed', probability_of_goal: 0.8311, win_probability: 0.0005 },
    ],
  },
}
const OTHER_RUN_BLOCK = { ...BLOCK, summary: 'another device ran it' }
const SAY = "I can't yet say how likely 'Raise to £59' is to reach the target: it depends on how 'Pro plan price' moves 'MRR', which isn't sized yet."
const UNEARNED_59 = { option_id: 'raise_to_59', probability_of_goal: 1, earned: false, unsized_path: { from: 'pro_plan_price', enters_goal_through: 'pro_plan_price' }, no_break_even: 'not_an_identity', say: SAY }
const EARNED_49 = { option_id: 'keep_49_price', probability_of_goal: 0, earned: true }

const hashOf = (block: unknown) => mapV5AnalysisToReport(block as AnalysisResultBlock).model_card.response_hash
type Opt = Record<string, { goalCertaintyUnearned?: { say: string | null } }>
const heldReport = () => useCanvasStore.getState().results as { status: string; report?: { model_card: { response_hash: string }; option_probabilities: Opt } | null }

function withRunState(b: Body, kind: 'complete_current' | 'complete_stale'): Body {
  const runState = b.analysis_state.run_state as { kind: string; computed_at?: string }
  return { ...b, analysis_state: {
    ...b.analysis_state,
    run_state: { kind, computed_at: runState.computed_at },
    requires_rerun: kind === 'complete_stale',
  } as AnalysisStateV1 }
}

let body: Body
beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, ceeAnalysisReady: null, lastServerGraphHash: null,
    bootAdmittedRevision: null,
  } as never)
  applyDraftResult(JSON.parse(JSON.stringify(SERVED.graph)) as never, { skipHistory: true, skipAutosave: true })
  // A FRESH BROWSER: nothing held — no report, no currency, no authoritative graph.
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, serverGraphIdentity: null,
    lastAuthoritativeGraph: null, lastServerGraphHash: null, results: { status: 'idle', report: null },
  } as never)
  body = { ...withRunState(JSON.parse(JSON.stringify(SERVED)), 'complete_current'), analysis_result: JSON.parse(JSON.stringify(BLOCK)) }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('⭐ a fresh browser sees the stored Run (Shared Data closure)', () => {
  it('ROW 1: a current read builds the report from the READ\'s own block', async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(heldReport().status).toBe('complete')
    expect(heldReport().report?.model_card.response_hash).toBe(hashOf(BLOCK))
  })

  it('ROW 1 (certainty): the read\'s record goes through the validating reader — unearned says its sentence, earned shows', async () => {
    body.analysis_goal_certainty = [UNEARNED_59, EARNED_49]
    await hydrateCanvasFromServer(SCENARIO_ID)
    const o = heldReport().report!.option_probabilities
    expect(o.raise_to_59.goalCertaintyUnearned).toEqual({ say: SAY })
    expect(o.keep_49_price.goalCertaintyUnearned).toBeUndefined()
    expect(o.raise_to_54.goalCertaintyUnearned).toBeUndefined()
  })

  it('ROW 1 (certainty): no record, or a refused one, never shows a raw 0/1', async () => {
    body.analysis_goal_certainty = [{ ...EARNED_49, say: 'forged' }]
    await hydrateCanvasFromServer(SCENARIO_ID)
    const o = heldReport().report!.option_probabilities
    expect(o.keep_49_price.goalCertaintyUnearned).toEqual({ say: null })
    expect(o.raise_to_59.goalCertaintyUnearned).toEqual({ say: null })
    expect(o.raise_to_54.goalCertaintyUnearned).toBeUndefined()
  })

  it('ROW 2: a stale read shows no report as current', async () => {
    body = { ...withRunState(body, 'complete_stale') }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(heldReport().status).not.toBe('complete')
  })

  /** A real reload: every in-memory field starts fresh; only the PERSISTED results report survives. */
  function reloadHolding(block: unknown) {
    const report = mapV5AnalysisToReport(block as AnalysisResultBlock)
    useCanvasStore.setState({
      analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, serverGraphIdentity: null,
      lastAuthoritativeGraph: null, lastServerGraphHash: null, bootAdmittedRevision: null,
      results: { status: 'complete', report, hash: report.model_card.response_hash },
    } as never)
  }
  function countResultsComplete() {
    const orig = useCanvasStore.getState().resultsComplete
    const spy = vi.fn((...a: Parameters<typeof orig>) => orig(...a))
    useCanvasStore.setState({ resultsComplete: spy } as never)
    return spy
  }

  it('ROW 3: a same-browser reload of the held Run re-writes nothing (the applier dedupes by the block identity)', async () => {
    reloadHolding(BLOCK)
    const spy = countResultsComplete()
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(spy).not.toHaveBeenCalled()
    expect(heldReport().report?.model_card.response_hash).toBe(hashOf(BLOCK))
  })

  it('ROW 4: a held report from ANOTHER Run (another device re-ran) is replaced by the read', async () => {
    reloadHolding(OTHER_RUN_BLOCK)
    const spy = countResultsComplete()
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(heldReport().report?.model_card.response_hash).toBe(hashOf(BLOCK))
  })

  it('CONTRAST (proof): a read the canvas does NOT match builds no report', async () => {
    const e = body.graph.edges[0] as { effect_direction?: string }
    e.effect_direction = e.effect_direction === 'positive' ? 'negative' : 'positive'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(heldReport().status).not.toBe('complete')
  })
})

describe('⭐ ROW 5 — a withheld leader on the stored Run stays withheld in a fresh browser (row 9 served FAIL, 30 Sep)', () => {
  // Served `a80db4a9`, R3's guest Run bc9640d4: the read carried `leader_claim: { permitted: false, withheld_reason:
  // 'constraint_verdict_withheld' }` + `complete_current`, yet the cold-opened report had NO `producer_leader_permission`
  // and the cards read "best in 49% / 51%". The boot withholding ran before any report was held (a no-op), and the
  // store view handed to the read applier lacked `resultsWithholdLeaderClaim`, so its post-write stamp no-op'd too.
  const withLeader = (permitted: boolean) => {
    body.analysis_state = {
      ...body.analysis_state,
      leader_claim: permitted
        ? { permitted: true, separation: 'separated' }
        : { permitted: false, withheld_reason: 'constraint_verdict_withheld', separation: 'near_tie' },
    } as unknown as AnalysisStateV1
  }
  const stamp = () => (useCanvasStore.getState().results as { report?: { producer_leader_permission?: unknown } | null }).report?.producer_leader_permission
  it('the report built from the read carries the withholding, with the producer\'s own cause', async () => {
    withLeader(false)
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(heldReport().status).toBe('complete')
    expect(stamp()).toEqual({ permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' })
    expect(selectWinSharesWithheld(useCanvasStore.getState() as never)).toBe(true)
  })
  it('CONTROL: a permitted leader leaves the report unstamped', async () => {
    withLeader(true)
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(heldReport().status).toBe('complete')
    expect(stamp()).toBeUndefined()
    expect(selectWinSharesWithheld(useCanvasStore.getState() as never)).toBe(false)
  })
})

/**
 * ⭐ DL #2800 follow-up (15 Oct): WHO leads is CEE's own `canonical_analysis_view.leader.option_id` (CEE #3192,
 * `run-facts.ts` `RunLeader`), matched to the Run by identity; and the Results report carries the Run id of the
 * canonical view delivered WITH it, so Results binds by identity rather than hash + time.
 *
 * Views: the served capacity view (14 Oct staging, UI joined-flow witness, licence 'permitted_with_caveat') with CEE's
 * `leader` in the producer's full shape. The turn rows drive the real `applyV5State` against the real canvas store.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { ceeLeaderPermits, chatCardRunViewOf, runViewOf } from '../runView'
import { parseCanonicalAnalysisView, stampCanonicalRunId, type CanonicalAnalysisView } from '../canonicalAnalysisView'
import { applyV5State } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../store'
import served from '../../../components/results/__tests__/fixtures/served-leader-licence-20261014.json'

const SERVED = served.capacity.canonical_analysis_view as unknown as CanonicalAnalysisView
const RUN_ID = SERVED.run!.run_id!
const HASH = SERVED.run!.graph_hash_at_run!
const withLeader = (option_id: string | null, view: CanonicalAnalysisView = SERVED): CanonicalAnalysisView =>
  parseCanonicalAnalysisView({ ...view, leader: { licence: view.leader_licence, option_id,
    goal_chance_leader: null, similar_option_ids: [], near_tie: false, robustness: 'moderate' } })!
const card = (runId = RUN_ID, hash = HASH) => ({ enrichment: {}, run_id: runId, computed_against_hash: hash })

describe('CEE names the leader; the surface designates only that option', () => {
  it('the parser keeps licence + option id, and drops a malformed leader without dropping the view', () => {
    expect(withLeader('opt_a').leader).toEqual({ licence: 'permitted_with_caveat', option_id: 'opt_a' })
    expect(withLeader(null).leader).toEqual({ licence: 'permitted_with_caveat', option_id: null })
    const bad = parseCanonicalAnalysisView({ ...SERVED, leader: { licence: 'permitted', option_id: 42 } })
    expect(bad).not.toBeNull()
    expect(bad!.leader).toBeUndefined()
    expect(parseCanonicalAnalysisView({ ...SERVED, leader: { licence: 'best', option_id: 'opt_a' } })!.leader).toBeUndefined()
  })

  it('same option → permitted; another option → not; CEE names none → not; no `leader` (older CEE) → the licence alone', () => {
    expect(ceeLeaderPermits(chatCardRunViewOf(card(), withLeader('opt_a')), 'opt_a')).toBe(true)
    expect(ceeLeaderPermits(chatCardRunViewOf(card(), withLeader('opt_b')), 'opt_a')).toBe(false)
    expect(ceeLeaderPermits(chatCardRunViewOf(card(), withLeader(null)), 'opt_a')).toBe(false)
    expect(ceeLeaderPermits(chatCardRunViewOf(card(), SERVED), 'opt_a')).toBe(true)
  })

  it('a withheld licence designates nothing even when CEE’s leader field names the option', () => {
    const withheld = withLeader('opt_a', { ...SERVED, leader_licence: 'withheld' })
    expect(ceeLeaderPermits(chatCardRunViewOf(card(), withheld), 'opt_a')).toBe(false)
  })

  it('IDENTITY: another Run’s leader never decides this card (null → the caller’s fallback)', () => {
    expect(ceeLeaderPermits(chatCardRunViewOf(card('an-older-run'), withLeader('opt_b')), 'opt_a')).toBeNull()
    expect(ceeLeaderPermits(chatCardRunViewOf(card(), null), 'opt_a')).toBeNull()
  })
})

describe('the Results report carries the Run id of the canonical view delivered with it', () => {
  it('stamps only an unstamped report whose graph is the view’s Run graph', () => {
    const r1: Record<string, unknown> = { computed_against_hash: HASH }
    stampCanonicalRunId(r1, SERVED)
    expect(r1.run_id).toBe(RUN_ID)
    const other: Record<string, unknown> = { computed_against_hash: 'another-graph' }
    stampCanonicalRunId(other, SERVED)
    expect(other.run_id).toBeUndefined()
    const own: Record<string, unknown> = { computed_against_hash: HASH, run_id: 'its-own' }
    stampCanonicalRunId(own, SERVED)
    expect(own.run_id).toBe('its-own')
    const noHash: Record<string, unknown> = {}
    stampCanonicalRunId(noHash, SERVED)
    expect(noHash.run_id).toBeUndefined()
    stampCanonicalRunId(r1, null)
    expect(r1.run_id).toBe(RUN_ID)
  })

  const NODES = [
    { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Expand' } },
    { id: 'opt_b', type: 'option', position: { x: 200, y: 0 }, data: { kind: 'option', label: 'Hold' } },
    { id: 'goal_1', type: 'goal', position: { x: 100, y: 200 }, data: { kind: 'goal', label: 'Grow ARR' } },
  ]
  const turn = (hash: string, view: CanonicalAnalysisView | null): OlumiResponse => ({
    response_version: 2, assistant_text: '', suggested_actions: [], insights: [], stage_indicator: 'analyse',
    blocks: [{ type: 'analysis_result', summary: 'Expand leads.', leading_option_id: 'opt_a', computed_against_hash: hash,
      win_probabilities: { opt_a: 0.71, opt_b: 0.29 }, enrichment: { robustness: { display_verdict: 'fragile' } } }],
    analysis_ready: { status: 'ready', goal_node_id: 'goal_1', freshness: 'fresh',
      options: ['opt_a', 'opt_b'].map((id) => ({ id, status: 'ready', interventions: {} })) },
    ...(view === null ? {} : { canonical_analysis_view: view }),
  }) as unknown as OlumiResponse
  const apply = (response: OlumiResponse) => {
    const snap = useCanvasStore.getState()
    return applyV5State(response, { ...snap, currentResultsHash: snap.results?.hash ?? null } as never,
      { turnScenarioId: 'scn-leader-id' } as never)
  }
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({ nodes: NODES, edges: [], results: { status: 'idle', progress: 0 }, ceeAnalysisReady: null,
      analysisStateV1: null, runDelta: null, currentScenarioId: 'scn-leader-id' } as never)
  })

  it('TURN: the report the turn writes carries the co-delivered view’s run id, and Results binds to CEE’s leader by it', () => {
    const view = withLeader('opt_a')
    expect(apply(turn(HASH, view)).applied).toContain('analysis_result:results_hydrated')
    const report = useCanvasStore.getState().results.report as unknown as Record<string, unknown>
    expect(report.run_id).toBe(RUN_ID)
    expect(runViewOf(report, view).leaderOptionId()).toBe('opt_a')
  })

  it('TURN CONTROL: a co-delivered view about another graph stamps nothing, and binds no leader', () => {
    const view = withLeader('opt_a')
    apply(turn('a-different-graph', view))
    const report = useCanvasStore.getState().results.report as unknown as Record<string, unknown>
    expect(report.computed_against_hash).toBe('a-different-graph')
    expect(report.run_id).toBeUndefined()
    expect(runViewOf(report, view).leaderOptionId()).toBeUndefined()
  })
})

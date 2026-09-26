/**
 * ⭐ THE SERVED RELOAD, REPLAYED: a canvas DRAFTED from the served OpenAI turn,
 * booted against CEE's stored graph.
 *
 * R&C's served witness (#69 5833719119, 5834151007, 5834846296): after a plain
 * reload the Run card still reads "Olumi can't confirm this still matches your
 * latest analysis". The boot read carries `complete_current`, its `computed_at`
 * and its `graph_hash`, all equal to the card's, yet `applyBootRunCurrency`
 * wrote nothing.
 *
 * `bootRunCurrency.spec.tsx` builds its read FROM the canvas's own projection,
 * so canvas and read are equal by construction and it could never see this.
 * On a real reload the canvas was built from the DRAFT TURN
 * (`applyDraftResult`), and the read is CEE's stored copy of that same draft.
 * This spec reproduces exactly that: the served `c673223` "C1 brief" draft goes
 * through the real `applyDraftResult`, and the boot read serves that draft graph
 * back with the served `complete_current` verdict.
 *
 * CLAIM TYPE: jsdom store + the real hydration path; `fetch` answers from the
 * served capture. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import served from '../../conversation/__tests__/fixtures/openai-route-coaching-journey.c673223.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { logger } from '../../../lib/logger'
import { renderHook } from '@testing-library/react'
import { useCoachingCurrency } from '../../../v5/blocks/useCoachingCurrency'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

type Turn = { turn: string; json: Record<string, unknown> }
const turns = (served as { turns: Turn[] }).turns
const C1 = turns.find((t) => t.turn === 'C1 brief')!.json
const C2 = turns.find((t) => t.turn === 'C2 run')!.json
const DRAFT = C1.draft_graph as { nodes: unknown[]; edges: unknown[]; goal_constraints?: unknown[] }

type Graph = {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
  goal_constraints?: Array<Record<string, unknown>>
  goal_node_id?: string
}
// CEE stores the draft's `goal_constraints` on `scenarios.graph` and the read
// returns them (served: Paul's manual test `1a298d6d`, `analysis_result_read`).
const draftGraph = (): Graph =>
  JSON.parse(JSON.stringify({ nodes: DRAFT.nodes, edges: DRAFT.edges, goal_constraints: DRAFT.goal_constraints }))

/** The served Run card: `created_at` = the run's `computed_at`, written on the run's graph. */
const RUN_STATE = (C2.analysis_state as { run_state: { computed_at: string } }).run_state
const RUN_CARD = { sourceHandler: 'run_analysis', createdAt: RUN_STATE.computed_at }
const runCardCurrency = () => renderHook(() => useCoachingCurrency(String(C2.graph_hash), RUN_CARD)).result.current

let readGraph: Graph

function readBody() {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: readGraph,
    graph_present: true,
    brief_text: null,
    graph_identity_hash: {
      kind: 'graph_identity_hash',
      value: 'c'.repeat(63) + '9',
      algorithm: 'sha256',
      projection_version: 'identity.v1',
      graph_schema_version: 'graph_v3',
      normaliser_version: '1',
    },
    layout_present: false,
    request_id: 'req-drafted-canvas-replay',
    graph_hash: C2.graph_hash,
    analysis_state: C2.analysis_state,
  }
}

let warnSpy: { mock: { calls: unknown[][] }; mockRestore: () => void; mockClear: () => void }

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [],
    edges: [],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never)
  // The live session drafted the canvas from the served turn, through the real path.
  applyDraftResult(DRAFT as never, { skipHistory: true, skipAutosave: true })
  // A reload keeps the canvas and drops the session's analysis beliefs.
  useCanvasStore.setState({
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    serverGraphIdentity: null,
    lastAuthoritativeGraph: null,
  } as never)
  readGraph = draftGraph()
  warnSpy = vi.spyOn(logger, 'warn')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => readBody() }) as unknown as Response))
})
afterEach(() => {
  vi.unstubAllGlobals()
  warnSpy.mockRestore()
})

const declineLog = () =>
  warnSpy.mock.calls.find((c) => c[0] === 'server_graph_hydration.boot_run_currency_declined')?.[1] as
    | { reason: string; unproven: string | null; mergeChanged: boolean | null }
    | undefined

describe('⭐ a reload of a DRAFTED model keeps its current Run card current (served c673223)', () => {
  it('PRECONDITION: the served read carries edge `defaulted`, which a drafted canvas never holds', () => {
    expect(readGraph.edges.filter((e) => e.defaulted === true).length).toBeGreaterThan(0)
    expect(useCanvasStore.getState().nodes.length).toBe(DRAFT.nodes.length)
  })

  it('the verdict and its hash are restored, and the Run card reads current', async () => {
    expect(runCardCurrency(), 'before the read').not.toBe('current')
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')
    expect(declineLog(), 'no decline').toBeUndefined()
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBe(C2.graph_hash)
    expect(runCardCurrency()).toBe('current')
  })

  it('RESIDUAL, not fixed here: an approval\'s `observed_state.source` stamp the canvas lacks still declines, as `edited_since_read`', async () => {
    // The currency proof ignores `source` (CEE's hash excludes it), but the boot
    // MERGE counts the stamp as a model change and marks the model edited
    // (`mergeServerGraph.ts` `modelChanged`), so the restore declines on
    // `edited_since_read`. Whether a served canvas lacks the stamp after an
    // approval is UNVERIFIED; the decline log names it on the next served run.
    // Owner of `mergeServerGraph.ts` `modelChanged`: flip this test when fixed.
    const n = readGraph.nodes.find((x) => x.observed_state && typeof x.observed_state === 'object')!
    n.observed_state = { ...(n.observed_state as object), source: 'user_assumption' }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toMatchObject({ reason: 'edited_since_read', mergeChanged: true })
    expect(runCardCurrency()).not.toBe('current')
  })
})

describe('CONTROLS: an ANALYSIS-AFFECTING difference still declines', () => {
  it('an edge strength CEE holds that the canvas does not: the merge adopts it, so the model changed: declined', async () => {
    const e = readGraph.edges.find((x) => x.defaulted === true)!
    e.strength = { mean: 0.91, std: 0.02 }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toMatchObject({ reason: 'edited_since_read', mergeChanged: true })
    expect(runCardCurrency()).not.toBe('current')
  })

  it('an observed value CEE holds that the canvas does not: declined', async () => {
    const n = readGraph.nodes.find((x) => x.observed_state && typeof x.observed_state === 'object')!
    n.observed_state = { ...(n.observed_state as object), value: 123456 }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()?.reason).toMatch(/^(edited_since_read|canvas_not_proven_equal)$/)
    expect(runCardCurrency()).not.toBe('current')
  })

  it('a field CEE does NOT list as excluded (edge `effect_direction`) is still compared: declined, and the log names the clause', async () => {
    const e = readGraph.edges[0]
    e.effect_direction = e.effect_direction === 'positive' ? 'negative' : 'positive'
    await hydrateCanvasFromServer(SCENARIO_ID)
    const d = declineLog()!
    expect(d.reason).toBe('canvas_not_proven_equal')
    expect(d.unproven).toMatch(/^fwd:edge:.+:strength:differs /)
    expect(runCardCurrency()).not.toBe('current')
  })
})

/** Re-draft the canvas from a changed copy of the served draft, and serve that draft back. */
function redraft(mutate: (d: Graph) => void) {
  const d = JSON.parse(JSON.stringify(DRAFT)) as Graph
  mutate(d)
  applyDraftResult(d as never, { skipHistory: true, skipAutosave: true })
  useCanvasStore.setState({
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    serverGraphIdentity: null,
    lastAuthoritativeGraph: null,
  } as never)
  readGraph = JSON.parse(JSON.stringify({ nodes: d.nodes, edges: d.edges, goal_constraints: d.goal_constraints }))
}

const LIMIT_ID = 'agent-lane:monthly_churn_rate:<='
const readLimit = () => readGraph.goal_constraints!.find((c) => c.constraint_id === LIMIT_ID)!

describe('⭐ THE GOAL HALF of CEE\'s hash: a stated limit and the goal node are part of "the same model"', () => {
  it('PRECONDITION: the canvas holds the drafted limit, and the read returns it with its keys reordered (JSONB): current', async () => {
    expect(useCanvasStore.getState().goalConstraints?.map((c) => c.constraint_id)).toEqual([LIMIT_ID])
    const c = readLimit()
    readGraph.goal_constraints = [Object.fromEntries(Object.entries(c).reverse())]
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog(), 'no decline').toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  it('⭐ the read\'s limit differs from the canvas\'s (4 → 6 per month): declined, and the log names the limit', async () => {
    readLimit().value = 6
    await hydrateCanvasFromServer(SCENARIO_ID)
    const d = declineLog()!
    expect(d.reason).toBe('canvas_not_proven_equal')
    expect(d.unproven).toMatch(/^goal:goal_constraints:agent-lane:monthly_churn_rate:<=:differs /)
    expect(runCardCurrency()).not.toBe('current')
  })

  it('⭐ the read holds no limit while the canvas holds one: declined', async () => {
    delete readGraph.goal_constraints
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toMatchObject({ reason: 'canvas_not_proven_equal', unproven: 'goal:goal_constraints:count canvas=1 read=0' })
    expect(runCardCurrency()).not.toBe('current')
  })

  it('ASYMMETRY, decided: a canvas with NO list (`null` is not "no limit") never declines on the read\'s limit', async () => {
    useCanvasStore.setState({ goalConstraints: null } as never)
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog(), 'no decline').toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  it('CONTROL: the read\'s `goal_node_id` names the canvas goal: current', async () => {
    readGraph.goal_node_id = 'monthly_recurring_revenue'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog(), 'no decline').toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  it('⭐ the read\'s `goal_node_id` names a node the canvas does not hold as its goal: declined', async () => {
    readGraph.goal_node_id = 'monthly_churn_rate'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toMatchObject({
      reason: 'canvas_not_proven_equal',
      unproven: 'goal:goal_node_id:monthly_churn_rate:not_a_canvas_goal',
    })
    expect(runCardCurrency()).not.toBe('current')
  })
})

describe('⭐ AN INTERVENTION UNIT counts exactly where CEE hashes it: beside a native `raw_value`', () => {
  const OPTION = 'raise_to_59_with_release'
  const FACTOR = 'pro_plan_price'
  const setIntervention = (g: Graph, patch: Record<string, unknown>) => {
    const n = g.nodes.find((x) => x.id === OPTION)!
    const iv = n.interventions as Record<string, Record<string, unknown>>
    iv[FACTOR] = { ...iv[FACTOR], ...patch }
  }

  it('CONTROL: canvas and read both hold 59 GBP: current', async () => {
    redraft((d) => setIntervention(d, { raw_value: 59, unit: 'GBP' }))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog(), 'no decline').toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  // ⚠ THE UNCHANGED EXIT, where the proof is the ONLY guard. On the merged exit
  // the boot merge adopts the read's unit and declines as `edited_since_read`
  // whatever the proof says (independent review of #2058, 5841555613). Here the
  // read's identity token matches the one already applied, so nothing is merged:
  // a reload of the same token, after a session that dropped its analysis beliefs.
  async function reloadOnTheSameToken(changeRead: () => void) {
    redraft((d) => setIntervention(d, { raw_value: 59, unit: 'GBP' }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')
    useCanvasStore.setState({ analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false } as never)
    warnSpy.mockClear()
    changeRead()
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('unchanged')
  }

  it('CONTROL, unchanged exit: the same 59 GBP on both sides: current', async () => {
    await reloadOnTheSameToken(() => {})
    expect(declineLog(), 'no decline').toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  it('⭐ unchanged exit: the canvas holds 59 GBP and the read 59 USD: declined BY THE PROOF, naming the intervention', async () => {
    await reloadOnTheSameToken(() => setIntervention(readGraph, { unit: 'USD' }))
    const d = declineLog()!
    expect(d.reason).toBe('canvas_not_proven_equal')
    expect(d.unproven).toMatch(/^fwd:node:raise_to_59_with_release:interventions:differs .*"unit":"GBP".* read=.*"unit":"USD"/)
    expect(runCardCurrency()).not.toBe('current')
  })

  it('CONTROL, unchanged exit: a unit with NO native `raw_value` beside it is metadata, as CEE hashes it: current', async () => {
    redraft((d) => setIntervention(d, { unit: 'GBP' }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')
    useCanvasStore.setState({ analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false } as never)
    warnSpy.mockClear()
    setIntervention(readGraph, { unit: 'USD' })
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('unchanged')
    expect(declineLog(), 'no decline').toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })
})

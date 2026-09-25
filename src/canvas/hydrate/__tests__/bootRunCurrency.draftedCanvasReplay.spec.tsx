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

type Graph = { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> }
const draftGraph = (): Graph => JSON.parse(JSON.stringify({ nodes: DRAFT.nodes, edges: DRAFT.edges }))

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

let warnSpy: { mock: { calls: unknown[][] }; mockRestore: () => void }

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

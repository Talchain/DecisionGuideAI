/**
 * ⭐ ROW 4 (Canonical #72 5883577636; DL seam 5882858834): the reload currency proof must read the SAME 0.62 analysis
 * vocabulary CEE hashes. Since schemas 0.62.0 CEE's `graph_hash` counts `observed_state.source`, `unit` and `raw_value`
 * (whose a value is, and in what units), served on CEE f297748. The UI's proof strips all three on BOTH sides
 * (`currencyComparable` → `withoutNonAnalysisFields`, `NOT_ANALYSIS_AFFECTING.observedState`) — a vocabulary mismatch.
 * MEASURED 29 Sep (Canonical #72 5883644673): at boot the merge clause catches every observed_state difference first
 * (`edited_since_read`, `mergeChanged: true`), so the GUARD rows below hold today; they pin that the Run card is never
 * current across an owner/unit difference, whatever the proof's vocabulary.
 *
 * CLAIM TYPE: jsdom store + the real hydration path (`applyDraftResult` → `hydrateCanvasFromServer`), served chip-2105
 * bytes; the perturbation is on the READ, so the canvas holds the original. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import served from './fixtures/served-chip-2105-exists-defaulted.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { logger } from '../../../lib/logger'
import { useCoachingCurrency } from '../../../v5/blocks/useCoachingCurrency'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
type Graph = { nodes: Array<Record<string, any>>; edges: Array<Record<string, any>>; goal_constraints?: unknown[] }
const S = served as unknown as { graph_hash: string; analysis_state: { run_state: { kind: string; computed_at: string } }; draft_graph: Graph }
const clone = (): Graph => JSON.parse(JSON.stringify({ nodes: S.draft_graph.nodes, edges: S.draft_graph.edges, goal_constraints: S.draft_graph.goal_constraints }))
const RUN_CARD = { sourceHandler: 'run_analysis', createdAt: S.analysis_state.run_state.computed_at }
const runCardCurrency = () => renderHook(() => useCoachingCurrency(S.graph_hash, RUN_CARD)).result.current
const WRITTEN = (g: Graph) => g.edges.find((e) => e.from === 'pro_plan_price' && e.to === 'mrr')!

let readGraph: Graph
const readBody = () => ({
  schema: 'scenario_graph.v1',
  scenario_id: SCENARIO_ID,
  graph: readGraph,
  graph_present: true,
  brief_text: null,
  graph_identity_hash: {
    kind: 'graph_identity_hash', value: 'd'.repeat(63) + '4', algorithm: 'sha256',
    projection_version: 'identity.v1', graph_schema_version: 'graph_v3', normaliser_version: '1',
  },
  layout_present: false,
  request_id: 'req-w4-metadata-edge-keys',
  graph_hash: S.graph_hash,
  analysis_state: S.analysis_state,
})

let warnSpy: { mock: { calls: unknown[][] }; mockRestore: () => void }
beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, analysisStateV1: null, analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never)
  // The session's canvas holds the served model through the real mapper; a reload keeps it and drops analysis beliefs.
  applyDraftResult(S.draft_graph as never, { skipHistory: true, skipAutosave: true })
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, serverGraphIdentity: null, lastAuthoritativeGraph: null,
  } as never)
  readGraph = clone()
  warnSpy = vi.spyOn(logger, 'warn')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => readBody() }) as unknown as Response))
})
afterEach(() => {
  vi.unstubAllGlobals()
  warnSpy.mockRestore()
})
const declineLog = () =>
  warnSpy.mock.calls.find((c) => c[0] === 'server_graph_hydration.boot_run_currency_declined')?.[1] as
    | { reason: string; unproven: string | null }
    | undefined


const CHURN = (g: Graph) => g.nodes.find((n) => n.id === 'monthly_churn')!

describe('0.62 vocabulary: whose a value is, and its unit, are analysis inputs on the reload proof too', () => {
  it('PRECONDITION: the canvas projection CARRIES observed_state source/unit/raw_value (else comparing them declines every reload)', async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog(), 'the unperturbed read restores').toBeUndefined()
    expect(runCardCurrency()).toBe('current')
    const node = useCanvasStore.getState().nodes.find((n) => (n as { id: string }).id === 'monthly_churn') as { data?: Record<string, any> }
    const os = node?.data?.observed_state ?? node?.data?.observedState
    expect(os, JSON.stringify(node?.data ?? {}).slice(0, 400)).toBeDefined()
  })

  it('GUARD: the read says churn is the USER\'s 7% (canvas: Olumi\'s) → not proven equal; the Run card is NOT current', async () => {
    CHURN(readGraph).observed_state.source = 'user_override'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()?.reason).toMatch(/^(canvas_not_proven_equal|edited_since_read)$/)
    expect(runCardCurrency()).not.toBe('current')
  })

  it('GUARD: the read holds churn in another UNIT (same number) → not proven equal', async () => {
    CHURN(readGraph).observed_state.unit = '% per year'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()?.reason).toMatch(/^(canvas_not_proven_equal|edited_since_read)$/)
    expect(runCardCurrency()).not.toBe('current')
  })

  // FINDING (measured 29 Sep, Canonical #72 5883644673): a review-only difference ALSO declines (`edited_since_read`),
  // so the first reload after a confirm-as-is can read "can't confirm" while CEE says current, IF the canvas has not
  // acquired the server's stamp. Panel's call: flip this row when the canvas acquires `reviewed_by_user` (or the merge
  // treats it as non-analytical).
  it.fails('WANTED: a review record only (`reviewed_by_user`, not a hash input) restores current', async () => {
    CHURN(readGraph).observed_state.reviewed_by_user = { intent: 'confirm', at: '2026-09-29T04:00:00.000Z' }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  it('PROBE (edges): does the canvas projection carry edge `provenance`? (decides whether provenance_fields can join the proof)', async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    const e = useCanvasStore.getState().edges.find((x) => (x as { source?: string }).source === 'pro_plan_price' && (x as { target?: string }).target === 'mrr') as { data?: Record<string, any> }
    // Recorded, not asserted: the answer scopes the edge half of the change.
    console.log('EDGE_PROVENANCE_ON_CANVAS', JSON.stringify(e?.data?.provenance ?? null))
    expect(e).toBeDefined()
  })
})

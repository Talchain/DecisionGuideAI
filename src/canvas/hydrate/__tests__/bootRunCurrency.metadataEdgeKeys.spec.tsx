/**
 * ⭐ W4 (X4, #70 5858431819 n=2; root cause R&C 5858906092): a reload after a link-strength write declined the Run
 * card's currency on an edge key CEE's analysis hash does not count.
 *
 * SERVED BYTES (AIC journey `chip-2105-136f1c75-554d78b-1756`, turns line 5): after the user set "Pro plan price →
 * MRR" weak, CEE #2096 (`adjust-edge-strength.ts`) turned that edge's `defaulted` into `exists_defaulted: true` —
 * metadata, outside `graph-hash.ts projectEdge` (a whitelist). The reload proof compared edges through a hand-kept
 * DENYLIST (`NOT_ANALYSIS_AFFECTING.edge`), so the reverse leg returned
 * `rev:edge:pro_plan_price\u0000mrr:exists_defaulted:canvas_lacks read=true`, nothing was restored, and the card read
 * "Olumi can't confirm this still matches your latest analysis" with Run still open.
 *
 * THE RULE: the proof compares an edge only on the PUBLISHED analysis-affecting edge vocabulary
 * (`CANONICAL_GRAPH_HASH_NESTED_PROJECTION.edge` from `@talchain/schemas/boundary`) — the space `graph_hash` and
 * `complete_current` live in. A metadata key CEE adds can never decline a reload; every hashed edge field still can.
 *
 * CLAIM TYPE: jsdom store + the real hydration path (`applyDraftResult` → `hydrateCanvasFromServer`); `fetch` answers
 * with the served graph and verdict. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import cold from './fixtures/lane-b-e625-cold-read.json'
import { PanelFooter } from '../../components/pre-analysis-v3/footer/PanelFooter'
import { readinessNothingHasAnswered } from '../../components/pre-analysis-v3/footer/readinessDisplay'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { readinessObjectsToRun } from '../../utils/canRunAnalysis'

import served from './fixtures/served-chip-2105-exists-defaulted.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { logger } from '../../../lib/logger'
import { markFactorEditInFlight, pendingFactorEditValue, settleFactorEditInFlight } from '../../conversation/pendingFactorEdit'
import { markEdgeEditInFlight, settleEdgeEdit, unconfirmedEdgeEditOnGraph } from '../../conversation/pendingEdgeEdit'
import { useCoachingCurrency } from '../../../v5/blocks/useCoachingCurrency'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import realStagingFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
type Graph = { nodes: Array<Record<string, any>>; edges: Array<Record<string, any>>; goal_constraints?: unknown[] }
const S = served as unknown as { graph_hash: string; analysis_state: { run_state: { kind: string; computed_at: string } }; draft_graph: Graph }
const RESULT = { ...(structuredClone(realStagingFixture.blocks[0]) as Record<string, unknown>), computed_against_hash: S.graph_hash }
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
  analysis_result: RESULT,
})

let warnSpy: { mock: { calls: unknown[][] }; mockClear: () => void; mockRestore: () => void }
beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, analysisStateV1: null, analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never)
  // The session's canvas holds the served model through the real mapper; a reload keeps it and drops analysis beliefs.
  applyDraftResult(S.draft_graph as never, { skipHistory: true, skipAutosave: true })
  const report = mapV5AnalysisToReport(RESULT as never)
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, serverGraphIdentity: null, lastAuthoritativeGraph: null,
    results: { status: 'complete', progress: 100, report, hash: report.model_card.response_hash }, v5AnalysisFact: null,
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

describe('W4: a metadata edge key CEE adds never declines a reload (served chip-2105)', () => {
  it('a hash-less boot cannot mint a current Run from a descriptive verdict', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ...readBody(), graph_hash: null }), { status: 200 }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(runCardCurrency()).not.toBe('current')
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  })

  it.each(['nonadvanced', 'missing_hash', 'foreign'] as const)('a recovery %s read cannot restore current currency from its structural merge', async kind => {
    useCanvasStore.setState({ lastServerGraphHash: S.graph_hash } as never)
    const body = { ...readBody(), ...(kind === 'missing_hash' ? { graph_hash: null } : {}),
      ...(kind === 'foreign' ? { scenario_id: '22222222-2222-4333-8444-555555555555' } : {}) }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
    const outcome = await hydrateCanvasFromServer(SCENARIO_ID, { reapplyServerGraph: true, requireServedScenario: true })
    expect(outcome).toBe(kind === 'foreign' ? 'skipped' : 'merged') // structural acceptance is a different fact
    expect(runCardCurrency()).not.toBe('current')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).not.toBe(S.graph_hash)
  })

  it.each(['nonadvanced', 'missing_hash'] as const)('a recovery %s read cannot retain a previously current verdict', async kind => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(runCardCurrency()).toBe('current')
    const body = { ...readBody(), ...(kind === 'missing_hash' ? { graph_hash: null } : {}) }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID, { reapplyServerGraph: true, requireServedScenario: true })).toBe('merged')
    expect(runCardCurrency()).not.toBe('current')
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).not.toBe('complete_current')
  })

  it.each(['raw_value', 'unit', 'source'] as const)('a changed observed-state %s remains part of the currency proof', async field => {
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(runCardCurrency()).toBe('current')
    useCanvasStore.setState({ analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false } as never)
    warnSpy.mockClear()
    const observed = readGraph.nodes.find(n => n.id === 'pro_plan_price')!.observed_state
    expect(observed).toMatchObject({ raw_value: 49, unit: 'GBP/month', source: 'brief_extraction' })
    if (field === 'raw_value') observed.raw_value += 1
    else observed[field] = 'incompatible test value'
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('unchanged')
    expect(declineLog()?.reason).toBe('canvas_not_proven_equal')
    expect(declineLog()?.unproven).toMatch(/observed_state:differs/)
    expect(runCardCurrency()).not.toBe('current')
  })

  it('PRECONDITION: the read carries `exists_defaulted` on the written edge; the canvas holds no such key; the verdict is complete_current', () => {
    expect(WRITTEN(readGraph).exists_defaulted).toBe(true)
    expect(useCanvasStore.getState().edges.some((e) => 'exists_defaulted' in ((e as { data?: object }).data ?? {}) || 'exists_defaulted' in (e as object))).toBe(false)
    expect(S.analysis_state.run_state.kind).toBe('complete_current')
    expect(S.graph_hash).toBe('efa3acf29a07bde5')
  })

  it('RED: the verdict and its hash are restored, and the Run card reads current', async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog(), 'no decline (at base: rev:edge:pro_plan_price\\u0000mrr:exists_defaulted:canvas_lacks read=true)').toBeUndefined()
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBe(S.graph_hash)
    expect(runCardCurrency()).toBe('current')
  })

  it('CLASS: any unhashed key on ANY edge (not only this one) is not a reason to decline', async () => {
    const other = readGraph.edges.find((e) => !(e.from === 'pro_plan_price' && e.to === 'mrr'))!
    other.some_future_metadata = { note: 'not analysis-affecting' }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })
})

describe('CONTRASTS: every field the analysis hash counts still declines', () => {
  it('edge `effect_direction` differs: declined on THAT edge\'s hashed fields (direction, or the signed strength it sets)', async () => {
    const e = WRITTEN(readGraph)
    e.effect_direction = e.effect_direction === 'positive' ? 'negative' : 'positive'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()?.reason).toBe('canvas_not_proven_equal')
    const unproven = declineLog()?.unproven ?? ''
    expect(unproven.includes('pro_plan_price\u0000mrr:')).toBe(true)
    expect(unproven).toMatch(/:(effect_direction|strength):differs/)
    expect(runCardCurrency()).not.toBe('current')
  })

  // ⚠ FLIPPED (P0 #75 5921880401, DL ruling on #2375): a hashed field the boot merge ADOPTS from CEE is the read's
  // own change, not an edit, once the mark was clear before the merge and the canvas is proven equal both ways. The
  // decline now binds to the twin: the SAME value over a canvas marked edited before the read (identity-bound, the
  // successor of DL 5859359015's row).
  it('edge `exists_probability` differs on THE WRITTEN EDGE: the boot merge adopts it, so the Run is current', async () => {
    WRITTEN(readGraph).exists_probability = 0.5
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  it('TWIN: the same `exists_probability` over a canvas marked edited BEFORE the read: declined as edited_since_read (identity-bound)', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    WRITTEN(readGraph).exists_probability = 0.5
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toMatchObject({ reason: 'edited_since_read', mergeChanged: true, unproven: null, graphHash: S.graph_hash })
    expect(runCardCurrency()).not.toBe('current')
  })

  it('node side untouched: the identity operands swapped on MRR: the merge adopts them, so the Run is current', async () => {
    const mrr = readGraph.nodes.find((n) => n.id === 'mrr')!
    expect(mrr.nonlinear_identity?.factor_ids).toHaveLength(2)
    mrr.nonlinear_identity = { ...mrr.nonlinear_identity, factor_ids: [...mrr.nonlinear_identity.factor_ids].reverse() }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()).toBeUndefined()
    expect(runCardCurrency()).toBe('current')
  })

  it('TWIN: the same swapped operands over a canvas marked edited BEFORE the read: declined', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    const mrr = readGraph.nodes.find((n) => n.id === 'mrr')!
    mrr.nonlinear_identity = { ...mrr.nonlinear_identity, factor_ids: [...mrr.nonlinear_identity.factor_ids].reverse() }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(declineLog()?.reason).toBe('edited_since_read')
    expect(declineLog()?.unproven ?? '').not.toMatch(/exists_defaulted/)
    expect(runCardCurrency()).not.toBe('current')
  })
})

// Exact saved-read and cached node facts from the existing e625 capture; only layout coordinates are harness values.
function prepareCapturedColdRead() {
  useCanvasStore.setState({ currentScenarioId: cold.read.scenario_id, nodes: [], edges: [],
    importPendingServerRegistration: false, pendingEmittedEdits: 0, serverGraphIdentity: null,
    lastAuthoritativeGraph: null, analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false } as never)
  applyDraftResult(cold.read.graph as never, { skipHistory: true, skipAutosave: true })
  const cached = cold.cached_node_data as Record<string, Record<string, unknown>>
  useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => ({ ...n,
    data: structuredClone(cached[n.id] ?? n.data), position: { x: 123, y: 456 } })),
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    serverGraphIdentity: null, lastAuthoritativeGraph: null, lastServerGraphHash: cold.read.graph_hash } as never)
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(cold.read), { status: 200 }))
}

it('e625 cold read: saved semantic absence replaces the cached frame; the actual footer shows the supplied blocked verdict', async () => {
  prepareCapturedColdRead()
  const goal = () => useCanvasStore.getState().nodes.find(n => n.id === 'angel_funding_secured')!
  expect(goal().data.scale_frame).toBe(5000000)
  expect(cold.read.graph.nodes.find(n => n.id === 'angel_funding_secured')).not.toHaveProperty('scale_frame')
  expect(await hydrateCanvasFromServer(cold.read.scenario_id)).toBe('merged')
  expect(goal().data).not.toHaveProperty('scale_frame')
  expect(goal().position).toEqual({ x: 123, y: 456 })
  const verdict = useCanvasStore.getState().analysisStateV1
  expect(verdict?.readiness).toEqual(cold.read.analysis_state.readiness)
  const readiness = selectAnalysisReadinessAuthority(verdict)
  expect(cold.read.current_read.analysis_ready.blocked_reason).toBe('NO_PATH_TO_GOAL')
  // The full wire assessment carries level blockers, while current_read's separate reason is NO_PATH. Preserve both;
  // do not manufacture a different blocker in the strict analysis_state schema for a green assertion.
  expect(readiness?.status).toBe('blocked')
  render(createElement(PanelFooter, { footer: { dot: 'warning', headline: 'Readiness not checked yet', subline: '' },
    onAnalyse: () => {}, isAnalysing: false, canRun: !readinessObjectsToRun(null, readiness),
    nothingHasAnswered: readinessNothingHasAnswered(null, readiness) }))
  expect(screen.queryByText('Readiness not checked yet')).toBeNull()
  expect(screen.getByText(readiness!.blockers[0]!.message)).toBeTruthy()
})

it.each(['target', 'comparator'] as const)('a changed %s under a reused read identity cannot restore the captured verdict', async field => {
  prepareCapturedColdRead()
  expect(await hydrateCanvasFromServer(cold.read.scenario_id)).toBe('merged')
  expect(useCanvasStore.getState().analysisStateV1?.readiness.status).toBe('blocked')
  useCanvasStore.setState({ analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false } as never)
  warnSpy.mockClear()
  const body = structuredClone(cold.read)
  const goal = body.graph.nodes.find(n => n.id === 'angel_funding_secured')! as Record<string, any>
  expect(Number.isFinite(goal.goal_threshold_raw)).toBe(true)
  if (field === 'target') goal.goal_threshold_raw += 1
  if (field === 'comparator') goal.goal_direction = '<='
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  expect(await hydrateCanvasFromServer(cold.read.scenario_id)).toBe('unchanged')
  expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  expect(declineLog()?.unproven).toMatch(/(goal_threshold_raw|goal_direction|observed_state):differs/)
})

it.each(['factor', 'edge'] as const)('a pending %s survives while an unrelated saved update merges, without a current verdict', async kind => {
  const nodeId = 'pro_plan_price'
  const edge = useCanvasStore.getState().edges.find(e => e.source === nodeId && e.target === 'mrr')!
  const pendingValue = 0.3
  if (kind === 'factor') {
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => n.id === nodeId
      ? { ...n, data: { ...n.data, observedState: { ...(n.data.observedState as object), value: pendingValue } } } : n) } as never)
    markFactorEditInFlight(nodeId, pendingValue)
  } else {
    markEdgeEditInFlight(edge.id, pendingValue, edge.data as Record<string, unknown>)
    useCanvasStore.setState({ edges: useCanvasStore.getState().edges.map(e => e.id === edge.id
      ? { ...e, data: { ...e.data, weight: pendingValue } } : e) } as never)
  }
  const before = structuredClone(kind === 'factor'
    ? useCanvasStore.getState().nodes.find(n => n.id === nodeId)!
    : useCanvasStore.getState().edges.find(e => e.id === edge.id)!)
  readGraph.nodes.find(n => n.id === 'mrr')!.label = 'Saved revenue label'
  useCanvasStore.setState({ pendingEmittedEdits: 1, analysisFreshnessDirty: true } as never)
  try {
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(kind === 'factor' ? useCanvasStore.getState().nodes.find(n => n.id === nodeId)
      : useCanvasStore.getState().edges.find(e => e.id === edge.id)).toEqual(before)
    expect(kind === 'factor' ? pendingFactorEditValue(nodeId)
      : unconfirmedEdgeEditOnGraph(useCanvasStore.getState().edges)).not.toBeNull()
    expect(useCanvasStore.getState().nodes.find(n => n.id === 'mrr')!.data.label).toBe('Saved revenue label')
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
    expect(runCardCurrency()).not.toBe('current')
  } finally {
    if (kind === 'factor') settleFactorEditInFlight(nodeId, pendingValue)
    else settleEdgeEdit(edge.id, pendingValue)
  }
})

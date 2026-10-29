/**
 * THE RELOAD DRAWS BOTH LINKS BETWEEN ONE PAIR (DET-HARM D225, D227; SPEC C13: the graph's links match the saved model).
 * The qualitative journey's FINAL COLD RELOAD (staging, 29 Oct 2026: a new browser context opens the scenario) drew 16
 * of the saved read's 17 links. Two of them join `ads_before_fix` to `marketing_disruption` (`from__to` and
 * `from__to__2`, CEE model-program/project.ts edgeId), and the boot merge matched links by pair, first wins.
 *
 * The boot merge now reads the same one-to-one mapping as the receipt path (`matchEdgesOneToOne`): exact ids first, on
 * the same pair; then the first wire link left on the pair, in wire order. Removals, updates and additions read it, and
 * a removed sibling is stripped from history by its own id, so the link it sat beside stays undoable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { __resetPendingFactorEditsForTest } from '../../conversation/pendingFactorEdit'
import SERVED from './fixtures/served-qualitative-parallel-links.a3c24d98.read.json'

type WireEdge = { id: string; from: string; to: string; effect_direction?: string }
const SERVED_EDGES = SERVED.graph.edges as WireEdge[]
const FIRST = 'ads_before_fix__marketing_disruption'
const SECOND = 'ads_before_fix__marketing_disruption__2'

type CanvasEdge = { id: string; source: string; target: string; data: Record<string, unknown> }
const edges = () => useCanvasStore.getState().edges as unknown as CanvasEdge[]
const between = (from: string, to: string) => edges().filter((e) => e.source === from && e.target === to)
const edgeById = (id: string) => edges().find((e) => e.id === id)
const cardsOf = (nodes: ReadonlyArray<{ id: string; kind: string; label: string }>) =>
  nodes.map((n, i) => ({ id: n.id, type: n.kind, position: { x: 200 * i, y: 0 }, data: { kind: n.kind, label: n.label } }))

/** A reloaded canvas with nothing between the user and CEE, so the read may remove (the removal licence). */
function seed(scenarioId: string, nodes: unknown[], canvasEdges: unknown[], history: unknown[] = []): void {
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    nodes: structuredClone(nodes) as never,
    edges: structuredClone(canvasEdges) as never,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    lastServerGraphHash: null,
    history: { past: structuredClone(history), future: [] },
    pendingEmittedEdits: 0,
    pendingStructuralDeletes: [],
    pendingStructuralRenames: [],
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralRenameLifecycle: [],
    structuralAddLifecycle: [],
    analysisFreshnessDirty: false,
  } as never)
}

beforeEach(() => {
  useCanvasStore.getState().reset()
  __resetPendingFactorEditsForTest()
})

describe('the real qualitative read, through the reload path', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a cold reload (new browser, empty canvas) draws all 17 links, both parallel ones under their own ids and directions', async () => {
    seed(SERVED.scenario_id, [], [])
    const body = Object.fromEntries(Object.entries(SERVED).filter(([k]) => k !== '_source'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => structuredClone(body) } as unknown as Response))
    expect(await hydrateCanvasFromServer(SERVED.scenario_id)).toBe('merged')
    expect(edges().map((e) => e.id).sort()).toEqual(SERVED_EDGES.map((e) => e.id).sort())
    expect(between('ads_before_fix', 'marketing_disruption').map((e) => e.id)).toEqual([FIRST, SECOND])
    // The first is stated positive; the second states no direction (its words say "not known yet").
    expect(edgeById(FIRST)?.data).toMatchObject({ direction: 'positive', directionSource: 'cee' })
    expect(edgeById(SECOND)?.data.directionSource).toBeUndefined()
  })

  it('a reload onto the 16 the canvas drew adds the lost link and moves nothing else', () => {
    const drawn = SERVED_EDGES.filter((e) => e.id !== SECOND)
    seed(SERVED.scenario_id, cardsOf(SERVED.graph.nodes), drawn.map((e, i) => mapDraftEdgeToCanvas(e, i)))
    const res = mergeServerGraphOnHydrate(structuredClone(SERVED.graph))
    expect(res).toMatchObject({ accepted: true, addedEdgeCount: 1, updatedEdgeCount: 0, removedEdgeCount: 0, addedNodeCount: 0, removedNodeCount: 0 })
    expect(edges()).toHaveLength(17)
    expect(between('ads_before_fix', 'marketing_disruption').map((e) => e.id)).toEqual([FIRST, SECOND])
  })
})

describe('each saved link stands for at most one canvas link on reload', () => {
  const SCENARIO = '0b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  const NODES = [
    { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Sales' } },
    { id: 'factor-1', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Added capacity' } },
  ]
  const WIRE_NODES = [
    { id: 'goal-1', kind: 'goal', label: 'Sales' },
    { id: 'factor-1', kind: 'factor', label: 'Added capacity' },
  ]
  const a = { id: 'factor-1__goal-1', from: 'factor-1', to: 'goal-1', effect_direction: 'positive' }
  const b = { id: 'factor-1__goal-1__2', from: 'factor-1', to: 'goal-1' }
  const local = { id: 'e-0', source: 'factor-1', target: 'goal-1', type: 'styled', data: { weight: 0.5 } }
  const pairIds = () => between('factor-1', 'goal-1').map((e) => e.id)

  it('the mixed-id case: canvas e-0 and b, a read of only a keeps exactly one link for a and removes b, in history too', () => {
    const drawnB = mapDraftEdgeToCanvas(b, 1)
    seed(SCENARIO, NODES, [local, drawnB], [{ nodes: NODES, edges: [local, drawnB] }])
    const res = mergeServerGraphOnHydrate({ nodes: WIRE_NODES, edges: [a] })
    expect(res).toMatchObject({ accepted: true, removedEdgeCount: 1, addedEdgeCount: 0 })
    expect(pairIds()).toEqual(['e-0'])
    expect(edgeById('e-0')?.data).toMatchObject({ direction: 'positive', directionSource: 'cee' })
    // The removed sibling leaves every history entry by its own id; the link that stands for `a` stays in each.
    const past = (useCanvasStore.getState().history as { past: Array<{ edges: CanvasEdge[] }> }).past
    expect(past.length).toBeGreaterThan(0)
    for (const entry of past) expect(entry.edges.map((e) => e.id)).toEqual(['e-0'])
  })

  it('a repeated id on another pair never hides a link\'s own same-pair counterpart (review of d23dd992)', () => {
    const cards = ['P', 'Q', 'U', 'V'].map((id, i) => ({ id, type: 'factor', position: { x: 200 * i, y: 0 }, data: { kind: 'factor', label: id } }))
    const x = { id: 'x', from: 'U', to: 'V', effect_direction: 'positive' }
    seed(SCENARIO, cards, [{ id: 'local', source: 'U', target: 'V', type: 'styled', data: { weight: 0.5 } }, mapDraftEdgeToCanvas(x, 1)])
    mergeServerGraphOnHydrate({
      nodes: cards.map((n) => ({ id: n.id, kind: 'factor', label: n.id })),
      edges: [{ id: 'x', from: 'P', to: 'Q' }, x, { id: 'y', from: 'U', to: 'V', effect_direction: 'negative' }],
    })
    expect(edgeById('x')?.data).toMatchObject({ direction: 'positive', directionSource: 'cee' })
    expect(edgeById('local')?.data).toMatchObject({ direction: 'negative', directionSource: 'cee' })
  })

  it('a later read updates each parallel link by its own id, whatever the wire order', () => {
    seed(SCENARIO, NODES, [mapDraftEdgeToCanvas(a, 0), mapDraftEdgeToCanvas(b, 1)])
    const before = edgeById(a.id)
    const res = mergeServerGraphOnHydrate({ nodes: WIRE_NODES, edges: [{ ...b, effect_direction: 'negative' }, a] })
    expect(res).toMatchObject({ accepted: true, updatedEdgeCount: 1, addedEdgeCount: 0, removedEdgeCount: 0 })
    expect(pairIds()).toEqual([a.id, b.id])
    expect(edgeById(a.id)).toEqual(before)
    expect(edgeById(b.id)?.data).toMatchObject({ direction: 'negative', directionSource: 'cee' })
  })
})

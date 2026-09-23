/**
 * ON RELOAD, THE SAVED MODEL WINS, AND WHAT DIFFERS IS NAMED — RED-first.
 *
 * Decision (lead, on Paul's standing authority, 23 Sep 2026): when the boot read
 * of CEE's saved model is ACCEPTED, the canvas ends up holding exactly CEE's
 * elements. Canvas nodes CEE lacks, and canvas edges whose endpoint pair CEE
 * lacks (or whose endpoint was removed), are taken off. Layout of what survives
 * is kept exactly. The removal is a model change (analysis out of date, undoable
 * pre-merge snapshot), and the hydration path records a notice naming what was
 * taken off, for one lasting chat line.
 *
 * THE WITNESSED SHAPE (served `fa84d226`, 23 Sep 08:31–08:35Z, two tabs on one
 * scenario): tab A deletes `fac_market_competition` ("Competitive Pressure");
 * stale tab B reloads; its boot merge KEPT the factor under the old "no
 * DELETION" clause, so the screen showed a factor analysis ignores and the user
 * could not delete. The fixture below is that shape (reused from
 * `registration/__tests__/staleTabReload.spec.tsx` on `canvas/stale-tab-reload`).
 *
 * THE LICENCE, each a case below:
 *   · only on an ACCEPTED merge — every refusal (pending import, zero overlap,
 *     empty server graph, unusable shape) removes nothing;
 *   · never while an edit is between the user and CEE (`editDeliveryHold`) — a
 *     node added seconds after load whose add turn is still in flight survives;
 *   · never a UI-only render node (`ghost-*`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { canvasEdgePairKey, wireEdgePairKey } from '../graphIdentity'
import { beginModelEditDelivery } from '../../registration/editDeliveryHold'
import { __resetPendingFactorEditsForTest } from '../../conversation/pendingFactorEdit'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'

const SCENARIO = '5a1e7ab0-0d04-4dd4-89db-bb6470a98fc5'
const GOAL = 'goal_revenue'
const KEPT = 'fac_usage_exposure'
const DELETED = 'fac_market_competition'
const DELETED_LABEL = 'Competitive Pressure'

const GOAL_POS = { x: 520, y: 180 }
const KEPT_POS = { x: 120, y: 80 }
const DELETED_POS = { x: 120, y: 280 }

function node(id: string, kind: 'factor' | 'goal', label: string, position: { x: number; y: number }) {
  return { id, type: kind, position: { ...position }, width: 180, data: { label, kind } }
}
function edge(source: string, target: string) {
  return { id: `e_${source}_${target}`, source, target, data: {} }
}

/** Tab B's restored copy: still holds the factor tab A deleted. */
function staleNodes() {
  return [
    node(GOAL, 'goal', 'Revenue', GOAL_POS),
    node(KEPT, 'factor', 'Usage-Based Pricing Exposure', KEPT_POS),
    node(DELETED, 'factor', DELETED_LABEL, DELETED_POS),
  ]
}
function staleEdges() {
  return [edge(KEPT, GOAL), edge(DELETED, GOAL)]
}

/** What CEE holds after tab A's applied delete. */
function serverAfterDelete() {
  return {
    nodes: [
      { id: GOAL, kind: 'goal', label: 'Revenue' },
      { id: KEPT, kind: 'factor', label: 'Usage-Based Pricing Exposure' },
    ],
    edges: [{ from: KEPT, to: GOAL }],
  }
}

function seed(nodes: unknown[], edges: unknown[]): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: structuredClone(nodes) as never,
    edges: structuredClone(edges) as never,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    lastServerGraphHash: null,
    history: { past: [], future: [] },
    pendingEmittedEdits: 0,
    pendingStructuralDeletes: [],
    pendingStructuralRenames: [],
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralRenameLifecycle: [],
    structuralAddLifecycle: [],
    // "Analysis reflects the current model" — so a stale mark is observable.
    graphEditedSinceLastRun: false,
    analysisStateReady: true,
    analysisFreshnessDirty: false,
  } as never)
}

const canvasNodeIds = () => useCanvasStore.getState().nodes.map((n: any) => n.id as string).sort()
const canvasEdgePairs = () =>
  useCanvasStore.getState().edges.map((e: any) => canvasEdgePairKey(e)).sort()
const nodeById = (id: string): any => useCanvasStore.getState().nodes.find((n: any) => n.id === id)

let releaseDelivery: (() => void) | null = null

beforeEach(() => {
  __resetPendingFactorEditsForTest()
  seed(staleNodes(), staleEdges())
})

afterEach(() => {
  releaseDelivery?.()
  releaseDelivery = null
})

describe('§1 the stale canvas ends up holding exactly the saved model', () => {
  it('THE WITNESSED CASE: the deleted factor and its edge are taken off; counts and labels are true', () => {
    const res = mergeServerGraphOnHydrate(serverAfterDelete())

    expect(res.accepted).toBe(true)
    expect(res.removedNodeCount).toBe(1)
    expect(res.removedEdgeCount).toBe(1)
    expect(res.removedLabels).toEqual([DELETED_LABEL])
    expect(nodeById(DELETED), 'the factor CEE no longer holds is still on the canvas').toBeUndefined()
    expect(canvasNodeIds()).toEqual([GOAL, KEPT].sort())
    expect(canvasEdgePairs()).toEqual([canvasEdgePairKey({ source: KEPT, target: GOAL })])
  })

  it('layout of every surviving element is kept EXACTLY (bound by id)', () => {
    mergeServerGraphOnHydrate(serverAfterDelete())
    expect(nodeById(KEPT).position).toEqual(KEPT_POS)
    expect(nodeById(KEPT).width).toBe(180)
    expect(nodeById(GOAL).position).toEqual(GOAL_POS)
  })

  it('after the merge the canvas element set EQUALS the saved model — no ghost remains', () => {
    const server = serverAfterDelete()
    mergeServerGraphOnHydrate(server)
    expect(canvasNodeIds()).toEqual(server.nodes.map((n) => n.id).sort())
    expect(canvasEdgePairs()).toEqual(server.edges.map((e) => wireEdgePairKey(e)).sort())
  })

  it('an edge whose PAIR the saved model lacks is taken off even when both endpoints survive, and is named', () => {
    seed(
      [...staleNodes().filter((n) => n.id !== DELETED)],
      [edge(KEPT, GOAL), edge(GOAL, KEPT)],
    )
    const res = mergeServerGraphOnHydrate(serverAfterDelete())
    expect(res.removedNodeCount).toBe(0)
    expect(res.removedEdgeCount).toBe(1)
    expect(canvasEdgePairs()).toEqual([canvasEdgePairKey({ source: KEPT, target: GOAL })])
    expect(res.removedLabels).toEqual(['the link from Revenue to Usage-Based Pricing Exposure'])
  })

  it('a removed node with no label is named by its id', () => {
    seed(
      [...staleNodes().filter((n) => n.id !== DELETED), { id: DELETED, type: 'factor', position: DELETED_POS, data: { kind: 'factor', label: '  ' } }],
      staleEdges(),
    )
    const res = mergeServerGraphOnHydrate(serverAfterDelete())
    expect(res.removedLabels).toEqual([DELETED])
  })

  it('a server edge reusing a REMOVED canvas edge id is still added (identity is the pair, not the id)', () => {
    // Canvas: `e1` joins KEPT→DELETED. Server: `e1` joins KEPT→GOAL. The canvas
    // edge goes with DELETED; the server's must not be skipped because an edge
    // that no longer exists once carried its id.
    seed(staleNodes(), [{ id: 'e1', source: KEPT, target: DELETED, data: {} }])
    const res = mergeServerGraphOnHydrate({
      ...serverAfterDelete(),
      edges: [{ id: 'e1', from: KEPT, to: GOAL }],
    })
    expect(res.removedEdgeCount).toBe(1)
    expect(res.addedEdgeCount).toBe(1)
    expect(canvasEdgePairs()).toEqual([canvasEdgePairKey({ source: KEPT, target: GOAL })])
  })
})

describe('§2 a removal is a model change', () => {
  it('marks the analysis out of date on ALL THREE flags — even when nothing else moved', () => {
    const before = useCanvasStore.getState()
    expect(before.graphEditedSinceLastRun, 'precondition').toBe(false)
    expect(before.analysisStateReady, 'precondition').toBe(true)
    expect(before.analysisFreshnessDirty, 'precondition').toBe(false)

    const res = mergeServerGraphOnHydrate(serverAfterDelete())

    // Pure removal: nothing updated, nothing added — the removal alone is the change.
    expect(res.updatedNodeCount + res.updatedEdgeCount + res.addedNodeCount + res.addedEdgeCount).toBe(0)
    expect(res.changed).toBe(true)
    const s = useCanvasStore.getState()
    expect(s.graphEditedSinceLastRun).toBe(true)
    expect(s.analysisStateReady).toBe(false)
    expect(s.analysisFreshnessDirty).toBe(true)
  })

  it('pushes a PRE-MERGE history snapshot that still holds the removed factor (undoable)', () => {
    mergeServerGraphOnHydrate(serverAfterDelete())
    const past = useCanvasStore.getState().history.past as any[]
    expect(past).toHaveLength(1)
    expect(past[0].nodes.map((n: any) => n.id)).toContain(DELETED)
  })
})

describe('§3 CONTROLS — the licence', () => {
  it('a pending IMPORT (2.467/2.503) is refused and NOTHING is removed', () => {
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    const before = useCanvasStore.getState().nodes
    const res = mergeServerGraphOnHydrate(serverAfterDelete())
    expect(res.accepted).toBe(false)
    expect(res.refusedReason).toBe('importUnregistered')
    expect(res.removedNodeCount).toBe(0)
    expect(res.removedLabels).toEqual([])
    expect(useCanvasStore.getState().nodes).toBe(before)
    expect(nodeById(DELETED)).toBeTruthy()
  })

  it('an edit ON THE WIRE (editDeliveryHold non-null) — accepted, but nothing is removed', () => {
    releaseDelivery = beginModelEditDelivery('factor_value_edit')
    const res = mergeServerGraphOnHydrate(serverAfterDelete())
    expect(res.accepted).toBe(true)
    expect(res.removedNodeCount).toBe(0)
    expect(res.removedEdgeCount).toBe(0)
    expect(res.removedLabels).toEqual([])
    expect(nodeById(DELETED)).toBeTruthy()
    expect(canvasEdgePairs()).toHaveLength(2)
  })

  it('a node ADDED seconds after load whose add is still queued survives (structural_edit_queued)', () => {
    useCanvasStore.setState({ pendingStructuralAdds: [{ nodeId: DELETED }] } as never)
    const res = mergeServerGraphOnHydrate(serverAfterDelete())
    expect(res.accepted).toBe(true)
    expect(res.removedNodeCount).toBe(0)
    expect(nodeById(DELETED)).toBeTruthy()
  })

  it('a canvas EQUAL to the saved model: no removal, `changed` false, nothing marked stale', () => {
    seed(staleNodes().filter((n) => n.id !== DELETED), [edge(KEPT, GOAL)])
    // Settle whatever the overlay acquires (e.g. edge defaults) first, so the
    // measured merge is the idempotent boot a real reload takes.
    mergeServerGraphOnHydrate(serverAfterDelete())
    useCanvasStore.setState({
      history: { past: [], future: [] },
      graphEditedSinceLastRun: false,
      analysisStateReady: true,
      analysisFreshnessDirty: false,
    } as never)
    const before = useCanvasStore.getState().nodes

    const res = mergeServerGraphOnHydrate(serverAfterDelete())

    expect(res.accepted).toBe(true)
    expect(res.changed).toBe(false)
    expect(res.removedNodeCount).toBe(0)
    expect(res.removedEdgeCount).toBe(0)
    expect(res.removedLabels).toEqual([])
    expect(useCanvasStore.getState().nodes).toBe(before)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
  })

  it('ZERO overlap is still refused and nothing is removed', () => {
    const before = useCanvasStore.getState().nodes
    const res = mergeServerGraphOnHydrate({
      nodes: [{ id: 'unrelated-a', kind: 'factor', label: 'Other' }],
      edges: [],
    })
    expect(res.refusedReason).toBe('zeroOverlap')
    expect(res.removedNodeCount).toBe(0)
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('an EMPTY server graph is still refused and nothing is removed', () => {
    const before = useCanvasStore.getState().nodes
    const res = mergeServerGraphOnHydrate({ nodes: [], edges: [] })
    expect(res.refusedReason).toBe('emptyServerGraph')
    expect(res.removedNodeCount).toBe(0)
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('a read with edges but NO NODES never blanks the canvas (no saved model has that shape)', () => {
    const res = mergeServerGraphOnHydrate({ nodes: [], edges: [{ from: KEPT, to: GOAL }] })
    expect(res.removedNodeCount).toBe(0)
    expect(res.removedEdgeCount).toBe(0)
    expect(canvasNodeIds()).toEqual([DELETED, GOAL, KEPT].sort())
  })

  it('a UI-only render node (`ghost-*`) is never removed', () => {
    seed(
      [
        ...staleNodes().filter((n) => n.id !== DELETED),
        { id: 'ghost-opt-1', type: 'ghost-option', position: { x: 0, y: 0 }, data: { label: 'Add an option' } },
      ],
      [edge(KEPT, GOAL)],
    )
    const res = mergeServerGraphOnHydrate(serverAfterDelete())
    expect(res.removedNodeCount).toBe(0)
    expect(nodeById('ghost-opt-1')).toBeTruthy()
  })

  it('an ordinary VALUE overwrite (every element present) behaves as today', () => {
    seed(
      [
        node(GOAL, 'goal', 'Revenue', GOAL_POS),
        { ...node(KEPT, 'factor', 'Usage-Based Pricing Exposure', KEPT_POS), data: { label: 'Usage-Based Pricing Exposure', kind: 'factor', value: 100 } },
      ],
      [],
    )
    const res = mergeServerGraphOnHydrate({
      nodes: [
        { id: GOAL, kind: 'goal', label: 'Revenue' },
        { id: KEPT, kind: 'factor', label: 'Usage-Based Pricing Exposure', value: 250 },
      ],
      edges: [],
    })
    expect(res.accepted).toBe(true)
    expect(res.updatedNodeCount).toBe(1)
    expect(res.removedNodeCount).toBe(0)
    expect(res.removedEdgeCount).toBe(0)
    expect(res.removedLabels).toEqual([])
    expect(nodeById(KEPT).data.value).toBe(250)
    expect(nodeById(KEPT).position).toEqual(KEPT_POS)
    expect(useCanvasStore.getState().history.past).toHaveLength(1)
  })
})

// ── §4 the hydration path records the notice ──────────────────────────────────
//
// Driven through the REAL chain (fetch → adapter → hydrate → merge) with only
// `fetch` stubbed. The store is imported dynamically so each case below fails on
// its own at base rather than taking the whole file down with a missing module.
function graphBody(graph: unknown) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO,
    graph,
    graph_present: true,
    brief_text: null,
    graph_identity_hash: {
      kind: 'graph_identity_hash',
      value: 'd'.repeat(64),
      algorithm: 'sha256',
      projection_version: 'identity.v1',
      graph_schema_version: 'graph_v3',
      normaliser_version: '1',
    },
    layout_present: false,
    request_id: 'req-reload-saved-model',
  }
}
function jsonResponse(status: number, b: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => b } as unknown as Response
}
// A variable specifier keeps Vite from resolving it at transform time.
const NOTICE_STORE_MODULE = '../../stores/reloadDifferenceStore'
const noticeStore = async () =>
  (await import(/* @vite-ignore */ NOTICE_STORE_MODULE) as typeof import('../../stores/reloadDifferenceStore'))
    .useReloadDifferenceStore

describe('§4 the reload records what it took off, for one lasting line', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, graphBody(serverAfterDelete()))))
    ;(await noticeStore()).getState().clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('an accepted reload that removed the factor writes the notice, keyed by scenario, naming it', async () => {
    const outcome = await hydrateCanvasFromServer(SCENARIO)
    expect(outcome).toBe('merged')
    const n = (await noticeStore()).getState()
    expect(n.scenarioId).toBe(SCENARIO)
    expect(typeof n.id).toBe('string')
    expect(n.removedLabels).toEqual([DELETED_LABEL])
  })

  it('CONTROL: a reload whose canvas matches the saved model writes NO notice', async () => {
    seed(staleNodes().filter((n) => n.id !== DELETED), [edge(KEPT, GOAL)])
    const outcome = await hydrateCanvasFromServer(SCENARIO)
    expect(outcome).toBe('merged')
    expect((await noticeStore()).getState().id).toBeNull()
  })

  it('CONTROL: a refused reload (pending import) writes NO notice', async () => {
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    const outcome = await hydrateCanvasFromServer(SCENARIO)
    expect(outcome).toBe('mergeRefused')
    expect((await noticeStore()).getState().id).toBeNull()
    expect(nodeById(DELETED)).toBeTruthy()
  })
})

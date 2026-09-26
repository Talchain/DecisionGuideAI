/**
 * STALE TAB RELOAD — a reload must never write the tab's own copy over a
 * DIFFERENT model CEE already holds.
 *
 * Witnessed on served `fa84d226`, 23 Sep 08:31–08:35Z, isolated scenario
 * `f47d2260`, guest, pricing starter, one person with two tabs:
 *   1. Tab A deletes `fac_market_competition` → applied; CEE holds 14 nodes.
 *   2. Tab B (stale, still 15 nodes) edits a value → applied, no register.
 *   3. Tab B reloads: the boot read returns 200 with 14 nodes, and 0.9 s later
 *      `graph/register` carries 15 nodes → CEE holds 15, the delete is undone.
 *
 * Two ruled behaviours compose into that write:
 *   - `mergeServerGraph.ts` boot merge: "no DELETION — an element the canvas has
 *     and the server does not SURVIVES" (its stated reason, ROADMAP 2.304, is
 *     recorded CLOSED);
 *   - `useImportRegistration.ts` reload re-arm: an unacknowledged injected model
 *     is marked imported and registered, without consulting the boot read.
 *
 * §1 is the write (C1: never overwrite newer saved work). §2 pins the two cases
 * where writing the local copy IS right and must survive any fix: CEE holds no
 * graph yet, and a deliberate import still waiting for its first registration
 * (2.503). §3 is the screen.
 *
 * ⭐ DECISION A (packaged with this fix, 23 Sep): on reload the SAVED MODEL WINS.
 *   An accepted boot merge takes off every canvas element CEE lacks
 *   (`mergeServerGraph.ts` "RELOAD SHOWS THE SAVED MODEL"), names it in one
 *   lasting chat line, and marks the analysis out of date. So after a reload the
 *   stale copy no longer carries the deleted factor, and a read carrying every
 *   remaining value now ACKNOWLEDGES the canvas (§1b). An element CEE lacks can
 *   only be on the canvas again if it arrives AFTER the read — a local add — and
 *   §1b / §6 pin that such an element is neither acknowledged nor registered.
 *
 * §4–§7 are the independent review's probes at `b072db1a` (CHANGES_REQUIRED),
 * kept as cases: B3 (a read acknowledges only values the wire carries), B1 (a
 * superseded read, and a re-arm that runs before the read begins), B2 option
 * (i) (the in-page re-arm is refused only for an element CEE lacks), and the
 * one authoritative record a successful registration leaves behind.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import {
  clearImportRegistrationMarkers,
  markGraphImported,
} from '../../store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

/** Mutable so a case can drive the hydration hook's own `user?.id` re-run path. */
const auth = vi.hoisted(() => ({ user: null as null | { id: string } }))

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => true }
})
const registerSpy = vi.fn()
vi.mock('../../../adapters/cee/registerScenarioGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../adapters/cee/registerScenarioGraph')>()),
  registerScenarioGraph: (...args: unknown[]) => registerSpy(...args),
}))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

import { useImportRegistration } from '../useImportRegistration'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useServerGraphHydration } from '../../hooks/useServerGraphHydration'
import {
  __resetBootGraphReadForTest,
  beginBootGraphRead,
  settleBootGraphRead,
  useBootGraphReadStore,
} from '../../hydrate/bootGraphRead'
import { isGraphServerAcknowledged } from '../../store/importRegistrationMarker'
import { analysisHeldOn } from '../../utils/analysisHeldOnInjectedModel'
import { edgePairKey } from '../../utils/graphIdentity'
import { beginModelEditDelivery } from '../editDeliveryHold'
import { useReloadDifferenceStore } from '../../stores/reloadDifferenceStore'

const SCENARIO = '5a1e7ab0-0d04-4dd4-89db-bb6470a98fc5'
const GOAL = 'goal_revenue'
const KEPT = 'fac_usage_exposure'
const DELETED = 'fac_market_competition'

function starterNode(id: string, kind: 'factor' | 'goal', label: string): Node {
  return {
    id,
    type: kind,
    position: { x: 100, y: 100 },
    data: { label, kind, starterId: 'pricing-model', provenance: 'ai_inferred' },
  } as unknown as Node
}
function starterEdge(source: string, target: string): Edge {
  return {
    id: `e_${source}_${target}`,
    source,
    target,
    data: { weight: 0.5, direction: 'positive' },
  } as unknown as Edge
}

/** Tab B's restored copy: still holds the factor tab A deleted. */
const STALE_NODES = [
  starterNode(GOAL, 'goal', 'Revenue'),
  starterNode(KEPT, 'factor', 'Usage-Based Pricing Exposure'),
  starterNode(DELETED, 'factor', 'Competitive Pressure'),
]
const STALE_EDGES = [starterEdge(KEPT, GOAL), starterEdge(DELETED, GOAL)]

/** What CEE holds after tab A's applied delete. */
const SERVER_AFTER_DELETE = {
  nodes: [
    { id: GOAL, kind: 'goal', label: 'Revenue' },
    { id: KEPT, kind: 'factor', label: 'Usage-Based Pricing Exposure' },
  ],
  edges: [{ from: KEPT, to: GOAL, strength_mean: 0.5 }],
}

/**
 * A factor the user adds on THIS tab after the reload's read — so CEE's saved
 * model (and its record, `lastAuthoritativeGraph`) cannot hold it yet.
 */
const ADDED = 'fac_added_after_read'
const ADDED_NODE = starterNode(ADDED, 'factor', 'Churn Risk')
const ADDED_EDGE = starterEdge(ADDED, GOAL)

/** Tab B's copy when nothing was deleted elsewhere: exactly CEE's elements. */
const MATCHING_NODES = STALE_NODES.filter((n) => n.id !== DELETED)
const MATCHING_EDGES = STALE_EDGES.filter((e) => e.source !== DELETED)

/**
 * What CEE holds once THIS canvas (`MATCHING_*`) has been registered: every
 * analytical key the registration projection sends, under CEE's own canonical
 * keys — nested `strength`, `effect_direction`, `edge_type` (the edge fields
 * CEE's analysis-affecting projection hashes: `graph-hash.ts` `projectEdge`,
 * olumi-assistants-service staging `cc7b26cb`). `starterId`/`provenance` are
 * absent: CEE never carries the UI's injection stamp.
 *
 * ⚠ WHY §1b READS THIS AND NOT `SERVER_AFTER_DELETE` (review B3). That wire
 *   spells strength flat and carries no direction or type, so it does not
 *   vouch for the `effect_direction`/`edge_type` the canvas would send. A read
 *   that acknowledged the canvas against it would attest values CEE does not
 *   hold — pinned as NOT acknowledged in §4 (D-flat).
 */
const SERVER_AS_REGISTERED = {
  nodes: [
    { id: GOAL, kind: 'goal', label: 'Revenue' },
    { id: KEPT, kind: 'factor', label: 'Usage-Based Pricing Exposure' },
  ],
  edges: [
    { from: KEPT, to: GOAL, strength: { mean: 0.5 }, effect_direction: 'positive', edge_type: 'directed' },
  ],
}

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
    request_id: 'req-stale-tab',
  }
}
function jsonResponse(status: number, b: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => b } as unknown as Response
}

const ACK = {
  status: 'registered' as const,
  identity: { value: 'id_abc', projectionVersion: 'identity.v1' },
  nodeCount: 3,
  edgeCount: 2,
  requestId: 'req_register',
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

function registeredNodeIds(call: unknown[]): string[] {
  const payload = call.find(
    (a) => a != null && typeof a === 'object' && Array.isArray((a as { nodes?: unknown }).nodes),
  ) as { nodes: Array<{ id: string }> } | undefined
  return (payload?.nodes ?? []).map((n) => n.id)
}
function registrationsCarrying(id: string) {
  return registerSpy.mock.calls.filter((c) => registeredNodeIds(c).includes(id))
}

let fetchSpy: ReturnType<typeof vi.fn>

/** Tab B at reload: its restored copy on the canvas, nothing acknowledged or pending. */
function restoreStaleCopy() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: STALE_NODES as never,
    edges: STALE_EDGES as never,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    lastServerGraphHash: null,
    history: { past: [], future: [] },
    pendingEmittedEdits: 0,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

/** The reload, in the witnessed order: boot read + merge, then the registration hook. */
async function reload() {
  await act(async () => {
    await hydrateCanvasFromServer(SCENARIO)
  })
  const hook = renderHook(() => useImportRegistration())
  await act(async () => { await flush() })
  return hook
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  registerSpy.mockReset()
  registerSpy.mockResolvedValue(ACK)
  clearImportRegistrationMarkers()
  __resetPersistenceSessionForTests()
  __resetBootGraphReadForTest()
  useReloadDifferenceStore.getState().clear()
  auth.user = null
  restoreStaleCopy()
})

/** A fetch that stays pending until answered, and rejects like a real fetch on abort. */
function pendingFetches() {
  const calls: Array<{ answer: (r: Response) => void; aborted: () => boolean }> = []
  fetchSpy.mockImplementation((_url: string, init: { signal?: AbortSignal }) =>
    new Promise<Response>((res, rej) => {
      calls.push({ answer: res, aborted: () => init?.signal?.aborted === true })
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.')
        err.name = 'AbortError'
        rej(err)
      })
    }),
  )
  return calls
}

/** Put a canvas on the store as the reload restored it: nothing acknowledged or pending. */
function setCanvas(nodes: Node[], edges: Edge[], scenarioId: string | null = SCENARIO) {
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    nodes: nodes as never,
    edges: edges as never,
  } as never)
}

async function hydrate(server: unknown) {
  fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(server)))
  let outcome: unknown
  await act(async () => { outcome = await hydrateCanvasFromServer(SCENARIO) })
  const st = useCanvasStore.getState()
  return {
    outcome,
    acked: isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never),
    held: analysisHeldOn(st as never),
  }
}

/** `MATCHING_NODES` with extra data on the kept factor. */
function keptWith(extra: Record<string, unknown>): Node[] {
  return MATCHING_NODES.map((n) =>
    n.id === KEPT ? ({ ...n, data: { ...(n.data as object), ...extra } } as Node) : n)
}

/** A local value-only change nothing sends: no receipt will acknowledge it. */
async function localValueOnlyChange(value: number) {
  const edited = useCanvasStore.getState().nodes.map((n) =>
    n.id === KEPT ? { ...n, data: { ...(n.data as object), observedState: { value } } } : n)
  await act(async () => {
    useCanvasStore.setState({ nodes: edited as never } as never)
    await flush()
  })
}

/** A local add after the read: the factor and its edge, with no delivery signal left up. */
function addAfterTheRead() {
  const st = useCanvasStore.getState()
  useCanvasStore.setState({
    nodes: [...st.nodes, ADDED_NODE] as never,
    edges: [...st.edges, ADDED_EDGE] as never,
  } as never)
}

function registeredEdgePairs(call: unknown[]): string[] {
  const payload = call.find(
    (a) => a != null && typeof a === 'object' && Array.isArray((a as { edges?: unknown }).edges),
  ) as { edges: Array<{ from: string; to: string }> } | undefined
  return (payload?.edges ?? []).map((e) => edgePairKey(e.from, e.to))
}

afterEach(async () => {
  await flush()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('§1 a stale tab reload never writes its copy over a different model CEE holds', () => {
  it('PRECONDITION: the boot read is served, and the merge accepts it', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
    let outcome: unknown
    await act(async () => { outcome = await hydrateCanvasFromServer(SCENARIO) })
    expect(fetchSpy).toHaveBeenCalled()
    expect(outcome).toBe('merged')
  })

  it('THE WITNESSED WRITE: no graph/register carries the factor CEE no longer holds', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
    const hook = await reload()
    expect(registrationsCarrying(DELETED)).toHaveLength(0)
    hook.unmount()
  })
  it('CEE UNREACHABLE: a read that fails is not a licence to write — no registration', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))
    const hook = await reload()
    expect(registerSpy).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('WHILE THE READ IS IN FLIGHT the re-arm waits; it registers only once the read says CEE holds no model', async () => {
    const token = beginBootGraphRead(SCENARIO)
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).not.toHaveBeenCalled()
    await act(async () => {
      settleBootGraphRead(SCENARIO, token, 'notReadable')
      await flush()
    })
    expect(registrationsCarrying(DELETED).length).toBeGreaterThan(0)
    hook.unmount()
  })

  it('MOUNTED TOGETHER, as the Canvas route mounts them: the re-arm does not race the read', async () => {
    let answer: (r: Response) => void = () => {}
    fetchSpy.mockImplementation(() => new Promise<Response>((res) => { answer = res }))
    const hook = renderHook(() => {
      useServerGraphHydration(SCENARIO)
      useImportRegistration()
    })
    await act(async () => { await flush() })
    expect(registerSpy).not.toHaveBeenCalled()
    await act(async () => {
      answer(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
      await flush()
    })
    expect(registrationsCarrying(DELETED)).toHaveLength(0)
    hook.unmount()
  })
})

describe('§1b the re-arm\'s own design case survives without its write', () => {
  it('LOST ACKNOWLEDGEMENT: a canvas that matches the read is acknowledged by the read — released, nothing sent', async () => {
    useCanvasStore.setState({ nodes: MATCHING_NODES as never, edges: MATCHING_EDGES as never } as never)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).not.toBeNull()
    // The read returns what this canvas registered (see SERVER_AS_REGISTERED).
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AS_REGISTERED)))
    const hook = await reload()
    const st = useCanvasStore.getState()
    expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(true)
    expect(analysisHeldOn(st as never)).toBeNull()
    expect(registerSpy).not.toHaveBeenCalled()
    hook.unmount()
  })

  // ⭐ DECISION A. This case used to read "a canvas that carries an element CEE
  // lacks is NOT acknowledged by the read (stays held, nothing sent)": the boot
  // merge KEPT the element, so the canvas could never match. The merge now takes
  // it off, so the stale copy converges on the saved model and the read vouches
  // for what is left. The "element CEE lacks" premise survives only for an
  // element that arrives AFTER the read — the next case.
  it('DECISION A: the reload takes off the element CEE lacks, the canvas then matches the read — acknowledged, nothing sent', async () => {
    expect(useCanvasStore.getState().nodes.some((n) => n.id === DELETED), 'precondition: the stale copy carries it').toBe(true)
    // What CEE holds after tab A's delete, spelled as CEE stores a registered graph.
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AS_REGISTERED)))
    const hook = await reload()
    const st = useCanvasStore.getState()
    // Taken off by the reload merge — bound by id, node and edge.
    expect(st.nodes.map((n) => n.id).sort()).toEqual([GOAL, KEPT].sort())
    expect(st.edges.map((e) => edgePairKey(e.source, e.target))).toEqual([edgePairKey(KEPT, GOAL)])
    expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(true)
    expect(analysisHeldOn(st as never)).toBeNull()
    expect(registerSpy).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('AN ELEMENT ADDED AFTER THE READ, its add turn not yet settled, is NOT acknowledged and NOT registered over the saved model', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AS_REGISTERED)))
    const hook = await reload()
    {
      const st = useCanvasStore.getState()
      expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never), 'precondition: the reload matched the read').toBe(true)
    }

    // The user adds a factor after the read; its `structural_add` turn is on the wire.
    const releaseAddTurn = beginModelEditDelivery('structural_add')
    try {
      await act(async () => {
        const st = useCanvasStore.getState()
        useCanvasStore.setState({
          nodes: [...st.nodes, ADDED_NODE] as never,
          edges: [...st.edges, ADDED_EDGE] as never,
        } as never)
        await flush()
      })
      const st = useCanvasStore.getState()
      expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(false)
      expect(registrationsCarrying(ADDED)).toHaveLength(0)
    } finally {
      releaseAddTurn()
    }

    // The turn has left the wire but no receipt put the factor into CEE's record:
    // nothing but the saved-model gate stands between it and a whole-graph write.
    await act(async () => { await flush() })
    const st = useCanvasStore.getState()
    expect(st.nodes.some((n) => n.id === ADDED), 'precondition: the added factor is still on the canvas').toBe(true)
    expect(useCanvasStore.getState().lastAuthoritativeGraph?.nodeIds ?? []).not.toContain(ADDED)
    expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(false)
    expect(registrationsCarrying(ADDED)).toHaveLength(0)
    expect(registerSpy).not.toHaveBeenCalled()
    hook.unmount()
  })
})

describe('§2 the two cases where the local copy IS the model to write — must survive any fix', () => {
  it('CEE holds no graph yet (404): the local model is registered, deleted-elsewhere factor and all', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, { error: 'not_found' }))
    const hook = await reload()
    expect(registrationsCarrying(DELETED).length).toBeGreaterThan(0)
    hook.unmount()
  })

  it('CEE holds no model yet (200, graph_present false): the local model is registered', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, { ...graphBody(null), graph: null, graph_present: false }))
    const hook = await reload()
    expect(registrationsCarrying(DELETED).length).toBeGreaterThan(0)
    hook.unmount()
  })

  it('a deliberate import still waiting for its first registration (2.503) is registered over the old model', async () => {
    markGraphImported(STALE_NODES as never, STALE_EDGES as never)
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
    const hook = await reload()
    expect(registrationsCarrying(DELETED).length).toBeGreaterThan(0)
    hook.unmount()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §4 — review B3 (CHANGES_REQUIRED @ b072db1a): a read acknowledges a canvas
// only when the wire carries every analytical value the canvas would send.
// Equal element sets are not enough: the boot merge KEEPS a canvas key the wire
// omits (`overlayNode`: "the canvas KEEPS keys the wire omits"), and the
// acknowledgement digest is the canvas's whole registration projection.
// ═══════════════════════════════════════════════════════════════════════════
describe('§4 a read acknowledges only values the wire carries (review B3)', () => {
  it('C: CEE holds NO observed value for the factor, the canvas holds 0.7 — NOT acknowledged, still held', async () => {
    setCanvas(
      keptWith({ observedState: { value: 0.7 } }),
      MATCHING_EDGES,
    )
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome).toBe('merged')
    // Precondition: the canvas-only value survived the merge (the ruled no-clear overlay).
    const kept = useCanvasStore.getState().nodes.find((n) => n.id === KEPT)!.data as Record<string, unknown>
    expect(kept.observedState).toEqual({ value: 0.7 })
    expect(r.acked).toBe(false)
    expect(r.held).not.toBeNull()
  })

  it('C-control: CEE holds a DIFFERENT value — the merge writes CEE\'s value, and the read vouches for it', async () => {
    setCanvas(
      keptWith({ observedState: { value: 0.7 } }),
      MATCHING_EDGES,
    )
    const server = {
      ...SERVER_AS_REGISTERED,
      nodes: [SERVER_AS_REGISTERED.nodes[0], { ...SERVER_AS_REGISTERED.nodes[1], observed_state: { value: 0.4 } }],
    }
    const r = await hydrate(server)
    const kept = useCanvasStore.getState().nodes.find((n) => n.id === KEPT)!.data as Record<string, unknown>
    expect(kept.observedState).toEqual({ value: 0.4 })
    expect(r.acked).toBe(true)
    expect(r.held).toBeNull()
  })

  it('D: the canvas edge carries an exists-probability CEE lacks — NOT acknowledged', async () => {
    setCanvas(MATCHING_NODES, [{ ...MATCHING_EDGES[0], data: { ...(MATCHING_EDGES[0].data as object), beliefExists: 0.3 } } as Edge])
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome).toBe('merged')
    const edge = useCanvasStore.getState().edges[0].data as Record<string, unknown>
    expect(edge.beliefExists).toBe(0.3)
    expect(r.acked).toBe(false)
    expect(r.held).not.toBeNull()
  })

  it('D-flat: a wire in the flat legacy spelling with no direction or type does not vouch for the canvas\'s — NOT acknowledged', async () => {
    setCanvas(MATCHING_NODES, MATCHING_EDGES)
    const r = await hydrate(SERVER_AFTER_DELETE)
    expect(r.outcome).toBe('merged')
    expect(r.acked).toBe(false)
  })

  // #2043 review 5841802705 blocker 1: the acknowledgement compares edge_type
  // under the contract's default on BOTH sides, as the currency proof does.
  // A canvas saved before A1 carries an explicit 'directed' (the readback wrote
  // it); a read that omits edge_type IS 'directed' by `EdgeV3Schema`.
  const SERVER_WITHOUT_EDGE_TYPE = {
    ...SERVER_AS_REGISTERED,
    edges: SERVER_AS_REGISTERED.edges.map(({ edge_type: _omitted, ...rest }) => rest),
  }
  function matchingEdgesTyped(edgeType: string): Edge[] {
    return MATCHING_EDGES.map((e) => ({ ...e, data: { ...(e.data as object), edge_type: edgeType } }) as Edge)
  }

  it('A1 contract default: a canvas edge spelling "directed" is vouched for by a read that omits edge_type — acknowledged', async () => {
    setCanvas(MATCHING_NODES, matchingEdgesTyped('directed'))
    const r = await hydrate(SERVER_WITHOUT_EDGE_TYPE)
    expect(r.outcome).toBe('merged')
    expect((useCanvasStore.getState().edges[0].data as Record<string, unknown>).edge_type, 'precondition: the canvas keeps its spelling').toBe('directed')
    expect(r.acked).toBe(true)
    expect(r.held).toBeNull()
  })

  it('A1 contract default is not a wildcard: a canvas edge marked "bidirected" is NOT vouched for by a read that omits edge_type', async () => {
    setCanvas(MATCHING_NODES, matchingEdgesTyped('bidirected'))
    const r = await hydrate(SERVER_WITHOUT_EDGE_TYPE)
    expect(r.outcome).toBe('merged')
    expect((useCanvasStore.getState().edges[0].data as Record<string, unknown>).edge_type, 'precondition: the canvas keeps its spelling').toBe('bidirected')
    expect(r.acked).toBe(false)
  })

  it('an option\'s interventionKeys is vouched for by the index of the wire\'s own interventions map — acknowledged', async () => {
    // `interventionKeys` is the index `mapDraftNodeToCanvas` derives; the wire
    // carries the map it indexes, never the index itself.
    const OPTION = 'opt_raise_price'
    const option = {
      id: OPTION,
      type: 'option',
      position: { x: 0, y: 0 },
      data: {
        label: 'Raise price',
        kind: 'option',
        starterId: 'pricing-model',
        provenance: 'ai_inferred',
        interventions: { [KEPT]: { value: 0.5 } },
        interventionKeys: [KEPT],
      },
    } as unknown as Node
    setCanvas([...MATCHING_NODES, option], MATCHING_EDGES)
    const r = await hydrate({
      ...SERVER_AS_REGISTERED,
      nodes: [
        ...SERVER_AS_REGISTERED.nodes,
        { id: OPTION, kind: 'option', label: 'Raise price', interventions: { [KEPT]: { value: 0.5 } } },
      ],
    })
    expect(r.outcome).toBe('merged')
    expect(r.acked).toBe(true)
  })

  it('M8 pin: the read does not acknowledge while an edit is still being delivered', async () => {
    setCanvas(MATCHING_NODES, MATCHING_EDGES)
    useCanvasStore.setState({ pendingEmittedEdits: 1 } as never)
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome).toBe('merged')
    expect(r.acked).toBe(false)
  })

  it('M12 pin: the read does not acknowledge a canvas that is not bound to the scenario it read', async () => {
    // `readAndMergeServerGraph` returns `skipped` for a canvas bound to ANOTHER
    // scenario, so the one reachable unbound state at the acknowledgement is a
    // null binding — the merge runs, the acknowledgement must not.
    setCanvas(MATCHING_NODES, MATCHING_EDGES, null)
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome).toBe('merged')
    expect(r.acked).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §5 — review B1: the two timings that still POSTed the stale copy.
// ═══════════════════════════════════════════════════════════════════════════
describe('§5 no timing lets the re-arm write before the read has answered (review B1)', () => {
  it('E: a SUPERSEDED read settling cannot erase the live read\'s mark — nothing is sent while read 2 is pending', async () => {
    const calls = pendingFetches()
    auth.user = { id: 'guest' }
    const hook = renderHook(() => {
      useServerGraphHydration(SCENARIO)
      useImportRegistration()
    })
    await act(async () => { await flush() })
    expect(calls.length).toBe(1)
    expect(registerSpy).not.toHaveBeenCalled()

    // The hook's own documented re-run path: `user?.id` changes while read 1 is unsettled.
    auth.user = { id: 'real-user' }
    await act(async () => {
      hook.rerender()
      await flush()
    })
    // Preconditions, by identity: read 1 aborted, read 2 issued and still pending.
    expect(calls.length).toBe(2)
    expect(calls[0].aborted()).toBe(true)
    expect(calls[1].aborted()).toBe(false)
    expect(registrationsCarrying(DELETED)).toHaveLength(0)

    await act(async () => {
      calls[1].answer(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
      await flush()
    })
    expect(registrationsCarrying(DELETED)).toHaveLength(0)
    hook.unmount()
  })

  it('E2: a superseded read that answers LATER cannot overwrite the current read — its "no model" is not a licence', async () => {
    // Two reads of one scenario in flight (e.g. the boot read and a draft
    // recovery read): the second supersedes the first. Neither is aborted, so
    // the first can answer with a real outcome after the second has begun.
    const calls = pendingFetches()
    let first: Promise<unknown> = Promise.resolve()
    let second: Promise<unknown> = Promise.resolve()
    await act(async () => {
      first = hydrateCanvasFromServer(SCENARIO)
      second = hydrateCanvasFromServer(SCENARIO)
      await flush()
    })
    expect(calls.length).toBe(2)
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })

    await act(async () => {
      calls[0].answer(jsonResponse(404, { error: 'not_found' }))
      await first
      await flush()
    })
    // The superseded read's 404 did not replace the live read's mark.
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('reading')
    expect(registrationsCarrying(DELETED)).toHaveLength(0)

    await act(async () => {
      calls[1].answer(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
      await second
      await flush()
    })
    expect(registrationsCarrying(DELETED)).toHaveLength(0)
    hook.unmount()
  })

  function Restorer({ restoreId }: { restoreId: string }) {
    // Mimics `ReactFlowGraph`'s PROD boot effect (a CHILD of CanvasMVP):
    // hydrateGraphSlice(autosave) + bindRestoredScenarioId(pointer ?? autosave).
    useEffect(() => {
      useCanvasStore.setState({ nodes: STALE_NODES as never, edges: STALE_EDGES as never, currentScenarioId: restoreId } as never)
    }, [restoreId])
    return null
  }
  function Route() {
    useServerGraphHydration(undefined)
    useImportRegistration()
    return <Restorer restoreId={SCENARIO} />
  }

  it('F: the re-arm runs before the read begins (store id bound by the child restore) — nothing is sent before or after the read', async () => {
    const calls = pendingFetches()
    setCanvas([], [], null)
    let view: ReturnType<typeof render> | null = null
    await act(async () => {
      view = render(<Route />)
      await flush()
    })
    expect(registrationsCarrying(DELETED)).toHaveLength(0)
    expect(calls.length).toBe(1)
    await act(async () => {
      calls[0].answer(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
      await flush()
    })
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]).toBeDefined()
    expect(registrationsCarrying(DELETED)).toHaveLength(0)
    view!.unmount()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §6 — review B2, option (i): the in-page re-arm survives a merged boot read
// for a canvas that holds nothing CEE lacks, and is refused only for one that
// does (the write that could resurrect a delete).
// ═══════════════════════════════════════════════════════════════════════════
describe('§6 after a merged boot read the re-arm is refused only for an element CEE lacks (review B2 (i))', () => {
  it('J: a later value-only change no receipt acknowledges IS re-offered — once, carrying no element CEE lacks', async () => {
    setCanvas(MATCHING_NODES, MATCHING_EDGES)
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome).toBe('merged')
    expect(r.held).toBeNull() // acknowledged by the read (§1b)
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).not.toHaveBeenCalled()

    await localValueOnlyChange(0.6)
    expect(registerSpy).toHaveBeenCalledTimes(1)
    const serverIds = SERVER_AS_REGISTERED.nodes.map((n) => n.id)
    const serverPairs = SERVER_AS_REGISTERED.edges.map((e) => edgePairKey(e.from, e.to))
    expect(registeredNodeIds(registerSpy.mock.calls[0]).every((id) => serverIds.includes(id))).toBe(true)
    expect(registeredEdgePairs(registerSpy.mock.calls[0]).every((p) => serverPairs.includes(p))).toBe(true)
    hook.unmount()
  })

  // ⭐ DECISION A. Both cases below used to reach "a canvas carrying an element
  // CEE lacks" by reloading the stale copy — the merge kept DELETED. The merge
  // now takes it off (asserted as a precondition), so the element CEE lacks is
  // one added after the read, which is the only way such a canvas now arises.
  it('J-control: a canvas carrying an element CEE lacks (added after the read) is NOT re-registered, before or after a value-only change', async () => {
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome).toBe('merged')
    expect(useCanvasStore.getState().nodes.some((n) => n.id === DELETED), 'precondition: the reload took DELETED off').toBe(false)
    addAfterTheRead()
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    await localValueOnlyChange(0.6)
    expect(registerSpy).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('the verdict follows CEE\'s record: when a later authoritative graph holds the element too, the model is re-offered', async () => {
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome).toBe('merged')
    expect(useCanvasStore.getState().nodes.some((n) => n.id === DELETED), 'precondition: the reload took DELETED off').toBe(false)
    addAfterTheRead()
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).not.toHaveBeenCalled()
    // No canvas change at all — only CEE's record of what it holds moves
    // (e.g. the add's receipt carrying the element).
    await act(async () => {
      useCanvasStore.getState().setLastAuthoritativeGraph({
        nodeIds: [GOAL, KEPT, ADDED],
        edgePairs: [edgePairKey(KEPT, GOAL), edgePairKey(ADDED, GOAL)],
      })
      await flush()
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(registeredNodeIds(registerSpy.mock.calls[0]).sort()).toEqual([GOAL, KEPT, ADDED].sort())
    hook.unmount()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §7 — one authoritative record: a registration CEE acknowledged is a record of
// exactly what CEE now holds.
// ═══════════════════════════════════════════════════════════════════════════
describe('§7 a registration CEE acknowledges records what CEE holds', () => {
  it('a successful registration sets lastAuthoritativeGraph to the registered element set', async () => {
    setCanvas(MATCHING_NODES, MATCHING_EDGES)
    markGraphImported(MATCHING_NODES as never, MATCHING_EDGES as never)
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    const record = useCanvasStore.getState().lastAuthoritativeGraph
    expect(record && [...record.nodeIds].sort()).toEqual([GOAL, KEPT].sort())
    expect(record && [...record.edgePairs].sort()).toEqual([edgePairKey(KEPT, GOAL)])
    hook.unmount()
  })

  it('CONTROL: a registration CEE did not acknowledge records nothing', async () => {
    registerSpy.mockResolvedValue({ status: 'unavailable' })
    setCanvas(MATCHING_NODES, MATCHING_EDGES)
    markGraphImported(MATCHING_NODES as never, MATCHING_EDGES as never)
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
    hook.unmount()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §8 — a registration CEE acknowledged IS a settled read. The residual #1903's
// review request left open (open question 1): a reload while a starter or
// import registration is still pending reads first, the merge refuses the
// pending import (`importUnregistered` → `mergeRefused`, verdict 'refuse'), the
// registration then succeeds — and with the refused read still on record every
// later value-only change was walled off for the page's life (probe:
// `{outcome:'mergeRefused', firstRegistrations:1, reRegistrationsAfterEdit:0}`).
// ═══════════════════════════════════════════════════════════════════════════
describe('§8 a registration CEE acknowledged settles the boot read (the mergeRefused residual)', () => {
  /** A pending import/starter registration on the canvas at reload, and the read landing first. */
  async function reloadWithPendingRegistrationReadFirst() {
    setCanvas(MATCHING_NODES, MATCHING_EDGES)
    markGraphImported(MATCHING_NODES as never, MATCHING_EDGES as never)
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    const r = await hydrate(SERVER_AS_REGISTERED)
    expect(r.outcome, 'precondition: the merge refuses the pending import').toBe('mergeRefused')
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('mergeRefused')
  }

  it('the read refuses, the registration succeeds, then a value-only change leaving the element set a subset IS re-offered — once', async () => {
    await reloadWithPendingRegistrationReadFirst()
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy, 'precondition: the pending registration was sent').toHaveBeenCalledTimes(1)
    expect(analysisHeldOn(useCanvasStore.getState() as never), 'precondition: CEE acknowledged it').toBeNull()

    await localValueOnlyChange(0.6)
    expect(registerSpy).toHaveBeenCalledTimes(2)
    const reOffer = registerSpy.mock.calls[1]
    expect(registeredNodeIds(reOffer).sort()).toEqual([GOAL, KEPT].sort())
    expect(registeredEdgePairs(reOffer)).toEqual([edgePairKey(KEPT, GOAL)])
    // Once: the re-offer's own acknowledgement releases the model.
    await act(async () => { await flush() })
    expect(registerSpy).toHaveBeenCalledTimes(2)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
    hook.unmount()
  })

  it('a read still IN FLIGHT when CEE acknowledges the registration cannot overwrite the settle — its later refusal is not a wall', async () => {
    const calls = pendingFetches()
    setCanvas(MATCHING_NODES, MATCHING_EDGES)
    markGraphImported(MATCHING_NODES as never, MATCHING_EDGES as never)
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    let read: Promise<unknown> = Promise.resolve()
    await act(async () => {
      read = hydrateCanvasFromServer(SCENARIO)
      await flush()
    })
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state, 'precondition: the read is in flight').toBe('reading')

    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy, 'precondition: the pending registration was sent and acknowledged').toHaveBeenCalledTimes(1)
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('registered')

    // The superseded read now answers with a refusal (429 → `refused`, verdict 'refuse').
    await act(async () => {
      calls[0].answer(jsonResponse(429, { error: 'rate_limited' }))
      await read
      await flush()
    })
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('registered')
    await localValueOnlyChange(0.6)
    expect(registerSpy).toHaveBeenCalledTimes(2)
    hook.unmount()
  })

  it('CONTROL: a registration CEE did NOT acknowledge settles nothing — the refused read stands, nothing is re-offered', async () => {
    registerSpy.mockResolvedValue({ status: 'unavailable' })
    await reloadWithPendingRegistrationReadFirst()
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('mergeRefused')
    hook.unmount()
  })

  it('CONTROL: after the registration settles the read, an element CEE lacks (added later) is still NOT registered', async () => {
    await reloadWithPendingRegistrationReadFirst()
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    await act(async () => {
      addAfterTheRead()
      await flush()
    })
    expect(registrationsCarrying(ADDED)).toHaveLength(0)
    expect(registerSpy).toHaveBeenCalledTimes(1)
    hook.unmount()
  })
})

describe('§3 decision A: after the reload, the screen shows the saved model', () => {
  it('the element CEE lacks is taken off the canvas AND named in a lasting notice, and the analysis is marked out of date', async () => {
    useCanvasStore.setState({
      graphEditedSinceLastRun: false,
      analysisStateReady: true,
      analysisFreshnessDirty: false,
    } as never)
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
    const hook = await reload()
    const st = useCanvasStore.getState()
    expect(st.nodes.some((n) => n.id === DELETED)).toBe(false)
    const notice = useReloadDifferenceStore.getState()
    expect(notice.scenarioId).toBe(SCENARIO)
    expect(notice.removedLabels).toEqual(['Competitive Pressure'])
    expect(st.graphEditedSinceLastRun).toBe(true)
    expect(st.analysisStateReady).toBe(false)
    expect(st.analysisFreshnessDirty).toBe(true)
    expect(registrationsCarrying(DELETED)).toHaveLength(0)
    hook.unmount()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §9 — a SUPERSEDED read changes nothing. `b1eaee0a` pins that a read still in
// flight cannot overwrite the settle RECORD; the canvas MERGE still ran. Probe
// (23 Sep): CEE acknowledged a registration of [goal, kept, "Churn Risk"]; the
// read issued before it then answered with the OLDER model and merged — "Churn
// Risk" was taken off the canvas, named in the chat line, and
// `lastAuthoritativeGraph` was reset to the older set. Under decision A that
// merge REMOVES what CEE has just acknowledged.
//
// Contract: a read whose token is no longer current when it answers (a
// registration acknowledgement, or a newer read, has superseded it) makes no
// canvas merge, no `recordRemoval`, no `lastAuthoritativeGraph` reset and no
// acknowledgement. A CURRENT read behaves exactly as before (§3, and the second
// half of the newer-read case below).
// ═══════════════════════════════════════════════════════════════════════════
describe('§9 a superseded read changes nothing (the late-read race)', () => {
  it('THE PROBE: a read answered AFTER CEE acknowledged a registration does not take the acknowledged element off', async () => {
    const calls = pendingFetches()
    const withAdded = [...MATCHING_NODES, ADDED_NODE]
    const withAddedEdges = [...MATCHING_EDGES, ADDED_EDGE]
    setCanvas(withAdded, withAddedEdges)
    markGraphImported(withAdded as never, withAddedEdges as never)
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)

    let read: Promise<unknown> = Promise.resolve()
    await act(async () => {
      read = hydrateCanvasFromServer(SCENARIO)
      await flush()
    })
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state, 'precondition: the read is in flight').toBe('reading')

    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registrationsCarrying(ADDED), 'precondition: the registration carried Churn Risk').toHaveLength(1)
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state, 'precondition: CEE acknowledged it').toBe('registered')
    const acknowledged = useCanvasStore.getState().lastAuthoritativeGraph
    expect(acknowledged && [...acknowledged.nodeIds].sort()).toEqual([GOAL, KEPT, ADDED].sort())

    // The read issued BEFORE the acknowledgement answers with the older model.
    let outcome: unknown
    await act(async () => {
      calls[0].answer(jsonResponse(200, graphBody(SERVER_AS_REGISTERED)))
      outcome = await read
      await flush()
    })

    const st = useCanvasStore.getState()
    // No canvas merge: the acknowledged element and its link are still on screen.
    expect(st.nodes.map((n) => n.id).sort()).toEqual([GOAL, KEPT, ADDED].sort())
    expect(st.edges.map((e) => edgePairKey(e.source, e.target)).sort()).toEqual(
      [edgePairKey(KEPT, GOAL), edgePairKey(ADDED, GOAL)].sort(),
    )
    // No recordRemoval: nothing is named in the chat line.
    expect(useReloadDifferenceStore.getState().scenarioId).toBeNull()
    expect(useReloadDifferenceStore.getState().removedLabels).toEqual([])
    // No lastAuthoritativeGraph reset: CEE's record is still what it acknowledged.
    const record = useCanvasStore.getState().lastAuthoritativeGraph
    expect(record && [...record.nodeIds].sort()).toEqual([GOAL, KEPT, ADDED].sort())
    expect(st.serverGraphIdentity).toBeNull()
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('registered')
    expect(outcome).toBe('skipped')
    hook.unmount()
  })

  it('A NEWER READ supersedes: the older read\'s answer merges, removes, records and acknowledges nothing — the current read then does all four', async () => {
    const calls = pendingFetches()
    let first: Promise<unknown> = Promise.resolve()
    let second: Promise<unknown> = Promise.resolve()
    await act(async () => {
      first = hydrateCanvasFromServer(SCENARIO)
      second = hydrateCanvasFromServer(SCENARIO)
      await flush()
    })
    expect(calls.length).toBe(2)

    let firstOutcome: unknown
    await act(async () => {
      calls[0].answer(jsonResponse(200, graphBody(SERVER_AS_REGISTERED)))
      firstOutcome = await first
      await flush()
    })
    {
      const st = useCanvasStore.getState()
      expect(st.nodes.some((n) => n.id === DELETED), 'no merge: the stale copy is untouched').toBe(true)
      expect(useReloadDifferenceStore.getState().removedLabels).toEqual([])
      expect(st.lastAuthoritativeGraph).toBeNull()
      expect(st.serverGraphIdentity).toBeNull()
      expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(false)
      expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('reading')
      expect(firstOutcome).toBe('skipped')
    }

    // CONTRAST, same run: the CURRENT read answers the same body and does all four.
    let secondOutcome: unknown
    await act(async () => {
      calls[1].answer(jsonResponse(200, graphBody(SERVER_AS_REGISTERED)))
      secondOutcome = await second
      await flush()
    })
    const st = useCanvasStore.getState()
    expect(secondOutcome).toBe('merged')
    expect(st.nodes.map((n) => n.id).sort()).toEqual([GOAL, KEPT].sort())
    expect(useReloadDifferenceStore.getState().removedLabels).toEqual(['Competitive Pressure'])
    expect(st.lastAuthoritativeGraph && [...st.lastAuthoritativeGraph.nodeIds].sort()).toEqual([GOAL, KEPT].sort())
    expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(true)
    expect(useBootGraphReadStore.getState().byScenario[SCENARIO]?.state).toBe('merged')
  })
})

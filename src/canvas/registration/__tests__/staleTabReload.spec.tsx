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
 * (2.503). §3 is the screen, and is ruling-dependent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import {
  clearImportRegistrationMarkers,
  markGraphImported,
} from '../../store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => true }
})
const registerSpy = vi.fn()
vi.mock('../../../adapters/cee/registerScenarioGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../adapters/cee/registerScenarioGraph')>()),
  registerScenarioGraph: (...args: unknown[]) => registerSpy(...args),
}))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
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
} from '../../hydrate/bootGraphRead'
import { isGraphServerAcknowledged } from '../../store/importRegistrationMarker'
import { analysisHeldOn } from '../../utils/analysisHeldOnInjectedModel'

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

/** Tab B's copy when nothing was deleted elsewhere: exactly CEE's elements. */
const MATCHING_NODES = STALE_NODES.filter((n) => n.id !== DELETED)
const MATCHING_EDGES = STALE_EDGES.filter((e) => e.source !== DELETED)

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
  restoreStaleCopy()
})

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
    beginBootGraphRead(SCENARIO)
    const hook = renderHook(() => useImportRegistration())
    await act(async () => { await flush() })
    expect(registerSpy).not.toHaveBeenCalled()
    await act(async () => {
      settleBootGraphRead(SCENARIO, 'notReadable')
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
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
    const hook = await reload()
    const st = useCanvasStore.getState()
    expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(true)
    expect(analysisHeldOn(st as never)).toBeNull()
    expect(registerSpy).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('a canvas that carries an element CEE lacks is NOT acknowledged by the read (stays held, nothing sent)', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, graphBody(SERVER_AFTER_DELETE)))
    const hook = await reload()
    const st = useCanvasStore.getState()
    expect(isGraphServerAcknowledged(SCENARIO, st.nodes as never, st.edges as never)).toBe(false)
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

describe('§3 RULING-DEPENDENT (Paul, decision A): after the reload, the screen shows the saved model', () => {
  it.todo('the element CEE lacks is taken off the canvas AND named in a lasting notice, and the analysis is marked out of date')
})

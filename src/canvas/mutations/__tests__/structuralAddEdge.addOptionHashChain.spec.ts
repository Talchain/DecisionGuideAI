/**
 * Decision "+ Add option" sends its decision link on the POST-ADD graph hash.
 *
 * THE DEFECT (served UI `eec722ab` against CEE staging, 25 Sep 2026 23:12Z,
 * turns.jsonl):
 *   seq 7  structural_add       node "1" (option)            base a8e8dbedf0e4bafa → 200, graph_hash 4892ada9d5cf6c12
 *   seq 8  structural_add_edge  dec_pricing → "1", mag 1, +   base a8e8dbedf0e4bafa → 409 GRAPH_DIVERGED /
 *          BASE_HASH_DIVERGED, expected_base_graph_hash 4892ada9d5cf6c12
 * CEE kept the option with NO decision link (OPTION_NOT_LINKED_TO_DECISION —
 * the model cannot run), and the canvas kept the refused link.
 *
 * ROOT CAUSE: `store.addNodeWithEdge` captures BOTH halves in one `set()`
 * against the same `lastServerGraphHash`. The node's write moves CEE's hash (an
 * add always does), so the link's captured base is stale BY CONSTRUCTION. The
 * two drains are independent, and the link's send is DEFERRED behind the node's
 * in-flight turn with its payload — stale base included — already frozen.
 *
 * Pinned through the REAL store action, the REAL two drains and the REAL
 * `useConversation().sendSystemEvent` (deferral queue included). Only `fetch`
 * is faked, by a transport that behaves like CEE's compare-and-swap: a write
 * whose `base_graph_hash` is not the server's current hash is refused 409
 * `BASE_HASH_DIVERGED` and writes nothing; a write that lands moves the hash.
 *
 *   1. "+ Add option": the link carries the hash the node's write RETURNED, and
 *      both land — the server holds the option AND its decision link.
 *   2. Same for option → new factor ("Add connected factor" on an option).
 *   3. The node is REFUSED: the dependent link is NOT sent — it would name an
 *      endpoint the server does not hold.
 *   4. The chain is bound by IDENTITY: the hash recorded on the node's committed
 *      verdict, not whatever `lastServerGraphHash` reads by the time the link
 *      goes; a link behind an in-flight add is HELD, then woken by the settle.
 *   5. CONTRAST — a single-capture gesture (a plain `addEdge` of a structural
 *      pair) is unchanged: one write, on the hash current at capture.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useConversation } from '../../conversation/useConversation'
import { useStructuralAddEvents } from '../../conversation/useStructuralAddEvents'
import { useStructuralAddEdgeEvents } from '../../conversation/useStructuralAddEdgeEvents'
import { useCanvasStore } from '../../store'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'
import {
  chainStructuralAddEdgeToNodeAdd,
  readChainedStructuralAddEdge,
  type StructuralAddEdgeIntent,
} from '../structuralAddEdge'
import { readCommittedIncidentEdgeKeys, structuralEdgePairKey, type StructuralAddLifecycleRecord } from '../structuralAdd'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(msg: string, status: number, body: unknown) {
      super(msg)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

// ---------------------------------------------------------------------------
// A fake CEE: compare-and-swap on `base_graph_hash`, exactly one hash per state.
// ---------------------------------------------------------------------------

const SCENARIO_ID = '9b0c62d6-fec0-468f-9c82-51480f5bdc9c'
/** The witnessed pre-add hash. */
const H0 = 'a8e8dbedf0e4bafa'
/** The witnessed hash the node's write returned. */
const H1 = '4892ada9d5cf6c12'
const LATER_HASHES = ['c3c3c3c3d4d4d4d4', 'e5e5e5e5f6f6f6f6', '0a0a0a0a1b1b1b1b']

interface ServerNode { id: string; kind: string; label: string }
interface ServerEdge { from: string; to: string }
interface WireRecord {
  kind: string
  base: unknown
  status: number
  event: Record<string, unknown>
}

/**
 * `linksOptionToSoleDecision` mirrors CEE #1937 (C32) exactly as its diff reads:
 * a `structural_add` of an OPTION on a graph with EXACTLY ONE decision writes
 * `decision → option` in the same commit, and a `structural_add_edge` for a
 * pair that already exists is an idempotent 200 refusal decided BEFORE the
 * stale gate ("… is already an option for …"), writing nothing.
 */
function fakeCee(
  initial: { hash: string; nodes: ServerNode[]; edges: ServerEdge[] },
  opts: { linksOptionToSoleDecision?: boolean } = {},
) {
  const server = {
    hash: initial.hash,
    nodes: initial.nodes.map((n) => ({ ...n })),
    edges: initial.edges.map((e) => ({ ...e })),
  }
  const wire: WireRecord[] = []
  const next = [H1, ...LATER_HASHES]

  const draftGraph = () => ({
    nodes: server.nodes.map((n) => ({ ...n })),
    edges: server.edges.map((e) => ({
      from: e.from,
      to: e.to,
      strength: { mean: 1, std: 0.01 },
      effect_direction: 'positive',
      exists_probability: 1,
    })),
    node_count: server.nodes.length,
    edge_count: server.edges.length,
  })

  const respond = (status: number, body: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response

  const ok = (extra: Record<string, unknown> = {}) =>
    respond(200, {
      response_version: 2,
      assistant_text: 'Done.',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
      graph_hash: server.hash,
      ...extra,
    })

  const diverged = (kind: string) =>
    respond(409, {
      error: 'GRAPH_DIVERGED',
      boundary: 'B1',
      direction: 'egress',
      validator: 'turn_commit',
      details: {
        phase: 'commit',
        failure_type: 'GRAPH_DIVERGED',
        event_kind: kind,
        reason: 'graph_write_conflict',
        recovery_action: 'refresh_and_reconfirm',
        conflict_category: 'BASE_HASH_DIVERGED',
        expected_base_graph_hash: server.hash,
      },
      request_id: `req_${wire.length}`,
      retryable: false,
    })

  const fetchImpl = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    const payload = JSON.parse(String(init?.body ?? '{}')) as { event?: Record<string, unknown> }
    const event = payload.event
    if (!event || (event.kind !== 'structural_add' && event.kind !== 'structural_add_edge')) {
      return ok()
    }
    const kind = String(event.kind)
    const base = event.base_graph_hash
    if (
      opts.linksOptionToSoleDecision &&
      kind === 'structural_add_edge' &&
      server.edges.some((e) => e.from === event.from && e.to === event.to)
    ) {
      wire.push({ kind, base, status: 200, event })
      return ok({ assistant_text: `${String(event.to)} is already an option for ${String(event.from)}, so there was nothing to change.` })
    }
    if (base !== server.hash) {
      wire.push({ kind, base, status: 409, event })
      return diverged(kind)
    }
    if (kind === 'structural_add') {
      server.nodes.push({
        id: String(event.node_id),
        kind: String(event.node_kind),
        label: String(event.label),
      })
      const decisions = server.nodes.filter((n) => n.kind === 'decision')
      if (opts.linksOptionToSoleDecision && event.node_kind === 'option' && decisions.length === 1) {
        server.edges.push({ from: decisions[0]!.id, to: String(event.node_id) })
      }
    } else {
      const from = String(event.from)
      const to = String(event.to)
      const endpointsHeld =
        server.nodes.some((n) => n.id === from) && server.nodes.some((n) => n.id === to)
      if (!endpointsHeld) {
        // CEE's committed-200 refusal: it speaks, writes nothing, hash unmoved.
        wire.push({ kind, base, status: 200, event })
        return ok({ assistant_text: "I couldn't connect those — one of them isn't in your model." })
      }
      server.edges.push({ from, to })
    }
    server.hash = next.shift() ?? `h${wire.length}`
    wire.push({ kind, base, status: 200, event })
    return ok({ draft_graph: draftGraph() })
  })

  return { server, wire, fetchImpl }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DECISION: ServerNode = { id: 'dec_pricing', kind: 'decision', label: 'Pricing' }
const OPT_A: ServerNode = { id: 'opt_a', kind: 'option', label: 'Keep price' }
/** Present on both sides, linked on neither — the contrast's structural pair. */
const OPT_B: ServerNode = { id: 'opt_b', kind: 'option', label: 'Raise price' }
const FAC: ServerNode = { id: 'fac_churn', kind: 'factor', label: 'Churn' }

const SERVER_NODES = [DECISION, OPT_A, OPT_B, FAC]
const SERVER_EDGES: ServerEdge[] = [
  { from: 'dec_pricing', to: 'opt_a' },
  { from: 'opt_a', to: 'fac_churn' },
]

function seedCanvas(lastServerGraphHash: string, nodes: ServerNode[] = SERVER_NODES) {
  useCanvasStore.getState().reset?.()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    lastServerGraphHash,
    nodes: nodes.map((n, i) => ({
      id: n.id,
      type: n.kind,
      position: { x: 0, y: i * 150 },
      data: { label: n.label, kind: n.kind },
    })) as unknown as Node[],
    edges: SERVER_EDGES.map((e) => ({
      id: `e_${e.from}_${e.to}`,
      source: e.from,
      target: e.to,
      type: 'styled',
      data: { ...USER_EDGE_DEFAULTS },
    })) as never,
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralAddLifecycle: [],
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

/** The canvas host as served: one conversation, both durable-add drains. */
function mountDrains() {
  return renderHook(() => {
    const conversation = useConversation()
    useStructuralAddEvents(conversation.sendSystemEvent)
    useStructuralAddEdgeEvents(conversation.sendSystemEvent)
    return conversation
  })
}

/** Let every queued microtask, deferred flush and effect re-run settle. */
async function settle() {
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════

describe('"+ Add option" — the decision link rides the hash the option write returned', () => {
  it('⭐ the link is sent on the POST-ADD hash, and CEE holds the option AND its link', async () => {
    const cee = fakeCee({ hash: H0, nodes: SERVER_NODES, edges: SERVER_EDGES })
    vi.stubGlobal('fetch', cee.fetchImpl)
    seedCanvas(H0)
    mountDrains()

    let optionId = ''
    await act(async () => {
      optionId = String(
        useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', 'dec_pricing', 'from-target'),
      )
    })
    await waitFor(() => expect(cee.wire.length).toBeGreaterThanOrEqual(2))
    await settle()

    const node = cee.wire.find((w) => w.kind === 'structural_add')
    const link = cee.wire.find((w) => w.kind === 'structural_add_edge')
    expect(node, 'the option was never sent').toBeDefined()
    expect(node!.event.node_id).toBe(optionId)
    expect(node!.base).toBe(H0)
    expect(node!.status).toBe(200)

    expect(link, 'the decision link was never sent').toBeDefined()
    expect(link!.event).toMatchObject({ from: 'dec_pricing', to: optionId, magnitude: 1, effect_direction: 'positive' })
    // ⭐ THE DEFECT: served, this carried the PRE-add hash H0 and was refused 409.
    expect(link!.base, 'the link must carry the hash the option write returned').toBe(H1)
    expect(link!.status).toBe(200)

    // Outcome, read from the fake server — not from the canvas.
    expect(cee.server.nodes.some((n) => n.id === optionId)).toBe(true)
    expect(cee.server.edges).toContainEqual({ from: 'dec_pricing', to: optionId })
    expect(cee.wire.filter((w) => w.status === 409)).toEqual([])
    // Exactly one of each — no retry, no duplicate.
    expect(cee.wire.map((w) => w.kind)).toEqual(['structural_add', 'structural_add_edge'])
    // The hash rode WITH the node's committed verdict — bound by identity.
    const record = useCanvasStore.getState().structuralAddLifecycle.find((r) => r.intent.nodeId === optionId)
    expect(record).toMatchObject({ status: 'committed', committedGraphHash: H1 })
  })

  it('option → new factor ("Add connected factor" on an option) chains the same way', async () => {
    const cee = fakeCee({ hash: H0, nodes: SERVER_NODES, edges: SERVER_EDGES })
    vi.stubGlobal('fetch', cee.fetchImpl)
    seedCanvas(H0)
    mountDrains()

    let factorId = ''
    await act(async () => {
      factorId = String(
        useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'factor', 'opt_a', 'from-target'),
      )
    })
    await waitFor(() => expect(cee.wire.length).toBeGreaterThanOrEqual(2))
    await settle()

    const link = cee.wire.find((w) => w.kind === 'structural_add_edge')
    expect(link?.event).toMatchObject({ from: 'opt_a', to: factorId })
    expect(link?.base).toBe(H1)
    expect(link?.status).toBe(200)
    expect(cee.server.edges).toContainEqual({ from: 'opt_a', to: factorId })
  })

  it('the option write is REFUSED → the dependent link is not sent at all', async () => {
    // The persisted graph has moved since the canvas last read it: CEE is at a
    // hash the UI has not seen, so the option is refused 409 and writes nothing.
    const cee = fakeCee({ hash: 'ffffeeeeddddcccc', nodes: SERVER_NODES, edges: SERVER_EDGES })
    vi.stubGlobal('fetch', cee.fetchImpl)
    seedCanvas(H0)
    mountDrains()

    await act(async () => {
      useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', 'dec_pricing', 'from-target')
    })
    await waitFor(() => expect(cee.wire.length).toBeGreaterThanOrEqual(1))
    await settle()

    expect(cee.wire.map((w) => `${w.kind}:${w.status}`)).toEqual(['structural_add:409'])
    // Nothing queued behind it either — the intent is settled, not stranded.
    expect(useCanvasStore.getState().pendingStructuralAddEdges).toEqual([])
  })
})

describe('the chain is bound by IDENTITY, never by "whatever the hash is now"', () => {
  function chainedLink(): StructuralAddEdgeIntent {
    return {
      id: 'sae-1',
      edgeId: 'e-new',
      from: 'dec_pricing',
      to: 'opt_new',
      magnitude: 1,
      direction: 'positive',
      baseGraphHash: null,
      afterNodeAddIntentId: 'sa-1',
    }
  }
  const nodeAdd = { id: 'sa-1', nodeId: 'opt_new', nodeKind: 'option', label: 'New option', baseGraphHash: H0 }

  it('a committed node add → the link is sent on ITS committed hash, even after another turn moved lastServerGraphHash', async () => {
    seedCanvas(LATER_HASHES[0]!)
    useCanvasStore.setState({
      pendingStructuralAddEdges: [chainedLink()],
      structuralAddLifecycle: [
        { intent: nodeAdd, scenarioId: SCENARIO_ID, status: 'committed', committedGraphHash: H1 },
      ],
    } as never)
    const sent: Array<Record<string, unknown>> = []
    const send = vi.fn(async (event: { payload: Record<string, unknown> }) => {
      sent.push(event.payload)
      return undefined
    })
    renderHook(() => useStructuralAddEdgeEvents(send as never))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    // H1 — the graph the gesture produced. A later turn's hash would assert a
    // graph the user never saw; if it has moved, CEE refusing is the truth.
    expect(sent[0]).toMatchObject({ from: 'dec_pricing', to: 'opt_new', base_graph_hash: H1 })
  })

  it('an in-flight node add → the link is HELD in the queue, not sent and not dropped', async () => {
    seedCanvas(H0)
    useCanvasStore.setState({
      pendingStructuralAddEdges: [chainedLink()],
      structuralAddLifecycle: [{ intent: nodeAdd, scenarioId: SCENARIO_ID, status: 'in_flight' }],
    } as never)
    const send = vi.fn(async () => undefined)
    renderHook(() => useStructuralAddEdgeEvents(send as never))
    await settle()
    expect(send).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().pendingStructuralAddEdges.map((i) => i.id)).toEqual(['sae-1'])

    // …and the node's commit is what wakes it.
    await act(async () => {
      useCanvasStore.getState().settleStructuralAdd('sa-1', 'committed', H1)
    })
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(useCanvasStore.getState().pendingStructuralAddEdges).toEqual([])
  })

  it('readiness, every arm', () => {
    const link = chainedLink()
    const rec = (status: StructuralAddLifecycleRecord['status'], committedGraphHash?: string) =>
      [{ intent: nodeAdd, scenarioId: SCENARIO_ID, status, ...(committedGraphHash ? { committedGraphHash } : {}) }]
    expect(readChainedStructuralAddEdge({ ...link, afterNodeAddIntentId: undefined }, [], [])).toEqual({ kind: 'independent' })
    expect(readChainedStructuralAddEdge(link, [nodeAdd], [])).toEqual({ kind: 'hold' })
    expect(readChainedStructuralAddEdge(link, [], rec('in_flight'))).toEqual({ kind: 'hold' })
    expect(readChainedStructuralAddEdge(link, [], rec('committed', H1))).toEqual({ kind: 'send', baseGraphHash: H1 })
    expect(readChainedStructuralAddEdge(link, [], rec('committed'))).toEqual({ kind: 'send', baseGraphHash: null })
    expect(readChainedStructuralAddEdge(link, [], rec('refused'))).toEqual({ kind: 'stand_down', nodeStatus: 'refused' })
    expect(readChainedStructuralAddEdge(link, [], rec('unconfirmed'))).toEqual({ kind: 'stand_down', nodeStatus: 'unconfirmed' })
    expect(readChainedStructuralAddEdge(link, [], [])).toEqual({ kind: 'stand_down', nodeStatus: 'missing' })
  })

  it('the chain binds only a link INCIDENT to the minted node', () => {
    const edge = { ...chainedLink(), baseGraphHash: H0, afterNodeAddIntentId: undefined }
    expect(chainStructuralAddEdgeToNodeAdd(edge, { id: 'sa-9', nodeId: 'someone_else' })).toBe(edge)
    expect(chainStructuralAddEdgeToNodeAdd(edge, nodeAdd)).toMatchObject({ baseGraphHash: null, afterNodeAddIntentId: 'sa-1' })
  })
})

describe('C32 with CEE #1937 served — the canvas reads the server\'s answer, it does not mirror its rule', () => {
  // Canonical State, olumi-programme-docs#70 5841540452: "If that draft_graph
  // already has an edge <decision> → <new option>, the link is done. Do not
  // send the follow-up structural_add_edge. If it has no such edge … send the
  // follow-up with base_graph_hash = the add reply's graph_hash."

  it('⭐ ONE decision: the option\'s own commit holds its link → no follow-up is sent, one commit, no second sentence', async () => {
    const cee = fakeCee({ hash: H0, nodes: SERVER_NODES, edges: SERVER_EDGES }, { linksOptionToSoleDecision: true })
    vi.stubGlobal('fetch', cee.fetchImpl)
    seedCanvas(H0)
    mountDrains()

    let optionId = ''
    await act(async () => {
      optionId = String(
        useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', 'dec_pricing', 'from-target'),
      )
    })
    await waitFor(() => expect(cee.wire.length).toBeGreaterThanOrEqual(1))
    await settle()

    // ONE message on the wire — the add. The duplicate link event, whose reply
    // would have put "… is already an option …" in the conversation, is gone.
    expect(cee.wire.map((w) => `${w.kind}:${w.status}`)).toEqual(['structural_add:200'])
    // Outcome read from the server: the option AND its link, in one commit.
    expect(cee.server.edges).toContainEqual({ from: 'dec_pricing', to: optionId })
    // The canvas shows exactly what the server holds — the link is not reverted.
    expect(
      useCanvasStore.getState().edges.some((e) => e.source === 'dec_pricing' && e.target === optionId),
    ).toBe(true)
    // Nothing left queued to leak out on a later turn.
    expect(useCanvasStore.getState().pendingStructuralAddEdges).toEqual([])
    const record = useCanvasStore.getState().structuralAddLifecycle.find((r) => r.intent.nodeId === optionId)
    expect(record?.status).toBe('committed')
    expect(record?.committedIncidentEdgeKeys).toContain(structuralEdgePairKey('dec_pricing', optionId))
  })

  it('TWO decisions: CEE writes no link → the follow-up IS sent, on the add\'s own hash, and lands (no 409)', async () => {
    const DEC_2: ServerNode = { id: 'dec_hiring', kind: 'decision', label: 'Hiring' }
    const nodes = [...SERVER_NODES, DEC_2]
    const cee = fakeCee({ hash: H0, nodes, edges: SERVER_EDGES }, { linksOptionToSoleDecision: true })
    vi.stubGlobal('fetch', cee.fetchImpl)
    seedCanvas(H0, nodes)
    mountDrains()

    let optionId = ''
    await act(async () => {
      optionId = String(
        useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', 'dec_pricing', 'from-target'),
      )
    })
    await waitFor(() => expect(cee.wire.length).toBeGreaterThanOrEqual(2))
    await settle()

    expect(cee.wire.map((w) => `${w.kind}:${w.status}`)).toEqual(['structural_add:200', 'structural_add_edge:200'])
    expect(cee.wire[1]!.base).toBe(H1)
    expect(cee.server.edges).toContainEqual({ from: 'dec_pricing', to: optionId })
    expect(cee.server.edges.some((e) => e.from === 'dec_hiring' && e.to === optionId)).toBe(false)
  })

  it('readiness reads the committed PAIR, in its direction — never "some edge touches the node"', () => {
    const link: StructuralAddEdgeIntent = {
      id: 'sae-1',
      edgeId: 'e-new',
      from: 'dec_pricing',
      to: 'opt_new',
      magnitude: 1,
      direction: 'positive',
      baseGraphHash: null,
      afterNodeAddIntentId: 'sa-1',
    }
    const nodeAdd = { id: 'sa-1', nodeId: 'opt_new', nodeKind: 'option', label: 'New option', baseGraphHash: H0 }
    const committed = (keys?: string[]) => [
      {
        intent: nodeAdd,
        scenarioId: SCENARIO_ID,
        status: 'committed' as const,
        committedGraphHash: H1,
        ...(keys ? { committedIncidentEdgeKeys: keys } : {}),
      },
    ]
    expect(readChainedStructuralAddEdge(link, [], committed([structuralEdgePairKey('dec_pricing', 'opt_new')])))
      .toEqual({ kind: 'already_linked' })
    // The reversed pair, another decision's link, an empty set and an unread
    // graph each leave the link to be SENT on the committed hash.
    for (const keys of [
      [structuralEdgePairKey('opt_new', 'dec_pricing')],
      [structuralEdgePairKey('dec_hiring', 'opt_new')],
      [],
      undefined,
    ]) {
      expect(readChainedStructuralAddEdge(link, [], committed(keys))).toEqual({ kind: 'send', baseGraphHash: H1 })
    }
  })

  it('the committed-graph reader keeps only edges INCIDENT on the node, and says "unread" for no graph', () => {
    const response = {
      draft_graph: {
        nodes: [],
        edges: [
          { from: 'dec_pricing', to: 'opt_new' },
          { from: 'opt_new', to: 'fac_churn' },
          { from: 'dec_pricing', to: 'opt_a' },
          { from: 42, to: 'opt_new' },
        ],
      },
    }
    expect(readCommittedIncidentEdgeKeys(response, 'opt_new')).toEqual([
      structuralEdgePairKey('dec_pricing', 'opt_new'),
      structuralEdgePairKey('opt_new', 'fac_churn'),
    ])
    expect(readCommittedIncidentEdgeKeys({ graph_hash: H1 }, 'opt_new')).toBeUndefined()
    expect(readCommittedIncidentEdgeKeys({ draft_graph: { nodes: [] } }, 'opt_new')).toBeUndefined()
  })
})

describe('CONTRAST — a single-capture gesture is unchanged', () => {
  it('a plain addEdge of a structural pair sends ONE write on the hash current at capture', async () => {
    const cee = fakeCee({ hash: H0, nodes: SERVER_NODES, edges: SERVER_EDGES })
    vi.stubGlobal('fetch', cee.fetchImpl)
    seedCanvas(H0)
    mountDrains()

    await act(async () => {
      useCanvasStore.getState().addEdge({
        source: 'dec_pricing',
        target: 'opt_b',
        data: { ...USER_EDGE_DEFAULTS },
      } as never)
    })
    await waitFor(() => expect(cee.wire.length).toBeGreaterThanOrEqual(1))
    await settle()

    expect(cee.wire).toHaveLength(1)
    expect(cee.wire[0]).toMatchObject({ kind: 'structural_add_edge', base: H0, status: 200 })
    expect(cee.wire[0]!.event).toMatchObject({ from: 'dec_pricing', to: 'opt_b' })
    expect(cee.server.edges).toContainEqual({ from: 'dec_pricing', to: 'opt_b' })
  })
})

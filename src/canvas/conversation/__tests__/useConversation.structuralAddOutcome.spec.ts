/**
 * Structural-add outcome resolution — and the premise refutation that decides
 * how it must be built.
 *
 * ⭐⭐⭐ THE FALSE PREMISE, NAMED, BECAUSE A PRIOR DRAFT OF THIS LANE WROTE IT
 * DOWN AS THOUGH DERIVED. That draft asserted: *"CEE's refusal path passes the
 * persisted graph through `commitDirectAnswer(..., { contentGraph })`, so that
 * arm carries a readable graph that positively lacks our node."*
 *
 * **It does not.** Derived at CEE `d5455355`: `contentGraph` is an INTERNAL
 * artefact (`commit.ts:200-218` — "the scenario graph used to resolve entity-id
 * labels when reducing `assistant_text` to its durable public form"), consumed
 * only by `durablePublicAssistantText`, and never emitted. The only inline-graph
 * WIRE field is `draft_graph`, stamped at exactly four places in the whole
 * system-event family — **all of them success arms** (`dispatch.ts:1054, 1489,
 * 2070 rename, 2367 add`).
 *
 * ⚠⚠ SO EVERY GENUINE REFUSAL ARRIVES WITH NO GRAPH AT ALL, and a receipt keyed
 * on "the committed graph came back without our node" would answer `unproven`
 * forever — the cannot-confirm line on the one outcome the user most needs told.
 *
 * ⭐ THE DISCRIMINATOR THAT DOES EXIST is specific to ADD: an add that lands
 * NECESSARILY moves CEE's analysis-affecting hash, because `projectNode`
 * emits the node's ID, so a new unique id changes the projected
 * `nodes` array. So `graph_hash === base_graph_hash` proves nothing was written.
 * The inference runs in ONE direction only, and it is the safe one — a hash that
 * moved proves only that SOMETHING changed, never that it was ours.
 *
 * ⚠ AND THE 409 IS THE ONE ARM WHERE THE UI MUST SUPPLY THE WORDS. CEE composes
 * an `assistant_text` for `BASE_HASH_DIVERGED` and the client never sees it: a
 * 409 returns a `BoundaryError` envelope rather than the writer's response. The
 * twelve committed-200 refusals get CEE's voice; this one gets ours.
 *
 * ⭐ EVERY CASE SHIPS ITS OPPOSITE-DIRECTION TWIN. A removal that fires too
 * eagerly DESTROYS the user's node; one that fires too rarely leaves the product
 * showing a node the model does not hold. Two different harms, and a corpus
 * testing one direction is a guard watching one door.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { STRUCTURAL_ADD_NOTICE, type StructuralAddIntent } from '../../mutations/structuralAdd'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
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

// `importOriginal`-spread rather than a hand-listed factory: a `vi.mock` factory
// REPLACES the module, so every flag not listed would silently vanish (trap 12).
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
// Fixtures
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const NEW_NODE_ID = 'fac_supplier_risk'
const SIBLING_ID = 'fac_sibling'
const BASE_GRAPH_HASH = 'cfded3af0aa14ebd'
/** A DIFFERENT hash — "the persisted graph moved". */
const MOVED_HASH = 'aaaa1111bbbb2222'
const NEW_LABEL = 'Supplier concentration risk'

function addIntent(): StructuralAddIntent {
  return {
    id: 'sa-1',
    nodeId: NEW_NODE_ID,
    nodeKind: 'factor',
    label: NEW_LABEL,
    baseGraphHash: BASE_GRAPH_HASH,
  }
}

/**
 * The canvas AFTER the optimistic local add — the real pre-state, because
 * `store.addNode` writes synchronously and the drain sends after.
 *
 * ⚠ THE SIBLING SHARES THE NEW LABEL AND KIND ON PURPOSE. A removal bound by a
 * value predicate ("the factor labelled NEW_LABEL") would be satisfied by
 * either node; only an id binding picks the right one, and only a same-labelled
 * sibling can prove the difference.
 */
function seedCanvasPostAdd(extra: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    // The REAL state at the moment `sendTurn` resolves: the drain moved this
    // gesture out of the queue and into the lifecycle as `in_flight` before it
    // awaited, so the resolver's job includes writing the terminal verdict.
    structuralAddLifecycle: [
      { intent: addIntent(), scenarioId: SCENARIO_ID, status: 'in_flight' },
    ],
    pendingStructuralAdds: [],
    nodes: [
      {
        id: NEW_NODE_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: NEW_LABEL, kind: 'factor' },
      },
      {
        id: SIBLING_ID,
        type: 'factor',
        position: { x: 200, y: 0 },
        data: { label: NEW_LABEL, kind: 'factor' },
      },
    ] as unknown as Node[],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ...extra,
  } as never)
}

/** The 409 envelope, byte-shaped from CEE `route-v2.ts`. */
function stub409(category: string) {
  const body = {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      phase: 'commit',
      failure_type: 'GRAPH_DIVERGED',
      event_kind: 'structural_add',
      recovery_action: 'refresh_and_reconfirm',
      conflict_category: category,
      expected_base_graph_hash: BASE_GRAPH_HASH,
    },
    request_id: `req_${category}`,
    retryable: false,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response)),
  )
}

/**
 * A COMMITTED 200.
 *
 * `carriesNode` mirrors CEE's real behaviour: the SUCCESS arm stamps
 * `draft_graph`; every refusal arm omits it entirely. `graphHash` is what CEE
 * reports as the persisted graph's current analysis hash.
 */
function stub200(opts: {
  carriesNode: boolean
  graphHash: string
  assistantText: string
}) {
  const body: Record<string, unknown> = {
    response_version: 2,
    assistant_text: opts.assistantText,
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    graph_hash: opts.graphHash,
  }
  if (opts.carriesNode) {
    body.draft_graph = {
      nodes: [
        { id: NEW_NODE_ID, kind: 'factor', label: NEW_LABEL },
        { id: SIBLING_ID, kind: 'factor', label: NEW_LABEL },
      ],
      edges: [],
      node_count: 2,
      edge_count: 0,
    }
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response)),
  )
}

async function driveAdd(seedExtra: Record<string, unknown> = {}) {
  seedCanvasPostAdd(seedExtra)
  const intent = addIntent()
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current
      .sendSystemEvent(
        {
          type: 'structural_add',
          payload: {
            node_id: NEW_NODE_ID,
            node_kind: 'factor',
            label: NEW_LABEL,
            base_graph_hash: BASE_GRAPH_HASH,
          },
        } as never,
        { structuralAdd: intent, debugSource: 'canvas_add' },
      )
      .catch(() => undefined)
  })

  const state = useCanvasStore.getState()
  return {
    hasNode: (id: string) => state.nodes.some((n) => n.id === id),
    lifecycle: state.structuralAddLifecycle[0]?.status,
    notices: result.current.messages
      .filter((m) => m.role === 'assistant' && m.synthetic === true)
      .map((m) => m.content),
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
// THE FORWARDING LINE — the omission that is invisible to every other test
// ═══════════════════════════════════════════════════════════════════════════

describe('the intent reaches the resolver at all', () => {
  it('⭐⭐ sendSystemEvent FORWARDS `structuralAdd` into sendTurn', async () => {
    // ⚠ THIS IS THE TEST THAT EXISTS BECAUSE THE RENAME LANE SHIPPED THE
    // OMISSION. Without the forwarding line the resolver still exists, the opts
    // type still declares the field, and EVERY test that does not drive a real
    // turn stays green — the add simply never resolves against the server and
    // the canvas silently keeps a node the model refused. The only way to see it
    // is an OUTCOME assertion on a real dispatch, which is what every case in
    // this file is.
    stub200({ carriesNode: false, graphHash: BASE_GRAPH_HASH, assistantText: '' })
    const { lifecycle } = await driveAdd()
    // A settled lifecycle record is proof the resolver ran. If the forwarding
    // line is removed this stays `in_flight` forever.
    expect(lifecycle).not.toBe('in_flight')
    expect(lifecycle).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SUCCESS
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_add — the committed bytes carry the node', () => {
  it('the node stays, the verdict is committed, and the UI adds NO second voice', async () => {
    stub200({
      carriesNode: true,
      graphHash: MOVED_HASH,
      assistantText:
        "Added 'Supplier concentration risk' to your model. That's saved, so it stays when you reload. I haven't given it a value — you haven't told me one, and I won't invent a number.",
    })
    const { hasNode, lifecycle, notices } = await driveAdd()

    expect(hasNode(NEW_NODE_ID)).toBe(true)
    expect(lifecycle).toBe('committed')
    // ⭐ CEE's own sentence already says the honest thing about the value. A
    // notice beside it would put TWO VOICES on one outcome, and ours would be
    // the vaguer.
    expect(notices).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE REFUSAL THAT ARRIVES AS A 200 WITH NO GRAPH — the premise-refutation case
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_add — a committed 200 that wrote nothing', () => {
  it('⭐⭐ an UNMOVED hash is read as a REFUSAL, and the node comes back off the canvas', async () => {
    // This is the shape of all twelve committed-200 refusal arms: CEE speaks,
    // commits a turn, writes no graph, and sends NO `draft_graph`. A UI keyed on
    // the status code, on `conflict_category`, or on graph-absence alone reads
    // this as a success or as an unknown — and leaves a node standing that the
    // model does not hold.
    stub200({
      carriesNode: false,
      graphHash: BASE_GRAPH_HASH,
      assistantText:
        "Something with that identity is already in your model, and I won't overwrite it. Reload the model and add it again.",
    })
    const { hasNode, lifecycle, notices } = await driveAdd()

    expect(lifecycle).toBe('refused')
    expect(hasNode(NEW_NODE_ID)).toBe(false)
    // BOUND BY IDENTITY — the same-labelled, same-kind sibling must survive.
    expect(hasNode(SIBLING_ID)).toBe(true)
    // CEE spoke, and its sentence names the actual reason. Ours is withheld.
    expect(notices).toHaveLength(0)
  })

  it('TWIN — a refusal where CEE said NOTHING gets our sentence instead of silence', async () => {
    stub200({ carriesNode: false, graphHash: BASE_GRAPH_HASH, assistantText: '' })
    const { hasNode, notices } = await driveAdd()

    expect(hasNode(NEW_NODE_ID)).toBe(false)
    expect(notices).toContain(STRUCTURAL_ADD_NOTICE.refused_server)
  })

  it('⭐⭐ TWIN — a MOVED hash with no graph is UNPROVEN: the node STAYS and we say so', async () => {
    // The safe half of the one-directional inference. Something changed, but
    // nothing says it was ours — so removing the node would be destroying the
    // user's work on a guess, which is strictly worse than admitting uncertainty.
    stub200({ carriesNode: false, graphHash: MOVED_HASH, assistantText: '' })
    const { hasNode, lifecycle, notices } = await driveAdd()

    expect(lifecycle).toBe('unconfirmed')
    expect(hasNode(NEW_NODE_ID)).toBe(true)
    expect(notices).toContain(STRUCTURAL_ADD_NOTICE.unconfirmed_server)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE 409 — the one arm where CEE's own words never reach the client
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_add — a 409 GRAPH_DIVERGED', () => {
  it('⭐ removes the node AND supplies the sentence, because CEE\'s never arrives', async () => {
    stub409('BASE_HASH_DIVERGED')
    const { hasNode, lifecycle, notices } = await driveAdd()

    expect(lifecycle).toBe('refused')
    expect(hasNode(NEW_NODE_ID)).toBe(false)
    expect(hasNode(SIBLING_ID)).toBe(true)
    // ⚠ A 409 returns a BoundaryError envelope, so CEE's own
    // "The model has changed since you added that…" is unreachable. The UI owns
    // this one sentence, and it names the action that actually refreshes the
    // base — a turn, not a reload and not a bare retry.
    expect(notices).toContain(STRUCTURAL_ADD_NOTICE.base_hash_diverged)
  })

  it('TWIN — an UNRECOGNISED conflict category is an unknown, so the node STAYS', async () => {
    // A category the producer does not guarantee wrote nothing cannot be called
    // a refusal. Calling an unknown a refusal is the same overclaim in verdict
    // form, and here it would destroy the user's node.
    stub409('SOME_FUTURE_CATEGORY')
    const { hasNode, lifecycle, notices } = await driveAdd()

    expect(lifecycle).toBe('unconfirmed')
    expect(hasNode(NEW_NODE_ID)).toBe(true)
    expect(notices).toContain(STRUCTURAL_ADD_NOTICE.unconfirmed_server)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE STAND-DOWNS — where a refusal must NOT destroy work
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_add — refused, but the removal must stand down', () => {
  it('⭐⭐ a CONNECTED node is LEFT on the canvas, and the copy names that exact state', async () => {
    // The add was refused, but the user has drawn an edge to it since. Removing
    // the node would destroy a link THIS GESTURE DID NOT CREATE — the data-loss
    // direction of the same harm. Silence would be worse still: the canvas would
    // knowingly show a node the model does not hold, which is the P0 shape this
    // whole event exists to close.
    stub200({ carriesNode: false, graphHash: BASE_GRAPH_HASH, assistantText: '' })
    const { hasNode, notices } = await driveAdd({
      edges: [{ id: 'e1', source: NEW_NODE_ID, target: SIBLING_ID }] as never,
    })

    expect(hasNode(NEW_NODE_ID)).toBe(true)
    expect(notices).toContain(STRUCTURAL_ADD_NOTICE.refused_left_on_canvas)
  })

  it('TWIN — with no edge attached, the very same refusal DOES remove the node', async () => {
    // Proves the stand-down above is the EDGE's doing and not a refusal that
    // silently stopped working.
    stub200({ carriesNode: false, graphHash: BASE_GRAPH_HASH, assistantText: '' })
    const { hasNode, notices } = await driveAdd({ edges: [] })

    expect(hasNode(NEW_NODE_ID)).toBe(false)
    expect(notices).not.toContain(STRUCTURAL_ADD_NOTICE.refused_left_on_canvas)
  })

  it('a SCENARIO SWITCH mid-turn stands the removal down and withholds the copy', async () => {
    // The copy promises the node is off the canvas. Once the user has opened a
    // different decision that promise is false, so it is withheld rather than
    // shipped beside a canvas it does not describe — and nothing is deleted from
    // a decision this gesture never touched.
    stub200({ carriesNode: false, graphHash: BASE_GRAPH_HASH, assistantText: '' })
    seedCanvasPostAdd()
    const intent = addIntent()
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      const p = result.current
        .sendSystemEvent(
          {
            type: 'structural_add',
            payload: {
              node_id: NEW_NODE_ID,
              node_kind: 'factor',
              label: NEW_LABEL,
              base_graph_hash: BASE_GRAPH_HASH,
            },
          } as never,
          { structuralAdd: intent, debugSource: 'canvas_add' },
        )
        .catch(() => undefined)
      useCanvasStore.setState({ currentScenarioId: 'a-different-decision' } as never)
      await p
    })

    expect(useCanvasStore.getState().nodes.some((n) => n.id === NEW_NODE_ID)).toBe(true)
    const notices = result.current.messages
      .filter((m) => m.role === 'assistant' && m.synthetic === true)
      .map((m) => m.content)
    expect(notices).not.toContain(STRUCTURAL_ADD_NOTICE.refused_server)
  })
})

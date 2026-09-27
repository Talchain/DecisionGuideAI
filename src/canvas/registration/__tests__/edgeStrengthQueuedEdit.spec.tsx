/**
 * A LINK-STRENGTH EDIT MADE WHILE ANOTHER IS ON THE WIRE (canvas audit
 * edit-values F1 + F2, each reproduced 3/3 by a skeptic on served `d87eeb94`).
 *
 * WITNESSED. build-vs-buy e-17 (0.62): "Moderate" then "Very strong" 340 ms
 * later. Turn 1 (0.3, expected 0.62) → 200. Turn 2 (0.85, expected 0.62 — the
 * tuple from BEFORE turn 1 landed) → 409 `GRAPH_DIVERGED`
 * `edge_expected_tuple_mismatch`, `retryable: false`. Then:
 *   · the queue kept the refused entry (not a proven no-write), replayed it up
 *     to three times, and held it for good — `pendingEmittedEdits` 1, Analyse
 *     "Your change is still being saved" at +5 … +75 s with nothing in flight;
 *   · a later click back to the stale tuple's value made the replay MATCH, and
 *     the superseded "Very strong" silently overwrote the newer choice;
 *   · a 12-step slow drag queued every intermediate value: 32 turns, 28 × 409.
 *
 * Every case drives the REAL carrier (`useEdgeMutations().setStrength`) inside
 * the REAL `ConversationProvider`. The transport is a small compare-and-swap
 * server with CEE's own rule — `expected.mean` must equal what it holds, bare
 * `!==`, else the witnessed 409 — so a stale tuple is refused HERE exactly as it
 * was on the wire. Assertions bind by identity: the payload that reached the
 * transport, the server's final mean, the hold's cause.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { __resetPendingFactorEditsForTest } from '../../conversation/pendingFactorEdit'
import { __resetPendingEdgeEditsForTest } from '../../conversation/pendingEdgeEdit'
import type { SystemEventSendSettlement } from '../../conversation/settleSystemEventSend'
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

// ── The compare-and-swap server ────────────────────────────────────────────
const SERVER_START = 0.25
let serverMean = SERVER_START
/**
 * When set to N, the Nth edge edit to reach the server is refused as if a third
 * party had moved the link — whatever tuple it asserts.
 */
let refuseEdgeEditNumber: number | null = null
/** When set, every edge edit after the first dies in transport (the request may never have arrived). */
let edgeEditTransportDiesAfterFirst = false
const dispatched: Array<Record<string, unknown>> = []
let holdTurn = false
let releaseTurn: (() => void) | null = null

const FROM = 'fac_usage_exposure'
const TO = 'out_nrr'
const EDGE_ID = 'e-13'

/** The witnessed 409, byte-shaped from the skeptic's turns.jsonl. */
const MISMATCH_409 = (current: number) => ({
  kind: 'boundary_error',
  error: {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      retryable: false,
      failure_type: 'GRAPH_DIVERGED',
      event_kind: 'edge_strength_edit',
      recovery_action: 'refresh_and_reconfirm',
      conflict_category: 'edge_expected_tuple_mismatch',
      edge: { current: { mean: current } },
    },
    request_id: 'req_edge_expected_409',
    retryable: false,
  },
})

const APPLIED = (mean: number) => ({
  ok: true,
  response: {
    assistant_text: 'Set the strength.',
    blocks: [],
    graph_hash: `aag_${mean}`,
    draft_graph: {
      nodes: [
        {
          id: FROM, kind: 'factor', label: 'Usage-Based Pricing Exposure', category: 'controllable',
          observed_state: { value: 0.5, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
        },
        { id: TO, kind: 'outcome', label: 'Net Revenue Retention' },
      ],
      edges: [
        {
          from: FROM, to: TO,
          strength: { mean, std: 0.12 },
          effect_direction: mean < 0 ? 'negative' : 'positive',
          exists_probability: 0.75, edge_type: 'directed',
          provenance: { source: 'user_specified' }, provenance_display: 'user_set',
        },
      ],
    },
  },
})

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      if (holdTurn) await new Promise<void>((res) => { releaseTurn = res })
      const ev = payload.event as Record<string, unknown> | undefined
      if (ev?.kind !== 'edge_strength_edit') return { ok: true, response: { assistant_text: 'ok', blocks: [] } }
      const nth = dispatched.filter((p) => (p.event as { kind?: string } | undefined)?.kind === 'edge_strength_edit').length
      if (refuseEdgeEditNumber === nth) return MISMATCH_409(serverMean)
      if (edgeEditTransportDiesAfterFirst && nth > 1) throw new TypeError('Failed to fetch')
      // CEE's rule: the exact signed mean last read, compared with a bare `!==`.
      if ((ev.expected as { mean: number }).mean !== serverMean) return MISMATCH_409(serverMean)
      const magnitude = ev.magnitude as number
      const intent = ev.direction_intent as string
      serverMean =
        intent === 'negative' ? -magnitude : intent === 'positive' ? magnitude : (serverMean < 0 ? -magnitude : magnitude)
      return APPLIED(serverMean)
    }),
  }
})
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, openV5TurnStream: async () => { throw new TypeError('Failed to fetch') } }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useImportRegistration } from '../useImportRegistration'
import { editDeliveryHold } from '../editDeliveryHold'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useEdgeMutations } from '../../ui/inspector-v2/useInspectorMutations'
import { useOptionalConversationContext } from '../../conversation/ConversationContext'

const SCENARIO = '9fc5c6bf-0d04-4dd4-89db-bb6470a98fc5'

const STARTER_NODES: Node[] = [
  {
    id: FROM, type: 'factor', position: { x: 0, y: 0 },
    data: {
      label: 'Usage-Based Pricing Exposure', kind: 'factor', category: 'controllable',
      starterId: 'pricing-model', provenance: 'ai_inferred',
      observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
    },
  } as unknown as Node,
  {
    id: TO, type: 'outcome', position: { x: 0, y: 0 },
    data: { label: 'Net Revenue Retention', kind: 'outcome', starterId: 'pricing-model', provenance: 'ai_inferred' },
  } as unknown as Node,
]

const starterEdge = (): Edge =>
  ({
    id: EDGE_ID, source: FROM, target: TO,
    data: {
      weight: SERVER_START, direction: 'positive', strengthStd: 0.12, exists_probability: 0.75,
      serverStrength: { mean: SERVER_START, effect_direction: 'positive' },
    },
  }) as unknown as Edge

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

const wrapper = ({ children }: { children: ReactNode }) => <ConversationProvider>{children}</ConversationProvider>

async function mountStarter() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: STARTER_NODES as never,
    edges: [starterEdge()] as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    lastServerGraphHash: 'aag_start',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(() => {
    useImportRegistration()
    const mutations = useEdgeMutations(EDGE_ID)
    const convo = useOptionalConversationContext()
    return Object.assign(Object.create(mutations), mutations, {
      transcript: convo?.messages ?? [],
      chat: (text: string) => convo?.sendMessage(text),
    })
  }, { wrapper })
  await act(async () => { await flush() })
  expect(editDeliveryHold(useCanvasStore.getState() as never), 'precondition: nothing held at open').toBeNull()
  return hook
}

type Hook = Awaited<ReturnType<typeof mountStarter>>

/** A band press — the real carrier, magnitude only. Returns the carrier's settlements. */
async function pick(hook: Hook, mean: number) {
  const settlements: SystemEventSendSettlement[] = []
  await act(async () => {
    expect(hook.result.current.setStrength(mean, { preserveDirection: true, onSendSettled: (s: SystemEventSendSettlement) => settlements.push(s) }))
      .toBe('dispatched')
    await flush()
  })
  return settlements
}

async function releaseAndDrain() {
  holdTurn = false
  await act(async () => { releaseTurn?.(); await flush(); await flush() })
}

const edgeEvents = () =>
  dispatched
    .map((p) => p.event as Record<string, unknown> | undefined)
    .filter((e): e is Record<string, unknown> => e?.kind === 'edge_strength_edit')
const edgeWeight = () =>
  (useCanvasStore.getState().edges.find((e) => e.id === EDGE_ID)?.data as { weight?: number } | undefined)?.weight
const hold = () => editDeliveryHold(useCanvasStore.getState() as never)

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  registerSpy.mockReset()
  registerSpy.mockResolvedValue({
    status: 'registered', identity: { value: 'id_abc', projectionVersion: 'identity.v1' },
    nodeCount: 2, edgeCount: 1, requestId: 'req_register',
  })
  serverMean = SERVER_START
  refuseEdgeEditNumber = null
  edgeEditTransportDiesAfterFirst = false
  dispatched.length = 0
  holdTurn = false
  releaseTurn = null
  clearImportRegistrationMarkers()
  __resetPendingFactorEditsForTest()
  __resetPendingEdgeEditsForTest()
  __resetPersistenceSessionForTests()
  useCanvasStore.setState({ nodes: [] as never, edges: [] as never, currentScenarioId: null, importPendingServerRegistration: false } as never)
})

afterEach(async () => {
  holdTurn = false
  releaseTurn?.()
  releaseTurn = null
  await flush()
  vi.unstubAllEnvs()
  __resetPersistenceSessionForTests()
})

describe('F1 — a queued link edit asserts what the server holds when it LEAVES', { timeout: 30_000 }, () => {
  it('two quick band picks: the second goes out with the FIRST receipt\'s tuple and applies — no 409, nothing held', async () => {
    const hook = await mountStarter()
    holdTurn = true
    const first = await pick(hook, 0.3)
    const second = await pick(hook, 0.85)
    expect(second, 'precondition: the second pick was QUEUED behind the first').toEqual(['queued'])
    expect(edgeEvents(), 'precondition: only the first is on the wire').toHaveLength(1)

    await releaseAndDrain()

    const sent = edgeEvents()
    expect(sent.map((e) => e.magnitude)).toEqual([0.3, 0.85])
    // THE assertion that was RED: the queued turn carried the pre-first tuple (0.25).
    expect((sent[1].expected as { mean: number }).mean).toBe(0.3)
    expect(serverMean, 'the server holds the LAST pick').toBe(0.85)
    expect(edgeWeight()).toBe(0.85)
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
    expect(hold(), 'Analyse is not held once both picks are confirmed').toBeNull()
    // …and the queued carrier hears its real outcome, not only 'queued'.
    expect(first).toEqual(['sent'])
    expect(second).toEqual(['queued', 'sent'])
  })

  it('a slow drag: every intermediate position collapses into ONE queued turn carrying the last value', async () => {
    const hook = await mountStarter()
    holdTurn = true
    await pick(hook, 0.3)
    for (const v of [0.35, 0.55, 0.7, 0.85]) await pick(hook, v)
    expect(edgeEvents(), 'precondition: one on the wire, the rest queued').toHaveLength(1)

    await releaseAndDrain()

    const sent = edgeEvents()
    expect(sent.map((e) => e.magnitude), 'two turns, not five (the served drag sent 32)').toEqual([0.3, 0.85])
    expect((sent[1].expected as { mean: number }).mean).toBe(0.3)
    expect(serverMean).toBe(0.85)
    expect(hold()).toBeNull()
  })

  it('dragging BACK to the value already on the wire sends nothing more — the model already holds it', async () => {
    const hook = await mountStarter()
    holdTurn = true
    await pick(hook, 0.55)
    await pick(hook, 0.85)
    const last = await pick(hook, 0.55)

    await releaseAndDrain()

    expect(edgeEvents().map((e) => e.magnitude), 'no second turn: CEE would refuse it as set_target_unchanged').toEqual([0.55])
    expect(serverMean).toBe(0.55)
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
    expect(hold()).toBeNull()
    expect(last).toEqual(['queued', 'sent'])
  })
})

describe('F2 — a queued link edit the server refuses is never replayed and never holds Analyse', { timeout: 30_000 }, () => {
  it('a non-retryable refusal DROPS the entry: no replay, the "still being saved" hold ends, the carrier is told', async () => {
    const hook = await mountStarter()
    holdTurn = true
    await pick(hook, 0.55)
    const second = await pick(hook, 0.85)
    // Someone else moved the link before the queued pick left: whatever the
    // client asserts, CEE refuses the SECOND edit.
    refuseEdgeEditNumber = 2

    await releaseAndDrain()
    for (let i = 0; i < 4; i++) await act(async () => { await flush() })

    expect(edgeEvents().map((e) => e.magnitude), 'the refused edit went out ONCE — no replay').toEqual([0.55, 0.85])
    expect(useCanvasStore.getState().pendingEmittedEdits, 'nothing is left to deliver').toBe(0)
    expect(hold(), 'never "Your change is still being saved" with nothing on the wire').not.toBe('edit_queued')
    // Not a proven no-write, so it is not called one: the cannot-confirm line.
    expect(second).toEqual(['queued', 'unverified'])

    // A later pick on the same link sends exactly ONE turn — the refused one is
    // gone, not waiting behind it — and releases whatever was held.
    await pick(hook, 0.3)
    await act(async () => { await flush() })
    expect(edgeEvents().map((e) => e.magnitude)).toEqual([0.55, 0.85, 0.3])
    expect(serverMean).toBe(0.3)
    expect(hold()).toBeNull()
  })

  it('RESURRECTION: moving the link back to a stale tuple\'s value never lets a superseded pick overwrite the newer choice', async () => {
    const hook = await mountStarter()
    holdTurn = true
    await pick(hook, 0.55)
    await pick(hook, 0.85)
    await releaseAndDrain()

    // The user then settles on the link's ORIGINAL strength — the exact tuple
    // the stale queued payload carried on the served build.
    await pick(hook, SERVER_START)
    await act(async () => { await flush(); await flush() })

    expect(serverMean, 'the model holds the user\'s LAST choice').toBe(SERVER_START)
    expect(edgeWeight()).toBe(SERVER_START)
    expect(edgeEvents().map((e) => e.magnitude)).toEqual([0.55, 0.85, SERVER_START])
    expect(hold()).toBeNull()
  })

  it('a queued link edit that never reaches the server is SAID in the transcript at the retry cap (it was silent)', async () => {
    const hook = await mountStarter()
    holdTurn = true
    await pick(hook, 0.55)
    const second = await pick(hook, 0.85)
    edgeEditTransportDiesAfterFirst = true

    await releaseAndDrain()
    // A queued send is retried when the NEXT turn releases the lock — so the
    // user goes on working (two chat turns) and the queue reaches its cap.
    const chat = (hook.result.current as unknown as { chat: (t: string) => Promise<void> }).chat
    for (const text of ['what drives retention?', 'and churn?']) {
      await act(async () => { await chat(text); await flush() })
    }
    expect(edgeEvents().map((e) => e.magnitude), 'precondition: the queued edit was tried three times')
      .toEqual([0.55, 0.85, 0.85, 0.85])

    const shown = (hook.result.current as unknown as { transcript: Array<{ content?: unknown }> }).transcript
      .map((m) => String(m.content)).join(' ')
    expect(shown, 'the user is told which link change has not reached the server')
      .toMatch(/strength of the link from Usage-Based Pricing Exposure to Net Revenue Retention hasn't reached the server/)
    // It may still land — the transport says nothing either way — so it is KEPT
    // (the hold is truthful here) and the carrier hears the cannot-confirm line.
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)
    expect(second).toEqual(['queued', 'unverified'])
  })
})

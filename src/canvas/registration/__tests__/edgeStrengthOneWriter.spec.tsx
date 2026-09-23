/**
 * ONE WRITER — A LINK-STRENGTH EDIT NEVER REACHES CEE BEHIND ITS OWN TURN.
 *
 * WITNESSED on served staging 23 Sep 02:49Z (UI `76e25c5f`, guest, pricing
 * example `ba816e00…`, `output/canvas-completion-20260923/LOG.md`): the edge
 * inspector's "Strong" wrote the canvas optimistically and sent
 * `edge_strength_edit`; a whole-graph `graph/register` left 1 ms later carrying
 * the new magnitude, moved CEE's hash, and the turn was refused
 * (409 `GRAPH_DIVERGED`, `rpc_cas_conflict`). CEE kept the refused value with no
 * receipt and no authorship; the panel said "You set this strength".
 *
 * #1892 closes the race WHILE the turn is on the wire (case A). Two paths stayed
 * open behind it, both because the edge carrier has no lifecycle after the send
 * (`useInspectorMutations.ts` — "no revert lifecycle"):
 *
 *   B. A REFUSED edit left its magnitude on the canvas; when the hold released,
 *      the side channel wrote the refused value into CEE.
 *   C. An APPLIED edit's own optimistic write left the pre-receipt canvas
 *      unacknowledged, so #1895's chain (correctly) did not fire and a
 *      whole-graph registration followed the receipt.
 *
 * RE-WITNESSED on served staging 23 Sep 09:4xZ (UI `4c6ec07b`, after #1895,
 * `output/canvas-completion-20260923/WITNESS-1895-4c6ec07b.md` step 3): an
 * APPLIED `edge_strength_edit` (draft_graph 15/30, the edge carrying
 * `provenance user_specified`) was still followed by a whole-graph register at
 * +58 ms, and that register's edge OMITTED `provenance` — CEE's copy then lost
 * the user's authorship. Case C is that witness.
 *
 * ⚠ B2 IS NOT A REFUSAL (independent audit of 31880193): a 200 that carries no
 * committed graph proves nothing either way, so it must not be told "Not
 * recorded". Refusal is claimed only on a proven no-write (the 409 of case B);
 * B2 takes the unverified line, keeps the number, and keeps it off the side
 * channel.
 *
 * Every case drives the REAL carrier (`useEdgeMutations().setStrength`) inside
 * the REAL `ConversationProvider`, beside the REAL `useImportRegistration`.
 * Only the transport and the registration POST are mocked. Assertions bind the
 * registration payload by IDENTITY — this edge's `strength.mean` — never by a
 * count alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { __resetCeeHeldModelLatchForTest } from '../ceeHeldModel'
import { clearImportRegistrationMarkers, isGraphServerAcknowledged } from '../../store/importRegistrationMarker'
import { analysisHeldOn } from '../../utils/analysisHeldOnInjectedModel'
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

const dispatched: Array<Record<string, unknown>> = []
const replies: unknown[] = []
let holdTurn = false
let releaseTurn: (() => void) | null = null
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      if (holdTurn) {
        await new Promise<void>((res) => { releaseTurn = res })
      }
      return replies.shift() ?? { ok: true, response: { assistant_text: 'ok', blocks: [] } }
    }),
  }
})
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useImportRegistration } from '../useImportRegistration'
import { editDeliveryHold } from '../editDeliveryHold'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useEdgeMutations } from '../../ui/inspector-v2/useInspectorMutations'

// ── Fixtures — the witnessed board's shape ─────────────────────────────────
const SCENARIO = '9fc5c6bf-0d04-4dd4-89db-bb6470a98fc5'
const FROM = 'fac_usage_exposure'
const TO = 'out_nrr'
const EDGE_ID = 'e-13'
/** What CEE holds at open (the witnessed edge: Moderate, 0.25). */
const SERVER_MEAN = 0.25
/** What the user picks ("Strong"). */
const USER_MEAN = 0.55

function node(id: string, type: string, label: string): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label, kind: type, starterId: 'pricing-model', provenance: 'ai_inferred' },
  } as unknown as Node
}

const STARTER_NODES: Node[] = [
  {
    ...node(FROM, 'factor', 'Usage-Based Pricing Exposure'),
    data: {
      label: 'Usage-Based Pricing Exposure',
      kind: 'factor',
      category: 'controllable',
      starterId: 'pricing-model',
      provenance: 'ai_inferred',
      observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
    },
  } as unknown as Node,
  node(TO, 'outcome', 'Net Revenue Retention'),
]

function starterEdge(): Edge {
  return {
    id: EDGE_ID,
    source: FROM,
    target: TO,
    data: {
      weight: SERVER_MEAN,
      direction: 'positive',
      strengthStd: 0.12,
      exists_probability: 0.75,
      serverStrength: { mean: SERVER_MEAN, effect_direction: 'positive' },
    },
  } as unknown as Edge
}

/** The edge exactly as "Strong" writes it (`setStrength`, preserveDirection) — the optimistic state. */
function editedEdge(mean: number): Edge {
  const e = starterEdge()
  return { ...e, data: { ...(e.data as object), weight: mean, weightSource: 'user' } } as unknown as Edge
}

const ACK = {
  status: 'registered' as const,
  identity: { value: 'id_abc', projectionVersion: 'identity.v1' },
  nodeCount: 2,
  edgeCount: 1,
  requestId: 'req_register',
}

/** The witnessed refusal, byte-shaped from the served 409 (02:49:18Z). */
const REFUSED_409 = {
  kind: 'boundary_error',
  error: {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      retryable: false,
      reason: 'graph_write_conflict',
      failure_type: 'GRAPH_DIVERGED',
      event_kind: 'edge_strength_edit',
      recovery_action: 'refresh_and_reconfirm',
      conflict_category: 'rpc_cas_conflict',
      expected_base_graph_hash: '25f9458b449257e4',
      stage: 'frame',
    },
    request_id: 'req_edge_409',
    retryable: false,
  },
}

/** A 200 that applies nothing: CEE's prose, no committed graph (e.g. the reader-only posture). */
const ANSWERED_NOT_APPLIED = {
  ok: true,
  response: { assistant_text: "I can't apply this link-strength change right now.", blocks: [] },
}

/** An untyped 500 — it may or may not have landed. */
const UNTYPED_500 = {
  kind: 'boundary_error',
  error: {
    error: 'INTERNAL_ERROR',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: { phase: 'commit', reason: 'system_event_commit_failed' },
    request_id: 'req_commit_failed',
    retryable: true,
  },
}

/** CEE's applied receipt — `dispatch.ts:1201` carries the committed graph on `draft_graph`. */
const APPLIED = (mean: number) => ({
  ok: true,
  response: {
    assistant_text: 'Set the strength of Usage-Based Pricing Exposure → Net Revenue Retention.',
    blocks: [],
    graph_hash: 'aag_after_edge',
    draft_graph: {
      nodes: [
        {
          id: FROM,
          kind: 'factor',
          label: 'Usage-Based Pricing Exposure',
          category: 'controllable',
          observed_state: { value: 0.5, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
        },
        { id: TO, kind: 'outcome', label: 'Net Revenue Retention' },
      ],
      edges: [
        {
          from: FROM,
          to: TO,
          strength: { mean, std: 0.12 },
          effect_direction: 'positive',
          exists_probability: 0.75,
          edge_type: 'directed',
          // As witnessed on the served receipt (4c6ec07b step 3): CEE records
          // the user as the author of the magnitude it just applied.
          provenance: { source: 'user_specified' },
          provenance_display: 'user_set',
        },
      ],
    },
  },
})

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

function edgeData(): Record<string, unknown> {
  return (useCanvasStore.getState().edges.find((e) => e.id === EDGE_ID)?.data ?? {}) as Record<string, unknown>
}

/** This edge's magnitude in one registration payload — by identity. */
function registeredMean(call: unknown[]): number | null {
  const graph = call[1] as { edges: Array<Record<string, unknown>> }
  const e = graph.edges.find((x) => (x.from ?? x.source) === FROM && (x.to ?? x.target) === TO)
  const mean = (e?.strength as { mean?: unknown } | undefined)?.mean
  return typeof mean === 'number' ? Math.abs(mean) : null
}
function registrationsCarrying(mean: number) {
  return registerSpy.mock.calls.filter((call) => registeredMean(call) === mean)
}

const wrapper = ({ children }: { children: ReactNode }) => <ConversationProvider>{children}</ConversationProvider>

async function mountAcknowledgedStarter() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: STARTER_NODES as never,
    edges: [starterEdge()] as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    lastServerGraphHash: 'aag_before_edge',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(
    () => {
      useImportRegistration()
      return useEdgeMutations(EDGE_ID)
    },
    { wrapper },
  )
  await act(async () => { await flush() })
  // PRECONDITIONS: the starter was registered ONCE with the server's own
  // magnitude, and the hold released on that acknowledgement.
  expect(registerSpy).toHaveBeenCalledTimes(1)
  expect(registeredMean(registerSpy.mock.calls[0])).toBe(SERVER_MEAN)
  expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  return hook
}

/** "Strong" in the edge inspector — the real carrier, magnitude only (the band buttons). */
async function pressStrong(hook: Awaited<ReturnType<typeof mountAcknowledgedStarter>>) {
  const settlements: SystemEventSendSettlement[] = []
  await act(async () => {
    const outcome = hook.result.current.setStrength(USER_MEAN, {
      preserveDirection: true,
      onSendSettled: (s) => settlements.push(s),
    })
    expect(outcome).toBe('dispatched')
    await flush()
  })
  return settlements
}

async function releaseAndDrain() {
  await act(async () => {
    releaseTurn?.()
    await flush()
    await flush()
  })
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  registerSpy.mockReset()
  registerSpy.mockResolvedValue(ACK)
  dispatched.length = 0
  replies.length = 0
  holdTurn = false
  releaseTurn = null
  clearImportRegistrationMarkers()
  // OW-1: the one-writer latch is page-life state keyed by scenario; each case is a fresh page.
  __resetCeeHeldModelLatchForTest()
  __resetPendingFactorEditsForTest()
  __resetPendingEdgeEditsForTest()
  __resetPersistenceSessionForTests()
  useCanvasStore.setState({
    nodes: [] as never,
    edges: [] as never,
    currentScenarioId: null,
    importPendingServerRegistration: false,
    pendingStructuralRenames: [],
  } as never)
})

afterEach(async () => {
  holdTurn = false
  releaseTurn?.()
  releaseTurn = null
  await flush()
  vi.unstubAllEnvs()
  __resetPersistenceSessionForTests()
})

describe('one writer — a link-strength edit never reaches CEE behind its own turn', { timeout: 30_000 }, () => {
  it('A · while the edit is on the wire, NO registration leaves (the served race, closed by #1892)', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true
    replies.push(REFUSED_409)
    await pressStrong(hook)

    expect(dispatched).toHaveLength(1)
    expect((dispatched[0].event as Record<string, unknown>).kind).toBe('edge_strength_edit')
    expect(edgeData().weight).toBe(USER_MEAN)
    expect(registrationsCarrying(USER_MEAN)).toHaveLength(0)
    expect(registerSpy).toHaveBeenCalledTimes(1)
    await releaseAndDrain()
  })

  it('B · REFUSED (the witnessed 409): the canvas returns to what CEE holds, and NO registration ever carries the refused magnitude', async () => {
    const hook = await mountAcknowledgedStarter()
    replies.push(REFUSED_409)
    const settlements = await pressStrong(hook)
    await act(async () => { await flush() })

    expect(settlements).toEqual(['refused'])
    // The canvas shows what the model holds — never a value the server refused.
    expect(edgeData().weight).toBe(SERVER_MEAN)
    expect(edgeData().weightSource).toBeUndefined()
    expect(registrationsCarrying(USER_MEAN)).toHaveLength(0)
    // …and with the canvas back on the acknowledged model, nothing is re-offered.
    expect(registerSpy).toHaveBeenCalledTimes(1)
    // A refused edit is never acknowledged: the edited model is not one CEE
    // holds — with the contrast that the probe DOES see the model CEE holds.
    expect(isGraphServerAcknowledged(SCENARIO, STARTER_NODES as never, [starterEdge()] as never)).toBe(true)
    expect(isGraphServerAcknowledged(SCENARIO, STARTER_NODES as never, [editedEdge(USER_MEAN)] as never)).toBe(false)
  })

  it('B2 · answered WITHOUT applying (200, no committed graph): NOT a proven refusal — unverified, number kept, nothing laundered', async () => {
    const hook = await mountAcknowledgedStarter()
    replies.push(ANSWERED_NOT_APPLIED)
    const settlements = await pressStrong(hook)
    await act(async () => { await flush() })

    // No committed graph and no typed refusal: the evidence cannot say the
    // server wrote nothing, so the panel may not say "Not recorded". It gets
    // the cannot-confirm line, as the untyped 500 does (B3).
    expect(settlements).toEqual(['unverified'])
    expect(edgeData().weight).toBe(USER_MEAN)
    // …and an unconfirmed magnitude never reaches CEE through the side channel.
    expect(registrationsCarrying(USER_MEAN)).toHaveLength(0)
    expect(isGraphServerAcknowledged(SCENARIO, STARTER_NODES as never, [editedEdge(USER_MEAN)] as never)).toBe(false)
  })

  it('B3 · UNVERIFIED (untyped 500): the number stays on screen, and NO registration ever carries it', async () => {
    const hook = await mountAcknowledgedStarter()
    replies.push(UNTYPED_500)
    const settlements = await pressStrong(hook)
    await act(async () => { await flush() })

    expect(settlements).toEqual(['unverified'])
    // It may have landed — hiding it would be the opposite lie…
    expect(edgeData().weight).toBe(USER_MEAN)
    // …but the side channel must never launder it into CEE under nobody's name.
    expect(registrationsCarrying(USER_MEAN)).toHaveLength(0)
    // …and an unconfirmed edit is never acknowledged.
    const s = useCanvasStore.getState()
    expect(isGraphServerAcknowledged(s.currentScenarioId, s.nodes as never, s.edges as never)).toBe(false)
  })

  it('C · APPLIED with the committed graph (4c6ec07b step 3): the receipt IS the acknowledgement — no registration follows it', async () => {
    const hook = await mountAcknowledgedStarter()
    replies.push(APPLIED(USER_MEAN))
    const settlements = await pressStrong(hook)
    await act(async () => { await flush() })

    expect(settlements).toEqual(['sent'])
    // The precondition, by identity: the receipt landed on this edge.
    expect(edgeData().weight).toBe(USER_MEAN)
    expect((edgeData().serverStrength as { mean?: number } | undefined)?.mean).toBe(USER_MEAN)
    // The ONLY registration is the one that acknowledged the starter — so no
    // whole-graph write can carry this edge without the provenance CEE just
    // recorded for it (the served register at +58 ms dropped it).
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(registrationsCarrying(USER_MEAN)).toHaveLength(0)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('D · a DEFERRED edit (queued behind the first) that applies is settled by its OWN receipt — the hold never outlives it', async () => {
    const STRONGER = 0.8
    const hook = await mountAcknowledgedStarter()
    holdTurn = true
    replies.push(APPLIED(USER_MEAN), APPLIED(STRONGER))
    await pressStrong(hook)
    // A second pick while the first is on the wire: the dispatcher queues it,
    // and the carrier is told 'queued' — the ONLY settlement it will ever hear.
    const second: SystemEventSendSettlement[] = []
    await act(async () => {
      hook.result.current.setStrength(STRONGER, { preserveDirection: true, onSendSettled: (s) => second.push(s) })
      await flush()
    })
    expect(second).toEqual(['queued'])
    expect(dispatched).toHaveLength(1)

    holdTurn = false
    await releaseAndDrain()

    // PRECONDITIONS, by identity: both turns went out in order, and the canvas
    // holds the magnitude CEE committed last.
    expect(dispatched.map((p) => (p.event as { magnitude?: number }).magnitude)).toEqual([USER_MEAN, STRONGER])
    expect(edgeData().weight).toBe(STRONGER)
    expect((edgeData().serverStrength as { mean?: number } | undefined)?.mean).toBe(STRONGER)
    expect(second).toEqual(['queued'])
    // ⭐ Only the deferred turn's own receipt can end its pending state; if it
    //    did not, signal 5 would hold registration for the life of the page.
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
    // …and whatever is offered afterwards carries only what CEE committed.
    for (const call of registerSpy.mock.calls.slice(1)) expect(registeredMean(call)).toBe(STRONGER)
  })

  // ⚠ OW-1 FLIPPED THIS CASE. It asserted the post-receipt re-offer (the #1855
  // whole-graph write). The one-writer contract retires it: the starter's own
  // 200, and this receipt, latched the scenario. Fail-closed still means the
  // receipt does not vouch for the change it never saw — it is just no longer
  // WRITTEN to CEE behind the canonical path.
  it('CONTROL (fail closed): a local-only change made while the edit is in flight is not acknowledged — and (OW-1) nothing is re-offered', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true
    replies.push(APPLIED(USER_MEAN))
    await pressStrong(hook)
    // A change nobody sent: the factor's value, written locally mid-flight.
    await act(async () => {
      const n = useCanvasStore.getState().nodes.find((x) => x.id === FROM)!
      const d = n.data as Record<string, unknown>
      useCanvasStore.getState().updateNode(FROM, {
        data: { ...d, observedState: { ...(d.observedState as object), value: 0.9 } },
      } as never)
      await flush()
    })
    const before = registerSpy.mock.calls.length
    await releaseAndDrain()
    // The receipt vouches for the link, not for a change it never saw…
    const st = useCanvasStore.getState()
    expect(isGraphServerAcknowledged(st.currentScenarioId, st.nodes as never, st.edges as never)).toBe(false)
    // …and nothing is written over the scenario CEE holds (rule 2).
    expect(registerSpy.mock.calls.slice(before)).toEqual([])
  })

  // ⚠ OW-1 FLIPPED THIS CASE. It was "CONTROL (#1855 preserved): a local-only
  // edge change with NOTHING in flight still re-registers". σ is one of the
  // manifest's reachable LOCAL-ONLY gestures (no turn carries it): under the
  // one-writer contract it is never written to CEE by a whole-graph register
  // (rule 2), and making it canonical or visibly unsaved is rule 5's.
  it('OW-1 (was "#1855 preserved"): a local-only edge change on a scenario CEE holds is NOT re-registered', async () => {
    const hook = await mountAcknowledgedStarter()
    await act(async () => {
      hook.result.current.setStd(0.3)
      await flush()
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    // ⚠ INTERIM, accepted by Panel (#63 5797440981): Run re-holds on the digest
    // path until 5(c) releases it on the latch.
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBe('starter')
  })
})

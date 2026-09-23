/**
 * ONE WRITER — a Canvas edit and a whole-graph registration must never overlap,
 * and a registration must never carry a value the server has not confirmed.
 *
 * ── THE DEFECT, WITNESSED ON SERVED STAGING (22 Sep 2026, UI 28d2745e, CEE 9c16e8c) ──
 * A factor value edit writes the canvas optimistically and sends a
 * `factor_value_edit` turn. The optimistic write moves the analytical digest,
 * so `useImportRegistration`'s re-arm effect armed a WHOLE-GRAPH registration
 * and the registration effect POSTed `/graph/register` — in the SAME
 * millisecond as the edit turn, carrying the user's number under Olumi's
 * authorship (`{value: 0.42, source: "cee_inference"}`). CEE's CAS then
 * rejected the edit (`GraphStaleWriteError … the turn and version both rolled
 * back` → HTTP 500 `system_event_commit_failed`), but the register had already
 * stored the user's number as an AI estimate. With the register blocked, the
 * same edit committed, settled `user_override` and survived reload.
 *
 * ── WHAT EACH CASE PINS ─────────────────────────────────────────────────────
 *  1. No registration while a value edit is in flight (the race itself).
 *  2. An APPLIED receipt is the acknowledgement: the hold clears with NO
 *     re-registration (the "fired 3 s after the confirm" row of the evidence).
 *  3. The untyped 500 keeps the user's number and NO registration ever carries
 *     it (the unconfirmed value must not be laundered into canonical state).
 *  4. A refusal reverts to the acknowledged model and nothing is sent.
 *  5. A queued rename holds registration too (evidence §4: the rename and the
 *     register left in the same millisecond).
 *  6. ANY model-changing system_event in flight holds registration — even one
 *     carrying no optimistic snapshot, so the in-flight signal is not the
 *     value-edit register in disguise.
 *  7. CONTROL (#1855 preserved): a local-only change with nothing in flight
 *     still re-registers, so the gate is not "never re-register".
 *
 * Assertions bind by IDENTITY — the exact register call and the exact factor's
 * `observed_state` in its payload — never by a count alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { analysisHeldOn } from '../../utils/analysisHeldOnInjectedModel'
import { captureOptimisticFactorEdit } from '../../conversation/optimisticFactorEdit'
import { __resetPendingFactorEditsForTest } from '../../conversation/pendingFactorEdit'
import { USER_VALUE_STAMP } from '../../domain/valueProvenance'
import type { WireSystemEvent } from '../../conversation/types'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

// ── The hold's run-path conjunct is FALSE by default under test (trap 13b) ──
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => true }
})

// ── The registration seam: a spy, so every POST is observable by identity ──
const registerSpy = vi.fn()
vi.mock('../../../adapters/cee/registerScenarioGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../adapters/cee/registerScenarioGraph')>()),
  registerScenarioGraph: (...args: unknown[]) => registerSpy(...args),
}))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
// Same factory as `useConversation.optimisticFactorEditConflict.spec` — the real
// module throws at import without Supabase env, which the dispatcher pulls in.
/** Set to hold the registration inside its identity await (the last hop before its POST). */
let identityGate: Promise<void> | null = null
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => {
    if (identityGate) await identityGate
    return { userId: null, accessToken: null }
  },
}))

// ── The edit seam: the TRANSPORT is mocked, the dispatcher is REAL ──────────
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
// Deterministic buffered fallback (see useConversation.deferredSystemSends.spec).
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
import { useConversation } from '../../conversation/useConversation'

// ── Fixtures — the witnessed board's shape (pricing starter, guest) ─────────
const SCENARIO = '9fc5c6bf-0d04-4dd4-89db-bb6470a98fc5'
const TARGET = 'fac_adoption_friction'
const BYSTANDER = 'fac_seat_price'
/** What the server holds at open: Olumi's own estimate. */
const SERVER_VALUE = 0.8
/** What the user types. */
const USER_VALUE = 0.55

function starterFactor(id: string, label: string, value: number, display: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      category: 'controllable',
      starterId: 'pricing-model',
      provenance: 'ai_inferred',
      display_value: display,
      observedState: {
        value,
        source: 'cee_inference',
        extractionType: 'inferred',
        factor_type: 'other',
      },
    },
  } as unknown as Node
}

const STARTER_NODES: Node[] = [
  starterFactor(TARGET, 'Bottom-Up Adoption Friction', SERVER_VALUE, 'Very high (0.8)'),
  starterFactor(BYSTANDER, 'Seat Price', 0.4, 'Moderate (0.4)'),
]
const STARTER_EDGES: Edge[] = [
  {
    id: `e_${TARGET}_${BYSTANDER}`,
    source: TARGET,
    target: BYSTANDER,
    data: { weight: 0.6, direction: 'negative' },
  } as unknown as Edge,
]

const ACK = {
  status: 'registered' as const,
  identity: { value: 'id_abc', projectionVersion: 'identity.v1' },
  nodeCount: 2,
  edgeCount: 1,
  requestId: 'req_register',
}

const valueEdit = (value: number): WireSystemEvent => ({
  type: 'factor_value_edit',
  payload: { target_id: TARGET, value, field: 'value' },
})

/** CEE's applied receipt, shape as in `optimisticFactorEditRevert.spec`. */
const APPLIED = (value: number) => ({
  ok: true,
  response: {
    assistant_text: `Updated Bottom-Up Adoption Friction from 0.8 to ${value}.`,
    blocks: [
      {
        type: 'graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: TARGET,
        before: { value: SERVER_VALUE },
        after: { value },
      },
    ],
    graph_hash: 'aag_after_edit',
  },
})

/** CEE's refusal: prose, no receipt. */
const REFUSED = {
  ok: true,
  response: { assistant_text: "That value is out of range. I haven't changed anything.", blocks: [] },
}

/** What a contended commit returns today — the witnessed 500. */
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

/** The dispatch-path optimistic write, same shape as `setObservedValue` (no stamp). */
function writeOptimistically(nodeId: string, value: number) {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === nodeId)!
  const data = node.data as Record<string, unknown>
  const existing = data.observedState as Record<string, unknown>
  store.updateNode(nodeId, {
    data: {
      ...data,
      display_value: undefined,
      extractionType: undefined,
      observedState: { ...existing, value, display_value: undefined, extractionType: undefined },
    },
  } as never)
}

function nodeData(id: string): Record<string, unknown> {
  return useCanvasStore.getState().nodes.find((n) => n.id === id)!.data as Record<string, unknown>
}
function observed(id: string): Record<string, unknown> {
  return (nodeData(id).observedState ?? {}) as Record<string, unknown>
}

/** The TARGET factor's `observed_state` in the Nth registration payload — by identity. */
function registeredTarget(call: unknown[]): Record<string, unknown> | undefined {
  const graph = call[1] as { nodes: Array<Record<string, unknown>> }
  return graph.nodes.find((n) => n.id === TARGET)?.observed_state as Record<string, unknown> | undefined
}
/** Every registration that carried the user's typed number for the TARGET factor. */
function registrationsCarrying(value: number) {
  return registerSpy.mock.calls.filter((call) => registeredTarget(call)?.value === value)
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

/** Mount both writers, exactly as the Canvas route does, and land the first ack. */
async function mountAcknowledgedStarter() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: STARTER_NODES as never,
    edges: STARTER_EDGES as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(() => {
    useImportRegistration()
    return useConversation()
  })
  await act(async () => { await flush() })

  // PRECONDITIONS, pinned: the starter was registered ONCE, with the server's
  // own value, and the hold released on that acknowledgement.
  expect(registerSpy).toHaveBeenCalledTimes(1)
  expect(registeredTarget(registerSpy.mock.calls[0])).toMatchObject({
    value: SERVER_VALUE,
    source: 'cee_inference',
  })
  expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  return hook
}

/**
 * Commit a value edit through the REAL dispatcher, exactly as the model-edit
 * authority does: snapshot, optimistic write, send — in one synchronous turn.
 */
async function commitValueEdit(
  hook: Awaited<ReturnType<typeof mountAcknowledgedStarter>>,
  value: number,
): Promise<{ send: Promise<unknown> }> {
  const undo = captureOptimisticFactorEdit(TARGET, value, nodeData(TARGET), USER_VALUE_STAMP)!
  let send: Promise<unknown> = Promise.resolve()
  await act(async () => {
    writeOptimistically(TARGET, value)
    send = hook.result.current
      .sendSystemEvent(valueEdit(value), { optimisticFactorEdit: undo })
      .catch(() => undefined)
    await flush()
  })
  // Wrapped: returning the bare promise from an async function would ADOPT it,
  // and the caller would wait for the very turn the case is holding open.
  return { send }
}

async function settleTurn(send: Promise<unknown>) {
  await act(async () => {
    releaseTurn?.()
    await send
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
  identityGate = null
  clearImportRegistrationMarkers()
  __resetPendingFactorEditsForTest()
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
  // A case that fails before `settleTurn` would leave its turn held open — and
  // with it the dispatcher's on-the-wire mark, which would then hold the NEXT
  // case's registration and fail it for the wrong reason. Drain it here.
  holdTurn = false
  releaseTurn?.()
  releaseTurn = null
  await flush()
  vi.unstubAllEnvs()
  __resetPersistenceSessionForTests()
})

// Each case drives two real async writers through a timer-draining flush; the
// default 5 s budget measures machine load, not behaviour.
describe('one writer — no registration while a Canvas edit is in flight', { timeout: 30_000 }, () => {
  it('sends NO registration while a factor value edit turn is in flight, and none carries the typed number', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true

    const { send } = await commitValueEdit(hook, USER_VALUE)

    // PRECONDITIONS: the edit really is on the wire and really is unanswered,
    // and the canvas really does hold the optimistic number with the OLD stamp
    // (the exact bytes the witnessed register carried).
    expect(dispatched).toHaveLength(1)
    expect((dispatched[0] as { event?: { kind?: string } }).event?.kind).toBe('factor_value_edit')
    expect(observed(TARGET)).toMatchObject({ value: USER_VALUE, source: 'cee_inference' })

    // ⭐ THE CLAIM. RED at 28d2745e: a second register, carrying
    //    {value: 0.55, source: 'cee_inference'} — Olumi's name on the user's number.
    expect(registrationsCarrying(USER_VALUE)).toEqual([])
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push(APPLIED(USER_VALUE))
    await settleTurn(send)
  })

  it('an APPLIED receipt acknowledges the edited model — the hold clears with NO re-registration', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true
    const { send } = await commitValueEdit(hook, USER_VALUE)

    replies.push(APPLIED(USER_VALUE))
    await settleTurn(send)

    // PRECONDITION: the receipt path ran — the value is the user's, on record.
    expect(observed(TARGET)).toMatchObject({ value: USER_VALUE, source: 'user_override' })

    // ⭐ THE CLAIM. The committed receipt IS the acknowledgement: the only
    //    registration ever sent is the original one, and the hold is released.
    //    RED at 28d2745e: the stamp moved the digest again and a whole-graph
    //    register followed the confirm (the "fired 3 s after the confirm" row).
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(registrationsCarrying(USER_VALUE)).toEqual([])
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('the untyped 500 keeps the number on screen but NO registration ever carries it', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true
    const { send } = await commitValueEdit(hook, USER_VALUE)

    replies.push(UNTYPED_500)
    await settleTurn(send)

    // PRECONDITION: the unconfirmed arm ran — number kept, no user stamp.
    expect(observed(TARGET).value).toBe(USER_VALUE)
    expect(observed(TARGET).source).not.toBe('user_override')

    // ⭐ THE CLAIM. The server has not confirmed 0.55, so no whole-graph write
    //    may carry it — that is exactly how the witnessed 500 left the user's
    //    number stored as Olumi's estimate.
    expect(registrationsCarrying(USER_VALUE)).toEqual([])
    expect(registerSpy).toHaveBeenCalledTimes(1)
    // And the product stays honest: an unconfirmed model is still held.
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBe('starter')
  })

  it('a refusal reverts to the acknowledged model — nothing is sent', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true
    const { send } = await commitValueEdit(hook, USER_VALUE)

    replies.push(REFUSED)
    await settleTurn(send)

    // PRECONDITION: the revert ran.
    expect(observed(TARGET)).toMatchObject({ value: SERVER_VALUE, source: 'cee_inference' })

    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  })

  it('a queued rename holds registration — the renamed label is not written by the side-channel', async () => {
    await mountAcknowledgedStarter()

    await act(async () => {
      useCanvasStore.getState().updateNodeLabel(TARGET, 'Hybrid Platform Fee Plus Usage RT')
      await flush()
    })

    // PRECONDITIONS: the gesture was captured for the edit protocol and the
    // canvas carries the optimistic label.
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(1)
    expect(nodeData(TARGET).label).toBe('Hybrid Platform Fee Plus Usage RT')

    // ⭐ RED at 28d2745e: the label moved the digest and the whole graph —
    //    renamed label and all — was registered in the same tick.
    expect(registerSpy).toHaveBeenCalledTimes(1)
    const labels = registerSpy.mock.calls.map(
      (call) => (call[1] as { nodes: Array<Record<string, unknown>> }).nodes.find((n) => n.id === TARGET)?.label,
    )
    expect(labels).toEqual(['Bottom-Up Adoption Friction'])
  })

  it('ANY model-changing system_event in flight holds registration, even with no optimistic snapshot', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true

    let send: Promise<unknown> = Promise.resolve()
    await act(async () => {
      writeOptimistically(BYSTANDER, 0.25)
      // No `optimisticFactorEdit`: the value-edit register is NOT marked, so
      // only the dispatcher's own in-flight signal can hold this one.
      send = hook.result.current
        .sendSystemEvent({ type: 'factor_value_edit', payload: { target_id: BYSTANDER, value: 0.25, field: 'value' } })
        .catch(() => undefined)
      await flush()
    })
    expect(dispatched).toHaveLength(1)

    // ⭐ RED at 28d2745e (and RED if the dispatcher's in-flight mark is removed).
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push({ ok: true, response: { assistant_text: 'ok', blocks: [] } })
    await settleTurn(send)
  })

  it('a registration ARMED while an edit is on the wire waits, then goes once — after delivery settles', async () => {
    const hook = await mountAcknowledgedStarter()
    holdTurn = true
    const { send } = await commitValueEdit(hook, USER_VALUE)

    // A graph-replacement site arms the train mid-edit (the store field every
    // replacement site derives). Nothing may leave while the edit is unanswered.
    await act(async () => {
      useCanvasStore.setState({ importPendingServerRegistration: true })
      await flush()
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push(APPLIED(USER_VALUE))
    await settleTurn(send)

    // ⭐ Offered exactly once, AFTER the receipt — so it carries the value the
    //    server confirmed, under the user's name, never Olumi's.
    expect(registerSpy).toHaveBeenCalledTimes(2)
    expect(registeredTarget(registerSpy.mock.calls[1])).toMatchObject({
      value: USER_VALUE,
      source: 'user_override',
    })
  })

  it('an edit admitted while a registration awaits its last hop wins — the POST stands down and goes after', async () => {
    const hook = await mountAcknowledgedStarter()

    // Arm a registration and hold it inside its identity await.
    let openIdentity: () => void = () => {}
    identityGate = new Promise<void>((res) => { openIdentity = res })
    await act(async () => {
      writeOptimistically(BYSTANDER, 0.3) // local-only: nothing in flight, so it arms
      await flush()
    })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
    expect(registerSpy).toHaveBeenCalledTimes(1)

    // The user edits while that registration is still on its way out.
    holdTurn = true
    const { send } = await commitValueEdit(hook, USER_VALUE)
    await act(async () => {
      identityGate = null
      openIdentity()
      await flush()
    })

    // ⭐ The late check: RED if removed — the POST leaves while the edit turn is
    //    on the wire (the overlap CEE's CAS rolled the witnessed edit back on).
    //    It carries the PRE-edit snapshot, so the count is the discriminator
    //    here, not the value.
    expect(registrationsCarrying(USER_VALUE)).toEqual([])
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push(APPLIED(USER_VALUE))
    await settleTurn(send)

    // …and the stood-down registration is not lost: it goes once, after the
    // receipt, carrying only confirmed values.
    expect(registerSpy).toHaveBeenCalledTimes(2)
    expect(registeredTarget(registerSpy.mock.calls[1])).toMatchObject({
      value: USER_VALUE,
      source: 'user_override',
    })
  })

  it('CONTROL (#1855 preserved): a local-only change with NOTHING in flight still re-registers', async () => {
    await mountAcknowledgedStarter()

    await act(async () => {
      writeOptimistically(BYSTANDER, 0.3)
      await flush()
    })

    // The gate is "not while an edit is in flight", never "not at all": a
    // model the server has not seen, with nothing pending, is still offered.
    expect(registerSpy).toHaveBeenCalledTimes(2)
    const sent = (registerSpy.mock.calls[1][1] as { nodes: Array<Record<string, unknown>> }).nodes
    expect((sent.find((n) => n.id === BYSTANDER)?.observed_state as Record<string, unknown>).value).toBe(0.3)
  })
})

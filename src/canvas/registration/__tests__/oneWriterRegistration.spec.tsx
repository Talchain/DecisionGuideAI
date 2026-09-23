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
 *  8. An applied receipt carrying the committed graph acknowledges the model
 *     (#1895) — option edit.
 *  9. …and PAST the edit's own optimistic write — structural delete and
 *     rename (the 4c6ec07b witness), with fail-closed, refused and 500 controls.
 *
 * Assertions bind by IDENTITY — the exact register call and the exact factor's
 * `observed_state` in its payload — never by a count alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { clearImportRegistrationMarkers, isGraphServerAcknowledged } from '../../store/importRegistrationMarker'
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
import { editDeliveryHold } from '../editDeliveryHold'
import { useStructuralRenameEvents } from '../../conversation/useStructuralRenameEvents'
import { useStructuralDeleteEvents } from '../../conversation/useStructuralDeleteEvents'

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

// ═══════════════════════════════════════════════════════════════════════════
// UNRESOLVED STRUCTURAL EDIT — #1892 review (CHANGES_REQUIRED @ fc0c7d91).
//
// "A structural rename whose turn ends in an untyped 500 can still be persisted
// by the whole-graph registration after delivery settles." The rename keeps its
// optimistic label (the 500 arm is `unconfirmed`, never a revert), the queue and
// the wire mark clear, and the re-arm used to register the canvas — carrying a
// label CEE never confirmed. Delivery settling is not proof CEE accepted it.
// ═══════════════════════════════════════════════════════════════════════════

const NEW_LABEL = 'Adoption Friction RENAMED'

async function mountAcknowledgedStarterWithRenameDrain() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: STARTER_NODES as never,
    edges: STARTER_EDGES as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    lastServerGraphHash: 'aag_before_rename',
    lastAuthoritativeGraph: null,
    pendingStructuralRenames: [],
    structuralRenameLifecycle: [],
    _externalMutationActive: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(() => {
    useImportRegistration()
    const conversation = useConversation()
    useStructuralRenameEvents(conversation.sendSystemEvent as never)
    return conversation
  })
  await act(async () => { await flush() })
  expect(registerSpy).toHaveBeenCalledTimes(1)
  expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  return hook
}

function registeredLabel(call: unknown[]): unknown {
  const graph = call[1] as { nodes: Array<Record<string, unknown>> }
  return graph.nodes.find((n) => n.id === TARGET)?.label
}

describe('an UNRESOLVED structural edit holds registration after delivery settles', () => {
  it('⛔ rename → untyped 500 → queue and wire settle: NO later registration carries the unconfirmed label', async () => {
    await mountAcknowledgedStarterWithRenameDrain()
    replies.push(UNTYPED_500)
    await act(async () => {
      useCanvasStore.getState().updateNodeLabel(TARGET, NEW_LABEL)
      await flush()
    })
    // Preconditions, pinned: the turn went out, settled `unconfirmed`, the
    // optimistic label stayed (the 500 arm never reverts), and delivery cleared.
    expect(dispatched.some((p) => (p as { event?: { kind?: string } }).event?.kind === 'structural_rename')).toBe(true)
    const record = useCanvasStore.getState().structuralRenameLifecycle.find((r) => r.intent.nodeId === TARGET)
    expect(record?.status).toBe('unconfirmed')
    expect((useCanvasStore.getState().nodes.find((n) => n.id === TARGET)!.data as { label?: string }).label).toBe(NEW_LABEL)
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)

    await act(async () => { await flush() })
    expect(registerSpy.mock.calls.filter((c) => registeredLabel(c) === NEW_LABEL)).toEqual([])
  })

  it('CONTROL: an APPLIED rename progresses — committed, and nothing holds registration afterwards', async () => {
    await mountAcknowledgedStarterWithRenameDrain()
    replies.push({
      ok: true,
      response: {
        assistant_text: `Renamed to '${NEW_LABEL}'.`,
        blocks: [],
        graph_hash: 'aag_after_rename',
        draft_graph: {
          nodes: [
            { id: TARGET, kind: 'factor', label: NEW_LABEL },
            { id: BYSTANDER, kind: 'factor', label: 'Seat Price' },
          ],
          edges: [],
        },
      },
    })
    await act(async () => {
      useCanvasStore.getState().updateNodeLabel(TARGET, NEW_LABEL)
      await flush()
    })
    const record = useCanvasStore.getState().structuralRenameLifecycle.find((r) => r.intent.nodeId === TARGET)
    expect(record?.status).toBe('committed')
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
  })

  it('CONTROL: an unconfirmed rename stops holding once its optimistic label is gone from the canvas', async () => {
    await mountAcknowledgedStarterWithRenameDrain()
    replies.push(UNTYPED_500)
    await act(async () => {
      useCanvasStore.getState().updateNodeLabel(TARGET, NEW_LABEL)
      await flush()
    })
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBe('unresolved_structural_edit')
    // The optimistic label is replaced (e.g. a receipt overlaid CEE's label).
    act(() => {
      useCanvasStore.setState({
        nodes: useCanvasStore.getState().nodes.map((n) =>
          n.id === TARGET ? { ...n, data: { ...(n.data as object), label: 'Bottom-Up Adoption Friction' } } : n,
        ),
      } as never)
    })
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
  })
})

const renameApplied = (label: string) => ({
  ok: true,
  response: {
    assistant_text: `Renamed to '${label}'.`,
    blocks: [],
    graph_hash: `aag_after_${label.replace(/\W+/g, '_')}`,
    draft_graph: {
      nodes: [
        { id: TARGET, kind: 'factor', label },
        { id: BYSTANDER, kind: 'factor', label: 'Seat Price' },
      ],
      edges: [],
    },
  },
})

/** A proven-no-write refusal (409 `BASE_HASH_DIVERGED`) — the rename is rolled back. */
const RENAME_REFUSED_NO_WRITE = {
  kind: 'boundary_error',
  error: {
    error: 'GRAPH_DIVERGED', boundary: 'B1', direction: 'egress', validator: 'turn_commit',
    details: { phase: 'commit', failure_type: 'GRAPH_DIVERGED', event_kind: 'structural_rename', recovery_action: 'refresh_and_reconfirm', conflict_category: 'BASE_HASH_DIVERGED', expected_base_graph_hash: 'aag_other' },
    request_id: 'req_rename_409', retryable: false,
  },
}

describe('#1892 review (846997a1): only the LATEST attempt per node may hold', () => {
  it('⛔ rename "Foo" → untyped 500, "Bar" → applied, "Foo" → applied: the stale record does not wall registration off', async () => {
    await mountAcknowledgedStarterWithRenameDrain()
    const rename = async (label: string, reply: unknown) => {
      replies.push(reply)
      await act(async () => {
        useCanvasStore.getState().updateNodeLabel(TARGET, label)
        await flush()
      })
    }
    await rename('Foo', UNTYPED_500)
    await rename('Bar', renameApplied('Bar'))
    // Contrast, from the review's own run: after "Bar" the post-commit registration went.
    expect(registerSpy.mock.calls.some((c) => registeredLabel(c) === 'Bar')).toBe(true)
    const beforeFoo = registerSpy.mock.calls.length
    await rename('Foo', renameApplied('Foo'))
    await act(async () => { await flush() })

    // Preconditions, by identity: three attempts on ONE node, the last one committed.
    const attempts = useCanvasStore.getState().structuralRenameLifecycle
      .filter((r) => r.intent.nodeId === TARGET)
      .map((r) => `${r.intent.label}:${r.status}`)
    expect(attempts).toEqual(['Foo:unconfirmed', 'Bar:committed', 'Foo:committed'])
    expect((useCanvasStore.getState().nodes.find((n) => n.id === TARGET)!.data as { label?: string }).label).toBe('Foo')

    // CEE applied "Foo": nothing may still be holding for the superseded attempt…
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
    // …and nothing walls the model off. ⚠ The discriminator USED to be "a
    // registration carrying 'Foo' follows" — which is the post-commit register
    // the 4c6ec07b witness recorded as the defect (+70 ms after an applied
    // rename). "Bar" was acknowledged by its own registration, "Foo" is CEE's
    // committed postimage of that model, so the receipt acknowledges it: the
    // model is released with NO second write, not walled and not re-offered.
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
    expect(registerSpy.mock.calls.slice(beforeFoo)).toEqual([])
  })

  it('⛔ (#1892 review @ 9dac7d3e) "Foo" → untyped 500, then "Bar" REFUSED (rolls back to "Foo"): a refusal is not proof — Foo stays held', async () => {
    await mountAcknowledgedStarterWithRenameDrain()
    const rename = async (label: string, reply: unknown) => {
      replies.push(reply)
      await act(async () => {
        useCanvasStore.getState().updateNodeLabel(TARGET, label)
        await flush()
      })
    }
    await rename('Foo', UNTYPED_500)
    await rename('Bar', RENAME_REFUSED_NO_WRITE)
    // Preconditions, by identity: the refusal rolled the canvas back to the
    // UNCONFIRMED label, and the latest record is the refusal.
    const attempts = useCanvasStore.getState().structuralRenameLifecycle
      .filter((r) => r.intent.nodeId === TARGET)
      .map((r) => `${r.intent.label}:${r.status}`)
    expect(attempts).toEqual(['Foo:unconfirmed', 'Bar:refused'])
    expect((useCanvasStore.getState().nodes.find((n) => n.id === TARGET)!.data as { label?: string }).label).toBe('Foo')

    // A local-only change that would otherwise re-offer the model:
    await act(async () => {
      writeOptimistically(BYSTANDER, 0.25)
      await flush()
    })
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBe('unresolved_structural_edit')
    expect(registerSpy.mock.calls.filter((c) => registeredLabel(c) === 'Foo')).toEqual([])
    expect(analysisHeldOn(useCanvasStore.getState() as never)).not.toBeNull()
  })
})

describe('the unresolved-edit rule, pure', () => {
  const nodes = [{ id: 'n1', data: { label: 'New name' } }, { id: 'n2', data: { label: 'x' } }]
  const rename = (status: string, scenarioId: string | null, label = 'New name') => ({
    status, scenarioId, intent: { nodeId: 'n1', label },
  })
  it('an unconfirmed rename for THIS scenario, still on the canvas, holds', () => {
    expect(editDeliveryHold({ nodes, currentScenarioId: 's1', structuralRenameLifecycle: [rename('unconfirmed', 's1')] } as never))
      .toBe('unresolved_structural_edit')
  })
  it('CONTROL: another scenario\'s record, a committed one, or a refused one does not hold', () => {
    expect(editDeliveryHold({ nodes, currentScenarioId: 's1', structuralRenameLifecycle: [rename('unconfirmed', 's2')] } as never)).toBeNull()
    expect(editDeliveryHold({ nodes, currentScenarioId: 's1', structuralRenameLifecycle: [rename('committed', 's1')] } as never)).toBeNull()
    expect(editDeliveryHold({ nodes, currentScenarioId: 's1', structuralRenameLifecycle: [rename('refused', 's1')] } as never)).toBeNull()
  })
  it('#1892 review: a LATER settled attempt on the same node supersedes an earlier unconfirmed one', () => {
    const at = (status: string, label: string, scenarioId = 's1', nodeId = 'n1') => ({ status, scenarioId, intent: { nodeId, label } })
    const hold = (lifecycle: unknown[]) =>
      editDeliveryHold({ nodes, currentScenarioId: 's1', structuralRenameLifecycle: lifecycle } as never)
    // The review's sequence: "New name" 500, "B" applied, "New name" applied.
    expect(hold([at('unconfirmed', 'New name'), at('committed', 'B'), at('committed', 'New name')])).toBeNull()
    // #1892 review @ 9dac7d3e: a later REFUSAL is not proof — the unconfirmed
    // state is still what the canvas shows, so it still holds.
    expect(hold([at('unconfirmed', 'New name'), at('refused', 'B')])).toBe('unresolved_structural_edit')
    expect(hold([at('unconfirmed', 'New name'), at('refused', 'New name')])).toBe('unresolved_structural_edit')
    // …and a later commit of a DIFFERENT state does not establish this one.
    expect(hold([at('unconfirmed', 'New name'), at('committed', 'B')])).toBe('unresolved_structural_edit')
    // CONTROLS — latest-only is not "never hold":
    expect(hold([at('committed', 'New name'), at('unconfirmed', 'New name')])).toBe('unresolved_structural_edit')
    // another node's attempt supersedes nothing here…
    expect(hold([at('unconfirmed', 'New name'), at('committed', 'x', 's1', 'n2')])).toBe('unresolved_structural_edit')
    // …not even with the SAME label: a commit on another node establishes nothing here.
    expect(hold([at('unconfirmed', 'New name'), at('committed', 'New name', 's1', 'n2')])).toBe('unresolved_structural_edit')
    // …nor does the same node id in another scenario.
    expect(hold([at('unconfirmed', 'New name'), at('committed', 'New name', 's2')])).toBe('unresolved_structural_edit')
  })
  it('#1892 review, the ADD twin: a later settled add on the same node supersedes an earlier unconfirmed one', () => {
    const add = (status: string) => ({ status, scenarioId: 's1', intent: { nodeId: 'n2' } })
    const hold = (lifecycle: unknown[]) =>
      editDeliveryHold({ nodes, currentScenarioId: 's1', structuralAddLifecycle: lifecycle } as never)
    expect(hold([add('unconfirmed'), add('committed')])).toBeNull()
    expect(hold([add('committed'), add('unconfirmed')])).toBe('unresolved_structural_edit')
    expect(hold([add('unconfirmed'), add('refused')])).toBe('unresolved_structural_edit')
  })
  it('an unconfirmed ADD holds while its node is on the canvas, and not after it is gone', () => {
    const add = { status: 'unconfirmed', scenarioId: 's1', intent: { nodeId: 'n2' } }
    expect(editDeliveryHold({ nodes, currentScenarioId: 's1', structuralAddLifecycle: [add] } as never)).toBe('unresolved_structural_edit')
    expect(editDeliveryHold({ nodes: [nodes[0]], currentScenarioId: 's1', structuralAddLifecycle: [add] } as never)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. AN APPLIED RECEIPT THAT CARRIES THE COMMITTED GRAPH IS THE ACKNOWLEDGEMENT
//    — for EVERY kind, not only the factor value edit (#1892 residual 3).
//
// WITNESSED on served staging 23 Sep 00:12Z (UI 8f79c9e1, CEE 29ffda8a,
// `output/canvas-completion-20260923/LOG.md` § M1): an `option_intervention_edit`
// came back 200 with its committed `draft_graph`; the reconcile moved the
// canvas digest, the re-arm saw an unacknowledged held model, and 9 ms later a
// whole-graph `graph/register` wrote the canvas over CEE — stripping every
// option's provenance and moving CEE's hash so the NEXT edit was refused.
// ═══════════════════════════════════════════════════════════════════════════

const OPTION = 'opt_hybrid'

function starterOption(): Node {
  return {
    id: OPTION,
    type: 'option',
    position: { x: 0, y: 200 },
    data: {
      label: 'Hybrid Platform Fee Plus Usage',
      kind: 'option',
      starterId: 'pricing-model',
      provenance: 'ai_inferred',
      is_baseline: false,
      interventions: {
        [TARGET]: { value: 0.4, source: 'brief_extraction', display_value: 'Moderate (0.4)' },
      },
      interventionKeys: [TARGET],
    },
  } as unknown as Node
}

const optionEdit = (value: number): WireSystemEvent => ({
  type: 'option_intervention_edit',
  payload: { option_id: OPTION, factor_id: TARGET, value, base_graph_hash: 'aag_before_edit' },
})

/** CEE's applied option receipt: prose, no blocks, the committed graph on `draft_graph`. */
const APPLIED_OPTION = (value: number) => ({
  ok: true,
  response: {
    assistant_text: `Set Hybrid Platform Fee Plus Usage's Bottom-Up Adoption Friction to ${value}.`,
    blocks: [],
    graph_hash: 'aag_after_option_edit',
    draft_graph: {
      nodes: [
        {
          id: TARGET,
          kind: 'factor',
          label: 'Bottom-Up Adoption Friction',
          category: 'controllable',
          observed_state: { value: SERVER_VALUE, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
        },
        {
          id: BYSTANDER,
          kind: 'factor',
          label: 'Seat Price',
          category: 'controllable',
          observed_state: { value: 0.4, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
        },
        {
          id: OPTION,
          kind: 'option',
          label: 'Hybrid Platform Fee Plus Usage',
          is_baseline: false,
          interventions: {
            [TARGET]: {
              value,
              source: 'user_specified',
              target_match: { node_id: TARGET, confidence: 'high', match_type: 'exact_id' },
            },
          },
        },
      ],
      edges: [{ id: `${TARGET}::${BYSTANDER}::0`, from: TARGET, to: BYSTANDER, strength: { mean: -0.6 } }],
    },
  },
})

async function mountAcknowledgedStarterWithOption() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [...STARTER_NODES, starterOption()] as never,
    edges: STARTER_EDGES as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    lastServerGraphHash: 'aag_before_edit',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(() => {
    useImportRegistration()
    return useConversation()
  })
  await act(async () => { await flush() })
  expect(registerSpy).toHaveBeenCalledTimes(1)
  expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  return hook
}

function registeredOption(call: unknown[]): Record<string, unknown> | undefined {
  const graph = call[1] as { nodes: Array<Record<string, unknown>> }
  return graph.nodes.find((n) => n.id === OPTION)?.interventions as Record<string, unknown> | undefined
}

describe('8 · an applied receipt carrying the committed graph acknowledges the model — no post-settle registration', () => {
  it('an APPLIED option-target edit sends NO whole-graph registration after it settles', async () => {
    const hook = await mountAcknowledgedStarterWithOption()
    replies.push(APPLIED_OPTION(0.6))
    await act(async () => {
      await hook.result.current.sendSystemEvent(optionEdit(0.6)).catch(() => undefined)
      await flush()
    })

    // The receipt landed on the canvas (the precondition, bound by identity)…
    const iv = (useCanvasStore.getState().nodes.find((n) => n.id === OPTION)!.data as Record<string, unknown>)
      .interventions as Record<string, unknown>
    expect((iv[TARGET] as { value?: number } | number)).toBeDefined()
    // …and the ONLY registration is the one that acknowledged the starter.
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(registeredOption(registerSpy.mock.calls[0])?.[TARGET]).toMatchObject({ value: 0.4 })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  })

  it('CONTROL: an unacknowledged local change made while the edit is in flight keeps the chain closed — the model is re-offered', async () => {
    const hook = await mountAcknowledgedStarterWithOption()
    holdTurn = true
    let send: Promise<unknown> = Promise.resolve()
    await act(async () => {
      send = hook.result.current.sendSystemEvent(optionEdit(0.6)).catch(() => undefined)
      await flush()
    })
    // While the turn is on the wire, a local-only analytical change nobody
    // sent: the registration is held (one writer), and G₀ is no longer the
    // model CEE acknowledged.
    await act(async () => {
      writeOptimistically(BYSTANDER, 0.9)
      await flush()
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push(APPLIED_OPTION(0.6))
    await settleTurn(send)

    // Fail CLOSED: the receipt does not vouch for a canvas it never saw, so a
    // registration offers the model once delivery settles (#1855 preserved).
    expect(registerSpy.mock.calls.length).toBeGreaterThan(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9. THE EDIT'S OWN OPTIMISTIC WRITE IS NOT A STRANGER — structural delete and
//    rename (the #1895 residual).
//
// WITNESSED on served staging 23 Sep 09:29–09:51Z (UI 4c6ec07b, pricing
// example, `output/canvas-completion-20260923/WITNESS-1895-4c6ec07b.md`):
// option edits sent 0 post-settle registrations, but an APPLIED
// `structural_rename` (draft_graph 15/30) was followed by a whole-graph
// `graph/register` at +70 ms and an APPLIED `structural_delete` (draft_graph
// 14/28, "Top Account Revenue Concentration" and its 2 connections) at +51 ms.
// Both gestures write the canvas BEFORE their turn is sent, so the canvas just
// before the receipt already carries the edit's own write, is unacknowledged,
// and #1895's chain never fired.
//
// The rule these pin: CEE held G₀ (the canvas before THIS edit's own write) ∧
// CEE applied this edit and returned its committed postimage ∧ the canvas is
// reconciled to it ⇒ CEE holds the canvas. Fail CLOSED on anything else.
// ═══════════════════════════════════════════════════════════════════════════

/** The witnessed delete target: a factor with two connections. */
const CONCENTRATION = 'fac_top_account_concentration'
const RENAMED = 'Competitor Usage-Pricing Pressure'

const STRUCTURAL_NODES: Node[] = [
  ...STARTER_NODES,
  starterFactor(CONCENTRATION, 'Top Account Revenue Concentration', 0.6, 'High (0.6)'),
]
const STRUCTURAL_EDGES: Edge[] = [
  ...STARTER_EDGES,
  { id: `e_${CONCENTRATION}_${TARGET}`, source: CONCENTRATION, target: TARGET, data: { weight: 0.3, direction: 'positive' } } as unknown as Edge,
  { id: `e_${CONCENTRATION}_${BYSTANDER}`, source: CONCENTRATION, target: BYSTANDER, data: { weight: 0.4, direction: 'negative' } } as unknown as Edge,
]

/** CEE's committed graph for this board, as the receipt's `draft_graph` carries it. */
function committedGraph(opts: { without?: string; labelOf?: Record<string, string> } = {}) {
  const wireFactor = (id: string, label: string, value: number) => ({
    id,
    kind: 'factor',
    label: opts.labelOf?.[id] ?? label,
    category: 'controllable',
    observed_state: { value, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' },
  })
  const nodes = [
    wireFactor(TARGET, 'Bottom-Up Adoption Friction', SERVER_VALUE),
    wireFactor(BYSTANDER, 'Seat Price', 0.4),
    wireFactor(CONCENTRATION, 'Top Account Revenue Concentration', 0.6),
  ].filter((n) => n.id !== opts.without)
  const edges = [
    { from: TARGET, to: BYSTANDER, strength: { mean: -0.6 } },
    { from: CONCENTRATION, to: TARGET, strength: { mean: 0.3 } },
    { from: CONCENTRATION, to: BYSTANDER, strength: { mean: -0.4 } },
  ].filter((e) => e.from !== opts.without && e.to !== opts.without)
  return { nodes, edges }
}

/** 200 `structural_delete`: prose, `blocks: []`, the committed graph WITHOUT the node (witness step 4). */
const DELETE_APPLIED = {
  ok: true,
  response: {
    assistant_text: "Removed 'Top Account Revenue Concentration' along with 2 connections. That change is saved.",
    blocks: [],
    graph_hash: 'aag_after_delete',
    draft_graph: committedGraph({ without: CONCENTRATION }),
  },
}

/** 200 `structural_rename`: prose, `blocks: []`, the committed graph at the new label (witness step 2). */
const RENAME_APPLIED = {
  ok: true,
  response: {
    assistant_text: `Renamed 'Bottom-Up Adoption Friction' to '${RENAMED}'. That change is saved.`,
    blocks: [],
    graph_hash: 'aag_after_rename',
    draft_graph: committedGraph({ labelOf: { [TARGET]: RENAMED } }),
  },
}

/** A proven-no-write refusal of the delete (409 `BASE_HASH_DIVERGED`). */
const DELETE_REFUSED_NO_WRITE = {
  kind: 'boundary_error',
  error: {
    error: 'GRAPH_DIVERGED', boundary: 'B1', direction: 'egress', validator: 'turn_commit',
    details: { phase: 'commit', failure_type: 'GRAPH_DIVERGED', event_kind: 'structural_delete', recovery_action: 'refresh_and_reconfirm', conflict_category: 'BASE_HASH_DIVERGED', expected_base_graph_hash: 'aag_other' },
    request_id: 'req_delete_409', retryable: false,
  },
}

async function mountAcknowledgedStructuralBoard() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: STRUCTURAL_NODES as never,
    edges: STRUCTURAL_EDGES as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    lastServerGraphHash: 'aag_before_structural_edit',
    lastAuthoritativeGraph: null,
    pendingStructuralDeletes: [],
    pendingStructuralRenames: [],
    structuralRenameLifecycle: [],
    _externalMutationActive: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(() => {
    useImportRegistration()
    const conversation = useConversation()
    useStructuralDeleteEvents(conversation.sendSystemEvent as never)
    useStructuralRenameEvents(conversation.sendSystemEvent as never)
    return conversation
  })
  await act(async () => { await flush() })
  // PRECONDITIONS: the board was registered ONCE, and that acknowledgement
  // released the hold — G₀ is a model CEE holds.
  expect(registerSpy).toHaveBeenCalledTimes(1)
  expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  return hook
}

function registeredGraph(call: unknown[]) {
  return call[1] as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> }
}
function nodeIdsOf(call: unknown[]): string[] {
  return registeredGraph(call).nodes.map((n) => String(n.id)).sort()
}
function touches(call: unknown[], id: string): boolean {
  return registeredGraph(call).edges.some((e) => (e.from ?? e.source) === id || (e.to ?? e.target) === id)
}
function currentAcknowledged(): boolean {
  const s = useCanvasStore.getState()
  return isGraphServerAcknowledged(s.currentScenarioId, s.nodes as never, s.edges as never)
}
function sentKinds(): unknown[] {
  return dispatched.map((p) => (p as { event?: { kind?: string } }).event?.kind)
}

async function deleteConcentration() {
  await act(async () => {
    useCanvasStore.getState().deleteNodeById(CONCENTRATION)
    await flush()
  })
}
async function renameTarget() {
  await act(async () => {
    useCanvasStore.getState().updateNodeLabel(TARGET, RENAMED)
    await flush()
  })
}
async function releaseHeldTurn() {
  await act(async () => {
    releaseTurn?.()
    await flush()
    await flush()
  })
}

describe('9 · an applied receipt acknowledges the model PAST the edit\'s own optimistic write', { timeout: 30_000 }, () => {
  it('⭐ an APPLIED structural_delete (committed graph without the node) sends NO registration after it settles, and the model is acknowledged', async () => {
    await mountAcknowledgedStructuralBoard()
    replies.push(DELETE_APPLIED)
    await deleteConcentration()

    // PRECONDITIONS, by identity: the delete went out as ONE durable turn for
    // this node, and the canvas carries exactly what CEE committed.
    expect(sentKinds()).toEqual(['structural_delete'])
    expect((dispatched[0] as { event?: { removed_node_ids?: string[] } }).event?.removed_node_ids).toEqual([CONCENTRATION])
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual([BYSTANDER, TARGET].sort())
    expect(useCanvasStore.getState().edges).toHaveLength(1)

    // ⭐ THE CLAIM. RED at 4c6ec07b: a whole-graph registration follows (+51 ms served).
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
    expect(currentAcknowledged()).toBe(true)
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('⭐ an APPLIED structural_rename (committed graph at the new label) sends NO registration after it settles, and the model is acknowledged', async () => {
    await mountAcknowledgedStructuralBoard()
    replies.push(RENAME_APPLIED)
    await renameTarget()

    // PRECONDITIONS: one rename turn, committed, and the canvas shows the name.
    expect(sentKinds()).toEqual(['structural_rename'])
    const record = useCanvasStore.getState().structuralRenameLifecycle.find((r) => r.intent.nodeId === TARGET)
    expect(record?.status).toBe('committed')
    expect(nodeData(TARGET).label).toBe(RENAMED)

    // ⭐ THE CLAIM. RED at 4c6ec07b: a whole-graph registration follows (+70 ms served).
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
    expect(currentAcknowledged()).toBe(true)
  })

  it('CONTROL (fail closed): a local change made while the DELETE is in flight is re-offered — carrying nothing of the deleted node', async () => {
    await mountAcknowledgedStructuralBoard()
    holdTurn = true
    await deleteConcentration()
    expect(sentKinds()).toEqual(['structural_delete'])
    // A local-only analytical change nobody sent, made while the turn is out.
    await act(async () => {
      writeOptimistically(BYSTANDER, 0.9)
      await flush()
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push(DELETE_APPLIED)
    const before = registerSpy.mock.calls.length
    await releaseHeldTurn()

    // G₀ rolled back is still not a model CEE holds, so the receipt vouches
    // for nothing and the model is offered once delivery settles (#1855).
    const offered = registerSpy.mock.calls.slice(before)
    expect(offered.length).toBeGreaterThan(0)
    // …and what is offered is CEE's postimage plus that change — the deleted
    // node and its two connections are in none of it.
    for (const call of offered) {
      expect(nodeIdsOf(call)).toEqual([BYSTANDER, TARGET].sort())
      expect(touches(call, CONCENTRATION)).toBe(false)
    }
  })

  it('CONTROL (fail closed): a local change made while the RENAME is in flight is re-offered — at the committed label', async () => {
    await mountAcknowledgedStructuralBoard()
    holdTurn = true
    await renameTarget()
    expect(sentKinds()).toEqual(['structural_rename'])
    await act(async () => {
      writeOptimistically(BYSTANDER, 0.9)
      await flush()
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push(RENAME_APPLIED)
    const before = registerSpy.mock.calls.length
    await releaseHeldTurn()

    const offered = registerSpy.mock.calls.slice(before)
    expect(offered.length).toBeGreaterThan(0)
    for (const call of offered) expect(registeredLabel(call)).toBe(RENAMED)
  })

  it('CONTROL: a REFUSED delete (409 BASE_HASH_DIVERGED) is never acknowledged — the node comes back and nothing is written', async () => {
    await mountAcknowledgedStructuralBoard()
    replies.push(DELETE_REFUSED_NO_WRITE)
    await deleteConcentration()

    // PRECONDITION: the refusal reverted the gesture (CEE certified no write).
    expect(useCanvasStore.getState().nodes.some((n) => n.id === CONCENTRATION)).toBe(true)
    // The post-delete model is not one CEE holds — the contrast is the board it does.
    const withoutNode = STRUCTURAL_NODES.filter((n) => n.id !== CONCENTRATION)
    const withoutEdges = STRUCTURAL_EDGES.filter((e) => e.source !== CONCENTRATION && e.target !== CONCENTRATION)
    expect(isGraphServerAcknowledged(SCENARIO, STRUCTURAL_NODES as never, STRUCTURAL_EDGES as never)).toBe(true)
    expect(isGraphServerAcknowledged(SCENARIO, withoutNode as never, withoutEdges as never)).toBe(false)
    expect(registerSpy.mock.calls.filter((c) => !nodeIdsOf(c).includes(CONCENTRATION))).toEqual([])
  })

  it('CONTROL: a REFUSED rename (409 BASE_HASH_DIVERGED) is never acknowledged — the old name comes back and nothing is written', async () => {
    await mountAcknowledgedStructuralBoard()
    replies.push(RENAME_REFUSED_NO_WRITE)
    await renameTarget()

    expect(nodeData(TARGET).label).toBe('Bottom-Up Adoption Friction')
    const renamedNodes = STRUCTURAL_NODES.map((n) =>
      n.id === TARGET ? { ...n, data: { ...(n.data as object), label: RENAMED } } : n,
    )
    expect(isGraphServerAcknowledged(SCENARIO, renamedNodes as never, STRUCTURAL_EDGES as never)).toBe(false)
    expect(registerSpy.mock.calls.filter((c) => registeredLabel(c) === RENAMED)).toEqual([])
  })

  it('CONTROL: an untyped 500 on the DELETE is never acknowledged by the receipt path', async () => {
    await mountAcknowledgedStructuralBoard()
    // Hold any registration at its last hop, so an acknowledgement could only
    // have come from the turn's own handling.
    let openIdentity: () => void = () => {}
    identityGate = new Promise<void>((res) => { openIdentity = res })
    replies.push(UNTYPED_500)
    await deleteConcentration()

    // PRECONDITION: the 500 arm keeps the deletion on screen ("couldn't confirm").
    expect(useCanvasStore.getState().nodes.some((n) => n.id === CONCENTRATION)).toBe(false)
    expect(currentAcknowledged()).toBe(false)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).not.toBeNull()
    await act(async () => {
      identityGate = null
      openIdentity()
      await flush()
    })
  })

  it('CONTROL: an untyped 500 on the RENAME is never acknowledged, and no registration carries the label', async () => {
    await mountAcknowledgedStructuralBoard()
    replies.push(UNTYPED_500)
    await renameTarget()

    const record = useCanvasStore.getState().structuralRenameLifecycle.find((r) => r.intent.nodeId === TARGET)
    expect(record?.status).toBe('unconfirmed')
    expect(nodeData(TARGET).label).toBe(RENAMED)
    expect(currentAcknowledged()).toBe(false)
    expect(registerSpy.mock.calls.filter((c) => registeredLabel(c) === RENAMED)).toEqual([])
  })
})

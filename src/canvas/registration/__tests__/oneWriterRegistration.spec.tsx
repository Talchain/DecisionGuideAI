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
 * 10. An UNCONFIRMED delete (untyped 500) holds registration after delivery
 *     settles — #1905's residual 1 — with applied, refused, latest-attempt and
 *     other-scenario controls.
 * 11. EVERY exit of a delete turn settles it — a user preempt, an AbortError,
 *     a resolved-but-aborted call and the scenario fence (Panel's #1905 item 1)
 *     — while D1–D5, the arms that already resolve, gain no second notice.
 * 12. A LATER applied receipt that proves the removal releases the hold
 *     (Panel's #1905 item 2) — ALL removed elements absent, same scenario,
 *     overlapping graph; each guard has its own case.
 * 13. The delete hold's ONE exit — "ask Olumi to remove it" — releases it
 *     through the chat, whichever way CEE's committed graph answers (Panel
 *     #1917 F1), with a no-receipt control.
 * 9c. An APPLIED goal target: the receipt's OWN `analysis_ready` backfill is
 *     part of the receipt, not a stranger — no whole-graph register follows,
 *     with a fail-closed local-change control.
 *
 * Assertions bind by IDENTITY — the exact register call and the exact factor's
 * `observed_state` in its payload — never by a count alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { clearImportRegistrationMarkers, isGraphServerAcknowledged } from '../../store/importRegistrationMarker'
import { analysisHeldOn, heldReason } from '../../utils/analysisHeldOnInjectedModel'
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
/**
 * Hold the NEXT turn until its OWN `AbortSignal` fires — a real preempt, not a
 * simulated one. Its two endings are the two ways `callV5Turn` can leave an
 * aborted request: `'reject'` is `fetch` rejecting `AbortError`; `'resolve'` is
 * a body already buffered, so the promise RESOLVES while the signal reads
 * aborted and `sendTurn` leaves through its in-try `aborted` return (see
 * `optimisticFactorEditInterrupted.spec`, which names both).
 */
let abortableNext: 'reject' | 'resolve' | null = null
/** An abort shaped exactly as `sendTurn` classifies it (`err.name === 'AbortError'`). */
function abortError(): Error {
  const e = new Error('The operation was aborted.')
  e.name = 'AbortError'
  return e
}
/** A queued reply that makes the transport THROW instead of answering. */
const THROWS = (err: Error) => ({ __throws: err })
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>, opts?: { signal?: AbortSignal }) => {
      dispatched.push(payload)
      if (abortableNext) {
        const ending = abortableNext
        abortableNext = null
        await new Promise<void>((res, rej) => {
          const signal = opts?.signal
          if (!signal) return rej(new Error('an abortable hold needs the turn signal'))
          const settle = () => (ending === 'resolve' ? res() : rej(abortError()))
          if (signal.aborted) return settle()
          signal.addEventListener('abort', settle, { once: true })
        })
      } else if (holdTurn) {
        await new Promise<void>((res) => { releaseTurn = res })
      }
      const queued = replies.shift() ?? { ok: true, response: { assistant_text: 'ok', blocks: [] } }
      // A reply may be built FROM the request: an add's committed graph must
      // carry the node id the gesture minted, which the test cannot know first.
      const reply = typeof queued === 'function' ? (queued as (p: Record<string, unknown>) => unknown)(payload) : queued
      if (reply && typeof reply === 'object' && '__throws' in reply) {
        throw (reply as { __throws: Error }).__throws
      }
      return reply
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
import { useStructuralAddEvents } from '../../conversation/useStructuralAddEvents'
import { useStructuralAddEdgeEvents } from '../../conversation/useStructuralAddEdgeEvents'
import {
  __resetUnconfirmedDeletesForTest,
  settleStructuralDeleteAttempt,
  settleUnconfirmedDeletesProvenByReceipt,
} from '../../conversation/unconfirmedStructuralDelete'
import { __resetBootGraphReadForTest } from '../../hydrate/bootGraphRead'
import { recordSettledBootRead } from './__helpers__/settledBootRead'
import { STRUCTURAL_DELETE_NOTICE } from '../../mutations/structuralDelete'
import { buildGoalTargetEditEvent } from '../../conversation/goalTargetEdit'

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
  // PRODUCTION'S CONFIGURATION: the Canvas route's boot read of this scenario
  // has answered — CEE holds the starter it just acknowledged (#1903 B2: the
  // re-arm waits while no read is recorded, so without this every case below
  // would stand in a state the app never settles in).
  recordSettledBootRead(SCENARIO, STARTER_NODES, STARTER_EDGES)
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

/** Every canvas toast raised during the case, by its exact message. */
const toastLog: string[] = []
function onToast(e: Event) {
  toastLog.push(String((e as CustomEvent<{ message?: unknown }>).detail?.message))
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  registerSpy.mockReset()
  registerSpy.mockResolvedValue(ACK)
  dispatched.length = 0
  replies.length = 0
  holdTurn = false
  releaseTurn = null
  abortableNext = null
  toastLog.length = 0
  window.addEventListener('topbar:show-toast', onToast)
  identityGate = null
  clearImportRegistrationMarkers()
  __resetPendingFactorEditsForTest()
  __resetUnconfirmedDeletesForTest()
  __resetPersistenceSessionForTests()
  __resetBootGraphReadForTest()
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
  abortableNext = null
  releaseTurn?.()
  releaseTurn = null
  await flush()
  window.removeEventListener('topbar:show-toast', onToast)
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
  recordSettledBootRead(SCENARIO, STARTER_NODES, STARTER_EDGES) // see mountAcknowledgedStarter
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
  recordSettledBootRead(SCENARIO, [...STARTER_NODES, starterOption()], STARTER_EDGES) // see mountAcknowledgedStarter
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
function committedGraph(
  opts: { without?: string; withoutEdge?: [string, string]; labelOf?: Record<string, string> } = {},
) {
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
  ]
    .filter((e) => e.from !== opts.without && e.to !== opts.without)
    .filter((e) => !(opts.withoutEdge && e.from === opts.withoutEdge[0] && e.to === opts.withoutEdge[1]))
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

// ═══════════════════════════════════════════════════════════════════════════
// 10. AN UNCONFIRMED DELETE HOLDS REGISTRATION — #1905's residual 1, the delete
//     twin of §7's unresolved rename/add hold.
//
// #1905's author, verified on base and head: "An untyped 500 on delete still
// leaks through registration. Once delivery settles, one whole-graph register
// carries the post-delete canvas and acknowledges it. Delete has no lifecycle
// hold, unlike rename and add." The 500 arm KEEPS the deletion on the canvas
// (`resolveStructuralDelete`: the server may have committed), so the next
// whole-graph `graph/register` omits the node and CEE deletes it through the
// side channel — a deletion its own edit protocol never confirmed becomes
// canonical. The rule: no user edit reaches CEE behind the canonical path.
// ═══════════════════════════════════════════════════════════════════════════

const OTHER_SCENARIO = '0b6f1c2e-5d3a-4e8f-9a1b-7c2d3e4f5a6b'

/** Every registration that carried the canvas WITHOUT the deleted node — by identity. */
function registeredWithoutConcentration(scenario = SCENARIO) {
  return registerSpy.mock.calls.filter((c) => c[0] === scenario && !nodeIdsOf(c).includes(CONCENTRATION))
}
function concentrationOnCanvas(): boolean {
  return useCanvasStore.getState().nodes.some((n) => n.id === CONCENTRATION)
}
function removedNodeIdsSent(): unknown[] {
  return dispatched.map((p) => (p as { event?: { removed_node_ids?: string[] } }).event?.removed_node_ids)
}

/** Delete CONCENTRATION against `reply`, then let delivery settle completely. */
async function deleteConcentrationAndSettle(reply: unknown) {
  replies.push(reply)
  await deleteConcentration()
  await act(async () => { await flush() })
}

describe('10 · an UNCONFIRMED delete holds registration after delivery settles (#1905 residual 1)', { timeout: 30_000 }, () => {
  it('⛔ delete → untyped 500 → delivery settles: NO whole-graph registration carries the post-delete canvas, and the model stays held', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)

    // PRECONDITIONS, by identity: ONE structural_delete turn for THIS node went
    // out; the 500 arm kept the deletion on screen ("couldn't confirm"); and
    // the queue has drained.
    expect(sentKinds()).toEqual(['structural_delete'])
    expect(removedNodeIdsSent()).toEqual([[CONCENTRATION]])
    expect(concentrationOnCanvas()).toBe(false)
    expect(useCanvasStore.getState().pendingStructuralDeletes).toHaveLength(0)

    // ⛔ THE CLAIM. RED at c0611192 (#1905's head): once delivery settles, one
    // whole-graph register carries the canvas without the node, and its ack
    // makes the unconfirmed deletion look like a model CEE holds.
    await act(async () => { await flush() })
    expect(registeredWithoutConcentration()).toEqual([])
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(false)
    // …and the model stays held, under the unresolved-structural-edit cause.
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBe('unresolved_structural_edit')
    expect(analysisHeldOn(useCanvasStore.getState() as never)).not.toBeNull()
  })

  it('CONTROL (#1905 preserved): an APPLIED delete (receipt proves it) releases — no hold, no registration, the post-delete model acknowledged', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(DELETE_APPLIED)

    expect(sentKinds()).toEqual(['structural_delete'])
    expect(concentrationOnCanvas()).toBe(false)
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(true)
  })

  it('CONTROL: a REFUSED delete (409, proven no-write) reverts — released, and the post-delete canvas is never acknowledged or registered', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(DELETE_REFUSED_NO_WRITE)

    expect(sentKinds()).toEqual(['structural_delete'])
    // The refusal restored the node (CEE certified no write) …
    expect(concentrationOnCanvas()).toBe(true)
    // … so nothing holds: the canvas shows no deletion to protect.
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
    const withoutNode = STRUCTURAL_NODES.filter((n) => n.id !== CONCENTRATION)
    const withoutEdges = STRUCTURAL_EDGES.filter((e) => e.source !== CONCENTRATION && e.target !== CONCENTRATION)
    expect(isGraphServerAcknowledged(SCENARIO, withoutNode as never, withoutEdges as never)).toBe(false)
    expect(registeredWithoutConcentration()).toEqual([])
  })

  it('LATEST ATTEMPT: an unconfirmed delete, the node restored, then an APPLIED delete of the same node — the earlier record is settled, nothing holds', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBe('unresolved_structural_edit')

    // The node comes back (an undo, or a boot merge of CEE's graph): the canvas
    // no longer shows the unconfirmed deletion, so it releases.
    await act(async () => {
      useCanvasStore.setState({ nodes: STRUCTURAL_NODES as never, edges: STRUCTURAL_EDGES as never } as never)
      await flush()
    })
    expect(concentrationOnCanvas()).toBe(true)
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()

    // A later delete of the SAME node that CEE proves applied supersedes the
    // stale record — otherwise the node's absence would match it again and
    // wall registration off for the rest of the page's life.
    await deleteConcentrationAndSettle(DELETE_APPLIED)
    expect(sentKinds()).toEqual(['structural_delete', 'structural_delete'])
    expect(concentrationOnCanvas()).toBe(false)
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
    expect(currentAcknowledged()).toBe(true)
    expect(registeredWithoutConcentration()).toEqual([])
  })

  it('SCOPE: another scenario is unaffected — its board, without that node id, still registers', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBe('unresolved_structural_edit')

    // The user opens a different decision whose model happens not to carry
    // that id either, and it needs registering.
    await act(async () => {
      useCanvasStore.setState({
        currentScenarioId: OTHER_SCENARIO,
        nodes: STARTER_NODES as never,
        edges: STARTER_EDGES as never,
        importPendingServerRegistration: true,
      } as never)
      await flush()
    })
    expect(editDeliveryHold(useCanvasStore.getState() as never)).toBeNull()
    const other = registerSpy.mock.calls.filter((c) => c[0] === OTHER_SCENARIO)
    expect(other).toHaveLength(1)
    expect(nodeIdsOf(other[0])).toEqual([BYSTANDER, TARGET].sort())
    // …and the held scenario's post-delete canvas still went nowhere.
    expect(registeredWithoutConcentration(SCENARIO)).toEqual([])
  })
})

describe('10 · the unconfirmed-delete rule, pure (through `editDeliveryHold`)', () => {
  const del = (nodeIds: string[], edgeIds: string[] = []) =>
    ({ claimedNodeIds: nodeIds, claimedEdgeIds: edgeIds }) as never
  const hold = (nodes: string[], scenario: string | null, edges: string[] = []) =>
    editDeliveryHold({
      nodes: nodes.map((id) => ({ id })),
      edges: edges.map((id) => ({ id })),
      currentScenarioId: scenario,
    } as never)

  it('holds only for the scenario it was made in, and only while every removed element is still absent', () => {
    settleStructuralDeleteAttempt(del(['n9']), 's2', 'unconfirmed')
    expect(hold(['n1'], 's1')).toBeNull()
    expect(hold(['n1'], 's2')).toBe('unresolved_structural_edit')
    expect(hold(['n1', 'n9'], 's2')).toBeNull()
  })

  it('an edge-only unconfirmed delete holds while the edge is gone; a REVERTED attempt releases nothing, a PROVEN one supersedes', () => {
    settleStructuralDeleteAttempt(del([], ['e7']), 's1', 'unconfirmed')
    expect(hold([], 's1', ['e1'])).toBe('unresolved_structural_edit')
    // #1892 review @ 9dac7d3e, delete form: a refusal is not proof.
    settleStructuralDeleteAttempt(del([], ['e7']), 's1', 'reverted')
    expect(hold([], 's1', ['e1'])).toBe('unresolved_structural_edit')
    settleStructuralDeleteAttempt(del([], ['e7']), 's1', 'proven')
    expect(hold([], 's1', ['e1'])).toBeNull()
  })

  it('SCOPE: a PROVEN delete of the same id in ANOTHER scenario settles nothing here', () => {
    settleStructuralDeleteAttempt(del(['n9']), 's1', 'unconfirmed')
    settleStructuralDeleteAttempt(del(['n9']), 's2', 'proven')
    expect(hold(['n1'], 's1')).toBe('unresolved_structural_edit')
  })

  it('CONTROL: a reverted or a proven attempt with no earlier record holds nothing', () => {
    settleStructuralDeleteAttempt(del(['n9']), 's1', 'reverted')
    settleStructuralDeleteAttempt(del(['n8']), 's1', 'proven')
    expect(hold(['n1'], 's1')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 11. EVERY EXIT SETTLES A DELETE — Panel's APPROVE on #1905, item 1.
//
// The 500 arm records an unconfirmed delete; three other exits never reach it:
// the catch resolves `structural_delete` only when `!isAbort`, the response
// arm needs `activeV5TurnIdRef.current === turnClientId`, and the scenario
// fence returns first. On each, NOTHING records the attempt, so once delivery
// settles one whole-graph `graph/register` carries the post-delete canvas and
// its ack makes a deletion CEE may have refused canonical (Panel D6: payload
// `[fac_adoption_friction, fac_seat_price]`). The abort is local; CEE does not
// cancel. D1–D5 are the arms that already resolve — they must not be touched,
// and in particular must not gain a second notice.
// ═══════════════════════════════════════════════════════════════════════════

/** A typed 409 whose category carries NO no-write guarantee (Panel D3). */
const DELETE_409_UNKNOWN_CATEGORY = {
  kind: 'boundary_error',
  error: {
    ...DELETE_REFUSED_NO_WRITE.error,
    details: { ...DELETE_REFUSED_NO_WRITE.error.details, conflict_category: 'SOME_FUTURE_CATEGORY' },
    request_id: 'req_delete_409_unknown',
  },
}
/** 200 whose committed graph still HOLDS the node — the receipt refutes the delete (Panel D4). */
const DELETE_200_REFUTED = {
  ok: true,
  response: {
    assistant_text: "I couldn't find everything you deleted in the saved model, so I haven't removed anything. Reload it and try again.",
    blocks: [],
    graph_hash: 'aag_after_refused_delete',
    draft_graph: committedGraph(),
  },
}
/** 200 with NO committed graph — the removal is unproven (Panel D5). */
const DELETE_200_UNPROVEN = {
  ok: true,
  response: {
    assistant_text: "I couldn't confirm that change in the saved model, so I haven't removed anything.",
    blocks: [],
  },
}

type Hook = Awaited<ReturnType<typeof mountAcknowledgedStructuralBoard>>

function syntheticNotices(hook: Hook): string[] {
  return hook.result.current.messages
    .filter((m) => m.role === 'assistant' && m.synthetic === true)
    .map((m) => String(m.content))
}
function heldCause(): unknown {
  return editDeliveryHold(useCanvasStore.getState() as never)
}
/** The user sends a chat message: `mode: 'user'` preempts, aborting the turn in flight. */
async function userSends(hook: Hook, text: string) {
  await act(async () => {
    void hook.result.current.sendMessage(text).catch(() => undefined)
    await flush()
  })
}
function userTurnsSent(): number {
  return dispatched.filter((p) => (p as { event?: unknown }).event === undefined).length
}

describe('11 · every exit of a delete turn settles it (Panel #1905 item 1)', { timeout: 30_000 }, () => {
  it('⛔ D6 — the user sends a chat message while the delete is on the wire (the preempt aborts it): NO registration carries the post-delete canvas, the model stays held, the user is told', async () => {
    const hook = await mountAcknowledgedStructuralBoard()
    abortableNext = 'reject'
    await deleteConcentration()
    expect(sentKinds()).toEqual(['structural_delete'])
    expect(removedNodeIdsSent()).toEqual([[CONCENTRATION]])

    await userSends(hook, 'Which of these factors matters most?')
    await act(async () => { await flush() })

    // PRECONDITIONS, by identity: the preempt really happened — a user turn went
    // out after the delete and the delete's own turn never answered — and the
    // abort did not revert the gesture (CEE may well have taken it).
    expect(sentKinds()).toEqual(['structural_delete', undefined])
    expect(userTurnsSent()).toBe(1)
    expect(concentrationOnCanvas()).toBe(false)

    // ⛔ THE CLAIM. RED at 2177f45c: one register carries the canvas without
    // the node and its ack makes the aborted deletion canonical.
    expect(registeredWithoutConcentration()).toEqual([])
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(false)
    expect(heldCause()).toBe('unresolved_structural_edit')
    expect(analysisHeldOn(useCanvasStore.getState() as never)).not.toBeNull()
    // …and the user hears it once, in the "couldn't confirm" words.
    expect(toastLog).toEqual([STRUCTURAL_DELETE_NOTICE.unconfirmed_server])
  })

  it('⛔ D6b — the delete turn rejects AbortError (a client timeout): NO registration carries the post-delete canvas, the model stays held, the user is told', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(THROWS(abortError()))

    expect(sentKinds()).toEqual(['structural_delete'])
    expect(concentrationOnCanvas()).toBe(false)

    expect(registeredWithoutConcentration()).toEqual([])
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(false)
    expect(heldCause()).toBe('unresolved_structural_edit')
    expect(toastLog).toEqual([STRUCTURAL_DELETE_NOTICE.unconfirmed_server])
  })

  it('⛔ D6c — the preempted delete\'s body was already buffered (the call RESOLVES while the signal reads aborted): the same', async () => {
    const hook = await mountAcknowledgedStructuralBoard()
    abortableNext = 'resolve'
    await deleteConcentration()
    await userSends(hook, 'Which of these factors matters most?')
    await act(async () => { await flush() })

    expect(sentKinds()).toEqual(['structural_delete', undefined])
    expect(concentrationOnCanvas()).toBe(false)

    expect(registeredWithoutConcentration()).toEqual([])
    expect(currentAcknowledged()).toBe(false)
    expect(heldCause()).toBe('unresolved_structural_edit')
    expect(toastLog).toEqual([STRUCTURAL_DELETE_NOTICE.unconfirmed_server])
  })

  it('⛔ D7 — the scenario fence: the user opens another decision while the delete is on the wire and its 500 lands there; back in the first decision, NO registration carries its post-delete canvas', async () => {
    await mountAcknowledgedStructuralBoard()
    holdTurn = true
    await deleteConcentration()
    expect(sentKinds()).toEqual(['structural_delete'])
    const postDeleteNodes = useCanvasStore.getState().nodes
    const postDeleteEdges = useCanvasStore.getState().edges

    await act(async () => {
      useCanvasStore.setState({
        currentScenarioId: OTHER_SCENARIO,
        nodes: STARTER_NODES as never,
        edges: STARTER_EDGES as never,
        importPendingServerRegistration: true,
      } as never)
      await flush()
    })
    replies.push(UNTYPED_500)
    await releaseHeldTurn()

    // The other decision is not held by it, and registers its own board.
    expect(heldCause()).toBeNull()
    expect(registerSpy.mock.calls.filter((c) => c[0] === OTHER_SCENARIO)).toHaveLength(1)

    // Back in the first decision, the canvas still shows the deletion (e.g. the
    // autosaved post-delete canvas), and CEE never confirmed it.
    await act(async () => {
      useCanvasStore.setState({
        currentScenarioId: SCENARIO,
        nodes: postDeleteNodes as never,
        edges: postDeleteEdges as never,
      } as never)
      await flush()
    })
    // ⛔ RED at 2177f45c (Panel R4, measured in harness): one register leaks it.
    expect(registeredWithoutConcentration(SCENARIO)).toEqual([])
    expect(heldCause()).toBe('unresolved_structural_edit')
  })

  it('D8 — a delete QUEUED behind a turn in flight is not announced as unconfirmed before it is sent: it goes, CEE proves it, nothing holds and no toast', async () => {
    const hook = await mountAcknowledgedStructuralBoard()
    // The user's own turn is on the wire when they delete.
    holdTurn = true
    replies.push({ ok: true, response: { assistant_text: 'ok', blocks: [] } }, DELETE_APPLIED)
    await userSends(hook, 'Which of these factors matters most?')
    await deleteConcentration()
    // PRECONDITION: the delete was DEFERRED, not dispatched — one turn on the wire.
    expect(dispatched).toHaveLength(1)
    expect(userTurnsSent()).toBe(1)
    expect(toastLog).toEqual([])

    holdTurn = false
    await releaseHeldTurn()
    await act(async () => { await flush() })

    // The queue dispatched it, and its own receipt proved it.
    expect(sentKinds()).toEqual([undefined, 'structural_delete'])
    expect(concentrationOnCanvas()).toBe(false)
    expect(heldCause()).toBeNull()
    expect(toastLog).toEqual([])
    expect(registeredWithoutConcentration()).toEqual([])
  })

  describe('the arms that already resolve stay as they are — and gain no second notice', () => {
    it('D1 — untyped 500: held, unacknowledged, ONE "couldn\'t confirm" notice and no toast', async () => {
      const hook = await mountAcknowledgedStructuralBoard()
      await deleteConcentrationAndSettle(UNTYPED_500)
      expect(concentrationOnCanvas()).toBe(false)
      expect(registeredWithoutConcentration()).toEqual([])
      expect(currentAcknowledged()).toBe(false)
      expect(heldCause()).toBe('unresolved_structural_edit')
      expect(syntheticNotices(hook).filter((n) => n === STRUCTURAL_DELETE_NOTICE.unconfirmed_server)).toHaveLength(1)
      expect(toastLog).toEqual([])
    })

    it('D2 — transport loss: held, unacknowledged, ONE transport notice and no toast', async () => {
      const hook = await mountAcknowledgedStructuralBoard()
      await deleteConcentrationAndSettle(THROWS(new TypeError('Failed to fetch')))
      expect(concentrationOnCanvas()).toBe(false)
      expect(registeredWithoutConcentration()).toEqual([])
      expect(currentAcknowledged()).toBe(false)
      expect(heldCause()).toBe('unresolved_structural_edit')
      expect(syntheticNotices(hook).filter((n) => n === STRUCTURAL_DELETE_NOTICE.unconfirmed_transport)).toHaveLength(1)
      expect(toastLog).toEqual([])
    })

    it('D3 — typed 409 with no no-write guarantee: held, unacknowledged, ONE "couldn\'t confirm" notice and no toast', async () => {
      const hook = await mountAcknowledgedStructuralBoard()
      await deleteConcentrationAndSettle(DELETE_409_UNKNOWN_CATEGORY)
      expect(concentrationOnCanvas()).toBe(false)
      expect(registeredWithoutConcentration()).toEqual([])
      expect(currentAcknowledged()).toBe(false)
      expect(heldCause()).toBe('unresolved_structural_edit')
      expect(syntheticNotices(hook).filter((n) => n === STRUCTURAL_DELETE_NOTICE.unconfirmed_server)).toHaveLength(1)
      expect(toastLog).toEqual([])
    })

    it('D4 — 200 refuted (committed graph still holds the node): reverted, released, nothing leaks, no toast', async () => {
      await mountAcknowledgedStructuralBoard()
      await deleteConcentrationAndSettle(DELETE_200_REFUTED)
      expect(concentrationOnCanvas()).toBe(true)
      expect(heldCause()).toBeNull()
      expect(registeredWithoutConcentration()).toEqual([])
      expect(toastLog).toEqual([])
    })

    it('D5 — 200 unproven (no committed graph): reverted, released, nothing leaks, no toast', async () => {
      await mountAcknowledgedStructuralBoard()
      await deleteConcentrationAndSettle(DELETE_200_UNPROVEN)
      expect(concentrationOnCanvas()).toBe(true)
      expect(heldCause()).toBeNull()
      expect(registeredWithoutConcentration()).toEqual([])
      expect(toastLog).toEqual([])
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 12. A LATER APPLIED RECEIPT CAN PROVE AN UNCONFIRMED DELETE — Panel's APPROVE
//     on #1905, item 2.
//
// `settleStructuralDeleteAttempt(…, 'proven')` ran only on the delete's OWN
// receipt, so when CEE committed a delete despite its 500 the hold could not
// learn it: the canvas equalled CEE's committed graph, yet analysis stayed held
// until reload (Panel R2, a wedge). The rule: an applied receipt for the SAME
// scenario, whose committed graph OVERLAPS the canvas, settles `proven` every
// standing record whose removed elements are ALL absent from that graph — by
// the delete's own receipt rule (`readStructuralDeleteReceipt`). Each guard has
// a case: a present element (R1, R5), zero overlap, another scenario, ALL-not-ANY.
// ═══════════════════════════════════════════════════════════════════════════

/** A later applied rename whose committed graph LACKS the node — CEE committed the delete despite its 500. */
const RENAME_APPLIED_AFTER_COMMITTED_DELETE = {
  ok: true,
  response: {
    assistant_text: `Renamed 'Bottom-Up Adoption Friction' to '${RENAMED}'. That change is saved.`,
    blocks: [],
    graph_hash: 'aag_after_rename_post_delete',
    draft_graph: committedGraph({ without: CONCENTRATION, labelOf: { [TARGET]: RENAMED } }),
  },
}
/** An applied delete of a DIFFERENT element (the TARGET→BYSTANDER link); CEE still holds CONCENTRATION. */
const EDGE_DELETE_APPLIED_NODE_STILL_HELD = {
  ok: true,
  response: {
    assistant_text: "Removed the link from 'Bottom-Up Adoption Friction' to 'Seat Price'. That change is saved.",
    blocks: [],
    graph_hash: 'aag_after_edge_delete',
    draft_graph: committedGraph({ withoutEdge: [TARGET, BYSTANDER] }),
  },
}
/** A receipt-shaped graph sharing NO node with the canvas (a misdrafted fresh graph). */
const ZERO_OVERLAP_RECEIPT = {
  ok: true,
  response: {
    assistant_text: "Here's a first model for this decision.",
    blocks: [],
    graph_hash: 'aag_unrelated',
    draft_graph: {
      nodes: [
        { id: 'fac_unrelated_a', kind: 'factor', label: 'Unrelated A', category: 'controllable' },
        { id: 'fac_unrelated_b', kind: 'factor', label: 'Unrelated B', category: 'controllable' },
      ],
      edges: [{ from: 'fac_unrelated_a', to: 'fac_unrelated_b', strength: { mean: 0.5 } }],
    },
  },
}

function canvasNodeIds(): string[] {
  return useCanvasStore.getState().nodes.map((n) => n.id).sort()
}
/**
 * The canvas shows the unconfirmed deletion AGAIN — e.g. the autosaved
 * post-delete canvas rehydrated after a failed boot read. Whether the record
 * still stands is exactly what decides whether this is held or registered.
 */
async function canvasShowsTheDeletionAgain(scenario = SCENARIO) {
  await act(async () => {
    const s = useCanvasStore.getState()
    useCanvasStore.setState({
      currentScenarioId: scenario,
      nodes: s.nodes.filter((n) => n.id !== CONCENTRATION) as never,
      edges: s.edges.filter((e) => e.source !== CONCENTRATION && e.target !== CONCENTRATION) as never,
    } as never)
    await flush()
  })
}

describe('12 · a later applied receipt proves an unconfirmed delete (Panel #1905 item 2)', { timeout: 30_000 }, () => {
  it('⛔ R2 — 500, but CEE committed it: a LATER applied receipt whose committed graph lacks the node releases the hold, and no register carried the canvas while it was unconfirmed', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)
    expect(heldCause()).toBe('unresolved_structural_edit')
    const registersWhileUnconfirmed = registerSpy.mock.calls.length
    expect(registeredWithoutConcentration()).toEqual([])

    replies.push(RENAME_APPLIED_AFTER_COMMITTED_DELETE)
    await renameTarget()
    await act(async () => { await flush() })

    // PRECONDITIONS, by identity: the rename applied, and the canvas is CEE's
    // committed graph by ids — the node is gone on both sides.
    expect(sentKinds()).toEqual(['structural_delete', 'structural_rename'])
    expect(canvasNodeIds()).toEqual([BYSTANDER, TARGET].sort())
    expect(nodeData(TARGET).label).toBe(RENAMED)
    expect(registersWhileUnconfirmed).toBe(1)

    // ⛔ THE CLAIM. RED at 2177f45c: the hold stands after the receipt (wedge).
    expect(heldCause()).toBeNull()
    // Nothing that left carries anything but CEE's own committed graph.
    for (const call of registerSpy.mock.calls.slice(registersWhileUnconfirmed)) {
      expect(nodeIdsOf(call)).toEqual([BYSTANDER, TARGET].sort())
      expect(registeredLabel(call)).toBe(RENAMED)
    }
  })

  it('R1 — 500, CEE did NOT commit it: a later receipt restores the node, its links come back under NEW edge ids, and the hold releases', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)
    expect(heldCause()).toBe('unresolved_structural_edit')

    replies.push(RENAME_APPLIED)
    await renameTarget()
    await act(async () => { await flush() })

    // PRECONDITIONS: the node is back, and its two links are back under ids
    // the unconfirmed record never named — which is what makes `every` in the
    // hold load-bearing (with `some`, the old edge ids stay "absent").
    expect(concentrationOnCanvas()).toBe(true)
    const restoredLinks = useCanvasStore.getState().edges
      .filter((e) => e.source === CONCENTRATION || e.target === CONCENTRATION)
    expect(restoredLinks).toHaveLength(2)
    const recordedIds = STRUCTURAL_EDGES
      .filter((e) => e.source === CONCENTRATION || e.target === CONCENTRATION)
      .map((e) => e.id)
    for (const link of restoredLinks) expect(recordedIds).not.toContain(link.id)

    expect(heldCause()).toBeNull()
    expect(registeredWithoutConcentration()).toEqual([])
  })

  it('R5 — a PROVEN delete of a DIFFERENT element, with the node still in the committed graph, does not settle its record', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)
    expect(heldCause()).toBe('unresolved_structural_edit')

    replies.push(EDGE_DELETE_APPLIED_NODE_STILL_HELD)
    await act(async () => {
      useCanvasStore.getState().deleteEdgeById(`e_${TARGET}_${BYSTANDER}`)
      await flush()
    })
    await act(async () => { await flush() })

    // PRECONDITIONS: the second delete was the LINK, by pair, and CEE proved it;
    // its committed graph still holds the node, so the receipt restored it.
    expect(sentKinds()).toEqual(['structural_delete', 'structural_delete'])
    expect((dispatched[1] as { event?: { removed_edges?: unknown } }).event?.removed_edges)
      .toEqual([{ from: TARGET, to: BYSTANDER }])
    expect(concentrationOnCanvas()).toBe(true)
    expect(registeredWithoutConcentration()).toEqual([])

    // ⭐ THE CLAIM: the record still stands — the moment the canvas shows the
    // deletion again, it holds rather than registering it.
    await canvasShowsTheDeletionAgain()
    expect(concentrationOnCanvas()).toBe(false)
    expect(heldCause()).toBe('unresolved_structural_edit')
    expect(registeredWithoutConcentration()).toEqual([])
  })

  it('ZERO OVERLAP — a receipt sharing no node with the canvas proves nothing: still held, nothing leaks', async () => {
    const hook = await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)
    expect(heldCause()).toBe('unresolved_structural_edit')

    replies.push(ZERO_OVERLAP_RECEIPT)
    await userSends(hook, 'Can you draft this again?')
    await act(async () => { await flush() })

    // PRECONDITIONS: the turn answered with the unrelated graph, and the
    // reconcile's own zero-overlap guard left the canvas alone.
    expect(userTurnsSent()).toBe(1)
    expect(canvasNodeIds()).toEqual([BYSTANDER, TARGET].sort())

    // The unrelated graph lacks the node too — which is exactly why it may not
    // count as proof.
    expect(heldCause()).toBe('unresolved_structural_edit')
    expect(registeredWithoutConcentration()).toEqual([])
    expect(currentAcknowledged()).toBe(false)
  })

  it('SCOPE — another decision\'s receipt proving the same node id gone settles nothing here', async () => {
    await mountAcknowledgedStructuralBoard()
    await deleteConcentrationAndSettle(UNTYPED_500)
    expect(heldCause()).toBe('unresolved_structural_edit')

    // A second decision opened from the same starter — identical node ids —
    // registers its board, then deletes the node there and CEE proves it.
    await act(async () => {
      useCanvasStore.setState({
        currentScenarioId: OTHER_SCENARIO,
        nodes: STRUCTURAL_NODES as never,
        edges: STRUCTURAL_EDGES as never,
        importPendingServerRegistration: true,
      } as never)
      await flush()
    })
    expect(registerSpy.mock.calls.filter((c) => c[0] === OTHER_SCENARIO)).toHaveLength(1)
    await deleteConcentrationAndSettle(DELETE_APPLIED)
    expect(sentKinds()).toEqual(['structural_delete', 'structural_delete'])
    expect(heldCause()).toBeNull()

    // Back in the first decision, its deletion is still unconfirmed.
    await canvasShowsTheDeletionAgain(SCENARIO)
    expect(heldCause()).toBe('unresolved_structural_edit')
    expect(registeredWithoutConcentration(SCENARIO)).toEqual([])
  })
})

describe('12 · the receipt-proof rule, pure (through `editDeliveryHold`)', () => {
  const intentOf = (nodeIds: string[], edges: Array<[string, string]> = [], edgeIds: string[] = []) =>
    ({
      id: `i_${nodeIds.join('_')}_${edges.map((e) => e.join('>')).join('_')}`,
      removedNodeIds: nodeIds,
      removedEdges: edges.map(([from, to]) => ({ from, to })),
      claimedNodeIds: nodeIds,
      claimedEdgeIds: edgeIds,
    }) as never
  const receipt = (nodes: string[], edges: Array<[string, string]> = []) => ({
    draft_graph: { nodes: nodes.map((id) => ({ id })), edges: edges.map(([from, to]) => ({ from, to })) },
  })
  const hold = (nodes: string[], scenario: string, edges: string[] = []) =>
    editDeliveryHold({
      nodes: nodes.map((id) => ({ id })),
      edges: edges.map((id) => ({ id })),
      currentScenarioId: scenario,
    } as never)
  const proveBy = (scenarioId: string, response: unknown, canvasNodeIds: string[]) =>
    settleUnconfirmedDeletesProvenByReceipt({ scenarioId, response, canvasNodeIds })

  it('ALL, not ANY: a two-node record stands while ONE of its nodes is still committed, and settles once BOTH are gone', () => {
    settleStructuralDeleteAttempt(intentOf(['n1', 'n2']), 's1', 'unconfirmed')
    expect(hold(['n3'], 's1')).toBe('unresolved_structural_edit')

    proveBy('s1', receipt(['n2', 'n3']), ['n3'])
    expect(hold(['n3'], 's1')).toBe('unresolved_structural_edit')

    proveBy('s1', receipt(['n3']), ['n3'])
    expect(hold(['n3'], 's1')).toBeNull()
  })

  it('a removed LINK is proven by its endpoint pair, never by a canvas edge id (which no committed graph carries)', () => {
    settleStructuralDeleteAttempt(intentOf([], [['n1', 'n2']], ['e_canvas_7']), 's1', 'unconfirmed')
    expect(hold(['n1', 'n2'], 's1', ['e_other'])).toBe('unresolved_structural_edit')

    // The pair is still committed: no proof, although `e_canvas_7` is "absent".
    proveBy('s1', receipt(['n1', 'n2'], [['n1', 'n2']]), ['n1', 'n2'])
    expect(hold(['n1', 'n2'], 's1', ['e_other'])).toBe('unresolved_structural_edit')

    proveBy('s1', receipt(['n1', 'n2']), ['n1', 'n2'])
    expect(hold(['n1', 'n2'], 's1', ['e_other'])).toBeNull()
  })

  it('SCOPE and OVERLAP: another scenario\'s receipt, or one sharing no node with the canvas, proves nothing', () => {
    settleStructuralDeleteAttempt(intentOf(['n9']), 's1', 'unconfirmed')
    proveBy('s2', receipt(['n1']), ['n1'])
    expect(hold(['n1'], 's1')).toBe('unresolved_structural_edit')
    proveBy('s1', receipt(['x1']), ['n1'])
    expect(hold(['n1'], 's1')).toBe('unresolved_structural_edit')
    // CONTROL: the same receipt with overlap, in the same scenario, proves it.
    proveBy('s1', receipt(['n1']), ['n1'])
    expect(hold(['n1'], 's1')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 13. THE DELETE HOLD'S ONE EXIT IS ONE THE USER CAN TAKE — Panel #1917 F1.
//
// While an unconfirmed delete holds analysis, the element is NOT on the canvas
// (the hold stands only while every removed element is absent), so "remove it
// again" names nothing to select; and Undo is disabled on the canvas
// (`mutationAuthority.ts` `canvasSemanticMutations: 'disabled'`: ⌘Z answers
// "Undo isn't available on the canvas", the menu item is disabled, the rail
// button is a no-op). The chat box is always on screen, so the hold asks:
// "Would you like to ask Olumi to remove it?"
//
// These cases pin that the exit it names RELEASES the hold, through the real
// dispatcher and `sendMessage` (the chat path), in BOTH states of CEE's
// committed graph:
//   · A — the graph LACKS the node (CEE removed it on this turn, or had already
//     committed the delete that answered 500): §12's receipt proof settles the
//     record `proven`.
//   · B — the graph still HOLDS it (CEE kept it): the reconcile puts the node
//     back, so the deletion the hold protects is no longer on the canvas.
//
// ⚠ SCOPE, stated rather than implied: A and B are both an APPLIED receipt (a
// committed `draft_graph`). Which reply CEE sends to "remove it" — above all
// whether a turn that finds the node ALREADY gone carries its committed graph at
// all — is a wire question this client spec does not answer. The CONTROL pins
// the consequence: a chat reply with no committed graph releases nothing.
// ═══════════════════════════════════════════════════════════════════════════

/** What the user types into the chat box, as the hold invites. */
const ASK_OLUMI_TO_REMOVE = 'Please remove Top Account Revenue Concentration from the model.'
/** The hold's sentence for the witnessed delete target, verbatim (proposed copy, for Experience Design). */
const DELETE_HOLD_ASKS_OLUMI =
  "Olumi couldn't confirm that Top Account Revenue Concentration was removed from the saved model, " +
  'so analysis is waiting until it is settled. Would you like to ask Olumi to remove it? If Olumi finds it already gone, reload this decision to see the saved model.'

/** A — the chat turn's applied receipt: CEE's committed graph LACKS the node. */
const CHAT_RECEIPT_WITHOUT_NODE = {
  ok: true,
  response: {
    assistant_text: "Removed 'Top Account Revenue Concentration' along with 2 connections. That change is saved.",
    blocks: [],
    graph_hash: 'aag_after_chat_removal',
    draft_graph: committedGraph({ without: CONCENTRATION }),
  },
}
/** B — the chat turn's applied receipt: CEE's committed graph still HOLDS the node. */
const CHAT_RECEIPT_STILL_HOLDING_NODE = {
  ok: true,
  response: {
    assistant_text: 'Top Account Revenue Concentration is still in the saved model.',
    blocks: [],
    graph_hash: 'aag_node_still_held',
    draft_graph: committedGraph(),
  },
}
/** CONTROL — CEE answers in prose only: no committed graph, so no receipt. */
const CHAT_REPLY_WITHOUT_RECEIPT = {
  ok: true,
  response: {
    assistant_text: 'Which element would you like me to remove?',
    blocks: [],
  },
}

function holdKind(): unknown {
  return heldReason(useCanvasStore.getState() as never)?.kind ?? null
}
function holdSentence(): string | null {
  return heldReason(useCanvasStore.getState() as never)?.sentence ?? null
}

/** Delete the node against an untyped 500 and pin the hold the user then sees. */
async function holdOnAnUnconfirmedDelete() {
  await deleteConcentrationAndSettle(UNTYPED_500)
  // PRECONDITIONS: the 500 kept the deletion on screen, the unconfirmed delete
  // holds analysis, and the hold names the node and its ONE exit.
  expect(concentrationOnCanvas()).toBe(false)
  expect(heldCause()).toBe('unresolved_structural_edit')
  expect(holdKind()).toBe('unconfirmed_delete')
  expect(holdSentence()).toBe(DELETE_HOLD_ASKS_OLUMI)
}

/** The user takes the exit: a chat message — a USER turn, not a system event. */
async function askOlumiToRemoveIt(hook: Hook, reply: unknown) {
  replies.push(reply)
  await userSends(hook, ASK_OLUMI_TO_REMOVE)
  await act(async () => { await flush() })
  // PRECONDITIONS, by identity: exactly one turn followed the delete, it was the
  // user's own chat message, and it carried what they typed.
  expect(sentKinds()).toEqual(['structural_delete', undefined])
  expect(userTurnsSent()).toBe(1)
  expect((dispatched[1] as { message?: unknown }).message).toBe(ASK_OLUMI_TO_REMOVE)
}

describe('13 · the delete hold\'s one exit — ask Olumi — releases it (Panel #1917 F1)', { timeout: 30_000 }, () => {
  it('⭐ A — the chat turn\'s committed graph LACKS the node: the hold releases, and no registration carries anything but CEE\'s committed graph', async () => {
    const hook = await mountAcknowledgedStructuralBoard()
    await holdOnAnUnconfirmedDelete()
    const registersWhileHeld = registerSpy.mock.calls.length
    expect(registeredWithoutConcentration()).toEqual([])

    await askOlumiToRemoveIt(hook, CHAT_RECEIPT_WITHOUT_NODE)

    // The canvas is CEE's committed graph by ids: the node is gone on both sides.
    expect(canvasNodeIds()).toEqual([BYSTANDER, TARGET].sort())
    // ⭐ THE CLAIM: the exit the hold named released it.
    expect(heldCause()).toBeNull()
    expect(holdKind()).not.toBe('unconfirmed_delete')
    expect(holdSentence()).not.toBe(DELETE_HOLD_ASKS_OLUMI)
    for (const call of registerSpy.mock.calls.slice(registersWhileHeld)) {
      expect(nodeIdsOf(call)).toEqual([BYSTANDER, TARGET].sort())
    }
  })

  it('⭐ B — the chat turn\'s committed graph still HOLDS the node: it is back on the canvas and the hold releases', async () => {
    const hook = await mountAcknowledgedStructuralBoard()
    await holdOnAnUnconfirmedDelete()

    await askOlumiToRemoveIt(hook, CHAT_RECEIPT_STILL_HOLDING_NODE)

    // The reconcile put CEE's node back — the canvas no longer shows the
    // deletion the hold was protecting.
    expect(concentrationOnCanvas()).toBe(true)
    // ⭐ THE CLAIM: released, and nothing ever registered the post-delete canvas.
    expect(heldCause()).toBeNull()
    expect(holdKind()).not.toBe('unconfirmed_delete')
    expect(holdSentence()).not.toBe(DELETE_HOLD_ASKS_OLUMI)
    expect(registeredWithoutConcentration()).toEqual([])
  })

  it('CONTROL — a chat reply with NO committed graph releases nothing: still held, still naming its one exit, nothing leaks', async () => {
    const hook = await mountAcknowledgedStructuralBoard()
    await holdOnAnUnconfirmedDelete()

    await askOlumiToRemoveIt(hook, CHAT_REPLY_WITHOUT_RECEIPT)

    expect(concentrationOnCanvas()).toBe(false)
    expect(heldCause()).toBe('unresolved_structural_edit')
    expect(holdSentence()).toBe(DELETE_HOLD_ASKS_OLUMI)
    expect(registeredWithoutConcentration()).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9b. THE STRUCTURAL ADD AND THE DRAWN LINK — the same own-write rule.
//
// SERVED (UI 5a8a27a9 + CEE 3829c96, 26 Sep 01:00Z, C32 witness): "+ Add
// option" on a one-decision model. CEE #1937 linked the option in the add's own
// commit (reply `graph_hash` a9a91f7c), and then a whole-graph `graph/register`
// re-wrote the link with `edge_type:'directed'` and `provenance: null`. The
// stored hash moved to e6a0a760, so the canvas's next edit was on a stale base
// and the user's link read as Olumi's (Canonical State, #70 5841806589).
// `canvasBeforeOwnAppliedWrite` had no arm for either kind.
// ═══════════════════════════════════════════════════════════════════════════

const DECISION = 'dec_pricing'
/** An option already on the board, linked to nothing yet — the drawn link's target. */
const OPT_KEEP = 'opt_keep_price'
const ADD_BOARD_NODES: Node[] = [
  ...STRUCTURAL_NODES,
  {
    id: DECISION,
    type: 'decision',
    position: { x: 0, y: -300 },
    data: { label: 'Pricing Model Transition', kind: 'decision', starterId: 'pricing-model' },
  } as unknown as Node,
  {
    id: OPT_KEEP,
    type: 'option',
    position: { x: 200, y: -300 },
    data: { label: 'Keep price', kind: 'option', starterId: 'pricing-model' },
  } as unknown as Node,
]

/** CEE's committed graph for the add board, plus whatever this turn wrote. */
function committedAddBoard(extra: { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> }) {
  const base = committedGraph()
  return {
    nodes: [
      ...base.nodes,
      { id: DECISION, kind: 'decision', label: 'Pricing Model Transition' },
      { id: OPT_KEEP, kind: 'option', label: 'Keep price' },
      ...(extra.nodes ?? []),
    ],
    edges: [...base.edges, ...(extra.edges ?? [])],
  }
}

async function mountAcknowledgedAddBoard() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: ADD_BOARD_NODES as never,
    edges: STRUCTURAL_EDGES as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    lastServerGraphHash: 'aag_before_add',
    lastAuthoritativeGraph: null,
    pendingStructuralDeletes: [],
    pendingStructuralRenames: [],
    structuralRenameLifecycle: [],
    pendingStructuralAdds: [],
    structuralAddLifecycle: [],
    pendingStructuralAddEdges: [],
    _externalMutationActive: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(() => {
    useImportRegistration()
    const conversation = useConversation()
    useStructuralAddEvents(conversation.sendSystemEvent as never)
    useStructuralAddEdgeEvents(conversation.sendSystemEvent as never)
    return conversation
  })
  await act(async () => { await flush() })
  // PRECONDITION: registered ONCE, and that acknowledgement released the hold.
  expect(registerSpy).toHaveBeenCalledTimes(1)
  expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  return hook
}

/** The add's reply, built from the request so it carries the minted node id. */
function addApplied(opts: { ceeLinksFrom?: string }) {
  return (payload: Record<string, unknown>) => {
    const ev = (payload as { event?: Record<string, unknown> }).event ?? {}
    const id = String(ev.node_id)
    return {
      ok: true,
      response: {
        assistant_text: `Added '${String(ev.label)}' to your model. That's saved.`,
        blocks: [],
        graph_hash: 'aag_after_add',
        draft_graph: committedAddBoard({
          nodes: [{ id, kind: String(ev.node_kind), label: String(ev.label) }],
          edges: opts.ceeLinksFrom
            ? [{ from: opts.ceeLinksFrom, to: id, strength: { mean: 1, std: 0.01 }, exists_probability: 1, provenance: { source: 'user_specified' } }]
            : [],
        }),
      },
    }
  }
}

describe('9b · an applied ADD or drawn LINK acknowledges the model past its own write — no register rewrite', { timeout: 30_000 }, () => {
  it('⭐ "+ Add option", CEE links it to the sole decision in the SAME commit: no follow-up, NO registration, the model acknowledged', async () => {
    await mountAcknowledgedAddBoard()
    replies.push(addApplied({ ceeLinksFrom: DECISION }))
    let optionId = ''
    await act(async () => {
      optionId = String(useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', DECISION, 'from-target'))
      await flush()
    })
    await act(async () => { await flush() })

    // PRECONDITIONS, by identity: ONE add for this node, committed with its link.
    expect(sentKinds()).toEqual(['structural_add'])
    expect((dispatched[0] as { event?: { node_id?: string } }).event?.node_id).toBe(optionId)
    expect(useCanvasStore.getState().structuralAddLifecycle.find((r) => r.intent.nodeId === optionId)?.status).toBe('committed')
    expect(useCanvasStore.getState().edges.some((e) => e.source === DECISION && e.target === optionId)).toBe(true)

    // ⭐ THE CLAIM. RED at 823c2bd4: a whole-graph registration re-writes CEE's link.
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(true)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  })

  it('⭐ a drawn LINK (structural_add_edge) applied with the committed pair: NO registration, the model acknowledged', async () => {
    await mountAcknowledgedAddBoard()
    replies.push({
      ok: true,
      response: {
        assistant_text: 'Connected them. That change is saved.',
        blocks: [],
        graph_hash: 'aag_after_link',
        draft_graph: committedAddBoard({
          edges: [{ from: DECISION, to: OPT_KEEP, strength: { mean: 1, std: 0.01 }, provenance: { source: 'user_specified' } }],
        }),
      },
    })
    await act(async () => {
      useCanvasStore.getState().addEdge({ source: DECISION, target: OPT_KEEP, data: { weight: 1, direction: 'positive' } } as never)
      await flush()
    })
    await act(async () => { await flush() })

    expect(sentKinds()).toEqual(['structural_add_edge'])
    expect((dispatched[0] as { event?: { from?: string; to?: string } }).event).toMatchObject({ from: DECISION, to: OPT_KEEP })

    // ⭐ THE CLAIM. RED at 823c2bd4.
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(true)
  })

  it('⭐ CEE does NOT link (no sole-decision rule applies): the add\'s receipt alone acknowledges nothing, the CHAINED link\'s applied receipt does — NO registration', async () => {
    await mountAcknowledgedAddBoard()
    let linkedId = ''
    replies.push(addApplied({}))
    replies.push((payload: Record<string, unknown>) => {
      const ev = (payload as { event?: Record<string, unknown> }).event ?? {}
      linkedId = String(ev.to)
      return {
        ok: true,
        response: {
          assistant_text: 'Connected. That change is saved.',
          blocks: [],
          graph_hash: 'aag_after_link',
          draft_graph: committedAddBoard({
            nodes: [{ id: linkedId, kind: 'option', label: 'New option' }],
            edges: [{ from: String(ev.from), to: linkedId, strength: { mean: 1, std: 0.01 }, provenance: { source: 'user_specified' } }],
          }),
        },
      }
    })
    let optionId = ''
    await act(async () => {
      optionId = String(useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', DECISION, 'from-target'))
      await flush()
    })
    await act(async () => { await flush() })

    expect(sentKinds()).toEqual(['structural_add', 'structural_add_edge'])
    expect(linkedId).toBe(optionId)
    // ⭐ THE CLAIM: the chain closes on the link's own receipt. RED at 823c2bd4.
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(true)
  })

  it('CONTROL (fail closed): the chained link\'s turn FAILS (untyped 500) — the canvas, which shows a link CEE never wrote, is NOT acknowledged', async () => {
    await mountAcknowledgedAddBoard()
    replies.push(addApplied({}))
    replies.push(UNTYPED_500)
    let optionId = ''
    await act(async () => {
      optionId = String(useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', DECISION, 'from-target'))
      await flush()
    })
    await act(async () => { await flush() })

    expect(sentKinds()).toEqual(['structural_add', 'structural_add_edge'])
    // PRECONDITION: the canvas still draws the link the server never took.
    expect(useCanvasStore.getState().edges.some((e) => e.source === DECISION && e.target === optionId)).toBe(true)
    // ⭐ THE CLAIM: the add's receipt acknowledged only what CEE holds (no link),
    // so the canvas as it stands is not a model CEE holds.
    expect(currentAcknowledged()).toBe(false)
  })

  it('⛔ (#2070 review 5842051351) a local write on the NEW node while the add is in flight is NOT acknowledged — the registration still carries it', async () => {
    await mountAcknowledgedAddBoard()
    holdTurn = true
    replies.push(addApplied({ ceeLinksFrom: DECISION }))
    let optionId = ''
    await act(async () => {
      optionId = String(useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, 'option', DECISION, 'from-target'))
      await flush()
    })
    // While the add is on the wire, the store writes to the new node.
    await act(async () => {
      const n = useCanvasStore.getState().nodes.find((x) => x.id === optionId)!
      useCanvasStore.getState().updateNode(optionId, { data: { ...(n.data as Record<string, unknown>), interventions: { [TARGET]: 42 } } } as never)
      await flush()
    })
    await releaseHeldTurn()
    holdTurn = false
    await act(async () => { await flush() })

    // ⭐ THE CLAIM: the add's receipt does not acknowledge the canvas carrying
    // the unsent write, so the side-channel still delivers it. The registration's
    // OWN receipt then acknowledges, so "acknowledged" alone cannot tell the
    // two apart: what discriminates is that a registration CARRIED the write.
    // RED at 664d2ade (1 call, mount only; the write never reached CEE).
    expect(registerSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    const carried = registerSpy.mock.calls.slice(1).some((call) =>
      registeredGraph(call).nodes.some((n) => n.id === optionId && JSON.stringify(n).includes('42')),
    )
    expect(carried).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9c. AN APPLIED GOAL TARGET — the receipt's own `analysis_ready` is not a
//     stranger.
//
// SERVED (UI 0622d972 + CEE e3b0844, 26 Sep 03:10Z, guest, pricing example):
// after a Run had left the canvas acknowledged, the goal panel sent
// `goal_target_edit` (at_least 121 %). CEE answered 200 with the whole
// committed `draft_graph`, `graph_hash` 0b039aeb1a22dab0, an applied
// `add_constraint` graph_patch and an `analysis_ready` whose goal fields moved
// (raw 110 → 121, cap provenance → 'inherited'). 2 s later the canvas POSTed a
// whole-graph `graph/register` and CEE's stored hash moved to 21c0fd8d5c96b5a2.
//
// The goal target writes NOTHING optimistically (`proposeGoalTarget`: no local
// echo). What moved the canvas before the receipt branch took G₀ was the SAME
// response: `applyV5State` step 4 backfills the goal node's
// `goal_threshold_raw`/`_unit`/`_cap`/`_cap_provenance` from `analysis_ready`,
// and it runs before the reconcile. So the canvas "just before the receipt"
// already carried the receipt's own write, was never acknowledged, and the
// chain did not fire. G₀ is the canvas before THIS response touched it.
// ═══════════════════════════════════════════════════════════════════════════

const GOAL = 'goal_pricing_transition'
const GOAL_LABEL = 'Achieve NRR Above 110% While Enabling Bottom-Up Adoption'
const GOAL_CONSTRAINT_ID = 'gc-15d1c571-307d-4a24-93e6-8f06491124ca'

/** The goal node as the canvas holds it after the Run: the starter's own target. */
function starterGoal(): Node {
  return {
    id: GOAL,
    type: 'goal',
    position: { x: 0, y: -200 },
    data: {
      label: GOAL_LABEL,
      kind: 'goal',
      starterId: 'pricing-model',
      provenance: 'ai_inferred',
      goal_threshold: 0.8,
      goal_threshold_raw: 110,
      goal_threshold_unit: '%',
      goal_threshold_cap: 137.5,
      goal_threshold_cap_provenance: 'target_derived_headroom',
      goal_threshold_frame: 'level',
    },
  } as unknown as Node
}

const GOAL_BOARD_NODES: Node[] = [...STARTER_NODES, starterOption(), starterGoal()]
const GOAL_BOARD_EDGES: Edge[] = [
  ...STARTER_EDGES,
  { id: `e_${TARGET}_${GOAL}`, source: TARGET, target: GOAL, data: { weight: 0.5, direction: 'negative' } } as unknown as Edge,
]

async function mountAcknowledgedGoalBoard() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: GOAL_BOARD_NODES as never,
    edges: GOAL_BOARD_EDGES as never,
    importPendingServerRegistration: true,
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    lastServerGraphHash: '40b8912736c452d8',
    goalConstraints: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const hook = renderHook(() => {
    useImportRegistration()
    return useConversation()
  })
  await act(async () => { await flush() })
  // PRECONDITIONS: registered ONCE, and that acknowledgement released the hold.
  expect(registerSpy).toHaveBeenCalledTimes(1)
  expect(currentAcknowledged()).toBe(true)
  expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  recordSettledBootRead(SCENARIO, GOAL_BOARD_NODES, GOAL_BOARD_EDGES) // see mountAcknowledgedStarter
  return hook
}

/** The event the goal panel sends — built by the one production builder. */
function goalTargetEvent(): WireSystemEvent {
  const built = buildGoalTargetEditEvent({
    goalNodeId: GOAL,
    constraintType: 'at_least',
    rawValue: 121,
    unit: '%',
    baseGraphHash: '40b8912736c452d8',
  })
  if (!built.ok) throw new Error('fixture: the goal target must build')
  return built.event
}

/** CEE's served 200 for that event, in its served shape (turns.jsonl, response 2). */
const GOAL_TARGET_APPLIED = {
  ok: true,
  response: {
    assistant_text: `Set the target for ${GOAL_LABEL} to at least 121%.`,
    blocks: [
      {
        type: 'graph_patch',
        status: 'applied',
        operation: 'add_constraint',
        // CEE's fact names the CONSTRAINT here, not the goal node.
        target_id: GOAL_CONSTRAINT_ID,
        before: null,
        after: {
          constraint_id: GOAL_CONSTRAINT_ID,
          node_id: GOAL,
          operator: '>=',
          value: 121,
          label: GOAL_LABEL,
          unit: '%',
          provenance: 'explicit',
          value_frame: 'level',
        },
      },
    ],
    graph_hash: '0b039aeb1a22dab0',
    draft_graph: {
      nodes: [
        ...committedGraph().nodes.filter((n) => n.id !== CONCENTRATION),
        {
          id: OPTION,
          kind: 'option',
          label: 'Hybrid Platform Fee Plus Usage',
          is_baseline: false,
          interventions: { [TARGET]: { value: 0.4, source: 'brief_extraction' } },
        },
        {
          id: GOAL,
          kind: 'goal',
          label: GOAL_LABEL,
          goal_threshold: 0.88,
          goal_threshold_raw: 121,
          goal_threshold_unit: '%',
          goal_threshold_cap: 137.5,
          goal_threshold_cap_provenance: 'inherited',
          goal_threshold_frame: 'level',
          threshold_source: 'user',
          success_threshold: 121,
          provenance: 'ai_inferred',
        },
      ],
      edges: [
        { from: TARGET, to: BYSTANDER, strength: { mean: -0.6 } },
        { from: TARGET, to: GOAL, strength: { mean: -0.5 } },
      ],
      goal_constraints: [
        {
          constraint_id: GOAL_CONSTRAINT_ID,
          node_id: GOAL,
          operator: '>=',
          value: 121,
          label: GOAL_LABEL,
          unit: '%',
          provenance: 'explicit',
          value_frame: 'level',
        },
      ],
    },
    analysis_ready: {
      goal_node_id: GOAL,
      status: 'ready',
      options: [
        { option_id: OPTION, label: 'Hybrid Platform Fee Plus Usage', status: 'ready', is_baseline: false, interventions: { [TARGET]: 0.4 } },
      ],
      goal_threshold: 0.88,
      goal_threshold_raw: 121,
      goal_threshold_unit: '%',
      goal_threshold_cap: 137.5,
      goal_threshold_cap_provenance: 'inherited',
      freshness: 'stale',
      freshness_reason: 'graph_hash_diverged',
    },
  },
}

/** A local-only analytical write on a key CEE's committed graph does not carry. */
const LOCAL_ONLY_UNIT = 'seats (local)'

function goalData(): Record<string, unknown> {
  return nodeData(GOAL)
}

describe('9c · an applied GOAL TARGET acknowledges the model — its own analysis_ready is not a stranger', { timeout: 30_000 }, () => {
  it('⭐ an APPLIED goal_target_edit (committed graph + add_constraint + analysis_ready) sends NO registration, and the model is acknowledged', async () => {
    const hook = await mountAcknowledgedGoalBoard()
    replies.push(GOAL_TARGET_APPLIED)
    await act(async () => {
      await hook.result.current.sendSystemEvent(goalTargetEvent(), { deferIfBusy: false }).catch(() => undefined)
      await flush()
    })
    await act(async () => { await flush() })

    // PRECONDITIONS, by identity: ONE goal_target_edit for this goal, and the
    // committed target is on the goal node and in the constraint slice.
    expect(sentKinds()).toEqual(['goal_target_edit'])
    expect((dispatched[0] as { event?: Record<string, unknown> }).event).toMatchObject({
      kind: 'goal_target_edit',
      goal_node_id: GOAL,
      raw_value: 121,
      unit: '%',
    })
    expect(goalData()).toMatchObject({
      goal_threshold_raw: 121,
      goal_threshold_cap_provenance: 'inherited',
      threshold_source: 'user',
      success_threshold: 121,
    })
    expect(useCanvasStore.getState().goalConstraints?.map((c) => c.constraint_id)).toContain(GOAL_CONSTRAINT_ID)

    // ⭐ THE CLAIM. RED at 0622d972: a whole-graph registration re-writes CEE's commit.
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(currentAcknowledged()).toBe(true)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()
  })

  it('CONTROL (fail closed): a local-only change made just BEFORE the goal edit is not vouched for — the register is still offered, carrying it', async () => {
    const hook = await mountAcknowledgedGoalBoard()
    holdTurn = true
    let send: Promise<unknown> = Promise.resolve()
    await act(async () => {
      // An analytical change nobody sent, then the goal edit, in one turn: the
      // edit's on-the-wire mark holds the registration, so the change is still
      // unacknowledged when the receipt lands. It is written on a key the
      // committed graph does not carry, so the reconcile keeps it on screen.
      const bystander = nodeData(BYSTANDER)
      useCanvasStore.getState().updateNode(BYSTANDER, { data: { ...bystander, unit: LOCAL_ONLY_UNIT } } as never)
      send = hook.result.current.sendSystemEvent(goalTargetEvent(), { deferIfBusy: false }).catch(() => undefined)
      await flush()
    })
    expect(registerSpy).toHaveBeenCalledTimes(1)

    replies.push(GOAL_TARGET_APPLIED)
    await settleTurn(send)
    await act(async () => { await flush() })

    // PRECONDITION: the receipt landed.
    expect(sentKinds()).toEqual(['goal_target_edit'])
    expect(goalData()).toMatchObject({ goal_threshold_raw: 121 })
    expect(nodeData(BYSTANDER).unit).toBe(LOCAL_ONLY_UNIT)
    // ⭐ THE CLAIM: the receipt does not vouch for a canvas carrying a change
    // CEE never saw, so a registration offers the model — and it CARRIES that
    // change, by identity (the bystander's local unit).
    expect(registerSpy.mock.calls.length).toBeGreaterThan(1)
    const carried = registerSpy.mock.calls.slice(1).some((call) =>
      registeredGraph(call).nodes.find((n) => n.id === BYSTANDER)?.unit === LOCAL_ONLY_UNIT,
    )
    expect(carried).toBe(true)
  })
})

/**
 * `factor_value_edit` — resolving the optimistic write against a FAILED turn.
 *
 * THE DEFECT THIS CLOSES, and it is a product lying about its own state.
 *
 * A value commit writes the canvas FIRST and fires the turn afterwards. When
 * that turn comes back a `typed_error` — a 409 the server refused, or the
 * untyped 500 a contended commit actually returns — `useConversation.ts:3860`
 * gated the whole resolution block on `target.kind !== 'typed_error'`, so
 * nothing ran. The canvas kept the number, no bubble was raised, and
 * `analysisFreshnessDirty` was never set. The user then runs an analysis that
 * CEE computes FROM ITS OWN PERSISTED GRAPH — i.e. from a different number
 * than the one on their screen — and nothing anywhere says so.
 *
 * ⚠ IT IS DURABLE, NOT SESSION-ONLY. Derived at the bytes both sides:
 *   · `saveAutosave` (`store/scenarios.ts:635-651`) writes
 *     `localStorage['olumi-canvas-autosave']` with NO hash check — only an
 *     identical-payload dedupe — and the boot path restores from it and
 *     fetches no graph. So a reload shows the refused number again.
 *   · The Supabase half is SHUT: `clientCanWriteReadableGraph()` returns a hard
 *     `false` (`lib/clientGraphWritePolicy.ts:55`), so `saveGraphViaGatedPath`
 *     returns before the RPC. And the RPC would not have caught it either —
 *     `apply_patch_and_log`'s body is `UPDATE scenarios SET graph = p_graph
 *     WHERE id = … AND user_id = auth.uid()`
 *     (`supabase/migrations/20260226000000_scenario_schema_v2.sql:166-170`):
 *     ownership is its ONLY predicate, `p_hashes` is recorded on the event and
 *     never compared. There is no CAS on that path to unshut into.
 *
 * WHY THE OLD JUSTIFICATION WAS FALSE. The pristine comment said typed errors
 * are "the deferral buffer's business (it retries and, at the attempt cap,
 * raises an honest transcript notice)". `enqueueDeferredSystemSend` has exactly
 * ONE call site (`useConversation.ts:3242`, the in-flight defer branch), so an
 * IMMEDIATE send that fails is never enqueued: nothing retried it and nothing
 * reverted it. `calibrateDrillInReceipt.spec.tsx:487-507` already disclosed
 * this and named its own assertion as the one to change when it was fixed.
 *
 * ── TWO HARMS, TWO PARAMETERS — the whole shape of this suite ──────────────
 *
 * Failing to revert a PROVEN-no-write is a LIE. Reverting a write that DID
 * land, or MIGHT have landed, is DATA LOSS. They cannot share one predicate,
 * so every case below has its opposite-direction twin:
 *
 *   REVERT   ⟵ only a `details.conflict_category` in the closed
 *              PROVEN_NO_WRITE_CONFLICT_CATEGORIES set, where CEE itself
 *              states the write did not land and marks `retryable: false`.
 *   NEVER    ⟵ everything else: the untyped 500 (`INTERNAL_ERROR`,
 *              `system_event_commit_failed`) that a contended commit actually
 *              returns today, an unknown future category, a fence verdict the
 *              producer does NOT answer with a no-write 409 (`unclaimed`,
 *              `unavailable`), and a transport failure. We hold no committed
 *              bytes, so we know neither that it landed nor that it did not —
 *              and an honest unknown may not be replaced by a convenient
 *              certainty.
 *
 * ⭐ THE FENCE VERDICTS `superseded` AND `stopped` ARE NOW ON THE REVERT SIDE,
 * because the producer says so (CEE #1868, `013fae8d`, served `92b1bf8`,
 * `system-events/dispatch.ts`, the `factor_value_edit` arm): a
 * `TurnFenceRejectedError` with either verdict returns 409 `GRAPH_DIVERGED`,
 * `retryable: false`, `commitPerformed: false` — "The turn fence refused the
 * write inside the append transaction, so nothing of this edit landed." They
 * revert under the FENCE's own sentence, not the proven-no-write one: "the
 * saved model changed since you typed that" is false when the user pressed
 * Stop.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { MessageBubble } from '../MessageBubble'
import { render, screen, cleanup, renderHook, act, waitFor } from '@testing-library/react'
import { markFactorEditInFlight, settleFactorEditInFlight, __resetPendingFactorEditsForTest } from '../pendingFactorEdit'
import { markEdgeEditInFlight, settleEdgeEdit, __resetPendingEdgeEditsForTest } from '../pendingEdgeEdit'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import { settleSystemEventSend } from '../settleSystemEventSend'
import { createRefusedGraphRefresh } from '../refusedGraphRefresh'
import { deliveryRegistersVersion } from '../../registration/editDeliveryHold'
import type { Node } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import {
  OPTIMISTIC_FACTOR_EDIT_NOTICE,
  type OptimisticFactorEdit,
} from '../optimisticFactorEdit'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// (Same harness discipline as useConversation.structuralDeleteConflictCategory.)
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

// `sendSystemEvent` short-circuits to SEND_BLOCKED unless orchestrator V2 is on.
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
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5'

/** The factor under edit. Bound by IDENTITY everywhere below, never by value. */
const TARGET_ID = 'fac_delivery_time'
/** A SECOND factor, present throughout, so no assertion can pass on the wrong object. */
const BYSTANDER_ID = 'fac_headcount'

/** What the server holds, and what a proven-no-write must restore. */
const SERVER_VALUE = 0.3
/** What the user typed and the canvas optimistically took. */
const SENT_VALUE = 0.8
/** The bystander's value — must never move, whatever the outcome. */
const BYSTANDER_VALUE = 0.55

/**
 * The fence's own per-verdict sentences (`FENCE_REFUSAL_COPY`,
 * `v5/failureTypeRetryability.ts`), bound here by the EXACT string so no other
 * notice can satisfy the assertion.
 */
const FENCE_STOPPED_COPY =
  "That change wasn't saved because this turn was stopped. Nothing in your decision changed. Send the change again if you still want it."
const FENCE_SUPERSEDED_COPY =
  "That change wasn't saved because a newer change to this decision got in first. Nothing was overwritten. Check the latest state, then make the edit again if it's still needed."

const PREV_OBSERVED = { value: SERVER_VALUE, raw_value: 3, unit: 'months', cap: 10 }
const PREV_DISPLAY = '3 months'

function factorNode(id: string, value: number, display: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      observedState: { value, raw_value: value * 10, unit: 'months', cap: 10 },
      display_value: display,
    },
  } as unknown as Node
}

/** The snapshot the commit captured BEFORE the optimistic write. */
function editSnapshot(): OptimisticFactorEdit {
  return {
    nodeId: TARGET_ID,
    sentValue: SENT_VALUE,
    prevObservedState: PREV_OBSERVED,
    prevDisplayValue: PREV_DISPLAY,
  }
}

/**
 * The 409 envelope, byte-shaped from CEE `route-v2.ts:2709-2737`
 * (`buildCommitFailureBoundaryError`). Only `conflict_category` varies between
 * the cases below — which is exactly the discrimination under test.
 */
function conflict409(category: string) {
  return {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      phase: 'commit',
      failure_type: 'GRAPH_DIVERGED',
      event_kind: 'factor_value_edit',
      recovery_action: 'refresh_and_reconfirm',
      conflict_category: category,
      expected_base_graph_hash: 'cfded3af0aa14ebd',
    },
    request_id: `req_${category}`,
    retryable: false,
  }
}

/**
 * ⚠ WHAT A CONTENDED COMMIT ACTUALLY RETURNS TODAY. Measured at the live probe
 * recorded in `calibrateDrillInReceipt.spec.tsx:487-497` (#560): an UNTYPED
 * HTTP 500 carrying `INTERNAL_ERROR` / `system_event_commit_failed` — no
 * `conflict_category` anywhere. The typed 409 above is the shape the contract
 * defines; THIS is the shape production emits, and the fix has to be right
 * about both.
 */
function untyped500() {
  return {
    error: 'INTERNAL_ERROR',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: { phase: 'commit', reason: 'system_event_commit_failed' },
    request_id: 'req_commit_failed',
    retryable: true,
  }
}

function stubFailure(status: number, body: unknown, beforeRefusal?: () => void) {
  const fetchStub = vi.fn(async (url: string) => url.endsWith('/graph') ? s2Response({
    schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph_present: true,
    graph: { nodes: [
      { id: TARGET_ID, kind: 'factor', label: TARGET_ID, observed_state: PREV_OBSERVED, display_value: PREV_DISPLAY },
      { id: BYSTANDER_ID, kind: 'factor', label: BYSTANDER_ID, observed_state: { value: BYSTANDER_VALUE } },
    ], edges: [] },
  }) : (() => {
    beforeRefusal?.()
    return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
  })())
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

/** A dispatch that never reaches the server at all. */
function stubTransportFailure() {
  const fetchStub = vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

/**
 * Drive one `factor_value_edit` turn from the POST-optimistic-write canvas —
 * which is the real pre-state: the panel writes locally and then sends.
 */
async function driveEdit(stub: () => unknown) {
  stub()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      factorNode(TARGET_ID, SENT_VALUE, '8 months'),
      factorNode(BYSTANDER_ID, BYSTANDER_VALUE, '5.5 months'),
    ],
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshnessDirty: false,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)

  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current
      .sendSystemEvent(
        {
          type: 'factor_value_edit',
          payload: { target_id: TARGET_ID, value: SENT_VALUE, field: 'value' },
        } as never,
        { optimisticFactorEdit: editSnapshot() },
      )
      .catch(() => undefined)
  })

  const state = useCanvasStore.getState()
  const read = (id: string) =>
    ((state.nodes.find((n) => n.id === id)?.data as Record<string, unknown>)
      ?.observedState ?? {}) as Record<string, unknown>

  return {
    messages: result.current.messages,
    /** Bound by IDENTITY — the exact factor the event named. */
    targetValue: read(TARGET_ID).value,
    targetDisplay: (state.nodes.find((n) => n.id === TARGET_ID)?.data as Record<string, unknown>)
      ?.display_value,
    /** The discriminator: a blanket revert would move this too. */
    bystanderValue: read(BYSTANDER_ID).value,
    freshnessDirty: state.analysisFreshnessDirty,
    notices: result.current.messages
      .filter((m) => m.role === 'assistant' && m.synthetic === true)
      .map((m) => m.content),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetPendingFactorEditsForTest()
  __resetPendingEdgeEditsForTest()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// DIRECTION 1 — a PROVEN no-write must revert. Failing to is the lie.
// ---------------------------------------------------------------------------

describe('factor_value_edit 409 — a guaranteed no-write reverts and says so', () => {
  it.each([
    ['top-level code', { code: 'revision_conflict' }],
    ['details.code', { details: { code: 'revision_conflict' } }],
    ['typed review body', { error: 'INTERNAL_ERROR', boundary: 'B1', direction: 'egress', validator: 'commit', details: { code: 'revision_conflict', reason: 'system_event_commit_failed' }, request_id: 'req_review', retryable: false }],
    ['executor envelope', { ...conflict409('revision_conflict'), code: 'revision_conflict', expected: 7, current: 8 }],
    ['central mapper envelope', { schema: 'error.v1', code: 'revision_conflict', message: 'stale revision', expected: 7, current: 8, details: { code: 'revision_conflict', expected: 7, current: 8 } }],
  ])('revision_conflict (%s) restores the value and shows the atomic no-write notice', async (_shape, body) => {
    const r = await driveEdit(() => stubFailure(409, body))
    expect(r.targetValue).toBe(SERVER_VALUE)
    expect(r.targetDisplay).toBe(PREV_DISPLAY)
    expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
    expect(r.notices).toEqual(['The scenario changed while I was saving, so nothing was saved. Try again.'])
    render(createElement(MessageBubble, { message: r.messages.at(-1)!, onChipClick: async () => {} }))
    expect(screen.getByTestId('message-body-text').textContent).toBe('The scenario changed while I was saving, so nothing was saved. Try again.')
    expect(screen.queryByText(OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server)).toBeNull()
  })

  it("'rpc_cas_conflict' puts the SERVER's value back on the named factor and renders the diverged notice", async () => {
    const r = await driveEdit(() => stubFailure(409, conflict409('rpc_cas_conflict')))

    expect(r.targetValue).toBe(SERVER_VALUE)
    // The display string is restored too — a value-only revert leaves the
    // canvas rendering its live fallback instead of the server's own prose.
    expect(r.targetDisplay).toBe(PREV_DISPLAY)
    expect(r.notices).toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
    expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server)
    // DISCRIMINATOR: the revert touched the factor the event named and nothing else.
    expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
  })

  it("POSITIVE CONTROL: 'BASE_HASH_DIVERGED' behaves identically — one class, one treatment", async () => {
    const r = await driveEdit(() => stubFailure(409, conflict409('BASE_HASH_DIVERGED')))

    expect(r.targetValue).toBe(SERVER_VALUE)
    expect(r.notices).toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
    expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
  })

  it.each([
    ['turn_fence_superseded', FENCE_SUPERSEDED_COPY],
    ['turn_fence_stopped', FENCE_STOPPED_COPY],
  ])(
    "'%s' (CEE #1868: refused inside the append transaction, nothing landed) puts the SERVER's value back and says the FENCE's own sentence",
    async (category, fenceCopy) => {
      const r = await driveEdit(() => stubFailure(409, conflict409(category)))

      // Bound by IDENTITY — the exact factor the event named.
      expect(r.targetValue).toBe(SERVER_VALUE)
      expect(r.targetDisplay).toBe(PREV_DISPLAY)
      // The fence's cause, by the exact sentence…
      expect(r.notices).toContain(fenceCopy)
      // …and NOT "the saved model changed since you typed that", which is false
      // about a stopped turn. Nor the cannot-confirm line: the producer stated it.
      expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
      expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server)
      // ONE notice for one outcome.
      expect(r.notices).toHaveLength(1)
      // DISCRIMINATOR: the revert touched the factor the event named and nothing else.
      expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
    },
  )

  /**
   * THE DURABILITY HALF, and it is not decoration.
   *
   * The optimistic write is already in `localStorage['olumi-canvas-autosave']`,
   * which is what the boot path restores from (it fetches no graph). An
   * in-memory-only revert would therefore be undone by the next reload: the
   * user would watch the server's value blink back to the one it refused. This
   * asserts the revert reached the slot the reload actually reads.
   *
   * ⚠ ASSERTED AGAINST THE PERSISTED BYTES, not against a spy on the writer —
   * a spy would pass on a call that wrote the wrong graph.
   */
  it('the revert is PERSISTED, so a reload cannot restore the refused number', async () => {
    localStorage.removeItem('olumi-canvas-autosave')
    await driveEdit(() => stubFailure(409, conflict409('rpc_cas_conflict')))

    const raw = localStorage.getItem('olumi-canvas-autosave')
    expect(raw).not.toBeNull()
    const nodes = (JSON.parse(raw as string) as { nodes?: Array<Record<string, any>> }).nodes ?? []
    // Bound by IDENTITY to the factor the event named.
    const persisted = nodes.find((n) => n.id === TARGET_ID)
    expect(persisted?.data?.observedState?.value).toBe(SERVER_VALUE)
    // DISCRIMINATOR: the flush wrote the whole current graph, not just a patch
    // — the bystander must be present and untouched in the same payload.
    expect(nodes.find((n) => n.id === BYSTANDER_ID)?.data?.observedState?.value).toBe(
      BYSTANDER_VALUE,
    )
  })
})

// ---------------------------------------------------------------------------
// DIRECTION 2 — the OPPOSITE-DIRECTION TWINS. Reverting here is DATA LOSS.
//
// Every case below stands at pristine and must KEEP standing. They are not
// redundant: they are the only thing stopping the fix above from being widened
// into a silent destroyer of accepted work.
// ---------------------------------------------------------------------------

describe('factor_value_edit — an unconfirmed outcome KEEPS the value and says it cannot confirm', () => {
  it.each([
    [409, { code: 'some_future_conflict_category' }],
    [409, { details: { code: 'some_future_conflict_category' } }],
    [500, { code: 'revision_conflict' }],
    [500, { error: 'INTERNAL_ERROR', boundary: 'B1', direction: 'egress', validator: 'commit', details: { code: 'revision_conflict', reason: 'system_event_commit_failed' }, request_id: 'req_review', retryable: false }],
    [500, conflict409('revision_conflict')],
  ])('an unrecognised code or non-409 refusal stays unconfirmed (%s, %j)', async (status, body) => {
    const r = await driveEdit(() => stubFailure(status, body))
    expect(r.targetValue).toBe(SENT_VALUE)
    expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
    expect(r.notices).toEqual([OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server])
    render(createElement(MessageBubble, { message: r.messages.at(-1)!, onChipClick: async () => {} }))
    expect(screen.getByTestId('message-body-text').textContent).toBe("I couldn't confirm that your change reached the saved model. It's still on your canvas, but the model may hold a different number  -  ask me what the model currently has before you rely on the analysis.")
    expect(screen.queryByText('The scenario changed while I was saving, so nothing was saved. Try again.')).toBeNull()
  })

  it("OPPOSITE TWIN: the untyped 500 a contended commit actually returns does NOT revert — but no longer passes in silence", async () => {
    const r = await driveEdit(() => stubFailure(500, untyped500()))

    // We hold no committed bytes. The write may have landed; discarding the
    // user's number here would be data loss on a guess.
    expect(r.targetValue).toBe(SENT_VALUE)
    expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
    // What DOES change: the silence. The user is told, and the analysis can no
    // longer report itself fresh against a value the engine may not hold.
    expect(r.notices).toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server)
    expect(r.freshnessDirty).toBe(true)
    expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
  })

  it('OPPOSITE TWIN: an unknown future conflict category is an honest unknown, not a revert', async () => {
    const r = await driveEdit(() => stubFailure(409, conflict409('some_future_conflict_category')))

    expect(r.targetValue).toBe(SENT_VALUE)
    expect(r.notices).toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server)
    expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
    expect(r.freshnessDirty).toBe(true)
  })

  it("OPPOSITE TWIN: 'turn_fence_unclaimed' — a fence verdict the producer does NOT answer with a no-write 409 — keeps the value and says it cannot confirm", async () => {
    // CEE #1868 deliberately keeps `unclaimed`/`unavailable` as the retryable
    // 500 on this arm. A 409 carrying one is therefore not a statement the
    // producer makes, and it must not borrow the members' revert by prefix.
    const r = await driveEdit(() => stubFailure(409, conflict409('turn_fence_unclaimed')))

    expect(r.targetValue).toBe(SENT_VALUE)
    expect(r.notices).toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server)
    expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
    // The generic fence sentence says "nothing in your decision changed" — a
    // claim this arm cannot make, so it must not appear either.
    expect(r.notices).not.toContain(
      "That change couldn't be saved, so nothing in your decision changed. Try it again in a moment.",
    )
    expect(r.freshnessDirty).toBe(true)
    expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
  })

  /**
   * ⚠ THIS TEST WAS WRITTEN EXPECTING A SEPARATE "didn't reach the server"
   * COPY, AND THE MEASUREMENT REFUTED IT — recorded rather than quietly
   * rewritten, because the refutation is the finding.
   *
   * `callV5Turn` (`v5/v5Adapter.ts:129-146`) rethrows ONLY `AbortError`; every
   * other fetch failure is converted into a typed error. So a network failure
   * does NOT reach `sendTurn`'s catch — it arrives at the typed-error branch
   * carrying no `conflict_category`, indistinguishable from a lost response.
   *
   * That makes the delete's `unconfirmed_transport` copy ("didn't reach the
   * server") unavailable here as an HONEST claim, not merely as an unused one:
   * the client cannot tell "never left the browser" from "reached CEE, reply
   * lost", and asserting the former would be a fresh untruth of exactly the
   * class this whole change removes. So there is one cannot-confirm outcome,
   * and this is it.
   */
  it('OPPOSITE TWIN: a network failure keeps the value and takes the cannot-confirm line', async () => {
    const r = await driveEdit(stubTransportFailure)

    expect(r.targetValue).toBe(SENT_VALUE)
    expect(r.notices).toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server)
    expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
    expect(r.freshnessDirty).toBe(true)
    expect(r.bystanderValue).toBe(BYSTANDER_VALUE)
  })
})

// ---------------------------------------------------------------------------
// THE DEFERRED PATH IS PINNED ELSEWHERE, DELIBERATELY.
//
// A deferred edit refused with a proven no-write must be REVERTED and then
// DROPPED, never retried — a retry re-sends the same value against the same
// stale base hash and refuses forever, and at the attempt cap the buffer adds a
// second notice telling the user to re-enter a value no longer on screen.
//
// That belongs in `useConversation.deferredSystemSends.spec.ts`, not here: it
// needs a genuinely occupied in-flight lock, and the assertion is only
// meaningful if the edit really went through the buffer. A version of it lived
// in this file briefly and was VACUOUS — this harness dispatches immediately,
// so nothing was ever queued and the absence of retry copy held for the wrong
// reason. The real test pins its own precondition (`pendingEmittedEdits === 1`
// before the flush) and carries its opposite-direction twin (an unknown
// category keeps the hold).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The revert's own precondition, in the failure direction.
// ---------------------------------------------------------------------------

describe('factor_value_edit 409 — the revert stands down rather than overwrite newer truth', () => {
  it('a value that has MOVED ON since dispatch is not reverted, and no "put it back" notice is shipped', async () => {
    const fetchStub = stubFailure(409, conflict409('rpc_cas_conflict'), () => {
      // The second carrier replaces A's pending register after A dispatches.
      markFactorEditInFlight(TARGET_ID, 0.95)
    })
    useCanvasStore.setState({
      currentScenarioId: SCENARIO_ID,
      // The user re-edited to something else while the turn was in flight, so
      // the node no longer holds `sentValue`.
      nodes: [factorNode(TARGET_ID, 0.95, '9.5 months'), factorNode(BYSTANDER_ID, BYSTANDER_VALUE, '5.5 months')],
      edges: [],
      results: { status: 'idle' } as never,
      analysisFreshnessDirty: false,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current
        .sendSystemEvent(
          {
            type: 'factor_value_edit',
            payload: { target_id: TARGET_ID, value: SENT_VALUE, field: 'value' },
          } as never,
          { optimisticFactorEdit: editSnapshot() },
        )
        .catch(() => undefined)
    })

    const obs = (useCanvasStore.getState().nodes.find((n) => n.id === TARGET_ID)!
      .data as Record<string, unknown>).observedState as Record<string, unknown>
    expect(obs.value).toBe(0.95)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(fetchStub.mock.calls.filter(([url]) => url.endsWith('/graph'))).toHaveLength(0)
    expect(fetchStub).toHaveBeenCalledTimes(1)

    const notices = result.current.messages
      .filter((m) => m.role === 'assistant' && m.synthetic === true)
      .map((m) => m.content)
    // The copy promises the previous value is back. It is not, so the promise
    // is withheld rather than shipped beside a canvas it does not describe.
    expect(notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
  })
})

// S2 uses real POST parsing, canonical GET hydration and the existing server merge.
const REFRESH_FAILED = "The latest state couldn't be refreshed."
const OTHER_SCENARIO = '22222222-2222-4333-8444-555555555555'
function s2Value(id = TARGET_ID): unknown {
  return (useCanvasStore.getState().nodes.find(n => n.id === id)?.data.observedState as { value?: number })?.value
}
function s2Response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body, text: async () => JSON.stringify(body) } as Response
}
function s2Graph(value = 414, scenarioId = SCENARIO_ID) {
  return { schema: 'scenario_graph.v1', scenario_id: scenarioId, graph_present: true,
    graph: { nodes: [TARGET_ID, BYSTANDER_ID].map(id => ({ id, kind: 'factor', label: id,
      observed_state: { value: id === TARGET_ID ? value : BYSTANDER_VALUE, unit: 'GBP' } })), edges: [] } }
}
function s2Seed() {
  useCanvasStore.setState({ currentScenarioId: SCENARIO_ID, importPendingServerRegistration: false,
    pendingEmittedEdits: 0, pendingStructuralAdds: [], pendingStructuralAddEdges: [], pendingStructuralDeletes: [],
    pendingStructuralRenames: [], structuralRenameLifecycle: [], structuralAddLifecycle: [],
    serverGraphIdentity: null, lastAuthoritativeGraph: null, lastServerGraphHash: 'cfded3af0aa14ebd',
    nodes: [factorNode(TARGET_ID, 300, '300 GBP'), factorNode(BYSTANDER_ID, BYSTANDER_VALUE, '5.5 months')],
    edges: [], results: { status: 'idle' }, history: { past: [], future: [] }, analysisFreshnessDirty: false } as never)
}
function s2Send(hook: ReturnType<typeof renderHook<ReturnType<typeof useConversation>, unknown>>,
  sentValue = 300, previous = 221) {
  return hook.result.current.sendSystemEvent({ type: 'factor_value_edit',
    payload: { target_id: TARGET_ID, value: sentValue, field: 'value' } } as never,
  { optimisticFactorEdit: { nodeId: TARGET_ID, sentValue,
    prevObservedState: { value: previous, unit: 'GBP' }, prevDisplayValue: `${previous} GBP` } }).catch(() => undefined)
}
function s2Wire(read: () => Response | Promise<Response>, body: unknown = conflict409('turn_fence_superseded'), status = 409,
  beforePostResponse?: () => void) {
  const get = vi.fn(read)
  vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/graph') ? get() : Promise.resolve().then(() => {
    beforePostResponse?.()
    return s2Response(body, status)
  })))
  return get
}
async function s2Refuse(hook: ReturnType<typeof renderHook<ReturnType<typeof useConversation>, unknown>>) {
  await act(async () => { await s2Send(hook) })
}

describe('S2 shown equals saved after a proven refusal', () => {
  beforeEach(s2Seed)
  it('S2 idle recovery does not advance the UI delivery snapshot', () => {
    const refresh = createRefusedGraphRefresh({ hasPendingTurn: () => false,
      identity: async () => ({ userId: null, accessToken: null }), onFailure: vi.fn() })
    try {
      const before = deliveryRegistersVersion()
      markFactorEditInFlight(TARGET_ID, 515)
      expect(deliveryRegistersVersion()).toBe(before)
      settleFactorEditInFlight(TARGET_ID, 515)
      expect(deliveryRegistersVersion()).toBe(before)
    } finally { refresh.dispose() }
  })
  it.each([
    { type: 'factor_value_edit', payload: { target_id: TARGET_ID, value: 300, field: 'value' } },
    { type: 'edge_strength_edit', payload: { from: TARGET_ID, to: BYSTANDER_ID, magnitude: 0.4,
      intent: 'confirm_current', direction_intent: 'preserve', expected: { mean: 0.4, effect_direction: 'positive' } } },
    { type: 'structural_add_edge', payload: { from: TARGET_ID, to: BYSTANDER_ID, magnitude: 0.4,
      effect_direction: 'positive', base_graph_hash: 'cfded3af0aa14ebd' } },
  ])('S2 raw $type carrier without F or S still recovers', async event => {
    const get = s2Wire(() => s2Response(s2Graph()))
    const hook = renderHook(() => useConversation())
    await act(async () => { await hook.result.current.sendSystemEvent(event as never).catch(() => undefined) })
    await waitFor(() => expect(s2Value()).toBe(414))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it.each([
    [503, { code: 'model_read_failed', details: { reason: 'model_read_failed' } }],
    [500, untyped500()],
  ])('S3 non-proven %s %j issues no graph read', async (status, body) => {
    const get = s2Wire(() => s2Response(s2Graph()), body, status)
    const hook = renderHook(() => useConversation())
    // No optimistic register may mask an illegal recovery request on this raw carrier.
    await act(async () => {
      await hook.result.current.sendSystemEvent({ type: 'factor_value_edit',
        payload: { target_id: TARGET_ID, value: 300, field: 'value' } } as never).catch(() => undefined)
    })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(get).not.toHaveBeenCalled()
    expect(s2Value()).toBe(300)
    expect(hook.result.current.messages.some(m => m.content === REFRESH_FAILED)).toBe(false)
  })

  it('S3 prior_range_edit proven conflict recovers through the existing wire carrier', async () => {
    const graph = s2Graph()
    const get = s2Wire(() => s2Response({ ...graph, graph: { ...graph.graph,
      nodes: graph.graph.nodes.map(n => ({ ...n, prior: { distribution: 'uniform', range_min: 10, range_max: 20 } })),
    } }), { code: 'revision_conflict' })
    const hook = renderHook(() => useConversation())
    const settlement = vi.fn()
    await act(async () => {
      settleSystemEventSend(hook.result.current.sendSystemEvent({ type: 'prior_range_edit',
        payload: { target_id: TARGET_ID, range_min: 1, range_max: 2, distribution: 'uniform' } } as never), settlement)
    })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(useCanvasStore.getState().nodes.find(n => n.id === TARGET_ID)!.data.prior)
      .toMatchObject({ distribution: 'uniform', range_min: 10, range_max: 20 }))
    expect(settlement).toHaveBeenCalledTimes(1)
    expect(settlement).toHaveBeenCalledWith('refused', expect.objectContaining({ conflictCategory: 'revision_conflict' }))
    const fetchStub = vi.mocked(fetch)
    expect(fetchStub).toHaveBeenCalledTimes(2)
    const turn = fetchStub.mock.calls.find(([url]) => !String(url).endsWith('/graph'))!
    expect(JSON.parse(String(turn[1]?.body)).event).toEqual({ kind: 'prior_range_edit',
      target_id: TARGET_ID, range_min: 1, range_max: 2, distribution: 'uniform' })
    expect(hook.result.current.messages.some(m => m.content === REFRESH_FAILED)).toBe(false)
  })

  it('S3 a refusal burst during recovery serialises reads and renders the final winner', async () => {
    let active = 0
    let maximum = 0
    const answers: Array<(response: Response) => void> = []
    const get = s2Wire(() => {
      active += 1
      maximum = Math.max(maximum, active)
      return new Promise<Response>(resolve => { answers.push(response => { active -= 1; resolve(response) }) })
    })
    const hook = renderHook(() => useConversation())
    await s2Refuse(hook)
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    for (const value of [515, 615]) {
      await act(async () => {
        useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => n.id === TARGET_ID ? {
          ...n, data: { ...n.data, observedState: { value, unit: 'GBP' }, display_value: `${value} GBP` },
        } : n) } as never)
        await s2Send(hook, value)
      })
      expect(active).toBe(1)
      expect(get).toHaveBeenCalledTimes(1)
    }
    await act(async () => { answers[0](s2Response(s2Graph(414))) })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(s2Value()).toBe(221) // The invalidated first answer was never applied.
    await act(async () => { answers[1](s2Response(s2Graph(777))) })
    await waitFor(() => expect(s2Value()).toBe(777))
    expect(factorDisplayText(useCanvasStore.getState().nodes.find(n => n.id === TARGET_ID)!.data)).toBe('777')
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(maximum).toBe(1)
    expect(active).toBe(0)
    expect(get).toHaveBeenCalledTimes(2)
    const notices = hook.result.current.messages.filter(m => m.role === 'assistant' && m.synthetic).map(m => m.content)
    expect(notices).toEqual([FENCE_SUPERSEDED_COPY, FENCE_SUPERSEDED_COPY, FENCE_SUPERSEDED_COPY])
  })

  it('S2 a network failure never requests recovery', async () => {
    const get = vi.fn()
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/graph') ? get() : Promise.reject(new TypeError('offline'))))
    const hook = renderHook(() => useConversation())
    await s2Refuse(hook)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(get).not.toHaveBeenCalled()
    expect(s2Value()).toBe(300)
  })
  it.each([515, 300])('S2 queued newer B=%s survives A refusal, including equal-value edits', async sentB => {
    let refuseA!: (r: Response) => void
    let refuseB!: (r: Response) => void
    const post = vi.fn(() => new Promise<Response>(resolve => {
      if (post.mock.calls.length === 1) refuseA = resolve
      else refuseB = resolve
    }))
    const get = vi.fn(async () => s2Response(s2Graph()))
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/graph') ? get() : post()))
    const hook = renderHook(() => useConversation())
    let a!: Promise<unknown>
    await act(async () => { a = s2Send(hook) })
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    await act(async () => {
      useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => n.id === TARGET_ID ? {
        ...n, data: { ...n.data, observedState: { value: sentB, unit: 'GBP' } } } : n) } as never)
      await s2Send(hook, sentB, 300)
      refuseA(s2Response(conflict409('turn_fence_superseded'), 409))
      await a
    })
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(s2Value()).toBe(sentB)
    expect(get).not.toHaveBeenCalled()
    await act(async () => { refuseB(s2Response(conflict409('turn_fence_superseded'), 409)) })
    await waitFor(() => expect(s2Value()).toBe(414))
    expect(get).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['fence', conflict409('turn_fence_superseded')],
    ['revision top-level', { code: 'revision_conflict' }],
    ['revision details', { details: { code: 'revision_conflict' } }],
  ])('S2 %s replaces reverted 221 with stored winner 414', async (_name, body) => {
    const get = s2Wire(() => s2Response(s2Graph()), body)
    const hook = renderHook(() => useConversation())
    await s2Refuse(hook)
    await waitFor(() => expect(s2Value()).toBe(414))
    expect(get).toHaveBeenCalledTimes(1)
    const shown = factorDisplayText(useCanvasStore.getState().nodes.find(n => n.id === TARGET_ID)!.data)
    expect(shown).toBe('414')
    expect(hook.result.current.messages.some(m => m.content.includes(REFRESH_FAILED))).toBe(false)
    const notice = _name === 'fence' ? FENCE_SUPERSEDED_COPY : 'The scenario changed while I was saving, so nothing was saved. Try again.'
    expect(hook.result.current.messages.some(m => m.content === notice)).toBe(true)
  })

  it.each(['failed', 'foreign', 'empty'] as const)('S2 %s refresh retains rollback and adds only the failure sentence', async failure => {
    s2Wire(() => failure === 'failed' ? Promise.reject(new TypeError('offline')) : s2Response(
      failure === 'foreign' ? s2Graph(414, OTHER_SCENARIO) : { ...s2Graph(), graph: { nodes: [], edges: [] } }))
    const hook = renderHook(() => useConversation())
    await s2Refuse(hook)
    await waitFor(() => expect(hook.result.current.messages.some(m => m.content === REFRESH_FAILED)).toBe(true))
    expect(s2Value()).toBe(221)
    expect(hook.result.current.messages.some(m => m.content === FENCE_SUPERSEDED_COPY)).toBe(true)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it.each(['same factor', 'other factor', 'edge'] as const)('S2 waits for a pending %s, then reads again', async kind => {
    const get = s2Wire(() => s2Response(s2Graph()), conflict409('turn_fence_superseded'), 409, () => {
      if (kind !== 'edge') markFactorEditInFlight(kind === 'other factor' ? BYSTANDER_ID : TARGET_ID, 515)
    })
    const hook = renderHook(() => useConversation())
    // B is admitted before A's response, including a pending write elsewhere on the graph.
    const id = kind === 'other factor' ? BYSTANDER_ID : TARGET_ID
    if (kind === 'edge') {
      useCanvasStore.setState({ edges: [{ id: 'pending-edge', source: TARGET_ID, target: BYSTANDER_ID,
        data: { weight: 0.9, direction: 'positive' } }] } as never)
      markEdgeEditInFlight('pending-edge', 0.9, { weight: 0.2 }, undefined,
        { scenarioId: SCENARIO_ID, from: TARGET_ID, to: BYSTANDER_ID })
    } else {
      useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => n.id === id ? {
        ...n, data: { ...n.data, observedState: { value: 515, unit: 'GBP' } } } : n) } as never)
      markFactorEditInFlight(id, 515)
    }
    await s2Refuse(hook)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(get).not.toHaveBeenCalled()
    if (kind !== 'edge') expect(s2Value(id)).toBe(515)
    await act(async () => {
      if (kind === 'edge') settleEdgeEdit('pending-edge', 0.9)
      else settleFactorEditInFlight(id, 515)
    })
    await waitFor(() => expect(s2Value()).toBe(414))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('S2 a pending edit begun during GET invalidates it even if B settles before that GET answers', async () => {
    let answer!: (response: Response) => void
    const get = s2Wire(() => get.mock.calls.length === 1 ? new Promise<Response>(resolve => { answer = resolve }) : s2Response(s2Graph(515)))
    const hook = renderHook(() => useConversation())
    await s2Refuse(hook)
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    await act(async () => {
      markFactorEditInFlight(TARGET_ID, 515)
      useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => n.id === TARGET_ID ? {
        ...n, data: { ...n.data, observedState: { value: 515, unit: 'GBP' } } } : n) } as never)
      settleFactorEditInFlight(TARGET_ID, 515)
      answer(s2Response(s2Graph(414)))
    })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(s2Value()).toBe(515)
  })

  it.each([false, true])('S2 switching scenarios (reopen=%s) rejects a late graph and notice', async reopen => {
    let answer!: (response: Response) => void
    const get = s2Wire(() => new Promise<Response>(resolve => { answer = resolve }))
    const hook = renderHook(() => useConversation())
    await s2Refuse(hook)
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: OTHER_SCENARIO })
      if (reopen) useCanvasStore.setState({ currentScenarioId: SCENARIO_ID })
      answer(s2Response(s2Graph()))
      await new Promise(resolve => setTimeout(resolve, 30))
    })
    expect(s2Value()).toBe(221)
    expect(hook.result.current.messages.some(m => m.content === REFRESH_FAILED)).toBe(false)
  })

  it.each([
    [500, untyped500()], [500, conflict409('turn_fence_superseded')],
    [500, { code: 'revision_conflict' }], [409, conflict409('future_category')],
  ])('S2 unknown outcome %s %j never reads', async (status, body) => {
    const get = s2Wire(() => s2Response(s2Graph()), body, status)
    const hook = renderHook(() => useConversation())
    await s2Refuse(hook)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(get).not.toHaveBeenCalled()
  })
})

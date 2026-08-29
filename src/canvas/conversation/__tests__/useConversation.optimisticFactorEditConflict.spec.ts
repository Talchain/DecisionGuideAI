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
 *              returns today, an unknown future category, a fence verdict, and
 *              a transport failure. We hold no committed bytes, so we know
 *              neither that it landed nor that it did not — and an honest
 *              unknown may not be replaced by a convenient certainty.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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

function stubFailure(status: number, body: unknown) {
  const fetchStub = vi.fn(async () => ({
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response))
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
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// DIRECTION 1 — a PROVEN no-write must revert. Failing to is the lie.
// ---------------------------------------------------------------------------

describe('factor_value_edit 409 — a guaranteed no-write reverts and says so', () => {
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

  it('OPPOSITE TWIN: a turn-fence verdict is a write conflict we cannot attribute — no revert', async () => {
    const r = await driveEdit(() => stubFailure(409, conflict409('turn_fence_superseded')))

    expect(r.targetValue).toBe(SENT_VALUE)
    expect(r.notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
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
    stubFailure(409, conflict409('rpc_cas_conflict'))
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

    const notices = result.current.messages
      .filter((m) => m.role === 'assistant' && m.synthetic === true)
      .map((m) => m.content)
    // The copy promises the previous value is back. It is not, so the promise
    // is withheld rather than shipped beside a canvas it does not describe.
    expect(notices).not.toContain(OPTIMISTIC_FACTOR_EDIT_NOTICE.proven_no_write)
  })
})

/**
 * Structural-delete 409 resolution — the SECOND guaranteed-no-write category.
 *
 * THE DEFECT, DERIVED AT THE CEE BYTES (olumi-assistants-service `293da078`,
 * not inferred from the name):
 *
 * CEE has TWO 409 sources on the `structural_delete` path, and BOTH guarantee
 * the write did not land:
 *
 *   1. `system-events/structural-delete.ts:475-484` — the stale gate refuses
 *      before anything is resolved and returns `conflict_category:
 *      BASE_HASH_DIVERGED`.
 *   2. `session/supabase-store.ts:309-318` and `:1070-1079` — the ATOMIC CAS
 *      (`append_turn_atomic_v3` / `v4`, SQLSTATE OLGC1) throws
 *      `GraphStaleWriteError` with `conflict_category: 'rpc_cas_conflict'` and
 *      the message *"Atomic in-transaction CAS: the whole turn rolled back,
 *      nothing clobbered."* — the guarantee stated by the producer itself.
 *
 * Both ride the same envelope: `system-events/dispatch.ts:1176-1197` (the
 * `structural_delete` arm) copies `err.conflict_category` onto `graphConflict`,
 * and `orchestrator/route-v2.ts:2476-2504` sends it as a 409 `GRAPH_DIVERGED`
 * with the category in `details.conflict_category`. The UI reads exactly that
 * field (`extractConflictCategory`, `v5/failureTypeRetryability.ts:146`).
 *
 * At pristine, `useConversation.ts:3012` compared for `BASE_HASH_DIVERGED`
 * ALONE, so an `rpc_cas_conflict` fell to `unconfirmed_server`: the canvas kept
 * asserting a deletion the server had declined, under copy that says *"It's
 * still gone from the canvas"*. A guaranteed no-write rendered as an unknown.
 *
 * ⚠ THE FIX IS SET-MEMBERSHIP, NOT A SECOND EQUALITY. The two categories are
 * one CLASS — "the server proved it wrote nothing" — and the class is what the
 * revert and the `base_hash_diverged` remedy are entitled to. The remedy copy
 * ("ask me anything and I'll re-sync with the saved model") holds for both,
 * because `applyV5State` captures the top-level `graph_hash` off EVERY response
 * — so any turn refreshes the base hash, whichever gate refused.
 *
 * OPPOSITE-DIRECTION TWINS BELOW, and they are the point: a fence category and
 * an unknown future category must STILL take the honest cannot-confirm line
 * with NO revert. Widening a set is only safe if the outside of the set is
 * pinned.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import {
  STRUCTURAL_DELETE_NOTICE,
  type StructuralDeleteIntent,
} from '../../mutations/structuralDelete'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// (Same harness discipline as useConversation.fence409Honesty.spec.ts.)
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

// `sendSystemEvent` short-circuits to SEND_BLOCKED unless orchestrator V2 is on
// (`useConversation.ts:6403`), and the flag has no default in `flags.ts`.
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

vi.mock('../../../lib/posthog', () => ({
  trackEvent: () => undefined,
}))

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

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const DELETED_NODE_ID = 'option-expand-eu'
const BASE_GRAPH_HASH = 'cfded3af0aa14ebd'

/** The element the user deleted, verbatim, as the intent's revert evidence. */
const DELETED_NODE = {
  id: DELETED_NODE_ID,
  type: 'option',
  position: { x: 120, y: 240 },
  data: { label: 'Expand into the EU' },
} as unknown as Node

const SURVIVING_NODE = {
  id: 'goal-revenue',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Grow revenue' },
} as unknown as Node

function deleteIntent(): StructuralDeleteIntent {
  return {
    id: 'sd-1',
    removedNodeIds: [DELETED_NODE_ID],
    removedEdges: [],
    baseGraphHash: BASE_GRAPH_HASH,
    claimedNodeIds: [DELETED_NODE_ID],
    claimedEdgeIds: [],
    restore: { nodes: [DELETED_NODE], edges: [] as readonly Edge[] },
  } as StructuralDeleteIntent
}

/**
 * The 409 envelope both categories ride, byte-shaped from CEE
 * `route-v2.ts:2476-2504` (`buildCommitFailureBoundaryError` +
 * `preStageExtras`). Only `conflict_category` varies between the cases below —
 * which is exactly the discrimination under test.
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
      event_kind: 'structural_delete',
      recovery_action: 'refresh_and_reconfirm',
      conflict_category: category,
      expected_base_graph_hash: BASE_GRAPH_HASH,
    },
    request_id: `req_${category}`,
    retryable: false,
  }
}

function stub409(category: string) {
  const body = conflict409(category)
  const fetchStub = vi.fn(async () => ({
    ok: false,
    status: 409,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

/**
 * Drive one `structural_delete` turn whose commit 409s with `category`, from a
 * canvas that has ALREADY had the element optimistically removed (which is the
 * real pre-state: the store deletes synchronously and the drain sends after).
 */
async function driveDelete(category: string) {
  stub409(category)
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    // Post-optimistic-delete state: the option is gone, the goal remains.
    nodes: [SURVIVING_NODE],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)

  const intent = deleteIntent()
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current
      .sendSystemEvent(
        {
          type: 'structural_delete',
          payload: {
            summary: 'Deleted 1 element',
            base_graph_hash: BASE_GRAPH_HASH,
            removed_node_ids: [DELETED_NODE_ID],
            removed_edges: [],
          },
        } as never,
        { structuralDelete: intent, debugSource: 'canvas_delete' },
      )
      .catch(() => undefined)
  })

  const nodeIds = useCanvasStore.getState().nodes.map((n) => n.id)
  const notices = result.current.messages
    .filter((m) => m.role === 'assistant' && m.synthetic === true)
    .map((m) => m.content)

  return { nodeIds, notices }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// The class that is entitled to a revert
// ---------------------------------------------------------------------------

describe('structural_delete 409 — a guaranteed no-write reverts and says so', () => {
  it("'rpc_cas_conflict' (the atomic-CAS refusal) puts the element BACK and renders the diverged notice", async () => {
    const { nodeIds, notices } = await driveDelete('rpc_cas_conflict')

    // Bound by IDENTITY — the exact node the intent named, not a count.
    expect(nodeIds).toContain(DELETED_NODE_ID)
    // Bound to the exported constant, not to a prose fragment another string
    // could satisfy.
    expect(notices).toContain(STRUCTURAL_DELETE_NOTICE.base_hash_diverged)
    // The lie this fixes: never claim it is still gone when the server declined.
    expect(notices).not.toContain(STRUCTURAL_DELETE_NOTICE.unconfirmed_server)
  })

  it("POSITIVE CONTROL: 'BASE_HASH_DIVERGED' behaves identically (the pre-existing arm is untouched)", async () => {
    const { nodeIds, notices } = await driveDelete('BASE_HASH_DIVERGED')

    expect(nodeIds).toContain(DELETED_NODE_ID)
    expect(notices).toContain(STRUCTURAL_DELETE_NOTICE.base_hash_diverged)
  })
})

// ---------------------------------------------------------------------------
// The outside of the set — pinned, because widening a set is only safe if its
// complement is pinned too.
// ---------------------------------------------------------------------------

describe('structural_delete 409 — everything else is still an honest unknown', () => {
  it('OPPOSITE TWIN: an unknown future category does NOT revert and takes the cannot-confirm line', async () => {
    const { nodeIds, notices } = await driveDelete('some_future_conflict_category')

    expect(nodeIds).not.toContain(DELETED_NODE_ID)
    expect(notices).toContain(STRUCTURAL_DELETE_NOTICE.unconfirmed_server)
    expect(notices).not.toContain(STRUCTURAL_DELETE_NOTICE.base_hash_diverged)
  })

  it('OPPOSITE TWIN: a turn-fence category does NOT revert either (no no-write guarantee for that class here)', async () => {
    const { nodeIds, notices } = await driveDelete('turn_fence_superseded')

    expect(nodeIds).not.toContain(DELETED_NODE_ID)
    expect(notices).toContain(STRUCTURAL_DELETE_NOTICE.unconfirmed_server)
    expect(notices).not.toContain(STRUCTURAL_DELETE_NOTICE.base_hash_diverged)
  })
})

/**
 * The rename resolver's TRANSPORT arm (the turn threw before any reply) settles
 * by the same authoritative reread as every other ambiguous arm — and the
 * resolver is AWAITED on that path, so its verdict lands before the drain's.
 * Unreadable keeps the arm's own uncertainty: unconfirmed, name kept.
 */
/**
 * A REFUSED rename must not leave the new name on the canvas.
 *
 * WITNESSED on served staging, 22 Sep 2026 (UI `d299880b`, guest, pricing
 * example): a rename of `opt_hybrid` went out as `structural_rename`, CEE
 * refused it ("… Nothing has been changed.", `blocks: []`), and the canvas KEPT
 * the new label. A factor value edit refused the same way reverted.
 *
 * WHY, derived at the CEE bytes (`olumi-assistants-service` staging `9c16e8cd`,
 * the served build), not from the UI's own docblocks:
 *
 *   · SUCCESS — HTTP 200 with a top-level `draft_graph` holding the node at the
 *     new label, stamped only after the label is verified in the committed bytes
 *     (`system-events/dispatch.ts:2511-2553`).
 *   · REFUSAL — HTTP 200, `blocks: []`, and NO `draft_graph`
 *     (`system-events/structural-rename.ts:237-256`, committed and returned at
 *     `dispatch.ts:2354-2425`). The `contentGraph` it passes to
 *     `commitDirectAnswer` only feeds the stored-text id scrub
 *     (`commit.ts:205-220`); it never reaches the wire.
 *
 * So the refusal arrived as "no readable committed graph", the resolver read
 * that as `unproven`, and `unproven` keeps the name. These fixtures are the wire
 * shapes above plus the witnessed refusal sentence, not an author's guess.
 *
 * ⭐ EVERY REVERT CASE SHIPS ITS OPPOSITE: a success keeps the name, a 500 keeps
 * the name (CEE: "a commit may have landed"), and a node the client holds no
 * server evidence for keeps the name (reverting there discards local typing).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import {
  STRUCTURAL_RENAME_NOTICE,
  type StructuralRenameIntent,
} from '../../mutations/structuralRename'

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


// The turn THROWS (an internal error re-raised around the network), which is the
// only route to the resolver's `{ kind: 'transport' }` arm. A fetch reject does
// NOT reach it — `callV5Turn` returns `parse_error` for that (see the sibling spec).
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, callV5Turn: vi.fn(async () => { throw new Error('internal failure before the reply') }) }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'c18c2621-d041-4579-b09a-a6b2e599af6f'
const NODE_ID = 'opt_hybrid'
const SIBLING_ID = 'opt_sibling'
const BASE_GRAPH_HASH = 'cfded3af0aa14ebd'

const PREVIOUS_LABEL = 'Hybrid platform fee plus usage'
const NEW_LABEL = 'Hybrid Platform Fee Plus Usage RT'

/** The witnessed refusal sentence (served staging, 22 Sep, evidence §4). */
const WITNESSED_REFUSAL =
  'That kind of change does not come through this conversation route. Nothing has been changed.'
/** CEE's own `apply_failed` refusal copy (`structural-rename.ts`, step 5). */
const CEE_APPLY_FAILED_REFUSAL =
  "I couldn't apply that rename to the saved model, so I haven't changed anything. Reload it and try again."

function renameIntent(): StructuralRenameIntent {
  return {
    id: 'sr-refused-1',
    nodeId: NODE_ID,
    label: NEW_LABEL,
    expectedLabel: PREVIOUS_LABEL,
    baseGraphHash: BASE_GRAPH_HASH,
    restore: {
      label: PREVIOUS_LABEL,
      provenance: 'ai_inferred',
      provenanceWasPresent: true,
    },
  }
}

/**
 * The canvas AFTER the optimistic local rename. `serverHeld` controls the
 * positive-evidence record: `true` = the last authoritative graph named this
 * node (the starter/hydrate/receipt paths all seed it); `false` = no record.
 *
 * The sibling shares the NEW label on purpose: a revert keyed on a label
 * predicate would move it too; only an id binding leaves it alone.
 */
function seed(serverHeld: boolean) {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    lastAuthoritativeGraph: serverHeld
      ? { nodeIds: [NODE_ID, SIBLING_ID], edgePairs: [] }
      : null,
    structuralRenameLifecycle: [
      { intent: renameIntent(), scenarioId: SCENARIO_ID, status: 'in_flight' },
    ],
    nodes: [
      {
        id: NODE_ID,
        type: 'option',
        position: { x: 0, y: 0 },
        data: { label: NEW_LABEL, kind: 'option', provenance: 'ai_inferred' },
      },
      {
        id: SIBLING_ID,
        type: 'option',
        position: { x: 200, y: 0 },
        data: { label: NEW_LABEL, kind: 'option' },
      },
    ] as unknown as Node[],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

/**
 * What CEE's persisted graph says, answered at `POST …/scenarios/{id}/graph` —
 * the authoritative READBACK a no-`draft_graph` reply is settled against
 * (#1884 review: "a 200 reply without `draft_graph` does not prove that the
 * saved node still has its previous label"). `label: null` = CEE holds no such
 * node; `'unreadable'` = the read itself fails (404 NOT_FOUND).
 */
type Readback = { label: string | null } | 'unreadable'
let readback: Readback = { label: PREVIOUS_LABEL }
let graphReads = 0

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function graphReadResponse(): Response {
  graphReads += 1
  if (readback === 'unreadable') {
    return jsonResponse(404, { schema: 'error.v1', code: 'NOT_FOUND', message: 'No readable graph for that scenario.' })
  }
  const nodes = [
    { id: SIBLING_ID, kind: 'option', label: NEW_LABEL },
    ...(readback.label === null ? [] : [{ id: NODE_ID, kind: 'option', label: readback.label }]),
  ]
  return jsonResponse(200, {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph_present: true,
    graph: { nodes, edges: [] },
    graph_hash: BASE_GRAPH_HASH,
  })
}

function stubFetch(status: number, body: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input)
      if (/\/scenarios\/[^/]+\/graph$/.test(url)) return graphReadResponse()
      return jsonResponse(status, body)
    }),
  )
}

/** CEE's refusal 200 — `refuse()` + dispatch's `graph_hash` stamp. NO draft_graph. */
function stubRefusal200(assistantText: string, extra: Record<string, unknown> = {}) {
  stubFetch(200, {
    response_version: 2,
    assistant_text: assistantText,
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    graph_hash: BASE_GRAPH_HASH,
    ...extra,
  })
}

/** CEE's 409, byte-shaped from `route-v2.ts` (as in the sibling outcome spec). */
function stub409(category: string) {
  stubFetch(409, {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      phase: 'commit',
      failure_type: 'GRAPH_DIVERGED',
      event_kind: 'structural_rename',
      recovery_action: 'refresh_and_reconfirm',
      conflict_category: category,
      expected_base_graph_hash: BASE_GRAPH_HASH,
    },
    request_id: `req_${category}`,
    retryable: false,
  })
}

/** CEE's success 200 — the committed graph rides `draft_graph`. */
function stubSuccess200() {
  stubFetch(200, {
    response_version: 2,
    assistant_text: `Renamed '${PREVIOUS_LABEL}' to '${NEW_LABEL}'.`,
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    graph_hash: BASE_GRAPH_HASH,
    draft_graph: {
      nodes: [
        { id: NODE_ID, kind: 'option', label: NEW_LABEL },
        { id: SIBLING_ID, kind: 'option', label: NEW_LABEL },
      ],
      edges: [],
      node_count: 2,
      edge_count: 0,
    },
  })
}

/** CEE's 500 — `buildCommitFailureBoundaryError`, reason `system_event_commit_failed`. */
function stub500CommitFailed() {
  stubFetch(500, {
    error: 'INTERNAL_ERROR',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      retryable: true,
      reason: 'system_event_commit_failed',
      event_kind: 'structural_rename',
      stage: 'frame',
    },
    request_id: 'req_commit_failed',
    retryable: true,
  })
}

async function driveRename(serverHeld = true) {
  seed(serverHeld)
  const intent = renameIntent()
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current
      .sendSystemEvent(
        {
          type: 'structural_rename',
          payload: {
            node_id: NODE_ID,
            label: NEW_LABEL,
            expected_label: PREVIOUS_LABEL,
            base_graph_hash: BASE_GRAPH_HASH,
          },
        } as never,
        { structuralRename: intent, debugSource: 'canvas_rename' },
      )
      .catch(() => undefined)
  })

  const nodes = useCanvasStore.getState().nodes
  const labelOf = (id: string) =>
    (nodes.find((n) => n.id === id)?.data as { label?: string } | undefined)?.label
  const provenanceOf = (id: string) =>
    (nodes.find((n) => n.id === id)?.data as { provenance?: unknown } | undefined)?.provenance
  const synthetic = result.current.messages
    .filter((m) => m.role === 'assistant' && m.synthetic === true)
    .map((m) => m.content)
  const spoken = result.current.messages
    .filter((m) => m.role === 'assistant' && m.synthetic !== true)
    .map((m) => m.content)
  const verdict = useCanvasStore
    .getState()
    .structuralRenameLifecycle.find((r) => r.intent.id === intent.id)?.status

  return { labelOf, provenanceOf, synthetic, spoken, verdict }
}

beforeEach(() => {
  vi.clearAllMocks()
  readback = { label: PREVIOUS_LABEL }
  graphReads = 0
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════
// THE DEFECT — a refusal 200 with no draft_graph
// ═══════════════════════════════════════════════════════════════════════════


describe('structural_rename — the transport arm (turn threw) is settled by the reread', () => {
  it('the model holds the NEW name → keep it, `committed`', async () => {
    stubRefusal200('unused — the turn throws before fetch')
    readback = { label: NEW_LABEL }
    const { labelOf, verdict } = await driveRename()
    expect(graphReads).toBe(1)
    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(verdict).toBe('committed')
  })

  it('the model holds the OLD name → the canvas shows it, `refused`', async () => {
    stubRefusal200('unused')
    readback = { label: PREVIOUS_LABEL }
    const { labelOf, verdict } = await driveRename()
    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    expect(verdict).toBe('refused')
  })

  it('CONTROL: unreadable → name kept, `unconfirmed`, the transport notice', async () => {
    stubRefusal200('unused')
    readback = 'unreadable'
    const { labelOf, synthetic, verdict } = await driveRename()
    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(verdict).toBe('unconfirmed')
    expect(synthetic).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_transport)
  })
})

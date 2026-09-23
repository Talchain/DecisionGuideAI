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

describe('structural_rename — a refusal 200 (no draft_graph) puts the model’s name back', () => {
  it('the WITNESSED refusal reverts THIS node to the name the model holds', async () => {
    stubRefusal200(WITNESSED_REFUSAL)
    const { labelOf, provenanceOf } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    // Provenance is restored from the capture, never stamped by the client.
    expect(provenanceOf(NODE_ID)).toBe('ai_inferred')
  })

  it("CEE's own orchestrator refusal reverts too — same shape, different sentence", async () => {
    stubRefusal200(CEE_APPLY_FAILED_REFUSAL)
    const { labelOf } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
  })

  it('the same-labelled SIBLING is untouched — bound by id, not by label', async () => {
    stubRefusal200(WITNESSED_REFUSAL)
    const { labelOf } = await driveRename()

    expect(labelOf(SIBLING_ID)).toBe(NEW_LABEL)
  })

  it("the user is told in the transcript: CEE's refusal sentence renders, and no second voice contradicts it", async () => {
    stubRefusal200(WITNESSED_REFUSAL)
    const { spoken, synthetic } = await driveRename()

    expect(spoken).toContain(WITNESSED_REFUSAL)
    // "It's on the canvas" would now be false — the name is gone.
    expect(synthetic).not.toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  })

  it('a SILENT refusal (no sentence from CEE) reverts and adds our one notice — which must not claim the name is still there', async () => {
    stubRefusal200('')
    const { labelOf, synthetic } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    expect(synthetic).toContain(STRUCTURAL_RENAME_NOTICE.not_applied)
    // (The pre-existing empty-response bubble also renders; it is not this lane's.)
    expect(synthetic).not.toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  })

  it('the lifecycle verdict is `refused`, not `unconfirmed`', async () => {
    stubRefusal200(WITNESSED_REFUSAL)
    const { verdict } = await driveRename()

    expect(verdict).toBe('refused')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// OPPOSITE TWINS — the name must SURVIVE where the model may hold it
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_rename — the arms that must KEEP the new name', () => {
  it('a success 200 (draft_graph at the new label) keeps it, adds no notice, settles `committed`', async () => {
    stubSuccess200()
    const { labelOf, synthetic, verdict } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(synthetic).toHaveLength(0)
    expect(verdict).toBe('committed')
  })

  it("a 500 `system_event_commit_failed` keeps it and says it couldn't confirm — CEE: a commit may have landed", async () => {
    stub500CommitFailed()
    const { labelOf, synthetic, verdict } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(synthetic).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
    expect(verdict).toBe('unconfirmed')
  })

  it('a refusal on a node CEE holds NO record of keeps it — reverting would discard local typing', async () => {
    stubRefusal200(WITNESSED_REFUSAL)
    readback = { label: null }
    const { labelOf, synthetic, verdict } = await driveRename(false)

    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(synthetic).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
    expect(verdict).toBe('unconfirmed')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// #1884 REVIEW (CHANGES_REQUIRED @ 340a4996) — settle from the AUTHORITATIVE
// readback, never from membership. `lastAuthoritativeGraph` holds ids only; it
// cannot say what the node is CALLED.
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_rename — a no-draft_graph reply is settled by reading the model back', () => {
  it("REVIEW CONTROL 1: CEE refused and still holds the OLD label → the canvas restores it and says `refused`", async () => {
    stubRefusal200(CEE_APPLY_FAILED_REFUSAL)
    readback = { label: PREVIOUS_LABEL }
    const { labelOf, verdict } = await driveRename()

    expect(graphReads).toBe(1)
    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    expect(verdict).toBe('refused')
  })

  it('REVIEW CONTROL 2: registration already stored the NEW label, CEE replies `expected_label_mismatch` with no graph → keep the saved name, never claim it was not saved', async () => {
    stubRefusal200("That element is already called 'Hybrid Platform Fee Plus Usage RT'.")
    readback = { label: NEW_LABEL }
    const { labelOf, synthetic, verdict } = await driveRename()

    expect(graphReads).toBe(1)
    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(verdict).toBe('committed')
    expect(synthetic).not.toContain(STRUCTURAL_RENAME_NOTICE.not_applied)
    expect(synthetic).not.toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  })

  it('the model holds a THIRD name (someone else renamed it) → the canvas shows the model’s name, `refused`', async () => {
    stubRefusal200('')
    readback = { label: 'Hybrid (renamed elsewhere)' }
    const { labelOf, verdict } = await driveRename()

    expect(labelOf(NODE_ID)).toBe('Hybrid (renamed elsewhere)')
    expect(labelOf(SIBLING_ID)).toBe(NEW_LABEL)
    expect(verdict).toBe('refused')
  })

  it('the readback itself FAILS → keep the name, say it could not be confirmed, never revert on a guess', async () => {
    stubRefusal200(WITNESSED_REFUSAL)
    readback = 'unreadable'
    const { labelOf, synthetic, verdict } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(verdict).toBe('unconfirmed')
    expect(synthetic).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  })

  it('a proven-no-write 409 while CEE ALREADY holds the new name (the side channel stored it) → keep it, `committed`', async () => {
    stub409('rpc_cas_conflict')
    readback = { label: NEW_LABEL }
    const { labelOf, synthetic, verdict } = await driveRename()

    expect(graphReads).toBe(1)
    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(verdict).toBe('committed')
    expect(synthetic).not.toContain(STRUCTURAL_RENAME_NOTICE.base_hash_diverged)
  })

  it('CONTROL: a proven-no-write 409 while CEE holds the old name → revert, `refused` (unchanged)', async () => {
    stub409('rpc_cas_conflict')
    readback = { label: PREVIOUS_LABEL }
    const { labelOf, synthetic, verdict } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    expect(verdict).toBe('refused')
    expect(synthetic).toContain(STRUCTURAL_RENAME_NOTICE.base_hash_diverged)
  })

  it('CONTROL: a proven-no-write 409 with an UNREADABLE model keeps its own evidence → revert, `refused` (unchanged)', async () => {
    stub409('rpc_cas_conflict')
    readback = 'unreadable'
    const { labelOf, verdict } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    expect(verdict).toBe('refused')
  })

  it('CONTROL: a success 200 WITH draft_graph needs no readback', async () => {
    stubSuccess200()
    const { verdict } = await driveRename()

    expect(verdict).toBe('committed')
    expect(graphReads).toBe(0)
  })
})

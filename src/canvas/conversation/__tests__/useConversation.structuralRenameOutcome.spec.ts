/**
 * Structural-rename outcome resolution — and the case that makes this event
 * different from every other optimistic writer in the product.
 *
 * ⭐⭐ THE DEFECT THIS PINS, DERIVED AT THE CEE BYTES (staging `4f0bd774`,
 * `system-events/structural-rename.ts`, not inferred from the pattern):
 *
 * This event carries TWO concurrency assertions and they get DIFFERENT answers.
 *
 *   · `base_graph_hash` diverged → HTTP **409** `GRAPH_DIVERGED`, nothing
 *     appended. Ordinary, and the estate's shared `isProvenNoWriteConflict` set
 *     already covers it.
 *
 *   · `expected_label` mismatched → a COMMITTED **200** refusal naming the
 *     current label. **NOT a 409**, and CEE states the derivation: the 409
 *     envelope's only recovery payload is `expected_base_graph_hash`, and on a
 *     label-only divergence that hash is UNCHANGED — because `label` is absent
 *     from `projectNode`'s keep-list, so a rename moves no analysis hash at all.
 *     The server would answer "refresh and reconfirm" while handing back the
 *     exact value the client already holds; the client would see no difference,
 *     conclude nothing moved, and resend the same rename forever.
 *
 * ⚠⚠ SO THE CONCURRENT-RENAME CASE — the entire reason `expected_label` exists —
 * ARRIVES AS A SUCCESS STATUS. A UI keyed on `conflict_category` reads it as a
 * win and leaves the user's name standing over a model that holds someone
 * else's. That is a lie the status code cannot expose, and it is why the verdict
 * here is taken from the COMMITTED BYTES: CEE's refusal path passes the
 * PERSISTED graph through `commitDirectAnswer(..., { contentGraph })`, so that
 * arm carries a positive, readable refutation.
 *
 * ⭐ EVERY CASE BELOW SHIPS ITS OPPOSITE-DIRECTION TWIN. A revert that fires too
 * eagerly DISCARDS the user's typing; one that fires too rarely leaves the
 * product lying about the model. Those are two different harms and a corpus
 * testing one direction is a guard watching one door.
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

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const NODE_ID = 'fac_monthly_eng_cost'
const SIBLING_ID = 'fac_sibling'
const BASE_GRAPH_HASH = 'cfded3af0aa14ebd'

const PREVIOUS_LABEL = 'Monthly eng cost'
const NEW_LABEL = 'Monthly engineering spend'
/** What a CONCURRENT renamer wrote — the label the model actually holds. */
const OTHER_USERS_LABEL = 'Engineering run rate'

/**
 * The canvas AFTER the optimistic local rename — the real pre-state, because
 * `store.updateNodeLabel` writes synchronously and the drain sends after.
 *
 * ⚠ THE SIBLING SHARES THE NEW LABEL ON PURPOSE. A revert bound by a value
 * predicate ("the node labelled NEW_LABEL") would be satisfied by either node;
 * only an id binding picks the right one, and only a same-labelled sibling can
 * prove the difference.
 */
function seedCanvasPostRename() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      {
        id: NODE_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: NEW_LABEL, kind: 'factor', provenance: 'ai_inferred' },
      },
      {
        id: SIBLING_ID,
        type: 'factor',
        position: { x: 200, y: 0 },
        data: { label: NEW_LABEL, kind: 'factor' },
      },
    ] as unknown as Node[],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

function renameIntent(): StructuralRenameIntent {
  return {
    id: 'sr-1',
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

/** The 409 envelope, byte-shaped from CEE `route-v2.ts`. */
function stub409(category: string) {
  const body = {
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
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response)),
  )
}

/**
 * A COMMITTED 200. `committedLabel` is what the persisted graph holds for
 * NODE_ID — CEE stamps this from the bytes it actually wrote (success) or from
 * the bytes it declined to change (refusal). `null` omits `draft_graph`
 * entirely, which is the "we hold no receipt" state.
 */
function stub200(committedLabel: string | null, assistantText: string) {
  const body: Record<string, unknown> = {
    response_version: 2,
    assistant_text: assistantText,
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    graph_hash: BASE_GRAPH_HASH,
  }
  if (committedLabel !== null) {
    body.draft_graph = {
      nodes: [
        { id: NODE_ID, kind: 'factor', label: committedLabel, category: 'external' },
        { id: SIBLING_ID, kind: 'factor', label: NEW_LABEL, category: 'external' },
      ],
      edges: [],
      node_count: 2,
      edge_count: 0,
    }
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response)),
  )
}

async function driveRename() {
  seedCanvasPostRename()
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
  const notices = result.current.messages
    .filter((m) => m.role === 'assistant' && m.synthetic === true)
    .map((m) => m.content)

  return { labelOf, provenanceOf, notices }
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════
// THE 200 THAT IS A REFUSAL — the case a status-code check cannot see
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_rename — a committed 200 whose bytes REFUTE the rename', () => {
  it("a concurrent rename (expected_label mismatch) LEAVES THE CANVAS SHOWING WHAT THE MODEL HOLDS, even though the status is 200", async () => {
    stub200(
      OTHER_USERS_LABEL,
      `That's called '${OTHER_USERS_LABEL}' in the saved model now, not '${PREVIOUS_LABEL}' — someone renamed it while you were working.`,
    )
    const { labelOf } = await driveRename()

    // ⭐ THE CLAIM UNDER TEST, stated as the harm rather than as a mechanism:
    // the user's REJECTED name must not survive on the canvas. That is the lie
    // — the product asserting a name the model refused.
    expect(labelOf(NODE_ID)).not.toBe(NEW_LABEL)

    // ⚠ AND THE END STATE IS THE SERVER'S LABEL, NOT THE PREVIOUS ONE — measured
    // rather than assumed, and it corrected my first expectation here. TWO
    // mechanisms fire on this arm, in order: `resolveStructuralRename` reverts
    // to `PREVIOUS_LABEL`, and then `reconcileAppliedGraph` ingests the
    // COMMITTED `draft_graph` and lands on `OTHER_USERS_LABEL`. The second is
    // strictly better information — it is what the model holds, including the
    // concurrent renamer's word — so the assertion follows the product rather
    // than forcing the product to follow the assertion.
    //
    // The revert is NOT thereby redundant: it is the ONLY correction on the 409
    // arm (nothing is appended, so no graph comes back) and on any 200 whose
    // graph-ingest gate declines. It is pinned directly, in isolation, by
    // `structuralRename.spec.ts` — so neither mechanism can rot behind the other.
    expect(labelOf(NODE_ID)).toBe(OTHER_USERS_LABEL)
  })

  it('the SAME-LABELLED SIBLING is untouched — nothing resolved by label', async () => {
    stub200(OTHER_USERS_LABEL, 'someone renamed it while you were working')
    const { labelOf } = await driveRename()

    // Both nodes started on NEW_LABEL, so a label-keyed correction would have
    // moved this one too. Only the named id changed.
    expect(labelOf(SIBLING_ID)).toBe(NEW_LABEL)
  })

  it('NO notice is added when CEE spoke — its sentence names the label the model holds, ours would not', async () => {
    stub200(OTHER_USERS_LABEL, 'someone renamed it while you were working')
    const { notices } = await driveRename()

    expect(notices).not.toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
    expect(notices).not.toContain(STRUCTURAL_RENAME_NOTICE.base_hash_diverged)
  })

  it('OPPOSITE TWIN — a 200 whose bytes CONFIRM the rename KEEPS the new name and adds no notice', async () => {
    stub200(NEW_LABEL, 'Renamed. That change is saved, so the new name stays when you reload.')
    const { labelOf, notices } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(notices).toHaveLength(0)
  })

  it('OPPOSITE TWIN — a 200 with NO readable committed graph KEEPS the name and says it could not confirm', async () => {
    stub200(null, 'Something happened.')
    const { labelOf, notices } = await driveRename()

    // Reverting on a guess is DATA LOSS — strictly worse than the uncertainty.
    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(notices).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE 409 — the ordinary arm, and the outside of its set
// ═══════════════════════════════════════════════════════════════════════════

describe('structural_rename 409 — a guaranteed no-write reverts and says so', () => {
  it("'BASE_HASH_DIVERGED' puts the old name back and renders the diverged notice", async () => {
    stub409('BASE_HASH_DIVERGED')
    const { labelOf, notices } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    // Bound to the exported constant, never to a prose fragment another string
    // could satisfy.
    expect(notices).toContain(STRUCTURAL_RENAME_NOTICE.base_hash_diverged)
    expect(notices).not.toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  })

  it("POSITIVE CONTROL: 'rpc_cas_conflict' — the OTHER guaranteed no-write — behaves identically", async () => {
    stub409('rpc_cas_conflict')
    const { labelOf, notices } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(PREVIOUS_LABEL)
    expect(notices).toContain(STRUCTURAL_RENAME_NOTICE.base_hash_diverged)
  })

  it('OPPOSITE TWIN: an unknown future category does NOT revert and takes the cannot-confirm line', async () => {
    stub409('some_future_conflict_category')
    const { labelOf, notices } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(notices).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
    expect(notices).not.toContain(STRUCTURAL_RENAME_NOTICE.base_hash_diverged)
  })

  it('OPPOSITE TWIN: a turn-fence category does NOT revert either', async () => {
    stub409('turn_fence_superseded')
    const { labelOf, notices } = await driveRename()

    expect(labelOf(NODE_ID)).toBe(NEW_LABEL)
    expect(notices).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  })
})

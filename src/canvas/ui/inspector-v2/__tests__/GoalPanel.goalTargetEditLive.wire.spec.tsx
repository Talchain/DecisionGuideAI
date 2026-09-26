/**
 * ⭐⭐⭐ THE GOAL TARGET, ARMED — end to end through the REAL wire chain, against
 * the replies CEE's reader actually sends.
 *
 * `GOAL_TARGET_EDIT_ENABLED` is `true` (read UNMOCKED here). What is real:
 * `InspectorRouter` → `GoalPanel` → `SuccessTargetLine` →
 * `useModelEditAuthority.proposeGoalTarget` → `buildGoalTargetEditEvent` →
 * the real `ConversationProvider` / `useConversation.sendSystemEvent` →
 * `buildV5Payload` → `callV5Turn` → parser → router → (200) `applyV5State` +
 * `reconcileAppliedGraph`, or (4xx/5xx) `SystemEventSendError` →
 * `settleSystemEventSend` → the pane's sentence. ONLY global `fetch` is a
 * double.
 *
 * ── THE REPLY FIXTURES ARE CEE #1859's, NOT INVENTED ─────────────────────────
 * olumi-assistants-service `fix/goal-target-edit-event` @ 9024dee1:
 *   · 200 — `dispatchGoalTargetEdit` (`src/orchestrator-v5/system-events/
 *     dispatch.ts:3335`) returns `composeToolCallResponse(...)` (`compose.ts:384`,
 *     `response_version: 2`, the `add_constraint` fact as a `graph_patch` block
 *     at `:617-632`) spread with `graph_hash` = the committed analysis hash
 *     (`dispatch.ts:3499`) and `draft_graph` = `buildAppliedGraphWireField`
 *     of the committed bytes (`:3501`); the route stamps `analysis_ready` with
 *     the freshness derivation (`compose/analysis-ready-emit.ts:179-205`) —
 *     `stale` / `graph_hash_diverged` over a prior run, as its own route test
 *     (h) pins. The goal row's `target_id` is the CONSTRAINT ROW id, not the
 *     goal id (route test (a)).
 *   · 409 — a stale `base_graph_hash` (`goal-target-edit.ts:172`) or the
 *     atomic-CAS race → `graphConflict` → `route-v2.ts:3467-3495`,
 *     `GRAPH_DIVERGED` with `details.conflict_category` `BASE_HASH_DIVERGED` /
 *     `rpc_cas_conflict` (route tests (d), (e)).
 *   · 422 — unknown / non-goal id, `at_least 0`, a handler refusal →
 *     `commitSkippedReason: 'refused_no_write'` (`dispatch.ts:3413`) →
 *     `route-v2.ts:3516-3533`, `details.reason: 'system_event_refused_no_write'`
 *     (route tests (f), (g0)).
 *   · 500 — commit failed / persisted read failed → `route-v2.ts:3535-3556`,
 *     `details.reason: 'system_event_commit_failed'`, `retryable: true`.
 * Envelope shape: `buildCommitFailureBoundaryError` (`route-v2.ts`).
 *
 * CLAIM SCOPE (trap 3): jsdom proves dispatch, text and state — never layout.
 * NO NETWORK, NO MODEL: `fetch` is stubbed and every other transport mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'

vi.mock('../../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})
vi.mock('../../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})
vi.mock('../../../utils/focusHelpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn(() => ({ authenticated: true, user: { id: 'u-1', email: 'a@b.io' } })) }
})

import { InspectorRouter } from '../InspectorRouter'
import { ConversationProvider, useOptionalConversationContext } from '../../../conversation/ConversationContext'
import { useCanvasStore } from '../../../store'
import { GOAL_TARGET_EDIT_ENABLED } from '../../../conversation/goalTargetEdit'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
/** The goal the reader edits. */
const GOAL = 'goal_mrr'
/** A SECOND goal on the same canvas — the body must name the edited one, not "a goal". */
const OTHER_GOAL = 'goal_nps'
const OPTION = 'opt_price'
const FACTOR = 'fac_price'
/** The analysis-space base the UI last saw (CEE's 16-hex `graph_hash`). */
const BASE = 'f3d31f75957c5cb5'
/** The hash CEE returns for the committed bytes. */
const NEXT = '9a7c2e41b0d35f68'
const ROW_ID = 'gc-mrr-target'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// ── the transport double: every body, and a queue of answers ─────────────────
const sentBodies: Array<Record<string, unknown>> = []
const answers: Array<{ status: number; body: unknown }> = []

function stubFetch() {
  const fetchStub = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    if (typeof init?.body === 'string') sentBodies.push(JSON.parse(init.body))
    const next = answers.shift()
    if (!next) throw new Error('test transport: no answer queued')
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

// ── the canvas ───────────────────────────────────────────────────────────────
function goalData(raw: number) {
  return {
    kind: 'goal',
    label: 'Reach £30k MRR within 18 months',
    goal_threshold_raw: raw,
    goal_threshold_unit: '£',
  }
}
const OTHER_GOAL_DATA = { kind: 'goal', label: 'Keep NPS above 40', goal_threshold_raw: 40, goal_threshold_unit: 'points' }

/**
 * ⚠ THE OTHER GOAL COMES FIRST, deliberately: a producer that picked "the first
 * goal" instead of the one the reader opened would name `goal_nps` and RED the
 * body assertion. Listing the edited goal first would let that mutant pass.
 */
function canvasNodes(): Node[] {
  return [
    { id: OTHER_GOAL, type: 'goal', position: { x: 0, y: 0 }, data: { ...OTHER_GOAL_DATA } },
    { id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data: goalData(25000) },
    { id: FACTOR, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Price' } },
    {
      id: OPTION, type: 'option', position: { x: 0, y: 0 },
      data: { kind: 'option', label: 'Raise price', interventions: { [FACTOR]: 0.6 } },
    },
  ] as unknown as Node[]
}

/** A prior run, FRESH on the base — so a committed edit has something to make stale. */
const PRIOR_RUN_VERDICT = {
  status: 'ready',
  options: [{ id: OPTION, label: 'Raise price', status: 'ready', interventions: { [FACTOR]: 0.6 }, is_baseline: false }],
  goal_node_id: GOAL,
  computed_at: '2026-09-25T09:00:00.000Z',
  freshness: 'fresh',
  freshness_reason: 'graph_hash_matches',
  graph_hash_at_run: BASE,
  current_graph_hash: BASE,
}

function seed() {
  sentBodies.length = 0
  answers.length = 0
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      lastServerGraphHash: BASE,
      nodes: canvasNodes(),
      edges: [],
      results: { status: 'idle', report: null },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      goalThreshold: null,
      goalThresholdRepresentation: null,
      goalConstraints: null,
      confirmedNodeIds: new Set(),
      analysisFreshness: null,
      analysisFreshnessDirty: false,
    } as never,
    false,
  )
  useCanvasStore.getState().setAnalysisFreshness(PRIOR_RUN_VERDICT)
}

// ── CEE #1859's replies ──────────────────────────────────────────────────────
/** The applied receipt for `at_least <raw> £` on GOAL. */
function appliedReceipt(raw: number) {
  const row = {
    constraint_id: ROW_ID,
    node_id: GOAL,
    operator: '>=',
    value: raw,
    label: 'Reach £30k MRR within 18 months',
    provenance: 'explicit',
    unit: '£',
    value_frame: 'level',
  }
  const wireNodes = [
    {
      id: GOAL, kind: 'goal', label: 'Reach £30k MRR within 18 months',
      goal_threshold_raw: raw, goal_threshold_unit: '£', goal_threshold_cap: 37500,
      goal_threshold_cap_provenance: 'target_derived_headroom', goal_threshold: raw / 37500,
      goal_threshold_frame: 'level',
    },
    { id: OTHER_GOAL, kind: 'goal', label: 'Keep NPS above 40', goal_threshold_raw: 40, goal_threshold_unit: 'points' },
    { id: FACTOR, kind: 'factor', label: 'Price' },
    { id: OPTION, kind: 'option', label: 'Raise price', interventions: { [FACTOR]: 0.6 } },
  ]
  return {
    response_version: 2,
    assistant_text: `Success target set: Reach £30k MRR within 18 months at least £${raw.toLocaleString('en-GB')}.`,
    blocks: [
      {
        type: 'graph_patch',
        status: 'applied',
        operation: 'add_constraint',
        target_id: ROW_ID,
        before: null,
        after: row,
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    graph_hash: NEXT,
    draft_graph: {
      nodes: wireNodes,
      edges: [],
      node_count: wireNodes.length,
      edge_count: 0,
      goal_constraints: [row],
    },
    analysis_ready: {
      status: 'ready',
      options: [{ id: OPTION, label: 'Raise price', status: 'ready', interventions: { [FACTOR]: 0.6 }, is_baseline: false }],
      goal_node_id: GOAL,
      computed_at: '2026-09-25T09:00:00.000Z',
      freshness: 'stale',
      freshness_reason: 'graph_hash_diverged',
      graph_hash_at_run: BASE,
      current_graph_hash: NEXT,
    },
  }
}

function envelope(opts: {
  error: string
  retryable: boolean
  details: Record<string, unknown>
}) {
  return {
    error: opts.error,
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: { retryable: opts.retryable, ...opts.details, stage: 'frame' },
    request_id: 'req_goal_target_1',
    retryable: opts.retryable,
  }
}
const STALE_BASE_409 = envelope({
  error: 'GRAPH_DIVERGED',
  retryable: false,
  details: {
    reason: 'graph_write_conflict',
    failure_type: 'GRAPH_DIVERGED',
    event_kind: 'goal_target_edit',
    recovery_action: 'refresh_and_reconfirm',
    conflict_category: 'BASE_HASH_DIVERGED',
    expected_base_graph_hash: '0123456789abcdef',
  },
})
const CAS_RACE_409 = envelope({
  error: 'GRAPH_DIVERGED',
  retryable: false,
  details: {
    reason: 'graph_write_conflict',
    failure_type: 'GRAPH_DIVERGED',
    event_kind: 'goal_target_edit',
    recovery_action: 'refresh_and_reconfirm',
    conflict_category: 'rpc_cas_conflict',
    expected_base_graph_hash: BASE,
  },
})
const REFUSED_NO_WRITE_422 = envelope({
  error: 'INGRESS_CONTRACT_VIOLATION',
  retryable: false,
  details: { reason: 'system_event_refused_no_write', event_kind: 'goal_target_edit' },
})
const COMMIT_FAILED_500 = envelope({
  error: 'INTERNAL_ERROR',
  retryable: true,
  details: { reason: 'system_event_commit_failed', event_kind: 'goal_target_edit' },
})

// ── the surface ──────────────────────────────────────────────────────────────
let conversation: ReturnType<typeof useOptionalConversationContext> = null
function CaptureConversation() {
  conversation = useOptionalConversationContext()
  return null
}

function openGoal() {
  return render(
    <ConversationProvider>
      <CaptureConversation />
      <InspectorRouter nodeId={GOAL} edgeId={null} onClose={vi.fn()} />
    </ConversationProvider>,
  )
}

async function stateTarget(amount: string, directionWord?: 'at least' | 'at most') {
  const user = userEvent.setup()
  await user.click(screen.getByTestId('goal-panel-target-edit'))
  if (directionWord !== undefined) {
    const select = screen.getByTestId('goal-panel-target-direction') as HTMLSelectElement
    const option = Array.from(select.options).find((o) => o.textContent === directionWord)
    expect(option, `no "${directionWord}" option`).toBeTruthy()
    await user.selectOptions(select, option!)
  }
  const input = screen.getByTestId('goal-panel-target-input')
  await user.clear(input)
  await user.type(input, amount)
  await user.click(screen.getByTestId('goal-panel-target-save'))
}

const outcome = () => screen.getByTestId('goal-panel-target-outcome').textContent ?? ''
const goalNode = (id: string) =>
  useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as Record<string, unknown>
const assistantTexts = () =>
  (conversation?.messages ?? []).filter((m) => m.role === 'assistant').map((m) => m.content)

beforeEach(() => {
  conversation = null
  seed()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  cleanup()
})

describe('PRECONDITION', () => {
  it('the typed carrier is armed in production — nothing here forces it', () => {
    expect(GOAL_TARGET_EDIT_ENABLED).toBe(true)
  })
})

describe('the body on the wire is the 0.59.0 contract member, for the goal the reader edited', () => {
  it('⭐ at least £30,000 → exactly one POST, exactly this body', async () => {
    const fetchStub = stubFetch()
    answers.push({ status: 200, body: appliedReceipt(30000) })
    openGoal()
    await stateTarget('30000')

    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1))
    expect(sentBodies).toHaveLength(1)
    // Byte-for-byte what CEE #1859's `validateIngress` parses
    // (`OrchestratorTurnPayloadSchema` 0.59.0, `SystemEventTurnPayloadSchema`
    // `.strict()` with `event: GoalTargetEditEvent.strict()`): `event.kind`, not
    // the UI's internal `type`; FLAT fields, no `payload` wrapper; no cap,
    // threshold, frame or provenance — the server derives those.
    expect(sentBodies[0]).toEqual({
      kind: 'system_event',
      turn_id: expect.stringMatching(UUID),
      scenario_id: SCENARIO,
      stage: expect.any(String),
      event: {
        kind: 'goal_target_edit',
        goal_node_id: GOAL,
        constraint_type: 'at_least',
        raw_value: 30000,
        unit: '£',
        base_graph_hash: BASE,
      },
    })
    // Identity, not "a goal": the other goal on this canvas is never named.
    expect(JSON.stringify(sentBodies[0])).not.toContain(OTHER_GOAL)
  })

  it('at most 0 is a real ceiling and reaches the wire as 0 (CEE route test (g0) commits it)', async () => {
    stubFetch()
    answers.push({ status: 200, body: appliedReceipt(25000) })
    openGoal()
    await stateTarget('0', 'at most')
    await waitFor(() => expect(sentBodies).toHaveLength(1))
    expect(sentBodies[0].event).toEqual({
      kind: 'goal_target_edit',
      goal_node_id: GOAL,
      constraint_type: 'at_most',
      raw_value: 0,
      unit: '£',
      base_graph_hash: BASE,
    })
  })

  it('CONTRAST — at least 0 never leaves the client (CEE would 422 it: route test (g0))', async () => {
    const fetchStub = stubFetch()
    openGoal()
    await stateTarget('0')
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

describe('a CEE-applied receipt: the target shown, the base, and the analysis all move', () => {
  it('⭐ the goal shows £30,000, the NEXT edit is based on the receipt hash, and the analysis reads changed', async () => {
    stubFetch()
    answers.push({ status: 200, body: appliedReceipt(30000) })
    answers.push({ status: 200, body: { ...appliedReceipt(35000), graph_hash: 'aaaabbbbccccdddd' } })
    openGoal()
    expect(screen.getByTestId('goal-panel-target-value')).toHaveTextContent('£25,000')

    await stateTarget('30000')

    // The store's goal node carries CEE's committed figure — delivered by the
    // receipt's `draft_graph`, never by a local echo.
    await waitFor(() => expect(goalNode(GOAL).goal_threshold_raw).toBe(30000))
    // The OTHER goal is untouched: the edit was bound to one identity.
    expect(goalNode(OTHER_GOAL).goal_threshold_raw).toBe(40)
    // And the reader sees it.
    await waitFor(() => expect(screen.getByTestId('goal-panel-target-value')).toHaveTextContent('£30,000'))
    expect(outcome()).toBe('Sent to Olumi. Its reply says whether the target was recorded.')
    // "Its reply says" is TRUE on this carrier: a 200 system-event receipt renders.
    expect(assistantTexts()).toContain('Success target set: Reach £30k MRR within 18 months at least £30,000.')

    // The readback: the base advanced to the receipt's hash, and CEE's `stale`
    // verdict over the prior run landed — the "Model changed" state.
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(NEXT)
    const freshness = useCanvasStore.getState().analysisFreshness
    expect(freshness?.freshness).toBe('stale')
    expect(freshness?.graphHashAtRun).toBe(BASE)
    expect(freshness?.currentGraphHash).toBe(NEXT)

    // ⭐ The next edit is written against the hash CEE just returned — so a
    // second target does not 409 on a base the UI failed to advance.
    await stateTarget('35000')
    await waitFor(() => expect(sentBodies).toHaveLength(2))
    expect((sentBodies[1].event as Record<string, unknown>).base_graph_hash).toBe(NEXT)
    expect((sentBodies[1].event as Record<string, unknown>).raw_value).toBe(35000)
  })
})

describe('every refusal CEE #1859 can send says its own sentence, and moves nothing', () => {
  async function refusedWith(status: number, body: unknown) {
    stubFetch()
    answers.push({ status, body })
    openGoal()
    await stateTarget('30000')
    await waitFor(() => expect(sentBodies).toHaveLength(1))
    await waitFor(() => expect(outcome()).not.toBe('Sent to Olumi. Its reply says whether the target was recorded.'))
  }
  function nothingMoved() {
    expect(goalNode(GOAL).goal_threshold_raw).toBe(25000)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(BASE)
    expect(screen.getByTestId('goal-panel-target-value')).toHaveTextContent('£25,000')
    // ⚠ And there is NO reply to point at — a refused system event renders no
    // transcript bubble, which is why the sentence may not say "the reply says why".
    expect(assistantTexts()).toEqual([])
  }

  it('⭐ 409 BASE_HASH_DIVERGED (stale base) → the model changed; the remedy is named', async () => {
    await refusedWith(409, STALE_BASE_409)
    expect(outcome()).toBe(
      'Not recorded — the model changed while this was sending, so nothing was written. Ask Olumi anything, then set the target again.',
    )
    nothingMoved()
  })

  it('409 rpc_cas_conflict (the atomic race) → the same conflict sentence', async () => {
    await refusedWith(409, CAS_RACE_409)
    expect(outcome()).toBe(
      'Not recorded — the model changed while this was sending, so nothing was written. Ask Olumi anything, then set the target again.',
    )
    nothingMoved()
  })

  it('⭐ 422 system_event_refused_no_write → refused, model unchanged, NO stale-base remedy', async () => {
    await refusedWith(422, REFUSED_NO_WRITE_422)
    expect(outcome()).toBe('Not recorded — this target was refused, so the model is unchanged.')
    nothingMoved()
  })

  it('500 system_event_commit_failed → cannot confirm; never "not recorded"', async () => {
    await refusedWith(500, COMMIT_FAILED_500)
    expect(outcome()).toBe(
      'Olumi may not have recorded this — its reply did not arrive. Check before setting it again.',
    )
    expect(outcome()).not.toMatch(/not recorded/i)
  })
})

/**
 * #2873 — a core canvas-event acknowledgement with no chat reply.
 *
 * After a canvas edit, core answers the `system_event` turn with its committed graph, a `graph_hash` and a valid
 * `analysis_state`, but with EMPTY `assistant_text`, `blocks` and `suggested_actions` (the served edit turn in
 * `v5/__tests__/fixtures/core-freshness-5e28e10f-edit.json` is that shape). The router calls it `empty`. Before #2873
 * the hook skipped the state applicator for every `empty` target and added "I received your message but couldn't
 * generate a response", so the edit's saved state never reached the canvas and the user was told it had failed.
 *
 * Driven through the REAL seam: stubbed global `fetch` → real `callV5Turn` → real `parseV5Response` → real
 * `routeV5Response` → `useConversation`'s V5 branch, on the core lane (`#/canvas?ai=core`).
 *
 * Every assertion binds by identity: the exact hash string, the parsed verdict, the node id's committed label, the
 * exact failure sentence, and the `reportTurnFailure` kind.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'

import { useConversation, SystemEventSendError } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useActionBarStore } from '../actionBar/actionBarStore'
import servedCoreEditTurn from '../../../v5/__tests__/fixtures/core-freshness-5e28e10f-edit.json'

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
    constructor(message: string, status: number, body: unknown) {
      super(message)
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

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

// The lifecycle's verdict on the turn: spied, the real module otherwise kept.
const reportTurnFailureSpy = vi.fn()
vi.mock('../turnLifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../turnLifecycle')>()
  return {
    ...actual,
    reportTurnFailure: (report: Parameters<typeof actual.reportTurnFailure>[0]) => {
      reportTurnFailureSpy(report)
      actual.reportTurnFailure(report)
    },
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const OTHER_SCENARIO_ID = 'f9f9f9f9-e8e8-4d7d-8c6c-b5b5b5b5b5b5'
const FACTOR_ID = 'fac_unit_price'
const GOAL_ID = 'goal_revenue'

const PRIOR_HASH = 'prior0000hash001'
const ACK_HASH = 'ack2873quiet0001'
const USER_REPLY_HASH = 'user2873reply001'

const FACTOR_LABEL_BEFORE = 'Unit price'
const FACTOR_LABEL_COMMITTED = 'Unit price (committed)'
const GOAL_LABEL = 'Revenue'

const EMPTY_REPLY_COPY = "I received your message but couldn't generate a response. Try rephrasing."

/** The served core edit turn's own verdict (real wire bytes, scenario 5e28e10f). */
const SERVED_STATE = (servedCoreEditTurn as { analysis_state: Record<string, unknown> }).analysis_state
const SERVED_COMPUTED_AT = '2026-10-21T00:17:49.704Z'
/** The same verdict with a run_state kind the contract does not have. */
const INVALID_STATE = { ...SERVED_STATE, run_state: { kind: 'teapot' } }

/** A sentinel for "the verdict this session held before the turn". Identity-compared, never parsed. */
const PRIOR_STATE = Object.freeze({ prior_marker: 'held-before-turn' })
/** A sentinel for "the action bar from the previous answer". Identity-compared. */
const PRIOR_BAR = Object.freeze({ priority: [], standard: [], more: [], prior_marker: 'previous-answer' })

const FACTOR_EDIT_EVENT = {
  type: 'factor_value_edit' as const,
  payload: { target_id: FACTOR_ID, value: 42, base_graph_hash: PRIOR_HASH },
}

function committedGraph() {
  return {
    nodes: [
      { id: FACTOR_ID, kind: 'factor', label: FACTOR_LABEL_COMMITTED, category: 'controllable' },
      { id: GOAL_ID, kind: 'goal', label: GOAL_LABEL },
    ],
    edges: [],
    node_count: 2,
    edge_count: 0,
  }
}

/** The quiet acknowledgement: graph + hash + valid verdict, no text, no blocks, no chips. */
function quietAckBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    graph_hash: ACK_HASH,
    draft_graph: committedGraph(),
    analysis_state: SERVED_STATE,
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete body[k]
    else body[k] = v
  }
  return body
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function stubFetchWith(status: number, body: unknown) {
  const fetchStub = vi.fn(async () => jsonResponse(status, body))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

/** First call waits for `release`; later calls answer with `later` at once. */
function stubFetchHeldFirst(later: { status: number; body: unknown }) {
  let release!: (r: Response) => void
  const held = new Promise<Response>((r) => {
    release = r
  })
  let calls = 0
  const fetchStub = vi.fn(async () => {
    calls += 1
    return calls === 1 ? held : jsonResponse(later.status, later.body)
  })
  vi.stubGlobal('fetch', fetchStub)
  return { fetchStub, release: (status: number, body: unknown) => release(jsonResponse(status, body)) }
}

function seedCanvas() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: FACTOR_LABEL_BEFORE, kind: 'factor' } },
      { id: GOAL_ID, type: 'goal', position: { x: 200, y: 0 }, data: { label: GOAL_LABEL, kind: 'goal' } },
    ] as unknown as Node[],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    lastServerGraphHash: PRIOR_HASH,
    analysisStateV1: PRIOR_STATE,
  } as never)
  useActionBarStore.getState().setBar(SCENARIO_ID, PRIOR_BAR as never)
}

function factorLabel(): unknown {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)
  return (node?.data as { label?: unknown } | undefined)?.label
}

function failureKinds(): string[] {
  return reportTurnFailureSpy.mock.calls.map((c) => (c[0] as { kind: string }).kind)
}

/** Drive one system event to completion and capture its outcome without an unhandled rejection. */
async function runSystemEvent() {
  const hook = renderHook(() => useConversation())
  let outcome: unknown = 'not-run'
  await act(async () => {
    outcome = await hook.result.current
      .sendSystemEvent(FACTOR_EDIT_EVENT)
      .then(() => 'resolved', (e: unknown) => e)
  })
  return { hook, outcome }
}

/** Nothing from the response reached the state: hash, verdict and committed graph are the pre-turn ones. */
function expectNothingApplied() {
  const s = useCanvasStore.getState()
  expect(s.lastServerGraphHash).toBe(PRIOR_HASH)
  expect(s.analysisStateV1).toBe(PRIOR_STATE)
  expect(factorLabel()).toBe(FACTOR_LABEL_BEFORE)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/#/canvas?ai=core')
  seedCanvas()
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Preconditions — the fixtures mean what the cases below say they mean
// ---------------------------------------------------------------------------

describe('preconditions', () => {
  it('the served core edit verdict is AnalysisStateV1-valid, and the teapot variant is not', () => {
    expect(AnalysisStateV1Schema.safeParse(SERVED_STATE).success).toBe(true)
    expect(AnalysisStateV1Schema.safeParse(INVALID_STATE).success).toBe(false)
    expect((SERVED_STATE as { run_state: { computed_at: string } }).run_state.computed_at).toBe(SERVED_COMPUTED_AT)
  })

  it('the turn goes out on the core lane as a system_event', async () => {
    const fetchStub = stubFetchWith(200, quietAckBody())
    await runSystemEvent()
    expect(fetchStub).toHaveBeenCalledTimes(1)
    const [, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit]
    expect(new Headers(init.headers).get('x-olumi-ai-mode')).toBe('core')
    const sent = JSON.parse(String(init.body)) as { kind?: string; event?: { kind?: string; target_id?: string } }
    expect(sent.kind).toBe('system_event')
    expect(sent.event).toMatchObject({ kind: 'factor_value_edit', target_id: FACTOR_ID })
  })
})

// ---------------------------------------------------------------------------
// (a) The quiet acknowledgement enters the existing reconciliation
// ---------------------------------------------------------------------------

describe('(a) a valid quiet core ACK applies its state, with no failure message', () => {
  it('applies the exact graph_hash, the parsed verdict and the committed graph; adds no message; reports no failure; keeps the action bar', async () => {
    stubFetchWith(200, quietAckBody())

    const { hook, outcome } = await runSystemEvent()

    expect(outcome).toBe('resolved')
    const s = useCanvasStore.getState()
    expect(s.lastServerGraphHash).toBe(ACK_HASH)
    expect(s.analysisStateV1).toEqual(AnalysisStateV1Schema.parse(SERVED_STATE))
    expect((s.analysisStateV1 as { run_state: { kind: string; computed_at: string } }).run_state).toMatchObject({
      kind: 'complete_stale',
      computed_at: SERVED_COMPUTED_AT,
    })
    // The committed graph reconciled onto the canvas, by node id (the goal, which did not change, is untouched).
    expect(factorLabel()).toBe(FACTOR_LABEL_COMMITTED)
    expect(
      (useCanvasStore.getState().nodes.find((n) => n.id === GOAL_ID)?.data as { label?: unknown }).label,
    ).toBe(GOAL_LABEL)
    // No "couldn't generate" bubble, and no message at all for a quiet system turn.
    expect(hook.result.current.messages.map((m) => m.content)).not.toContain(EMPTY_REPLY_COPY)
    expect(hook.result.current.messages).toHaveLength(0)
    expect(failureKinds()).toEqual([])
    // The previous answer's action bar stays (the ACK carries none and must not clear it).
    expect(useActionBarStore.getState().bar).toBe(PRIOR_BAR)
    expect(useActionBarStore.getState().scenarioId).toBe(SCENARIO_ID)
  })
})

// ---------------------------------------------------------------------------
// (b) A user's empty chat reply is still a failure
// ---------------------------------------------------------------------------

describe('(b) control: an empty reply to a USER message keeps its failure handling', () => {
  it('shows the empty-reply failure with a retry chip and applies nothing, even with graph + hash + valid verdict', async () => {
    stubFetchWith(200, quietAckBody())

    const hook = renderHook(() => useConversation())
    await act(async () => {
      await hook.result.current.sendMessage('What changed?')
    })

    const last = hook.result.current.messages[hook.result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.synthetic).toBe(true)
    expect(last.content).toBe(EMPTY_REPLY_COPY)
    expect(last.actionChips?.map((c) => c.id)).toEqual(['retry'])
    expect(hook.result.current.lastSendFailure).toMatchObject({ kind: 'transport', inputText: 'What changed?' })
    expect(failureKinds()).toEqual(['empty'])
    expectNothingApplied()
  })
})

// ---------------------------------------------------------------------------
// (c) An incomplete or malformed acknowledgement is not a quiet ACK
// ---------------------------------------------------------------------------

describe('(c) a missing or malformed ACK keeps its failure handling and applies nothing', () => {
  const emptyFailureCases: Array<[string, Record<string, unknown>]> = [
    ['no draft_graph', { draft_graph: undefined }],
    ['no graph_hash', { graph_hash: undefined }],
    ['a whitespace-only graph_hash', { graph_hash: '   ' }],
    ['no analysis_state', { analysis_state: undefined }],
    ['a schema-invalid analysis_state (run_state kind "teapot")', { analysis_state: INVALID_STATE }],
  ]
  for (const [name, overrides] of emptyFailureCases) {
    it(`${name}: the empty-reply failure stands`, async () => {
      stubFetchWith(200, quietAckBody(overrides))

      const { hook, outcome } = await runSystemEvent()

      expect(outcome).toBe('resolved')
      expect(hook.result.current.messages.map((m) => m.content)).toEqual([EMPTY_REPLY_COPY])
      expect(hook.result.current.messages[0].synthetic).toBe(true)
      expect(failureKinds()).toEqual(['empty'])
      expectNothingApplied()
    })
  }

  const parseFailureCases: Array<[string, Record<string, unknown>]> = [
    ['an empty-string graph_hash', { graph_hash: '' }],
    ['a draft_graph whose nodes is not an array', { draft_graph: { ...committedGraph(), nodes: 'not-a-list' } }],
  ]
  for (const [name, overrides] of parseFailureCases) {
    it(`${name}: the strict parse refuses it, the event rejects, nothing is applied`, async () => {
      stubFetchWith(200, quietAckBody(overrides))

      const { hook, outcome } = await runSystemEvent()

      expect(outcome).toBeInstanceOf(SystemEventSendError)
      expect(hook.result.current.messages).toHaveLength(0)
      expect(failureKinds()).toHaveLength(1)
      expect(failureKinds()[0]).not.toBe('empty')
      expectNothingApplied()
    })
  }
})

// ---------------------------------------------------------------------------
// (d) Typed errors keep their error
// ---------------------------------------------------------------------------

describe('(d) a typed error keeps its error', () => {
  it('a 500 BoundaryError rejects the system event with SystemEventSendError and applies nothing', async () => {
    stubFetchWith(500, {
      error: 'INTERNAL_ERROR',
      boundary: 'B1',
      direction: 'egress',
      validator: 'system_event_pipeline',
      details: { retryable: true, stage: 'frame' },
      request_id: 'req_quiet_ack_500',
      retryable: true,
    })

    const { hook, outcome } = await runSystemEvent()

    expect(outcome).toBeInstanceOf(SystemEventSendError)
    expect(hook.result.current.messages).toHaveLength(0)
    expect(failureKinds()).toEqual(['server'])
    expectNothingApplied()
  })

  it('a 200 with a FATAL error block rejects even though it carries graph + hash + valid verdict', async () => {
    stubFetchWith(200, quietAckBody({ blocks: [{ type: 'error', error_code: 'INTERNAL_ERROR', severity: 'error' }] }))

    const { hook, outcome } = await runSystemEvent()

    expect(outcome).toBeInstanceOf(SystemEventSendError)
    expect(hook.result.current.messages).toHaveLength(0)
    expect(failureKinds()).toHaveLength(1)
    expect(failureKinds()[0]).not.toBe('empty')
    expectNothingApplied()
  })
})

// ---------------------------------------------------------------------------
// (e) A stale or foreign acknowledgement stays fenced out
// ---------------------------------------------------------------------------

describe('(e) a stale or foreign quiet ACK is fenced out', () => {
  it('another scenario: the user left the scenario while the ACK was in flight — nothing applied, no message', async () => {
    const { release } = stubFetchHeldFirst({ status: 200, body: quietAckBody() })
    const hook = renderHook(() => useConversation())

    let pending!: Promise<unknown>
    await act(async () => {
      pending = hook.result.current.sendSystemEvent(FACTOR_EDIT_EVENT).then(() => 'resolved', (e: unknown) => e)
      await new Promise((r) => setTimeout(r, 0))
    })
    act(() => {
      useCanvasStore.setState({ currentScenarioId: OTHER_SCENARIO_ID } as never)
    })
    await act(async () => {
      release(200, quietAckBody())
      await pending
    })

    expect(hook.result.current.messages).toHaveLength(0)
    expectNothingApplied()
    expect(failureKinds()).not.toContain('empty')
  })

  it('a superseded turn: a newer user send pre-empted the edit turn — its late ACK applies nothing', async () => {
    const userReply = {
      response_version: 2,
      assistant_text: 'Here is where things stand.',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
      graph_hash: USER_REPLY_HASH,
    }
    const { fetchStub, release } = stubFetchHeldFirst({ status: 200, body: userReply })
    const hook = renderHook(() => useConversation())

    let pendingSystem!: Promise<unknown>
    await act(async () => {
      pendingSystem = hook.result.current.sendSystemEvent(FACTOR_EDIT_EVENT).then(() => 'resolved', (e: unknown) => e)
      await new Promise((r) => setTimeout(r, 0))
    })
    await act(async () => {
      await hook.result.current.sendMessage('Where do things stand?')
    })
    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(USER_REPLY_HASH)

    await act(async () => {
      release(200, quietAckBody())
      await pendingSystem
    })

    const s = useCanvasStore.getState()
    expect(s.lastServerGraphHash).toBe(USER_REPLY_HASH)
    expect(s.analysisStateV1).not.toEqual(AnalysisStateV1Schema.parse(SERVED_STATE))
    expect(factorLabel()).toBe(FACTOR_LABEL_BEFORE)
    expect(hook.result.current.messages.map((m) => m.content)).not.toContain(EMPTY_REPLY_COPY)
  })
})

// ---------------------------------------------------------------------------
// (f) Warnings or chips make it a reply, not a quiet ACK
// ---------------------------------------------------------------------------

describe('(f) empty text with warnings or chips is NOT a quiet ACK', () => {
  const notQuietCases: Array<[string, Record<string, unknown>]> = [
    ['a warn-severity error block', { blocks: [{ type: 'error', error_code: 'INTERNAL_ERROR', severity: 'warn' }] }],
    ['an info-severity error block', { blocks: [{ type: 'error', error_code: 'INTERNAL_ERROR', severity: 'info' }] }],
    [
      'a suggested action',
      { suggested_actions: [{ id: 'chip_rerun_2873', label: 'Run again', message: 'Run the analysis again' }] },
    ],
  ]
  for (const [name, overrides] of notQuietCases) {
    it(`${name}: keeps the empty-reply failure and applies nothing`, async () => {
      stubFetchWith(200, quietAckBody(overrides))

      const { hook, outcome } = await runSystemEvent()

      expect(outcome).toBe('resolved')
      expect(hook.result.current.messages.map((m) => m.content)).toEqual([EMPTY_REPLY_COPY])
      expect(failureKinds()).toEqual(['empty'])
      expectNothingApplied()
    })
  }
})

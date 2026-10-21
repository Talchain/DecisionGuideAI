/**
 * #2875, end to end through the hook — a core canvas edit's quiet ACK, then the automatic Run.
 *
 * Driven through the REAL seam on the core lane (`#/canvas?ai=core`): stubbed global `fetch` → real `callV5Turn` →
 * real `parseV5Response` → real `routeV5Response` → `useConversation`'s V5 branch → `applyV5State` → the
 * applied-receipt reconcile (`reconcileAppliedGraph`). Nothing in the conversation module is mocked.
 *
 * (3) Two edits queued behind a turn in flight: each quiet ACK settles ONLY its own queue entry, and the other
 *     edit, still unconfirmed, keeps the model held as changed until its own ACK lands.
 * (4) Quiet ACK → the automatic Run (core: no `analysis_ready`; `run_state: complete_current`, the analysis_result
 *     computed against the same `graph_hash`, a readback `draft_graph` that moves the canvas) → the live freshness
 *     reads current with no manual Rerun.
 *
 * The automatic Run is dispatched the way `useAnalyseAfterCommittedChange` → the canonical runner reaches the hook:
 * a hidden `run_analysis` turn initiated automatically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useConversation, SEND_DEFERRED } from '../useConversation'
import { useCanvasStore } from '../../store'
import { classifyFreshnessForDisplay } from '../../store/analysisFreshness'
import servedEditTurn from '../../../v5/__tests__/fixtures/core-freshness-5e28e10f-edit.json'
import servedRunTurn from '../../../v5/__tests__/fixtures/core-freshness-5e28e10f-run.json'

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const GOAL_ID = 'usable_field_goal'
const FACTOR_A = 'usable_field_goal__change'
const FACTOR_B = 'eyepiece_field_stop'

const PRIOR_HASH = 'prior0000hash001'
/** The served edit's committed hash, which its Run was then computed against. */
const EDIT_HASH = '19ed7f3dc288c81b'
const EDIT_B_HASH = 'b2875edithash002'

/** The served core edit turn's own verdict (complete_stale). */
const EDIT_STATE = (servedEditTurn as { analysis_state: Json }).analysis_state

function seedCanvas() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: GOAL_ID, type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Usable field' } },
      { id: FACTOR_A, type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Field gain', observedState: { value: 20 } } },
      { id: FACTOR_B, type: 'factor', position: { x: 240, y: 200 }, data: { kind: 'factor', label: 'Field stop', observedState: { value: 5 } } },
    ] as unknown as Node[],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    lastServerGraphHash: PRIOR_HASH,
    lastAuthoritativeGraph: null,
    analysisFreshness: null,
    // The local edit has already dirtied the overlay, as the inspector's write does before the event is sent.
    analysisFreshnessDirty: true,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
  } as never)
}

/** The committed graph as core reads it back. `aValue` / `bValue` are the factors' persisted figures. */
function committedGraph(aValue: number, bValue: number): Json {
  return {
    nodes: [
      { id: GOAL_ID, kind: 'goal', label: 'Usable field' },
      { id: FACTOR_A, kind: 'factor', label: 'Field gain', observed_state: { value: aValue } },
      { id: FACTOR_B, kind: 'factor', label: 'Field stop', observed_state: { value: bValue } },
    ],
    edges: [],
    node_count: 3,
    edge_count: 0,
  }
}

/** A core quiet ACK: committed graph, hash and valid verdict; no text, blocks or chips. */
function quietAck(hash: string, graph: Json): Json {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    graph_hash: hash,
    draft_graph: graph,
    analysis_state: EDIT_STATE,
  }
}

/** The served core Run (no analysis_ready; complete_current; result computed against EDIT_HASH) with its readback. */
function coreRun(graph: Json, patch: (r: Json) => void = () => undefined): Json {
  const r = clone(servedRunTurn) as Json
  delete r._capture
  r.draft_graph = graph
  patch(r)
  return r
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

/** Every call waits until the test releases it, by call index (0-based). */
function stubHeldFetch() {
  const releases: Array<(r: Response) => void> = []
  const fetchStub = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        releases.push(resolve)
      }),
  )
  vi.stubGlobal('fetch', fetchStub)
  return {
    fetchStub,
    release: (index: number, status: number, body: unknown) => releases[index](jsonResponse(status, body)),
    sentEvent: (index: number) => {
      const [, init] = fetchStub.mock.calls[index] as unknown as [string, RequestInit]
      return (JSON.parse(String(init.body)) as { event?: { kind?: string; target_id?: string } }).event
    },
  }
}

function stubFetchSequence(bodies: Array<{ status: number; body: unknown }>) {
  let i = 0
  const fetchStub = vi.fn(async () => {
    const next = bodies[Math.min(i, bodies.length - 1)]
    i += 1
    return jsonResponse(next.status, next.body)
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const editEvent = (target: string, value: number) => ({
  type: 'factor_value_edit' as const,
  payload: { target_id: target, value, base_graph_hash: PRIOR_HASH },
})

const live = () => {
  const s = useCanvasStore.getState()
  return classifyFreshnessForDisplay(s.analysisFreshness, s.analysisFreshnessDirty, s.importPendingServerRegistration)
}

const factorValue = (id: string) =>
  ((useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as Json | undefined)?.observedState as
    | { value?: unknown }
    | undefined)?.value

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
// (3) Queued quiet ACKs settle only their own entries
// ---------------------------------------------------------------------------

describe('(3) a queued quiet ACK settles only its own queue entry', () => {
  it('A settles (count 2 → 1) while B, still unconfirmed, keeps the model held; B\'s own ACK brings the count to 0', async () => {
    const wire = stubHeldFetch()
    const hook = renderHook(() => useConversation())

    // A turn is in flight, so both edits queue behind it.
    let chat!: Promise<void>
    await act(async () => {
      chat = hook.result.current.sendMessage('What matters most here?')
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(wire.fetchStub).toHaveBeenCalledTimes(1)

    let outcomeA: unknown
    let outcomeB: unknown
    await act(async () => {
      outcomeA = await hook.result.current.sendSystemEvent(editEvent(FACTOR_A, 20.2))
      outcomeB = await hook.result.current.sendSystemEvent(editEvent(FACTOR_B, 7))
    })
    expect(outcomeA).toBe(SEND_DEFERRED)
    expect(outcomeB).toBe(SEND_DEFERRED)
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(2)

    // The chat turn settles; the queue drains one entry: A goes on the wire.
    await act(async () => {
      wire.release(0, 200, { response_version: 2, assistant_text: 'The field gain matters most.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'analyse' })
      await chat
    })
    await waitFor(() => expect(wire.fetchStub).toHaveBeenCalledTimes(2))
    expect(wire.sentEvent(1)).toMatchObject({ kind: 'factor_value_edit', target_id: FACTOR_A })
    expect(useCanvasStore.getState().pendingEmittedEdits, 'A is counted until its reply is accepted').toBe(2)

    // A's quiet ACK: A is settled, B (queued, unconfirmed) goes on the wire and stays counted.
    await act(async () => {
      wire.release(1, 200, quietAck(EDIT_HASH, committedGraph(20.2, 5)))
    })
    await waitFor(() => expect(wire.fetchStub).toHaveBeenCalledTimes(3))
    expect(wire.sentEvent(2)).toMatchObject({ kind: 'factor_value_edit', target_id: FACTOR_B })
    let s = useCanvasStore.getState()
    expect(s.lastServerGraphHash).toBe(EDIT_HASH)
    expect(s.pendingEmittedEdits).toBe(1)
    expect(s.analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
    expect(hook.result.current.messages.map((m) => m.content)).not.toContain(
      "I received your message but couldn't generate a response. Try rephrasing.",
    )

    // B's own quiet ACK settles B.
    await act(async () => {
      wire.release(2, 200, quietAck(EDIT_B_HASH, committedGraph(20.2, 7)))
    })
    await waitFor(() => expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0))
    s = useCanvasStore.getState()
    expect(s.lastServerGraphHash).toBe(EDIT_B_HASH)
    expect(wire.fetchStub).toHaveBeenCalledTimes(3)
  })
})

// ---------------------------------------------------------------------------
// (4) Quiet ACK → automatic Run → current
// ---------------------------------------------------------------------------

describe('(4) quiet ACK → automatic core Run → the live freshness reads current', () => {
  async function editThenAutomaticRun(run: Json) {
    const fetchStub = stubFetchSequence([
      { status: 200, body: quietAck(EDIT_HASH, committedGraph(20.2, 5)) },
      { status: 200, body: run },
    ])
    const hook = renderHook(() => useConversation())

    await act(async () => {
      await hook.result.current.sendSystemEvent(editEvent(FACTOR_A, 20.2))
    })
    // The quiet ACK landed: its hash and verdict are held, nothing failed, the model still reads changed.
    expect(useCanvasStore.getState().lastServerGraphHash, 'PRECONDITION: the ACK applied').toBe(EDIT_HASH)
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_stale')
    expect(live(), 'PRECONDITION: the edit reads as a change before the Run').not.toBe('current')

    // The automatic Run (hidden run_analysis, initiated automatically), as the after-change runner dispatches it.
    await act(async () => {
      await hook.result.current.sendMessage('Run analysis', {
        hidden: true,
        turnType: 'run_analysis',
        debugInitiatedBy: 'automatic',
        debugSource: 'after-change',
      })
    })
    expect(fetchStub).toHaveBeenCalledTimes(2)
    return hook
  }

  it('⭐ the Run\'s readback moves the canvas and the live freshness reads current, with no manual Rerun', async () => {
    // The readback carries the factor as the engine persisted it (20.25), not as the canvas shows it (20.2).
    const hook = await editThenAutomaticRun(coreRun(committedGraph(20.25, 5)))

    const s = useCanvasStore.getState()
    expect(factorValue(FACTOR_A), 'PRECONDITION: the receipt was a real reconcile').toBe(20.25)
    expect(s.results?.status).toBe('complete')
    expect(s.analysisStateV1?.run_state.kind).toBe('complete_current')
    expect(s.analysisFreshness).toMatchObject({ freshness: 'fresh', graphHashAtRun: EDIT_HASH, currentGraphHash: EDIT_HASH })
    expect(s.analysisFreshnessDirty).toBe(false)
    expect(live()).toBe('current')
    expect(hook.result.current.messages.map((m) => m.content)).not.toContain(
      "I received your message but couldn't generate a response. Try rephrasing.",
    )
  })

  it('CONTROL: the same Run computed against another hash leaves the model changed', async () => {
    await editThenAutomaticRun(
      coreRun(committedGraph(20.25, 5), (r) => {
        ;(r.blocks as Json[])[0] = { ...((r.blocks as Json[])[0]), computed_against_hash: 'ffffffffffffffff' }
      }),
    )
    expect(factorValue(FACTOR_A)).toBe(20.25)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
  })
})

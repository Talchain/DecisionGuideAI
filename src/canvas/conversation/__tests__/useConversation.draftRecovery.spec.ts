/**
 * ROADMAP 2.1257 — in-session draft recovery after stream loss.
 *
 * THE SEAM. When a draft's SSE stream dies and the buffered fallback cannot
 * re-draft (CEE's continuation guard declines on a committed scenario), the
 * server usually HOLDS the drafted graph — and until this change the UI's only
 * reader of it was boot hydration, so the user was offered "Start a new draft"
 * for a model one request away. These tests pin the new order: the scenario-
 * graph read is ATTEMPTED FIRST, and the copy is chosen from its RESULT.
 *
 * Harness is streamedDraftTurn.spec.ts's: a real ReadableStream through the
 * real streamStageFrames → consumeStreamedDraftTurn → fallback → parse chain,
 * with only the network seams mocked. The recovery read is mocked at the
 * ADAPTER (`fetchScenarioGraph`) so the REAL ingestion authority runs — the
 * same `hydrateCanvasFromServer` → `mergeServerGraphOnHydrate` chain boot
 * hydration uses. Mocking any deeper would let a second ingestion path hide.
 *
 * MUTATION OBLIGATIONS (run in a throwaway worktree, per the lane brief):
 *   M1 — call site skips the recovery fetch (straight to start-new-draft):
 *        "recovers the committed draft…" and the terminal-error twin RED.
 *   M2 — recovery claims success on a 404 (`notReadable` → 'recovered'):
 *        "states the standing truth on 404…" (the honesty pin) REDs.
 *   M3 — recovery does not release the unsettled phase on success:
 *        the phase/run-gate assertions in the success tests RED.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useConversation, START_NEW_DRAFT_CHIP_ID } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore, draftStreamPhaseFor } from '../../stores/draftStore'
import { canRunAnalysis, DRAFT_VALUES_UNSETTLED_REFUSAL } from '../../utils/canRunAnalysis'
import {
  UNSETTLED_DRAFT_NOTICE,
  DRAFT_FAILED_MODEL_KEPT_NOTICE,
  DRAFT_RECOVERED_STREAM_LOSS_NOTICE,
  DRAFT_RECOVERED_TERMINAL_ERROR_NOTICE,
} from '../../components/DraftLoadingAnimation'
import type { ScenarioGraphResult } from '../../../adapters/cee/scenarioGraph'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

// ---------------------------------------------------------------------------
// Network seams — the only things mocked
// ---------------------------------------------------------------------------

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()
const mockFetchScenarioGraph = vi.fn<unknown[], Promise<ScenarioGraphResult>>()
const mockStopV5Turn = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ kind: 'not_saved' as const }),
)

vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: (...args: unknown[]) => mockStopV5Turn(...args),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args),
  }
})

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
    getV5Endpoint: () => 'https://cee.test/proxy/v5/turn',
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }) }
})

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))

// The recovery read, mocked at the ADAPTER so hydrateCanvasFromServer and
// mergeServerGraphOnHydrate — the one ingestion authority — run for real.
vi.mock('../../../adapters/cee/scenarioGraph', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters/cee/scenarioGraph')>()
  return {
    ...actual,
    fetchScenarioGraph: (...args: unknown[]) => mockFetchScenarioGraph(...args),
  }
})

// ---------------------------------------------------------------------------
// Fixtures — the live 29 Jul wire shape (same provenance as streamedDraftTurn)
// ---------------------------------------------------------------------------

const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const TERMINAL_GRAPH = TERMINAL_BODY.draft_graph as {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}

/**
 * The GRAPH_READY frame's graph: SAME identities, values zeroed — the frame
 * contract ("identity is stable, values settle"). Derived from the terminal
 * graph so the two cannot drift and hollow out the value assertions below.
 */
const READY_GRAPH = {
  nodes: TERMINAL_GRAPH.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
  edges: TERMINAL_GRAPH.edges.map((e) => ({ from: e.from, to: e.to, strength: { mean: 0 } })),
}

/**
 * What the SERVER holds after the commit: `scenarios.graph` verbatim — for a
 * committed draft that is the terminal graph, values included. This is the
 * body the recovery read returns.
 */
function serverGraphResult(): ScenarioGraphResult {
  return {
    status: 'graph',
    graph: { nodes: TERMINAL_GRAPH.nodes, edges: TERMINAL_GRAPH.edges },
    briefText: null,
    notModelled: null,
    identity: { value: 'srv-hash-1', projectionVersion: 'p1' },
    layoutPresent: false,
    requestId: 'req-recovery-1',
  }
}

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}
const F_DRAFTING = frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
const F_GRAPH_READY = frame({
  stage: 'GRAPH_READY',
  seq: 2,
  status: 'in_progress',
  schema_version: 'v3',
  elapsed_ms: 35_834,
  graph: READY_GRAPH,
})

function controllableStream() {
  const encoder = new TextEncoder()
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })
  const res = new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))
    })
  let closed = false
  return {
    response: res,
    async push(text: string) {
      if (!closed) ctrl.enqueue(encoder.encode(text))
      await settle()
    },
    async fail() {
      if (!closed) {
        closed = true
        try {
          ctrl.error(new Error('socket hung up'))
        } catch {
          /* already closed */
        }
      }
      await settle()
    },
  }
}

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const BRIEF = 'Should we build or buy a billing system for our new SaaS product?'

/** CEE's decline prose — the buffered fallback on a committed scenario. */
const DECLINE_RESPONSE = {
  kind: 'response' as const,
  response: {
    response_version: 2,
    assistant_text: 'Your billing system decision model is already drafted with four options.',
    blocks: [],
  },
}

/**
 * Drive: stream dies after GRAPH_READY → buffered fallback DECLINES → the
 * unsettled path, where recovery now runs. Returns the hook handle.
 */
async function driveStreamLossDecline() {
  const stream = controllableStream()
  mockOpenStream.mockResolvedValue(stream.response)
  mockCallV5Turn.mockResolvedValue(DECLINE_RESPONSE)
  const { result } = renderHook(() => useConversation())
  let sent!: Promise<void>
  await act(async () => {
    sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
  })
  await stream.push(F_DRAFTING + F_GRAPH_READY)
  await stream.fail()
  await act(async () => {
    await sent
  })
  return result
}

function runGate() {
  const currentScenarioId = useCanvasStore.getState().currentScenarioId
  return canRunAnalysis({
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: useCanvasStore.getState().nodes.length,
    draftStreamPhase: draftStreamPhaseFor(useDraftStore.getState(), currentScenarioId),
  })
}

/** Identity-bound edge lookup (trap 19): endpoint pair, never a value hunt. */
function canvasEdgeWeight(sourceId: string, targetId: string): number | undefined {
  const edge = useCanvasStore
    .getState()
    .edges.find((e: { source: string; target: string }) => e.source === sourceId && e.target === targetId) as
    | { data?: { weight?: number } }
    | undefined
  expect(edge, `edge ${sourceId}->${targetId} must exist on the canvas`).toBeDefined()
  return edge?.data?.weight
}

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  mockFetchScenarioGraph.mockReset()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    history: { past: [], future: [] },
    _internal: {
      ...(useCanvasStore.getState() as unknown as { _internal: object })._internal,
      lastHistoryHash: null,
    },
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------

describe('stream loss + fallback decline — the server HOLDS the draft', () => {
  it('recovers the committed draft in-session: server values land, phase settles, gate opens, no start-new-draft chip', async () => {
    mockFetchScenarioGraph.mockResolvedValue(serverGraphResult())
    const result = await driveStreamLossDecline()

    // The read was attempted, once, for THIS scenario (identity, not luck).
    expect(mockFetchScenarioGraph).toHaveBeenCalledTimes(1)
    expect(mockFetchScenarioGraph.mock.calls[0][0]).toBe(SCENARIO)

    // The SERVER's values are on the canvas, through the one ingestion
    // authority. Identity-bound discriminating pair: two different edges,
    // two different server values — a merge that wrote one value everywhere,
    // or matched by index, fails one of the two.
    expect(canvasEdgeWeight('d1', 'opt_a')).toBe(1)
    expect(canvasEdgeWeight('opt_a', 'fac_year_budget')).toBe(0.5)

    // The unsettled state is genuinely settled: phase released, gate open.
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(runGate().allowed).toBe(true)

    // The copy states the recovery — cause-keyed to the dropped connection —
    // and the failure copy with its chip never renders.
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(DRAFT_RECOVERED_STREAM_LOSS_NOTICE)
    expect(contents).not.toContain(UNSETTLED_DRAFT_NOTICE)
    const chips = result.current.messages.flatMap((m) => m.actionChips ?? [])
    expect(chips.some((c) => c.id === START_NEW_DRAFT_CHIP_ID)).toBe(false)
  })

  it('states the standing truth on 404: unsettled notice + start-new-draft chip, gate shut, and NO recovery claim (the honesty pin)', async () => {
    // CEE's 404 is a deliberate "no readable graph" — recovery must not be
    // claimed, and the pre-existing behaviour must stand byte for byte.
    mockFetchScenarioGraph.mockResolvedValue({ status: 'notReadable' })
    const result = await driveStreamLossDecline()

    expect(mockFetchScenarioGraph).toHaveBeenCalledTimes(1)

    // Nothing recovered: the preview's zeroed values are untouched.
    expect(canvasEdgeWeight('d1', 'opt_a')).toBe(0)

    // The standing unsettled behaviour, unchanged.
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    expect(runGate().reason).toBe(DRAFT_VALUES_UNSETTLED_REFUSAL)
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(UNSETTLED_DRAFT_NOTICE)
    // The honesty pin: no sentence claims a recovery that did not happen.
    expect(contents).not.toContain(DRAFT_RECOVERED_STREAM_LOSS_NOTICE)
    expect(contents).not.toContain(DRAFT_RECOVERED_TERMINAL_ERROR_NOTICE)
    const chip = result.current.messages
      .flatMap((m) => m.actionChips ?? [])
      .find((c) => c.id === START_NEW_DRAFT_CHIP_ID)
    expect(chip).toBeDefined()
  })

  it('a transport-dead recovery read is a failure, not a recovery — same standing behaviour', async () => {
    // The read leg itself can die (the 2.1251 class). `unusable` must route
    // exactly like 404: no claim, standing notice, chip present.
    mockFetchScenarioGraph.mockResolvedValue({ status: 'unusable' })
    const result = await driveStreamLossDecline()

    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(UNSETTLED_DRAFT_NOTICE)
    expect(contents).not.toContain(DRAFT_RECOVERED_STREAM_LOSS_NOTICE)
  })
})

describe('terminal error with kept model — the second unsettled cause', () => {
  async function driveTerminalErrorKeptModel() {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    // Terminal COMPLETE with an error status that does NOT prove commit
    // failure → the model is kept and marked unsettled with the
    // terminal_error_model_kept cause (F1 reconciliation). Payload is the
    // 8 Aug measured CEE class, byte-shaped as in
    // useConversation.streamedDraftTerminalError.spec.tsx.
    await stream.push(
      F_DRAFTING +
        F_GRAPH_READY +
        frame({
          stage: 'COMPLETE',
          seq: 4,
          status: 'complete',
          status_code: 504,
          payload: {
            error: 'UPSTREAM_TIMEOUT',
            boundary: 'B1',
            direction: 'egress',
            validator: 'draft_graph_pipeline',
            details: { retryable: true, reason: 'draft_graph_cee_timeout' },
          },
        }),
    )
    await act(async () => {
      await sent
    })
    return result
  }

  it('recovers via the same read and keys the copy to the terminal-error cause', async () => {
    mockFetchScenarioGraph.mockResolvedValue(serverGraphResult())
    const result = await driveTerminalErrorKeptModel()

    expect(mockFetchScenarioGraph).toHaveBeenCalledTimes(1)
    expect(canvasEdgeWeight('d1', 'opt_a')).toBe(1)
    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')

    const contents = result.current.messages.map((m) => m.content)
    // Cause-keyed: "the connection dropped" would be false here.
    expect(contents).toContain(DRAFT_RECOVERED_TERMINAL_ERROR_NOTICE)
    expect(contents).not.toContain(DRAFT_RECOVERED_STREAM_LOSS_NOTICE)
    expect(contents).not.toContain(DRAFT_FAILED_MODEL_KEPT_NOTICE)
  })

  it('keeps the standing kept-model notice when the read finds nothing', async () => {
    mockFetchScenarioGraph.mockResolvedValue({ status: 'notReadable' })
    const result = await driveTerminalErrorKeptModel()

    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).toContain(DRAFT_FAILED_MODEL_KEPT_NOTICE)
    expect(contents).not.toContain(DRAFT_RECOVERED_TERMINAL_ERROR_NOTICE)
  })
})

describe('recovery is failure-path-only', () => {
  it('a draft that completes normally never touches the scenario-graph read', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
    })
    await stream.push(
      F_DRAFTING +
        F_GRAPH_READY +
        frame({ stage: 'COMPLETE', seq: 4, status: 'complete', status_code: 200, payload: TERMINAL_BODY }),
    )
    await act(async () => {
      await sent
    })

    expect(useDraftStore.getState().draftStreamPhase).toBe('idle')
    expect(mockFetchScenarioGraph).not.toHaveBeenCalled()
    const contents = result.current.messages.map((m) => m.content)
    expect(contents).not.toContain(DRAFT_RECOVERED_STREAM_LOSS_NOTICE)
    expect(contents).not.toContain(DRAFT_RECOVERED_TERMINAL_ERROR_NOTICE)
  })
})

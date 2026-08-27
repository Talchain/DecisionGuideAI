/**
 * M3 — THE LINK: real stream → real `useConversation` → real store → real notice.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS (review finding, 2026-08-27)
 * ═══════════════════════════════════════════════════════════════════════════
 * The first cut of this fix had the producer tested and the consumer tested and
 * **the wiring between them tested by nothing**:
 *
 *   graphFrameArrived                    → only the PRODUCER spec
 *   draftStreamGraphDeliveredScenarioId  → only the COMPONENT spec
 *   the component spec called `markDraftStreamGraphDelivered` DIRECTLY, with
 *   zero references to `consumeStreamedDraftTurn`
 *
 * So deleting the single `if` in `useConversation` that carries the delivery
 * into the store left **both** specs green while the fix shipped DARK — the user
 * gets the false sentence back and the suite applauds. That is *built, never
 * plugged in*, occurring inside the fix for a defect of exactly that family, and
 * it is the reason this estate's own doctrine says a derived guard beats two
 * well-covered halves.
 *
 * ⭐ THE PROOF OBLIGATION THIS FILE CARRIES: delete that `if` and these tests
 * must RED. Nothing here reaches into the store to plant the delivery — every
 * assertion below is downstream of a real streamed turn.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DRIVE, AND WHY IT IS SHAPED LIKE M3
 * ═══════════════════════════════════════════════════════════════════════════
 * Measured on the deployed build (fresh isolated context, fresh signup, fresh
 * scenario, CEE `d7dcdd0`, 2026-08-26): 15 chunks · 110,343 bytes · all four
 * stages · COMPLETE · **nodes = 0** · "Olumi did not return a model for this
 * decision."
 *
 * The failure case below reproduces that shape through the real chain by moving
 * the live scenario id mid-stream, which is the one mechanism in this code that
 * makes a delivered model render nothing: `onGraphReady`'s scenario guard throws
 * (so no preview) and the terminal scenario-response fence then discards the
 * COMPLETE response before `routeV5Response` (so no terminal ingest either).
 * ⚠ Those two guards are CORRELATED — the second is documented as the first's
 * fallback and cannot be, because it asks the same question. That correlation is
 * a separate finding with its own PR; here it is simply the most faithful way to
 * produce M3's end state from real frames rather than by planting store values.
 *
 * The stream is a real `ReadableStream` through the real `streamStageFrames`;
 * only the two network calls are mocked. Harness shape follows
 * `streamedDraftTurn.spec.ts`, deliberately — it is the house pattern for this
 * seam and its comments record why each piece is needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen } from '@testing-library/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore, draftStreamGraphDeliveredFor } from '../../stores/draftStore'
import { useServerGraphRetryStore } from '../../stores/serverGraphRetryStore'
import {
  ServerGraphRetryNotice,
  SERVER_GRAPH_RETRY_NOTICE_TESTID,
  SERVER_GRAPH_RETRY_EXHAUSTED_COPY,
  SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY,
} from '../../components/ServerGraphRetryNotice'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

// ---------------------------------------------------------------------------
// Network seam — the only thing mocked
// ---------------------------------------------------------------------------

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args) }
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

// ---------------------------------------------------------------------------
// Fixtures — a REAL CEE wire capture, for the reason the sibling spec records:
// an invented body is rejected by the strict schema and the ingest silently
// never happens, so every downstream assertion fails for the wrong reason.
// ---------------------------------------------------------------------------

const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const TERMINAL_GRAPH = TERMINAL_BODY.draft_graph as {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}

/** Same identities as the terminal graph, values zeroed — the frame contract. */
const READY_GRAPH = {
  nodes: TERMINAL_GRAPH.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
  edges: TERMINAL_GRAPH.edges.map((e) => ({ from: e.from, to: e.to, strength: { mean: 0 } })),
}

/** Well-formed and genuinely empty — the discriminating twin's graph. */
const EMPTY_GRAPH = { nodes: [], edges: [] }

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}

const F_DRAFTING = frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
const fGraphReady = (graph: unknown) =>
  frame({
    stage: 'GRAPH_READY',
    seq: 2,
    status: 'in_progress',
    schema_version: 'v3',
    elapsed_ms: 35_834,
    graph,
  })
const F_COACHING = frame({
  stage: 'COACHING_READY',
  seq: 3,
  status: 'in_progress',
  coaching_status: 'partial',
})
const F_COMPLETE = frame({
  stage: 'COMPLETE',
  seq: 4,
  status: 'complete',
  status_code: 200,
  payload: TERMINAL_BODY,
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
    async close() {
      if (!closed) {
        closed = true
        try {
          ctrl.close()
        } catch {
          /* already closed by the consumer's own cancel */
        }
      }
      await settle()
    },
  }
}

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const OTHER = 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5'
const BRIEF = 'Should we build or buy a billing system for our new SaaS product?'

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useServerGraphRetryStore.getState().clear()
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
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Drive one real streamed draft turn to COMPLETE.
 *
 * `moveScenarioMidStream` reproduces M3: the live scenario id changes between
 * dispatch and GRAPH_READY, so the delivered model reaches neither the preview
 * nor the terminal ingest.
 */
async function driveStreamedTurn(opts: {
  graph: unknown
  moveScenarioMidStream?: boolean
}): Promise<void> {
  const stream = controllableStream()
  mockOpenStream.mockResolvedValue(stream.response)
  const { result } = renderHook(() => useConversation())

  let sent!: Promise<void>
  await act(async () => {
    sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
  })

  await stream.push(F_DRAFTING)
  if (opts.moveScenarioMidStream) {
    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: OTHER } as never)
    })
  }
  await stream.push(fGraphReady(opts.graph))
  await stream.push(F_COACHING)
  await stream.push(F_COMPLETE)
  await stream.close()
  await act(async () => {
    await sent
  })
}

// ---------------------------------------------------------------------------

describe('M3 link — a real streamed turn records the delivery in the store', () => {
  /**
   * ⭐ THE WIRING TEST. Nothing here plants a store value; the only input is
   * frames on a real stream. Delete the `if` in `useConversation` that calls
   * `markDraftStreamGraphDelivered` and this REDs.
   */
  it('records the delivery for the DISPATCHING scenario on a healthy turn', async () => {
    await driveStreamedTurn({ graph: READY_GRAPH })

    expect(useDraftStore.getState().draftStreamGraphDeliveredScenarioId).toBe(SCENARIO)
    // PRECONDITION — the drive really did deliver a usable model, so this is
    // not agreeing with itself about an empty stream.
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
  })

  /**
   * ⭐⭐ M3'S EXACT CONDITION, THROUGH THE REAL CHAIN: all four stages arrive,
   * GRAPH_READY carries a consumable graph, and the client renders ZERO nodes.
   * The delivery must STILL be recorded — this is the case the whole fix is for,
   * and the case where the old code had nothing to say but "the server failed".
   */
  it('records the delivery even when the client renders NOTHING (M3)', async () => {
    await driveStreamedTurn({ graph: READY_GRAPH, moveScenarioMidStream: true })

    // The M3 observation: a complete, four-stage, consumable stream — zero nodes.
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    // And the fact that makes an honest sentence possible.
    expect(useDraftStore.getState().draftStreamGraphDeliveredScenarioId).toBe(SCENARIO)
  })

  /**
   * The discriminating twin, driven through the IDENTICAL path — the graph's
   * content is the only difference. A delivery must not be claimed for a stream
   * that carried no model.
   */
  it('records NO delivery when GRAPH_READY carried an empty graph', async () => {
    await driveStreamedTurn({ graph: EMPTY_GRAPH, moveScenarioMidStream: true })

    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useDraftStore.getState().draftStreamGraphDeliveredScenarioId).toBeNull()
  })
})

describe('M3 link — the sentence the user actually reads, end to end', () => {
  /** Put the notice in the state M3 put it in: re-ask exhausted, canvas empty. */
  function renderNoticeFor(scenarioId: string): HTMLElement | null {
    useServerGraphRetryStore
      .getState()
      .setRetryStage({ scenarioId, stage: 'exhausted' })
    useCanvasStore.setState({ currentScenarioId: scenarioId } as never)
    render(<ServerGraphRetryNotice />)
    return screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
  }

  /**
   * ⭐ THE WHOLE CHAIN IN ONE TEST: frames → consumer → link → store → surface.
   * The delivery fact is never planted; it arrives from the stream.
   */
  it('a delivered-but-undrawable model stops the notice blaming the server', async () => {
    await driveStreamedTurn({ graph: READY_GRAPH, moveScenarioMidStream: true })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)

    const el = renderNoticeFor(SCENARIO)
    expect(el).not.toBeNull()
    // PRECONDITION — the store fact reaching the component came from the drive.
    expect(draftStreamGraphDeliveredFor(useDraftStore.getState(), SCENARIO)).toBe(true)

    expect(el).not.toHaveTextContent('did not return a model')
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY)
    expect(el!.getAttribute('data-model-delivered')).toBe('true')
  })

  /** The twin: nothing delivered, so the original sentence is the true one. */
  it('a stream that delivered nothing still gets the honest failure sentence', async () => {
    await driveStreamedTurn({ graph: EMPTY_GRAPH, moveScenarioMidStream: true })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)

    const el = renderNoticeFor(SCENARIO)
    expect(el).not.toBeNull()
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
    expect(el!.getAttribute('data-model-delivered')).toBe('false')
  })
})

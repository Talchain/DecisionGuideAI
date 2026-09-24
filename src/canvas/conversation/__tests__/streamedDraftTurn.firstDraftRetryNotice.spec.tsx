/**
 * U14 THE LINK — a guest's real first Send keys the draft phase on the SAME id
 * the retry notice reads, so GATE 4 actually closes over a first draft
 * (contract v3.1 gap U14, Paul 24 Sep).
 *
 * The component spec (`ServerGraphRetryNotice.firstDraftInFlight.spec.tsx`)
 * plants the phase. This one does not: the canvas starts with NO scenario id,
 * the real `useConversation` mints one on Send, and the real streamed-draft
 * runner writes the phase. If the runner ever keyed the phase on anything other
 * than the minted `currentScenarioId`, GATE 4 would be dark and this reds.
 *
 * The boot re-ask is not mounted; its one observable effect — `retrying` for
 * the minted id — is written exactly as `useServerGraphHydration` writes it.
 * Harness follows `streamedDraftTurn.m3DeliveryLink.spec.tsx`; only the two
 * network calls are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen } from '@testing-library/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore, draftStreamPhaseFor } from '../../stores/draftStore'
import { useServerGraphRetryStore } from '../../stores/serverGraphRetryStore'
import {
  ServerGraphRetryNotice,
  SERVER_GRAPH_RETRY_NOTICE_TESTID,
} from '../../components/ServerGraphRetryNotice'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

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

const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const TERMINAL_GRAPH = TERMINAL_BODY.draft_graph as {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}
const READY_GRAPH = {
  nodes: TERMINAL_GRAPH.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
  edges: TERMINAL_GRAPH.edges.map((e) => ({ from: e.from, to: e.to, strength: { mean: 0 } })),
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

const BRIEF = 'Should we build or buy a billing system for our new SaaS product?'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useServerGraphRetryStore.getState().clear()
  // A guest before their first Send: NO scenario id, empty canvas.
  useCanvasStore.setState({
    currentScenarioId: null,
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

describe('U14 link — the first Send closes GATE 4 on the minted id', () => {
  it('no "Looking for your model…" while the first draft streams; the gate releases at COMPLETE', async () => {
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())

    let sent!: Promise<void>
    await act(async () => {
      sent = result.current.sendMessage(BRIEF) as Promise<void>
    })
    await stream.push(F_DRAFTING)

    // PRECONDITIONS — the Send minted the id and the runner owns the phase for it.
    const minted = useCanvasStore.getState().currentScenarioId
    expect(minted).toMatch(UUID_RE)
    expect(mockOpenStream).toHaveBeenCalledTimes(1)
    expect(draftStreamPhaseFor(useDraftStore.getState(), minted!)).toBe('drafting')
    expect(useCanvasStore.getState().nodes).toHaveLength(0)

    // The boot read answered `absent` for the row the turn provisioned.
    act(() => {
      useServerGraphRetryStore.getState().setRetryStage({ scenarioId: minted!, stage: 'retrying' })
    })

    // Unmount ONLY the notice: a global cleanup would also unmount the hook and
    // abort the turn, so the release below would be the abort path, not COMPLETE.
    const notice = render(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
    notice.unmount()

    await stream.push(F_GRAPH_READY)
    await stream.push(F_COACHING)
    await stream.push(F_COMPLETE)
    await stream.close()
    await act(async () => {
      await sent
    })

    // The gate cannot strand the notice hidden: the healthy turn releases the phase.
    expect(draftStreamPhaseFor(useDraftStore.getState(), minted!)).toBe('idle')
    expect(useCanvasStore.getState().currentScenarioId).toBe(minted)
    // And it was the HEALTHY exit: the model is on the canvas.
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
  })
})

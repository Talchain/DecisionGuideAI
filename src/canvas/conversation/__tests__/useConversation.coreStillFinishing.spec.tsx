/**
 * DL lease (20 Oct 2026): on the core lane a turn that outran the stream budget is STILL FINISHING, not failed.
 *
 * Real wire shape, CEE b76bc42c `streamed-turn-sse.ts:334-353`: COMPLETE { status_code: 504, payload: { schema:
 * 'error.v1', code: 'UPSTREAM_TIMEOUT', message: 'The turn did not complete within the stream budget.', request_id } }.
 * The server keeps running and commits the turn, so the UI says Olumi is still finishing, re-sends the SAME turn_id
 * once (core dedupes it: waits for the answer, or 409 TURN_OUTCOME_UNKNOWN, never a second run), and on an unresolved
 * re-send reads what was saved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { DRAFT_FAILED_MODEL_KEPT_NOTICE } from '../../components/DraftLoadingAnimation'
import { CORE_STILL_FINISHING_NOTICE, CORE_FINISHED_RELOADED_NOTICE, STILL_FINISHING_REPLAY_DELAY_MS } from '../coreStillFinishing'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockRecover = vi.fn()
vi.mock('../../hydrate/draftRecovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hydrate/draftRecovery')>()
  return { ...actual, recoverDraftFromServer: (...args: unknown[]) => mockRecover(...args) }
})

const TERMINAL_GRAPH = (wireFixture as unknown as Record<string, unknown>).draft_graph as {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}
const READY_GRAPH = {
  nodes: TERMINAL_GRAPH.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label })),
  edges: TERMINAL_GRAPH.edges.map((e) => ({ from: e.from, to: e.to, strength: { mean: 0 } })),
}
/** The served stream-budget timeout, byte for byte in shape (no turn_id on the frame). */
const CORE_STREAM_BUDGET_TIMEOUT = {
  schema: 'error.v1',
  code: 'UPSTREAM_TIMEOUT',
  message: 'The turn did not complete within the stream budget.',
  request_id: '0b6c1d52-1f0e-4a43-9c4e-2d8d7a1b9f10',
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
  elapsed_ms: 96_981,
  graph: READY_GRAPH,
})
const fCompleteError = (statusCode: number, payload: unknown) =>
  frame({ stage: 'COMPLETE', seq: 4, status: 'complete', status_code: statusCode, payload })

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
const BRIEF =
  'How should we lift net revenue retention from 96% to 110% by March 2027 without breaking the £650k programme cap?'

const turnIdOf = (call: unknown[] | undefined) => {
  const m = JSON.stringify(call ?? []).match(/"turn_id":"([^"]+)"/)
  return m ? m[1] : null
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
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
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

afterEach(() => { window.history.replaceState(null, '', '/') })

describe('core: a 504 UPSTREAM_TIMEOUT stream end is an UNKNOWN outcome, not a failure', () => {
  async function runCore(payload: unknown) {
    window.history.replaceState(null, '', '/#/canvas?ai=core')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockRecover.mockResolvedValue('recovered')
    // The one re-send: core's claim wait ran out, nothing was run again.
    mockCallV5Turn.mockResolvedValue({ kind: 'parse_error', reason: 'http_409', http_status: 409, raw: {
      error: 'TURN_OUTCOME_UNKNOWN', detail: 'This message is already being handled, or an earlier attempt ran and its reply was not recorded. Nothing was run again — reload to see the current model.',
    } })
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => { sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void> })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    await stream.push(fCompleteError(504, payload))
    await stream.close()
    await act(async () => { await sent })
    return result
  }

  it('says Olumi is still finishing — no failure notice, no retry, no send-failure banner, the message reads as sent', async () => {
    const result = await runCore(CORE_STREAM_BUDGET_TIMEOUT)
    const texts = result.current.messages.map((m) => m.content)
    expect(texts).toContain(CORE_STILL_FINISHING_NOTICE)
    expect(texts).not.toContain(DRAFT_FAILED_MODEL_KEPT_NOTICE)
    expect(result.current.messages.flatMap((m) => m.actionChips ?? []).map((c) => c.id)).not.toContain('retry')
    expect((result.current as unknown as { lastSendFailure: unknown }).lastSendFailure).toBeNull()
    expect(result.current.messages.find((m) => m.role === 'user')?.deliveryState).toBe('sent')
    vi.useRealTimers()
  })

  it('re-sends the SAME turn_id once, and on an unresolved re-send reads the saved model and says so', async () => {
    const result = await runCore(CORE_STREAM_BUDGET_TIMEOUT)
    expect(mockCallV5Turn).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(STILL_FINISHING_REPLAY_DELAY_MS + 50) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(turnIdOf(mockCallV5Turn.mock.calls[0])).toBe(turnIdOf(mockOpenStream.mock.calls[0]))
    expect(turnIdOf(mockCallV5Turn.mock.calls[0])).not.toBeNull()
    expect(mockRecover).toHaveBeenCalledTimes(1)
    const texts = result.current.messages.map((m) => m.content)
    expect(texts).toContain(CORE_FINISHED_RELOADED_NOTICE)
    expect(texts).not.toContain(CORE_STILL_FINISHING_NOTICE)
    expect(result.current.messages.filter((m) => m.role === 'user')).toHaveLength(1)
    vi.useRealTimers()
  })

  it('a successful re-send renders the answer, removes the notice and SETTLES the draft (Run and autosave reopen)', async () => {
    const result = await runCore(CORE_STREAM_BUDGET_TIMEOUT)
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    mockCallV5Turn.mockResolvedValue({ kind: 'response', response: {
      response_version: 2, assistant_text: 'Here is the model I built.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame',
    } })
    await act(async () => { await vi.advanceTimersByTimeAsync(STILL_FINISHING_REPLAY_DELAY_MS + 50) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    const texts = result.current.messages.map((m) => m.content)
    expect(texts).not.toContain(CORE_STILL_FINISHING_NOTICE)
    expect(texts.some((t) => String(t).includes('Here is the model I built.'))).toBe(true)
    expect(useDraftStore.getState().draftStreamPhase).not.toBe('unsettled')
    expect(mockRecover).not.toHaveBeenCalled()
    // The reply arrived live: no bubble keeps the turn's read-back key, so no later cold read can add it twice.
    expect(result.current.messages.filter((m) => m.deliveryTurnId !== undefined)).toEqual([])
    vi.useRealTimers()
  })

  it('CONTRAST: a successful re-send never settles a NEWER turn\'s unsettled draft', async () => {
    await runCore(CORE_STREAM_BUDGET_TIMEOUT)
    // A newer draft took ownership of the unsettled phase before the re-send answered.
    useDraftStore.getState().setDraftStreamPhase('unsettled', 'a-newer-turn', SCENARIO)
    mockCallV5Turn.mockResolvedValue({ kind: 'response', response: {
      response_version: 2, assistant_text: 'Late answer.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame',
    } })
    await act(async () => { await vi.advanceTimersByTimeAsync(STILL_FINISHING_REPLAY_DELAY_MS + 50) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(useDraftStore.getState().draftStreamPhase).toBe('unsettled')
    expect(useDraftStore.getState().draftStreamTurnId).toBe('a-newer-turn')
    vi.useRealTimers()
  })

  it('a message sent DURING the wait never takes the re-sent turn\'s key; the original bubble keeps it', async () => {
    const result = await runCore(CORE_STREAM_BUDGET_TIMEOUT)
    const firstTurnId = turnIdOf(mockOpenStream.mock.calls[0])
    const firstBubble = result.current.messages.find((m) => m.role === 'user')!
    expect(firstBubble.deliveryTurnId).toBe(firstTurnId)
    mockCallV5Turn
      .mockResolvedValueOnce({ kind: 'response', response: { response_version: 2, assistant_text: 'Another answer.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' } })
      .mockResolvedValueOnce({ kind: 'parse_error', reason: 'http_409', http_status: 409, raw: { error: 'TURN_OUTCOME_UNKNOWN' } })
    mockRecover.mockResolvedValue('notRecovered')
    await act(async () => { await result.current.sendMessage('And what about hiring two people?') })
    await act(async () => { await vi.advanceTimersByTimeAsync(STILL_FINISHING_REPLAY_DELAY_MS + 50) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    const users = result.current.messages.filter((m) => m.role === 'user')
    expect(users).toHaveLength(2)
    expect(users.find((m) => m.id === firstBubble.id)?.deliveryTurnId).toBe(firstTurnId)
    expect(users.find((m) => m.id !== firstBubble.id)?.deliveryTurnId).toBeUndefined()
    vi.useRealTimers()
  })

  it('a retyped delivery-unknown core message, once answered, leaves NO bubble keyed for a second copy of the reply', async () => {
    window.history.replaceState(null, '', '/#/canvas?ai=core')
    // A model is already on the canvas, so these are buffered turns.
    useCanvasStore.setState({ nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team size' } }] as never })
    mockCallV5Turn
      .mockResolvedValueOnce({ kind: 'parse_error', reason: 'http_504', http_status: 504, raw: { code: 'PROXY_UPSTREAM_TIMEOUT', message: 'The model generation service did not respond within 125s.' } })
      .mockResolvedValueOnce({ kind: 'response', response: { response_version: 2, assistant_text: 'Answered.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' } })
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('What drives capacity most?') })
    const keyed = result.current.messages.filter((m) => m.role === 'user' && m.deliveryTurnId !== undefined)
    expect(keyed, 'precondition: the unknown core send is keyed by its turn_id').toHaveLength(1)
    await act(async () => { await result.current.sendMessage('What drives capacity most?') })
    expect(turnIdOf(mockCallV5Turn.mock.calls[1]), 'precondition: the retype reuses the turn_id').toBe(turnIdOf(mockCallV5Turn.mock.calls[0]))
    expect(result.current.messages.filter((m) => m.deliveryTurnId !== undefined)).toEqual([])
  })

  it('a timeout BEFORE the model reached the canvas re-sends exactly once, buffered — never a second stream', async () => {
    window.history.replaceState(null, '', '/#/canvas?ai=core')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockRecover.mockResolvedValue('notRecovered')
    mockCallV5Turn.mockResolvedValue({ kind: 'parse_error', reason: 'http_409', http_status: 409, raw: { error: 'TURN_OUTCOME_UNKNOWN' } })
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => { sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void> })
    await stream.push(F_DRAFTING)
    await stream.push(fCompleteError(504, CORE_STREAM_BUDGET_TIMEOUT))
    await stream.close()
    await act(async () => { await sent })
    expect(result.current.messages.map((m) => m.content)).toContain(CORE_STILL_FINISHING_NOTICE)
    await act(async () => { await vi.advanceTimersByTimeAsync(STILL_FINISHING_REPLAY_DELAY_MS + 50) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(mockOpenStream).toHaveBeenCalledTimes(1)
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(turnIdOf(mockCallV5Turn.mock.calls[0])).toBe(turnIdOf(mockOpenStream.mock.calls[0]))
    vi.useRealTimers()
  })

  it('CONTRAST: off the core lane the same frame keeps today\'s kept-model behaviour and sends nothing again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const stream = controllableStream()
    mockOpenStream.mockResolvedValue(stream.response)
    const { result } = renderHook(() => useConversation())
    let sent!: Promise<void>
    await act(async () => { sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void> })
    await stream.push(F_DRAFTING + F_GRAPH_READY)
    await stream.push(fCompleteError(504, CORE_STREAM_BUDGET_TIMEOUT))
    await stream.close()
    await act(async () => { await sent })
    await act(async () => { await vi.advanceTimersByTimeAsync(STILL_FINISHING_REPLAY_DELAY_MS + 50) })
    const texts = result.current.messages.map((m) => m.content)
    expect(texts).not.toContain(CORE_STILL_FINISHING_NOTICE)
    expect(mockCallV5Turn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('CONTRAST: on core, a 504 that is not the stream budget (the proxy\'s own body) is not treated as still finishing', async () => {
    const result = await runCore({ code: 'PROXY_UPSTREAM_TIMEOUT', message: 'The model generation service did not respond within 125s.' })
    expect(result.current.messages.map((m) => m.content)).not.toContain(CORE_STILL_FINISHING_NOTICE)
    vi.useRealTimers()
  })
})

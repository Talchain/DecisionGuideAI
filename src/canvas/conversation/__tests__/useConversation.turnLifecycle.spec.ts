/**
 * THE CHAT TURN LIFECYCLE — ONE OWNED STATE MACHINE (S-F; `turnLifecycle.ts`).
 *
 * Rows, each RED on base (79a058e5 → e438a05e) and GREEN here:
 *   (1) a PREEMPTED turn finishing late must not end the NEWER turn: its indicator stays until the newer reply;
 *   (2) a failed turn is REPORTED (Sentry `captureTurnFailure`, kind + turn type as tags, no user text) — base: 0 capture calls;
 *   (3) a session read that never returns no longer holds the spinner with nothing sent: the turn fails as not sent,
 *       is reported as `session_timeout`, and the user can retry.
 * Controls: a user Stop and a preempt abort are NOT reported (they are not failures); a clean turn reports nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
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

const mockCallV5Turn = vi.fn()
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))

vi.mock('../../../v5/stopTurn', () => ({
  // A Stop's server acknowledgement is out of scope here: it resolves as "unconfirmed".
  stopV5Turn: vi.fn(async () => ({ kind: 'unconfirmed' })),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

const sessionRead = { impl: async () => ({ userId: null as string | null, accessToken: null as string | null }) }
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: () => sessionRead.impl(),
}))

const captured: Array<{ message: string; tags: Record<string, string>; scenarioId: string | null }> = []
vi.mock('../../../lib/monitoring', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/monitoring')>()),
  captureTurnFailure: (error: Error, report: { tags: Record<string, string>; scenarioId: string | null }) => {
    captured.push({ message: error.message, tags: report.tags, scenarioId: report.scenarioId })
  },
  addBreadcrumb: () => {},
}))

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: vi.fn(async () => null),
}))

// The streamed sibling is stubbed unreachable so the send takes one
// deterministic path; the refusal under test happens before either transport.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => {
    throw new TypeError('Failed to fetch')
  },
}))

vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorStreamingEnabled: () => true,
  isOrchestratorV2Enabled: () => true,
}))

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import {
  setPersistenceSessionActive,
  __resetPersistenceSessionForTests,
} from '../../../lib/persistenceSession'


const ok = (text: string) => ({
  kind: 'response' as const,
  response: { response_version: 2, assistant_text: text, blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' },
})

/** A turn the test settles by hand; an abort of its signal rejects it the way fetch does. */
function controllable() {
  let resolve: (v: unknown) => void = () => {}
  let reject: (e: unknown) => void = () => {}
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  const bind = (signal: AbortSignal | undefined) => {
    signal?.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; reject(e)
    })
  }
  return { promise, resolve, bind }
}

const SCENARIO = '33333333-4444-4555-8666-777777777777'

beforeEach(() => {
  vi.clearAllMocks()
  captured.length = 0
  sessionRead.impl = async () => ({ userId: null, accessToken: null })
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Launch on time' } }] as never,
  })
  __resetPersistenceSessionForTests()
  setPersistenceSessionActive(false)
})

afterEach(() => {
  vi.useRealTimers()
  __resetPersistenceSessionForTests()
})

describe('the turn lifecycle', () => {
  it('(1) a preempted turn finishing late does not end the newer turn', async () => {
    const first = controllable()
    const second = controllable()
    mockCallV5Turn
      .mockImplementationOnce((_p: unknown, o: { signal?: AbortSignal }) => { first.bind(o?.signal); return first.promise })
      .mockImplementationOnce((_p: unknown, o: { signal?: AbortSignal }) => { second.bind(o?.signal); return second.promise })
    const { result } = renderHook(() => useConversation())

    let a: Promise<unknown> = Promise.resolve()
    await act(async () => { a = result.current.sendMessage('first question'); await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.isThinking).toBe(true)

    // The user sends again: the first request is aborted (preempt) and the second goes out.
    let b: Promise<unknown> = Promise.resolve()
    await act(async () => { b = result.current.sendMessage('second question'); await new Promise((r) => setTimeout(r, 0)) })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(2)
    // The first turn's abort has now run its catch and finally.
    await act(async () => { await a.catch(() => {}); await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.isThinking, 'the superseded turn ended the newer turn').toBe(true)
    // …and it did not clear the newer turn's composer-side state either (the draft store mirror).
    expect(useDraftStore.getState().isGenerating, 'the superseded turn cleared the newer turn\'s isGenerating').toBe(true)

    await act(async () => { second.resolve(ok('second answer')); await b })
    expect(result.current.isThinking).toBe(false)
    expect(captured, 'a preempt is not a failure').toEqual([])
  })

  it('(2) a turn that fails in transport is reported once, with its kind and type and no user text', async () => {
    mockCallV5Turn.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('a private question about salaries') })
    expect(result.current.isThinking).toBe(false)
    expect(captured).toHaveLength(1)
    expect(captured[0].message).toMatch(/^Chat turn failed: (not_sent|transport)$/)
    expect(captured[0].message).not.toMatch(/NetworkError/)
    expect(captured[0].tags).toMatchObject({ turn_mode: 'user' })
    expect(captured[0].scenarioId).toBe(SCENARIO.slice(0, 8))
    expect(JSON.stringify(captured[0])).not.toContain('salaries')
  })

  it('control: a clean turn reports nothing', async () => {
    mockCallV5Turn.mockResolvedValueOnce(ok('fine'))
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })
    expect(captured).toEqual([])
  })

  it('(3) a session read that never returns: the turn fails as not sent, is reported, and the spinner ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionRead.impl = () => new Promise(() => {}) // hangs, as a held auth lock does
    const { result } = renderHook(() => useConversation())
    let sending: Promise<unknown> = Promise.resolve()
    await act(async () => { sending = result.current.sendMessage('suggest risks'); await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.isThinking, 'precondition: the turn is pending on the session read').toBe(true)
    expect(mockCallV5Turn).not.toHaveBeenCalled()

    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); await sending })
    expect(result.current.isThinking, 'the spinner held with nothing sent').toBe(false)
    expect(mockCallV5Turn).not.toHaveBeenCalled()
    expect(captured.map((c) => c.message)).toEqual(['Chat turn failed: session_timeout'])
    const userBubble = result.current.messages.find((m) => m.role === 'user' && m.content === 'suggest risks')
    expect(userBubble?.deliveryState, 'the user is told it did not go through, and may retry').toBe('failed')
  })

  it('(4) buddy r2 P1-1: after a preempt, Stop still stops the live turn', async () => {
    const first = controllable()
    const second = controllable()
    mockCallV5Turn
      .mockImplementationOnce((_p: unknown, o: { signal?: AbortSignal }) => { first.bind(o?.signal); return first.promise })
      .mockImplementationOnce((_p: unknown, o: { signal?: AbortSignal }) => { second.bind(o?.signal); return second.promise })
    const { result } = renderHook(() => useConversation())
    let a: Promise<unknown> = Promise.resolve()
    await act(async () => { a = result.current.sendMessage('first'); await new Promise((r) => setTimeout(r, 0)) })
    await act(async () => { void result.current.sendMessage('second'); await new Promise((r) => setTimeout(r, 0)) })
    await act(async () => { await a.catch(() => {}); await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.isThinking, 'precondition: the second turn is live').toBe(true)
    const secondSignal = mockCallV5Turn.mock.calls[1][1]?.signal as AbortSignal
    await act(async () => { result.current.cancelTurn(); await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.isThinking, 'Stop did nothing under a live spinner').toBe(false)
    expect(secondSignal.aborted, 'the live request was not aborted').toBe(true)
  })

  it('(5) buddy r2 P1-2: a superseded attempt\'s late session timeout does not cancel the live turn\'s wait timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let reads = 0
    sessionRead.impl = () => (++reads === 1 ? new Promise(() => {}) : Promise.resolve({ userId: null, accessToken: null }))
    mockCallV5Turn.mockImplementation(() => new Promise(() => {})) // the live request never answers
    const { result } = renderHook(() => useConversation())
    await act(async () => { void result.current.sendMessage('first'); await vi.advanceTimersByTimeAsync(1_000) })
    await act(async () => { void result.current.sendMessage('second'); await vi.advanceTimersByTimeAsync(0) })
    expect(mockCallV5Turn, 'precondition: the second request went out').toHaveBeenCalledTimes(1)
    // +15 s: the FIRST attempt's session read expires; its late catch must leave the live turn's timers alone.
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(result.current.isThinking).toBe(true)
    // The live turn's own 175 s wait still fires.
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000) })
    expect(result.current.isThinking, 'the live turn lost its wait timer and spins forever').toBe(false)
    expect(captured.map((c) => c.message)).toContain('Chat turn failed: timeout')
  })

  it('(6) buddy r2 P1-3: a retry reusing the client turn id is not ended by the old attempt\'s late exit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let reads = 0
    sessionRead.impl = () => (++reads === 1 ? new Promise(() => {}) : Promise.resolve({ userId: null, accessToken: null }))
    mockCallV5Turn.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useConversation())
    // The buddy's sequence: A's session read hangs → a hidden turn B preempts A and completes → the user retries
    // (which reuses A's client turn id, kept by the hidden turn) → A's original read then expires.
    mockCallV5Turn.mockImplementationOnce(async () => ok('b done'))
    await act(async () => { void result.current.sendMessage('suggest risks'); await vi.advanceTimersByTimeAsync(1_000) })
    await act(async () => { await result.current.sendMessage('hidden follow-up', { hidden: true }); await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.isThinking, 'precondition: B completed').toBe(false)
    mockCallV5Turn.mockClear()
    await act(async () => { void result.current.retryLast(); await vi.advanceTimersByTimeAsync(0) })
    expect(mockCallV5Turn, 'precondition: the retry went out').toHaveBeenCalledTimes(1)
    expect(result.current.isThinking).toBe(true)
    // +15 s: the ORIGINAL attempt's session read expires (same client turn id as the retry).
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(result.current.isThinking, 'the old attempt ended the live retry').toBe(true)
    expect(captured.map((c) => c.message), 'a superseded attempt is not this turn\'s failure').not.toContain('Chat turn failed: session_timeout')
  })
})

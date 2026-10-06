/**
 * W4 C1b: WITNESS.md + founder-evening-2/ROWS.jsonl record the text below,
 * a 192-second wait, the false non-delivery UI, and a server user row at
 * 19:14:12 with no assistant row. There is NO captured native exception or
 * C1b HTTP body. The rejection below is a synthetic transport seam, not a
 * claimed captured TypeError; the readback ID is taken from the real request
 * header, not invented as a witnessed ID. Adapter/parser/router are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { readServerConversationTurns, reconcileUnconfirmedServerTurns } from '../serverConversationTurns'
import { assertsDeliveryUnknown, assertsNonDelivery } from '../deliveryUnknown'
import { NETWORK_AFTER_SEND_UNKNOWN_COPY } from '../transportFailure'
import { loadTranscript, TRANSCRIPT_STORAGE_KEY, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { REQUEST_ID_HEADER } from '../../../types/requestId'
import { TURN_WAIT_MS } from '../../../v5/getTimeoutMs'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
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
vi.mock('../../../v5/eligibility', async importOriginal => ({
  ...await importOriginal<typeof import('../../../v5/eligibility')>(),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
const mockStop = vi.hoisted(() => vi.fn(async () => ({ kind: 'not_saved' as const })))
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: mockStop,
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

const SCENARIO = '8bc39f9f-5636-45dd-952d-a084ea75dd82'
const OTHER = '741ad434-a42a-4059-b20e-e5c41cf13ec7'
const C1B = 'We fit 16 small-update equivalents per sprint.'
const SERVER_AT = '2026-10-06T19:14:12Z'
const RUN = { runNotCurrent: false, currentRunComputedAt: null }
// Supplemental success/control body, not claimed to be the missing C1b reply.
const SUCCESS = { response_version: 2, assistant_text: 'Reply received.', blocks: [],
  suggested_actions: [], insights: [], stage_indicator: 'frame' }

function deferredFetch() {
  let reject!: (reason: Error) => void
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no })
  const fetchSpy = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(() => promise)
  vi.stubGlobal('fetch', fetchSpy)
  return { fetchSpy, reject, resolve }
}
function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body, text: async () => JSON.stringify(body) } as Response
}
function requestId(fetchSpy: ReturnType<typeof deferredFetch>['fetchSpy']): string {
  const id = new Headers(fetchSpy.mock.calls[0][1]?.headers).get(REQUEST_ID_HEADER)
  expect(id).toBeTruthy()
  return id!
}
function turns(id: string, reply: string | null = null) {
  return readServerConversationTurns([{ turn_id: id, created_at: SERVER_AT,
    user_message: C1B, assistant_message: reply }])!
}
async function offer(id: string, reply: string | null = null, scenarioId = SCENARIO) {
  await act(async () => {
    useServerConversationTurnsStore.getState().offerServerConversationTurns({ scenarioId, turns: turns(id, reply), run: RUN })
  })
}
async function flushDispatch() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function user(messages: ReturnType<typeof useConversation>['messages']) {
  return messages.find(m => m.role === 'user' && m.content === C1B)!
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetTranscriptTombstonesForTests()
  useServerConversationTurnsStore.setState({ offer: null })
  mockStop.mockClear()
  vi.stubEnv('VITE_V5_ENDPOINT', 'https://cee.test/proxy/v5/turn')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  useCanvasStore.setState({ currentScenarioId: SCENARIO,
    // C1b is a continuation on a populated canvas, not a cold streamed draft.
    nodes: [{ id: 'productivity', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'productivity' } }],
    edges: [], results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('W4 witnessed rejection and exact server receipt', () => {
  it('RED: 192 s then rejection stays unknown; same-scenario receipt and later reply reconcile once', async () => {
    // Model elapsed wall time while browser deadline callbacks are suspended.
    // No 192-second threshold or native-error heuristic is part of production.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(SERVER_AT))
    const pending = deferredFetch()
    const { result, unmount } = renderHook(() => useConversation())
    let send!: Promise<void>
    await act(async () => { send = result.current.sendMessage(C1B); await flushDispatch() })
    expect(pending.fetchSpy).toHaveBeenCalledTimes(1)
    const id = requestId(pending.fetchSpy)
    vi.setSystemTime(Date.now() + 192_000)
    await act(async () => { pending.reject(new Error('response not received')); await send })
    expect(user(result.current.messages).deliveryState).toBe('unconfirmed')
    expect(user(result.current.messages).deliveryRequestId).toBe(id)
    const notice = result.current.messages.at(-1)!
    expect(assertsNonDelivery(notice.content)).toBe(false)
    expect(assertsDeliveryUnknown(notice.content)).toBe(true)
    expect(notice.content).not.toMatch(/reload/i)
    expect(notice.actionChips ?? []).toEqual([])
    expect(result.current.lastSendFailure?.retryable).toBe(false)

    // Same words under another ID are not evidence of THIS request's receipt.
    await offer('other-request')
    expect(user(result.current.messages).deliveryState).toBe('unconfirmed')
    await offer(id, null, OTHER)
    expect(user(result.current.messages).deliveryState).toBe('unconfirmed')
    expect(useServerConversationTurnsStore.getState().offer?.scenarioId).toBe(OTHER)
    await offer(id)
    expect(user(result.current.messages).deliveryState).toBe('sent')
    expect(result.current.lastSendFailure).toBeNull()
    expect(result.current.messages.filter(m => m.role === 'assistant' && !m.sessionDivider)).toHaveLength(0)
    // Receipt alone does not throw away the association needed for a later reply.
    expect(loadTranscript(SCENARIO)?.messages.find(m => m.role === 'user')?.deliveryRequestId).toBe(id)
    await offer(id, 'Supplemental late server reply.')
    await offer(id, 'Supplemental late server reply.')
    expect(result.current.messages.filter(m => m.content === 'Supplemental late server reply.')).toHaveLength(1)
    expect(result.current.messages.filter(m => m.role === 'user')).toHaveLength(1)
    expect(pending.fetchSpy).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('RED: the exact association survives a page reload, including a receipt-only read before the reply', async () => {
    const pending = deferredFetch()
    const first = renderHook(() => useConversation())
    let send!: Promise<void>
    await act(async () => { send = first.result.current.sendMessage(C1B); await flushDispatch() })
    const id = requestId(pending.fetchSpy)
    await act(async () => { pending.reject(new Error('response not received')); await send })
    expect(loadTranscript(SCENARIO)?.messages.find(m => m.role === 'user')?.deliveryState).toBe('unconfirmed')
    first.unmount()
    function earlierPageLoad() {
      const saved = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
      saved[SCENARIO].pageLoadId = 'earlier-page-load'
      localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(saved))
    }
    earlierPageLoad()
    const second = renderHook(() => useConversation())
    expect(user(second.result.current.messages).deliveryState).toBe('unconfirmed')
    await offer(id)
    expect(user(second.result.current.messages).deliveryState).toBe('sent')
    second.unmount()
    earlierPageLoad()
    const third = renderHook(() => useConversation())
    await offer(id, 'Reply after receipt and another reload.')
    await offer(id, 'Reply after receipt and another reload.')
    expect(third.result.current.messages.filter(m => m.content === 'Reply after receipt and another reload.')).toHaveLength(1)
    expect(third.result.current.messages.filter(m => m.role === 'user')).toHaveLength(1)
    expect(pending.fetchSpy).toHaveBeenCalledTimes(1)
    third.unmount()
  })

  it('CONTROL: proven offline before dispatch makes no fetch and keeps non-delivery/Retry', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const fetchSpy = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(C1B) })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(user(result.current.messages).deliveryState).toBe('failed')
    const notice = result.current.messages.at(-1)!
    expect(assertsNonDelivery(notice.content)).toBe(true)
    expect(notice.actionChips?.map(c => c.id)).toEqual(['retry'])
    expect(result.current.lastSendFailure?.retryable).toBe(true)
    unmount()
  })

  it.each([200, 504])('CONTROL: HTTP %s keeps success/proxy semantics and no automatic resend', async status => {
    vi.useFakeTimers()
    const body = status === 200 ? SUCCESS : { code: 'PROXY_UPSTREAM_TIMEOUT' }
    const fetchSpy = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => response(status, body))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(C1B) })
    expect(user(result.current.messages).deliveryState).toBe(status === 200 ? 'sent' : 'unconfirmed')
    if (status === 504) {
      expect(assertsDeliveryUnknown(result.current.messages.at(-1)!.content)).toBe(true)
      expect(result.current.messages.at(-1)!.actionChips ?? []).toEqual([])
      await offer(new Headers(fetchSpy.mock.calls[0][1]?.headers).get(REQUEST_ID_HEADER)!)
      expect(user(result.current.messages).deliveryState).toBe('sent')
    } else {
      expect(result.current.lastSendFailure).toBeNull()
      expect(user(result.current.messages).deliveryRequestId).toBeUndefined()
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000) })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('CONTROL: deadline abort then late rejection cannot claim failure or resend; readback still confirms receipt', async () => {
    vi.useFakeTimers()
    const pending = deferredFetch()
    const { result, unmount } = renderHook(() => useConversation())
    let send!: Promise<void>
    await act(async () => { send = result.current.sendMessage(C1B); await flushDispatch() })
    const id = requestId(pending.fetchSpy)
    await act(async () => { await vi.advanceTimersByTimeAsync(TURN_WAIT_MS) })
    expect(user(result.current.messages).deliveryState).toBe('unconfirmed')
    await act(async () => { pending.reject(new Error('late rejection')); await send })
    expect(user(result.current.messages).deliveryState).toBe('unconfirmed')
    expect(result.current.messages.filter(m => m.content === NETWORK_AFTER_SEND_UNKNOWN_COPY)).toHaveLength(0)
    await offer(id)
    expect(user(result.current.messages).deliveryState).toBe('sent')
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000) })
    expect(pending.fetchSpy).toHaveBeenCalledTimes(1)
    unmount()
  })

  it.each(['stop', 'switch'] as const)('CONTROL: %s fences a late response', async action => {
    const pending = deferredFetch()
    const { result, unmount } = renderHook(() => useConversation())
    let send!: Promise<void>
    await act(async () => { send = result.current.sendMessage(C1B); await flushDispatch() })
    await act(async () => {
      if (action === 'stop') result.current.cancelTurn()
      else useCanvasStore.setState({ currentScenarioId: OTHER })
      await flushDispatch()
    })
    await act(async () => { pending.resolve(response(200, SUCCESS)); await send })
    expect(result.current.messages.some(m => m.content === SUCCESS.assistant_text)).toBe(false)
    if (action === 'stop') expect(mockStop).toHaveBeenCalledTimes(1)
    else {
      await offer(requestId(pending.fetchSpy), 'Foreign reply.')
      expect(result.current.messages.some(m => m.content === 'Foreign reply.')).toBe(false)
    }
    expect(pending.fetchSpy).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('CONTROL: duplicate identities and reply-only rows cannot establish receipt', () => {
    const local = [{ id: 'local', role: 'user' as const, content: C1B, timestamp: new Date(SERVER_AT),
      deliveryState: 'unconfirmed' as const, deliveryRequestId: 'exact', deliveryScenarioId: SCENARIO }]
    const duplicate = [...turns('exact'), ...turns('exact')]
    expect(reconcileUnconfirmedServerTurns(local, SCENARIO, duplicate, RUN)).toEqual(local)
    expect(reconcileUnconfirmedServerTurns([...local, { ...local[0], id: 'local-duplicate' }], SCENARIO, turns('exact'), RUN)
      .every(m => m.deliveryState === 'unconfirmed')).toBe(true)
    const replyOnly = readServerConversationTurns([{ turn_id: 'exact', created_at: SERVER_AT,
      user_message: null, assistant_message: 'Reply only.' }])!
    expect(reconcileUnconfirmedServerTurns(local, SCENARIO, replyOnly, RUN)).toEqual(local)
    expect(reconcileUnconfirmedServerTurns(local, OTHER, turns('exact'), RUN)).toEqual(local)
  })
})

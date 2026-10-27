// @vitest-environment-options {"url": "https://staging--olumi.netlify.app/#/canvas"}
/**
 * The staging default is the core route (DL 22 Oct): a turn from a plain staging link, with no `?ai=`, sends
 * `x-olumi-ai-mode: core-route` and its answer is read through `coreTurnContract.ts`, on the buffered turn AND on the
 * streamed turn's COMPLETE frame. The answer is core-route's real R2 card turn (22 Oct), so the reply and its card are
 * CEE's, as sent; a legacy-shaped body would be a schema mismatch here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import real from '../../../v5/__tests__/fixtures/core-turn-r2-real.json'
import r2Errors from '../../../v5/__tests__/fixtures/core-turn-r2-errors.json'
import servedChatEdit from '../../../v5/__tests__/fixtures/core-turn-served-chat-edit.json'
import { PROXY_TIMEOUT_UNKNOWN_COPY } from '../deliveryUnknown'
import { CORE_STILL_FINISHING_NOTICE, CORE_OUTCOME_UNKNOWN_NOTICE, STILL_FINISHING_REPLAY_DELAY_MS } from '../coreStillFinishing'

const mockOpenStream = vi.fn()
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args) }
})
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: () => Promise.resolve({ kind: 'not_saved' as const }),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
const mockRecover = vi.fn()
vi.mock('../../hydrate/draftRecovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hydrate/draftRecovery')>()
  return { ...actual, recoverDraftFromServer: (...args: unknown[]) => mockRecover(...args) }
})

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const TURN = real.card_turn

function stubFetch(body: unknown, status = 200) {
  const fetchStub = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

/** What the person sees from the turn: CEE's reply and its card's approve / decline, as sent. */
function reply(result: { current: ReturnType<typeof useConversation> }) {
  const last = result.current.messages.at(-1)!
  return { role: last.role, content: last.content, chips: (last.actionChips ?? []).map((c) => c.label) }
}
const EXPECTED = { role: 'assistant', content: TURN.assistant_text, chips: ['Make this change', 'Change something first', 'Not now'] }

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  mockOpenStream.mockReset()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO, nodes: [], edges: [], results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null, selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('⭐ staging default = core route, read only through the contract', () => {
  it('the page is a plain staging link (no ?ai=)', () => {
    expect(window.location.hostname).toBe('staging--olumi.netlify.app')
    expect(window.location.href).not.toContain('ai=')
  })

  it('buffered: the turn sends core-route and shows CEE\'s reply and its card', async () => {
    mockOpenStream.mockRejectedValue(new TypeError('Failed to fetch'))
    const fetchStub = stubFetch(TURN)
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('Explore staffing options') })
    const turnCall = fetchStub.mock.calls.find(([, init]) => new Headers(init?.headers).has('x-olumi-ai-mode'))
    expect(new Headers(turnCall?.[1]?.headers).get('x-olumi-ai-mode')).toBe('core-route')
    expect(reply(result)).toEqual(EXPECTED)
  })

  it('streamed: the COMPLETE frame\'s body is read through the contract too', async () => {
    const encoder = new TextEncoder()
    const frame = (o: Record<string, unknown>) => `event: stage\ndata: ${JSON.stringify(o)}\n\n`
    mockOpenStream.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode(frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
          + frame({ stage: 'COMPLETE', seq: 1, status: 'complete', status_code: 200, payload: TURN })))
        c.close()
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    stubFetch({})
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('Explore staffing options', { turnType: 'explicit_generate' }) })
    expect(mockOpenStream).toHaveBeenCalledTimes(1)
    expect(new Headers((mockOpenStream.mock.calls[0][1] as { headers?: HeadersInit } | undefined)?.headers).get('x-olumi-ai-mode')).toBe('core-route')
    expect(reply(result)).toEqual(EXPECTED)
  })

  describe('⭐ the served journey\'s chat edit (22 Oct 13:54Z): a turn with no Run shows its reply and card, never "did not reply"', () => {
    const SERVED = servedChatEdit.chat_edit_turn
    const shown = { role: 'assistant', content: SERVED.assistant_text, chips: ['Make this change', 'Change something first', 'Not now'] }
    it('buffered', async () => {
      mockOpenStream.mockRejectedValue(new TypeError('Failed to fetch'))
      stubFetch(SERVED)
      const { result } = renderHook(() => useConversation())
      await act(async () => { await result.current.sendMessage('A correction: we sell about 950 loaves a week, not 900.') })
      expect(reply(result)).toEqual(shown)
      expect(result.current.messages.map((m) => m.content)).not.toContain(PROXY_TIMEOUT_UNKNOWN_COPY)
    })
    it('streamed COMPLETE', async () => {
      const encoder = new TextEncoder()
      const frame = (o: Record<string, unknown>) => `event: stage\ndata: ${JSON.stringify(o)}\n\n`
      mockOpenStream.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode(frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
            + frame({ stage: 'COMPLETE', seq: 1, status: 'complete', status_code: 200, payload: SERVED })))
          c.close()
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } }))
      stubFetch({})
      const { result } = renderHook(() => useConversation())
      await act(async () => { await result.current.sendMessage('Explore staffing options', { turnType: 'explicit_generate' }) })
      expect(reply(result)).toEqual(shown)
    })
  })

  describe('R2\'s stream timeout (its exact bytes, head 43e7e5e8): still finishing, never a failure', () => {
    const encoder = new TextEncoder()
    const sse = (o: unknown) => `event: stage\ndata: ${JSON.stringify(o)}\n\n`
    const turnIdOf = (init: unknown) => (JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')) as { turn_id?: string }).turn_id
    async function timedOutTurn() {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mockRecover.mockResolvedValue('recovered')
      mockOpenStream.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode(sse({ stage: 'DRAFTING', seq: 0, status: 'in_progress' }) + sse(r2Errors.stream_timeout_complete_frame)))
          c.close()
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } }))
      const fetchStub = stubFetch(r2Errors.resend_after_claim_wait.body, r2Errors.resend_after_claim_wait.status)
      const { result } = renderHook(() => useConversation())
      await act(async () => { await result.current.sendMessage('Explore staffing options', { turnType: 'explicit_generate' }) })
      return { result, fetchStub }
    }
    afterEach(() => { vi.useRealTimers() })

    it('⭐ TURN_STILL_RUNNING says Olumi is still finishing: no failure, no retry, the message reads as sent', async () => {
      const { result } = await timedOutTurn()
      expect(result.current.messages.map((m) => m.content)).toContain(CORE_STILL_FINISHING_NOTICE)
      expect(result.current.messages.flatMap((m) => m.actionChips ?? []).map((c) => c.id)).not.toContain('retry')
      expect(result.current.lastSendFailure).toBeNull()
      expect(result.current.messages.find((m) => m.role === 'user')?.deliveryState).toBe('sent')
    })

    it('⭐ its one re-send (same turn_id) meets 409 TURN_OUTCOME_UNKNOWN, so the saved model is read and the outcome stays unknown', async () => {
      const { result, fetchStub } = await timedOutTurn()
      await act(async () => { await vi.advanceTimersByTimeAsync(STILL_FINISHING_REPLAY_DELAY_MS + 50) })
      await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
      const resends = fetchStub.mock.calls.filter(([, init]) => new Headers(init?.headers).get('x-olumi-ai-mode') === 'core-route')
      expect(resends).toHaveLength(1)
      expect(turnIdOf(resends[0][1])).toBe(turnIdOf({ body: JSON.stringify(mockOpenStream.mock.calls[0][0]) }))
      expect(mockRecover).toHaveBeenCalledTimes(1)
      const texts = result.current.messages.map((m) => m.content)
      // C7 (27 Oct): the merged graph is not this turn finishing, so the outcome stays unknown.
      expect(texts).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
      expect(texts.some((t) => t.includes('Olumi finished this'))).toBe(false)
      expect(texts).not.toContain(CORE_STILL_FINISHING_NOTICE)
    })
  })
})

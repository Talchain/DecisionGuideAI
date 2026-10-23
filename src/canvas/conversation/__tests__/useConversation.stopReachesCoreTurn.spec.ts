/**
 * Stop reaches the core turn (23 Oct, PR L). On `?ai=core-route` every turn is sent with `x-olumi-ai-mode: core-route`
 * and the person's auth headers, but Stop posted `/turn/stop` with Content-Type alone, so the proxy routed it to the
 * orchestrator rather than to the core turn it names. Through the real conversation -> stopTurn -> fetch path, the stop
 * POST now carries the same route and auth headers, and the same scenario and turn id, as the turn it stops.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => 'user-stop-1',
  getSessionIdentity: async () => ({ userId: 'user-stop-1', accessToken: 'access-token-stop-1' }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals() })

const SCENARIO = 'c1c1c1c1-d2d2-4e3e-8f4f-a5a5a5a5a5a5'

describe('Stop on a core-route turn', () => {
  it('⭐ posts /proxy/v5/turn/stop with the turn\'s route + auth headers and identity, and leaves the thinking state', async () => {
    window.history.replaceState({}, '', '/#/canvas?ai=core-route')
    Element.prototype.scrollIntoView = vi.fn()
    useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [], edges: [], results: { status: 'idle' } as never } as never)
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/turn/stop')) {
        return Promise.resolve(new Response(JSON.stringify({ stopped: true, already_committed: false }), { status: 200, headers: { 'content-type': 'application/json' } }))
      }
      // The core turn never answers; it ends only when the browser aborts it.
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useConversation())

    await act(async () => { void result.current.sendMessage('We sell about 950 loaves a week.'); await new Promise((r) => setTimeout(r, 0)) })
    const turnCall = fetchMock.mock.calls.find(([u]) => u === 'https://cee.test/proxy/v5/turn')
    expect(turnCall, 'precondition: the core turn was sent').toBeDefined()
    const turnHeaders = turnCall![1].headers as Record<string, string>
    expect(turnHeaders['x-olumi-ai-mode'], 'precondition: the turn went to the core route').toBe('core-route')
    expect(result.current.isThinking, 'precondition: the turn is live').toBe(true)
    const turnBody = JSON.parse(String(turnCall![1].body)) as { turn_id: string; scenario_id: string }

    await act(async () => { result.current.cancelTurn(); await new Promise((r) => setTimeout(r, 0)) })

    const stopCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith('/turn/stop'))
    expect(stopCalls).toHaveLength(1)
    const [stopUrl, stopInit] = stopCalls[0]
    expect(stopUrl).toBe('https://cee.test/proxy/v5/turn/stop')
    const stopHeaders = stopInit.headers as Record<string, string>
    expect(stopHeaders['x-olumi-ai-mode'], 'a header-less stop is routed to the orchestrator, not this core turn').toBe('core-route')
    expect(stopHeaders.Authorization).toBe('Bearer access-token-stop-1')
    expect(stopHeaders['X-User-Id']).toBe('user-stop-1')
    expect(stopHeaders['X-Request-Id'], 'the turn\'s per-send request id is not reused for the stop').toBeUndefined()
    expect(JSON.parse(String(stopInit.body))).toEqual({ scenario_id: SCENARIO, turn_id: turnBody.turn_id })
    expect(turnBody.scenario_id).toBe(SCENARIO)
    expect(result.current.isThinking, 'the panel left the thinking state').toBe(false)
  })
})

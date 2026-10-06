/** Round 4: the adapter call and the fetch boundary are distinct facts. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { assertsDeliveryUnknown, assertsNonDelivery } from '../deliveryUnknown'
import { loadTranscript, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import * as adapter from '../../../v5/v5Adapter'
import * as parser from '../../../v5/responseParser'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(), streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null, storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../v5/eligibility', async importOriginal => ({
  ...await importOriginal<typeof import('../../../v5/eligibility')>(),
  isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false,
}))

const SID = '8bc39f9f-5636-45dd-952d-a084ea75dd82'
const INPUT = 'We fit 16 small-update equivalents per sprint.'
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetTranscriptTombstonesForTests()
  useServerConversationTurnsStore.setState({ offer: null })
  vi.stubEnv('VITE_V5_ENDPOINT', 'https://cee.test/proxy/v5/turn')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  useCanvasStore.setState({ currentScenarioId: SID,
    nodes: [{ id: 'productivity', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'productivity' } }],
    edges: [], results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('Round 4 request start boundary', () => {
  it('RED: adapter rejection before fetch stays failed, unsaved and retryable', async () => {
    // Same pre-dispatch seam as the unchanged cardActionSettledReload row.
    vi.spyOn(adapter, 'callV5Turn').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(INPUT) })
    const user = result.current.messages.find(m => m.role === 'user')!
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(user.deliveryState).toBe('failed')
    expect(user.deliveryRequestId).toBeUndefined()
    expect(loadTranscript(SID)?.messages.some(m => m.id === user.id) ?? false).toBe(false)
    const notice = result.current.messages.at(-1)!
    expect(assertsNonDelivery(notice.content)).toBe(true)
    expect(notice.actionChips?.map(c => c.id)).toEqual(['retry'])
    expect(result.current.lastSendFailure?.retryable).toBe(true)
    unmount()
  })

  it('CONTROL: the same native rejection from an invoked fetch stays unconfirmed', async () => {
    const fetchSpy = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(INPUT) })
    const user = result.current.messages.find(m => m.role === 'user')!
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(user.deliveryState).toBe('unconfirmed')
    expect(loadTranscript(SID)?.messages.find(m => m.id === user.id)?.deliveryState).toBe('unconfirmed')
    expect(assertsDeliveryUnknown(result.current.messages.at(-1)!.content)).toBe(true)
    expect(result.current.messages.at(-1)!.actionChips ?? []).toEqual([])
    expect(result.current.lastSendFailure?.retryable).toBe(false)
    unmount()
  })

  it('CONTROL: an unexpected parser throw after fetch also stays unconfirmed', async () => {
    // Exercise the outer catch with the REAL adapter/start callback, rather
    // than inferring dispatch from the exception name or mocking the signal.
    vi.spyOn(parser, 'parseV5Response').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(INPUT) })
    const user = result.current.messages.find(m => m.role === 'user')!
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(user.deliveryState).toBe('unconfirmed')
    expect(user.deliveryRequestId).toBeTruthy()
    expect(assertsNonDelivery(result.current.messages.at(-1)!.content)).toBe(false)
    expect(result.current.lastSendFailure?.retryable).toBe(false)
    unmount()
  })
})

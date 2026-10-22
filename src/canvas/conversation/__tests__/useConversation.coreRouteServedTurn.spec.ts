/**
 * The served journey (22 Oct 13:54Z, UI bce4aa49, CEE 5b2b5441) on `?ai=core-route`: CEE answered a chat correction with
 * a valid contract and a card, and the person was told "The server did not reply in time", because a turn with no Run
 * carries `run` with null fields. Through the real fetch -> parser -> conversation, the same bytes now show the reply and
 * its card.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import served from '../../../v5/__tests__/fixtures/core-turn-served-chat-edit.json'
import { PROXY_TIMEOUT_UNKNOWN_COPY } from '../deliveryUnknown'

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals() })

describe('a core-route turn with no Run', () => {
  it('⭐ shows CEE\'s reply and its card, never "the server did not reply"', async () => {
    window.history.replaceState({}, '', '/#/canvas?ai=core-route')
    Element.prototype.scrollIntoView = vi.fn()
    useCanvasStore.setState({ currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4', nodes: [], edges: [], results: { status: 'idle' } as never } as never)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(served.chat_edit_turn), { status: 200, headers: { 'content-type': 'application/json' } })))
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('A correction: we sell about 950 loaves a week, not 900.') })
    const last = result.current.messages.at(-1)!
    expect(last.content).toBe(served.chat_edit_turn.assistant_text)
    expect((last.actionChips ?? []).map((c) => c.label)).toEqual(['Make this change', 'Change something first', 'Not now'])
    expect(result.current.messages.map((m) => m.content)).not.toContain(PROXY_TIMEOUT_UNKNOWN_COPY)
  })
})

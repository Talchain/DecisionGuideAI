/**
 * Recovery Batch B, witness row 3 (DL 12 Oct; CLAUDE.md §7.3 "a confirmed local non-send is distinct from a delivery or
 * result that is UNKNOWN; check idempotency before offering a retry").
 *
 * Served (live/runs/2026-10-12T020148Z/marketing, row 3; UI 52936df0): L36's reply was lost after delivery, the user
 * typed the same words again (L41), and CEE recorded and answered the message twice — two client turn ids, two server
 * turns. CEE dedupes on (scenario_id, turn_id) and hashes `message.trim()`, so the same words on the SAME id replay the
 * recorded answer. The rule: the same words (equal after trim) as the LAST send, while that send is still
 * delivery-unknown, re-use its turn id. A confirmed reply, a confirmed non-send, other words, or a send in between keep
 * a fresh id. Ids are read on the wire (`fetch` body) or at the adapter seam, never inferred.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import * as adapter from '../../../v5/v5Adapter'

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
const L36 = "It's for the marketing campaign. What date do you mean by last Friday?"
const OTHER = 'What should we review first?'
const reply = (text: string) => new Response(JSON.stringify({ response_version: 2, assistant_text: text,
  blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }), { status: 200, headers: { 'content-type': 'application/json' } })
const lost = async (): Promise<Response> => { throw new TypeError('Failed to fetch') }
type Body = { turn_id: string; scenario_id: string; message: string }
const bodies = (f: ReturnType<typeof vi.fn>): Body[] => f.mock.calls.map(c => JSON.parse(String((c[1] as RequestInit).body)) as Body)

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

describe('row 3: the same words typed again while the last send is delivery-unknown re-use its turn id', () => {
  it('RED on 6bbe357 (served marketing row 3): the retyped L36 carries L36\'s own turn_id, so CEE replays instead of recording twice', async () => {
    const fetchSpy = vi.fn().mockImplementationOnce(lost).mockImplementationOnce(async () => reply('Last Friday was 9 October.'))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(L36) })
    expect(result.current.messages.find(m => m.role === 'user')!.deliveryState).toBe('unconfirmed')
    // Typed again with stray whitespace: CEE hashes message.trim(), so these are the same request.
    await act(async () => { await result.current.sendMessage(`  ${L36} `) })
    const [first, second] = bodies(fetchSpy)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(first!.turn_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(second!.turn_id, 'the retype is the SAME turn').toBe(first!.turn_id)
    expect(second!.scenario_id).toBe(first!.scenario_id)
    expect(second!.message.trim()).toBe(L36)
    expect(result.current.messages.at(-1)!.content).toBe('Last Friday was 9 October.')
    unmount()
  })

  it('CONFLICT (CEE TURN_ID_REUSED on the re-used id): existing copy only, and "Try again" then sends a fresh id, never the refused one', async () => {
    const conflict = async () => new Response(JSON.stringify({ error: 'TURN_ID_REUSED', detail: 'That turn id was already used for a different message. Nothing was run or changed.' }),
      { status: 409, headers: { 'content-type': 'application/json' } })
    const fetchSpy = vi.fn().mockImplementationOnce(lost).mockImplementationOnce(conflict).mockImplementationOnce(async () => reply('Answer.'))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(L36) })
    await act(async () => { await result.current.sendMessage(L36) })
    expect(result.current.messages.at(-1)!.content, 'the existing refusal copy, no new string').toBe('Something went wrong on our side. Please retry.')
    expect(result.current.messages.filter(m => m.role === 'user').at(-1)!.deliveryState).toBe('failed')
    await act(async () => { await result.current.retryLast() })
    const [first, second, third] = bodies(fetchSpy)
    expect(second!.turn_id).toBe(first!.turn_id)
    expect(third!.turn_id, 'CEE said that id holds another request: the retry is a new turn').not.toBe(second!.turn_id)
    expect(result.current.messages.at(-1)!.content).toBe('Answer.')
    unmount()
  })

  it('CONTROL (confirmed reply): the same words after a delivered answer are a new turn', async () => {
    const fetchSpy = vi.fn().mockImplementationOnce(async () => reply('First answer.')).mockImplementationOnce(async () => reply('Second answer.'))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(L36) })
    expect(result.current.messages.find(m => m.role === 'user')!.deliveryState).toBe('sent')
    await act(async () => { await result.current.sendMessage(L36) })
    const [first, second] = bodies(fetchSpy)
    expect(second!.turn_id).not.toBe(first!.turn_id)
    unmount()
  })

  it('CONTROL (confirmed local non-send): the same words after a send that never left are a new turn', async () => {
    const seam = vi.spyOn(adapter, 'callV5Turn').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const fetchSpy = vi.fn(async () => reply('Answer.'))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(L36) })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.messages.find(m => m.role === 'user')!.deliveryState).toBe('failed')
    await act(async () => { await result.current.sendMessage(L36) })
    const ids = seam.mock.calls.map(c => (c[0] as { turn_id: string }).turn_id)
    expect(ids).toHaveLength(2)
    expect(ids[1], 'a confirmed non-send is not an unknown delivery').not.toBe(ids[0])
    unmount()
  })

  it('CONTROL (other words): different text after an unknown delivery is a new turn', async () => {
    const fetchSpy = vi.fn().mockImplementationOnce(lost).mockImplementationOnce(async () => reply('Answer.'))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(L36) })
    await act(async () => { await result.current.sendMessage(OTHER) })
    const [first, second] = bodies(fetchSpy)
    expect(second!.turn_id).not.toBe(first!.turn_id)
    unmount()
  })

  it('CONTROL (a send in between): the unknown send is no longer the LAST one, so its words later are a new turn', async () => {
    const fetchSpy = vi.fn().mockImplementationOnce(lost).mockImplementationOnce(async () => reply('Answer.'))
      .mockImplementationOnce(async () => reply('Answer again.'))
    vi.stubGlobal('fetch', fetchSpy)
    const { result, unmount } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage(L36) })
    await act(async () => { await result.current.sendMessage(OTHER) })
    await act(async () => { await result.current.sendMessage(L36) })
    const ids = bodies(fetchSpy).map(b => b.turn_id)
    expect(new Set(ids).size).toBe(3)
    unmount()
  })
})

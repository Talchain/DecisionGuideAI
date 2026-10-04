/**
 * ⭐ THE CHAT BESIDE A COLD-LOAD DEEP LINK IS THE LINK'S CHAT (Canvas, DL 0df0e1 row, 4 Oct 2026).
 *
 * `useConversation` restores a transcript ONCE per mount (`didMountRestoreRef`), for the `currentScenarioId` of its
 * first render. That is the class `claimColdLoadDeepLink` runs in the route's RENDER for: a supersede done in a layout
 * effect still leaves every hook's first render holding the remembered id, and React flushes that commit's passive
 * effects before re-rendering. MEASURED here, and stated exactly: under a layout-effect supersede the first-mount restore
 * ASKS FOR Z's transcript (`loadTranscript(Z)`), and Z's chat is still never rendered — its update lands behind the
 * synchronous re-render, and the scenario-switch effect replaces it with Y's. So the visible harm in this hook is nil
 * either way; what the render-time claim buys is that no first render, here or in any hook below the route, starts on Z.
 * The pair below binds that by id: which transcripts the restore asked for, and every render's chat.
 *
 * Transcripts are written by the REAL `saveTranscript` and marked as an EARLIER page load (`pageLoadId`), which is the
 * only thing the restore asks of them. They are bound by scenario id: each scenario's chat says its own id.
 * Mock preamble trimmed from `useConversation.serverTurnsRestore.spec.tsx` (it stops the hook reaching a network path).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { useConversation } from '../../conversation/useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import {
  saveTranscript,
  loadTranscript,
  TRANSCRIPT_STORAGE_KEY,
  __resetTranscriptTombstonesForTests,
} from '../../conversation/utils/transcriptStore'
import type { ConversationMessage } from '../../conversation/types'
import { claimColdLoadDeepLink, supersedeRememberedScenario, __resetColdLoadDeepLinkForTests } from '../coldLoadDeepLink'
import { projectAutosaveData, autosaveSourceFromStore } from '../../store/autosaveProjection'

// A passthrough: `useConversation` imports this module's `loadTranscript`, so the spy sees exactly what it asked for.
vi.mock('../../conversation/utils/transcriptStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/utils/transcriptStore')>()
  return { ...actual, loadTranscript: vi.fn(actual.loadTranscript) }
})
vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: vi.fn(),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: vi.fn(() => Promise.resolve({ kind: 'not_saved' })),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => {
    throw new TypeError('Failed to fetch')
  },
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: vi.fn(async () => null) }))

const Z = 'aaaaaaaa-1111-4111-8111-111111111111'
const Y = 'bbbbbbbb-2222-4222-8222-222222222222'

function chatOf(id: string): ConversationMessage[] {
  return [
    { id: `${id}-u`, role: 'user', content: `question about ${id}`, timestamp: '2026-10-04T10:00:00.000Z' },
    { id: `${id}-a`, role: 'assistant', content: `answer about ${id}`, timestamp: '2026-10-04T10:00:05.000Z' },
  ] as unknown as ConversationMessage[]
}
/** Both chats, written by the real writer, then marked as an EARLIER page load (all the restore asks). */
function earlierChats(): void {
  for (const id of [Z, Y]) expect(saveTranscript(id, chatOf(id))).toBe(0)
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) as string) as Record<string, { pageLoadId?: string }>
  for (const id of [Z, Y]) file[id].pageLoadId = 'an-earlier-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}
/** A browser that remembers Z (pointer + autosave), and the store as module load seeds it. */
function rememberZ(): void {
  useCanvasStore.setState({ currentScenarioId: Z, nodes: [{ id: 'z_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Z' } }] as never, edges: [] })
  scenarios.setCurrentScenarioId(Z)
  scenarios.saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  useCanvasStore.setState({ currentScenarioId: scenarios.getCurrentScenarioId(), nodes: [], edges: [] })
}
const said = (messages: readonly ConversationMessage[]) => messages.map((m) => m.content).filter((c) => /about/.test(c ?? ''))
type Frame = { id: string | null; chat: string[] }
const CHAT = (id: string) => [`question about ${id}`, `answer about ${id}`]
const askedFor = () => vi.mocked(loadTranscript).mock.calls.map((c) => c[0])

describe('the chat a cold-load deep link opens beside', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetTranscriptTombstonesForTests()
    __resetColdLoadDeepLinkForTests()
    earlierChats()
    rememberZ()
    vi.mocked(loadTranscript).mockClear()
  })

  it('PRECONDITION: with no link, the remembered scenario\'s chat is restored (the instrument sees a restore)', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    expect(said(result.current.messages)).toEqual([`question about ${Z}`, `answer about ${Z}`])
  })

  it('⭐ claimed in the route\'s render, before the hook: the first-mount restore reads Y, and no render ever shows Z\'s chat', async () => {
    const frames: Frame[] = []
    const { result } = renderHook(() => {
      claimColdLoadDeepLink(Y)
      const conv = useConversation()
      frames.push({ id: useCanvasStore.getState().currentScenarioId, chat: said(conv.messages) })
      return conv
    })
    await act(async () => { await Promise.resolve() })
    expect(useCanvasStore.getState().currentScenarioId).toBe(Y)
    expect(said(result.current.messages)).toEqual(CHAT(Y))
    expect(askedFor()).toContain(Y)
    expect(askedFor()).not.toContain(Z)
    expect(frames.filter((f) => f.chat.some((c) => c.includes(Z)))).toEqual([])
    expect(frames.every((f) => f.id === Y)).toBe(true)
  })

  it('WHY IT IS THE RENDER: the same supersede from a layout effect leaves the first-mount restore asking for Z (never rendered)', async () => {
    const frames: Frame[] = []
    const { result } = renderHook(() => {
      useLayoutEffect(() => { supersedeRememberedScenario(Y) }, [])
      const conv = useConversation()
      frames.push({ id: useCanvasStore.getState().currentScenarioId, chat: said(conv.messages) })
      return conv
    })
    await act(async () => { await Promise.resolve() })
    expect(askedFor()[0]).toBe(Z)
    expect(frames[0].id).toBe(Z)
    expect(frames.filter((f) => f.chat.some((c) => c.includes(Z)))).toEqual([])
    expect(said(result.current.messages)).toEqual(CHAT(Y))
  })
})

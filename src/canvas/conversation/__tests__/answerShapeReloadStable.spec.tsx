/** U1/U2: answer sidecars persist, while complete assistant_text renders live and after reload. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor, cleanup } from '@testing-library/react'

import servedJourneyC673223 from './fixtures/openai-route-coaching-journey.c673223.json'
import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import {
  saveTranscript,
  loadTranscript,
  TRANSCRIPT_STORAGE_KEY,
  __resetTranscriptTombstonesForTests,
  type SourceKeyedMessage,
} from '../utils/transcriptStore'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
// The streamed sibling is unreachable, so the turn is ONE buffered request.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: async () => { throw new TypeError('Failed to fetch') } }
})
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ initPostHog: vi.fn(), identifyUser: vi.fn(), resetPostHog: vi.fn(), trackEvent: vi.fn() }))
vi.mock('../hooks/useThreadPersistence', () => ({ useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken: vi.fn() }) }))

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

const SID = '00000000-0000-4000-8000-000000000001'

type Wire = Record<string, unknown> & { assistant_text?: string }
const C2_RUN = (servedJourneyC673223 as { turns: Array<{ turn: string; json: Wire }> }).turns.find(
  (t) => t.turn === 'C2 run',
)!.json
const SERVED_TEXT = String(C2_RUN.assistant_text)
const HEADLINE = SERVED_TEXT.split('\n')[0].trim()
const BULLETS = SERVED_TEXT.split('\n')
  .filter((l) => l.startsWith('- '))
  .slice(0, 3)
  .map((l) => l.slice(2).trim())
/** Text that is in the detail and NOT in the headline or bullets. */
const DETAIL_ONLY = 'leave the decision unsettled'
const SHAPE = { headline: HEADLINE, bullets: BULLETS, detail: SERVED_TEXT }
const withShape = (): Wire => ({ ...JSON.parse(JSON.stringify(C2_RUN)), _answer_shape: SHAPE })

function savedRaw(): Array<Record<string, unknown>> {
  const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
  expect(raw, 'a transcript was saved').not.toBeNull()
  return (JSON.parse(raw!)[SID].messages ?? []) as Array<Record<string, unknown>>
}
function restampAsEarlierPageLoad(): void {
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  file[SID].pageLoadId = 'an-earlier-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

beforeEach(() => {
  localStorage.clear()
  __resetTranscriptTombstonesForTests()
})

describe('the store keeps the producer\'s answer shape', () => {
  const turn = (over: Partial<SourceKeyedMessage> = {}): SourceKeyedMessage =>
    ({ id: 't1', role: 'assistant', content: SERVED_TEXT, timestamp: new Date('2026-09-25T11:00:00Z'), ...over }) as SourceKeyedMessage

  it('saves it and reads it back verbatim', () => {
    saveTranscript(SID, [turn({ answerShape: SHAPE })])
    expect(savedRaw()[0].answerShape).toEqual(SHAPE)
    expect(loadTranscript(SID)!.messages[0].answerShape).toEqual(SHAPE)
  })

  it('a malformed stored shape is dropped on restore (the live validator decides), and the text still renders', () => {
    saveTranscript(SID, [turn({ answerShape: SHAPE })])
    const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    file[SID].messages[0].answerShape = { headline: '  ', bullets: ['x'], detail: SERVED_TEXT }
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
    const [restored] = loadTranscript(SID)!.messages
    expect(restored).not.toHaveProperty('answerShape')
    expect(restored.content).toBe(SERVED_TEXT)
  })

  it('an older save with no shape loads exactly as before', () => {
    saveTranscript(SID, [turn()])
    expect(savedRaw()[0]).not.toHaveProperty('answerShape')
    expect(loadTranscript(SID)!.messages[0]).not.toHaveProperty('answerShape')
  })
})

const queue: Wire[] = []
const conv: { current: UseConversationReturn | null } = { current: null }
function Harness() {
  const c = useConversation()
  conv.current = c
  return (
    <ToastProvider>
      <ConversationPanel conversation={c} onCollapse={vi.fn()} onAttach={vi.fn()} />
    </ToastProvider>
  )
}
async function mountPanel(): Promise<void> {
  render(<Harness />)
  await waitFor(() => expect(useGuidanceStore.getState()._sendChip).toBeTypeOf('function'))
}
async function reload(): Promise<void> {
  cleanup()
  restampAsEarlierPageLoad()
  await mountPanel()
}

const body = () => document.querySelector('[data-testid="answer-body"]')
const onTheFace = (text: string) => (document.body.textContent ?? '').includes(text)


describe('the served Run reply, live and after a reload (c673223 "C2 run")', () => {
  beforeEach(() => {
    queue.length = 0
    Element.prototype.scrollIntoView = vi.fn()
    window.history.replaceState(null, '', '/?ai=openai#/canvas')
    useCanvasStore.setState({
      currentScenarioId: SID,
      nodes: [],
      edges: [],
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      analysisStateV1: null,
      results: { status: 'idle' } as never,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never)
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      if (!/\/v5\/turn(\?|$)/.test(String(url))) return new Response('{}', { status: 404 })
      const next = queue.shift()
      if (!next) throw new Error('the UI sent a request no served turn answers')
      return new Response(JSON.stringify(next), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('U1/U2: full repeated replies survive the answer sidecar and reload', async () => {
    await mountPanel()
    queue.push(withShape(), withShape())
    for (const words of ['Run the analysis.', 'Explain that again.']) {
      await act(async () => { await conv.current!.sendMessage(words) })
    }
    const fullReplies = () => Array.from(document.querySelectorAll('[data-testid="message-body-text"]'))
      .filter(el => el.textContent?.includes(DETAIL_ONLY))
    expect(fullReplies()).toHaveLength(2)
    expect(body()).toBeNull()
    await waitFor(() => expect(savedRaw().filter(m => m.answerShape !== undefined)).toHaveLength(2))
    await reload()
    await waitFor(() => expect(fullReplies()).toHaveLength(2))
    expect(body()).toBeNull()
  })

  it('CONTROL, the served bytes as they are (no shape): the full text, live and after a reload', async () => {
    await mountPanel()
    queue.push(JSON.parse(JSON.stringify(C2_RUN)))
    await act(async () => { await conv.current!.sendMessage('Run the analysis.') })
    expect(body(), 'live: no concise view without the producer\'s shape').toBeNull()
    expect(onTheFace(DETAIL_ONLY), 'live: the full text is on the face').toBe(true)

    await reload()
    await waitFor(() => expect(onTheFace('This run does not establish')).toBe(true))
    expect(body(), 'after reload: still no concise view').toBeNull()
    expect(onTheFace(DETAIL_ONLY)).toBe(true)
  })
})

afterEach(() => { cleanup() })

/**
 * ⭐ A CONSENT TURN LOOKS THE SAME AFTER A RELOAD.
 *
 * THE DEFECT (morning guide, step 4: "a known layout shift"). The served first
 * brief drafts the model, runs the automatic first pass (so it carries the run
 * card) AND asks for consent with CEE's pair "Use as starting assumptions" /
 * "Change something first". Live, the run card keeps its line, because the
 * consent pair is the turn's one next action (`shouldPromoteRunTurnCard`).
 * `MessageBubble` read "asks for consent" from the turn's own `actionChips`,
 * and the transcript store drops chips on save. So after a reload the same turn
 * read as "no consent", and its run card jumped onto the face of the reply.
 *
 * THE RULE. That a turn OFFERED consent is a fact about the turn. The store
 * keeps the fact (`consentOffered`), never the chips: the restored turn
 * composes as it did live, and offers no consent button to click again.
 *
 * CLAIM TYPE: jsdom DOM + localStorage. The mounted half drives the served
 * route body (`fixtures/openai-route-first-pass-with-consent.e39f6e0.json`)
 * through the REAL `useConversation` and `ConversationPanel`, with `fetch`
 * answering from the capture. A "reload" is: unmount, re-stamp the saved
 * transcript as an earlier page load's, and mount fresh. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor, cleanup } from '@testing-library/react'

import servedFirstPassWithConsent from './fixtures/openai-route-first-pass-with-consent.e39f6e0.json'
import servedJourneyE39f6e0 from './fixtures/openai-route-coaching-journey.e39f6e0.json'
import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import {
  saveTranscript,
  loadTranscript,
  turnOfferedConsent,
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

// ── Fixtures ────────────────────────────────────────────────────────────────

const SID = '00000000-0000-4000-8000-000000000001'
const APPROVE = 'agent-approve-proposal:prop_6e4bc41340eb967f29685f87c464c571'

type Wire = Record<string, unknown> & { blocks?: Array<Record<string, unknown>> }
const C1 = (servedFirstPassWithConsent as { turns: Array<{ turn: string; json: Wire }> }).turns.find(
  (t) => t.turn === 'C1 brief',
)!.json
const RUN_CARD_ID = String((C1.blocks ?? []).find((b) => b.type === 'coaching')?.block_id)
/** A later explicit Run with NO consent offer (served e39f6e0 journey, C2). */
const C2_RUN = (servedJourneyE39f6e0 as { turns: Array<{ turn: string; json: Wire }> }).turns.find(
  (t) => t.turn === 'C2 run',
)!.json
const C2_CARD_ID = String((C2_RUN.blocks ?? []).find((b) => b.type === 'coaching')?.block_id)

function assistantTurn(id: string, chips: Array<{ id: string; label: string }> | undefined): SourceKeyedMessage {
  return {
    id,
    role: 'assistant',
    content: `Reply ${id}.`,
    timestamp: new Date('2026-09-25T02:00:00Z'),
    ...(chips ? { actionChips: chips.map((c) => ({ ...c, intent: 'primary' as const })) } : {}),
  } as SourceKeyedMessage
}

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

// ── The store keeps the fact, never the chips ───────────────────────────────

describe('the store records that a turn offered consent', () => {
  it('a consent turn saves `consentOffered`, drops the chips, and reads back as offering consent', () => {
    saveTranscript(SID, [assistantTurn('t1', [{ id: APPROVE, label: 'Use as starting assumptions' }, { id: 'agent-amend-proposal', label: 'Change something first' }])])
    const [stored] = savedRaw()
    expect(stored.consentOffered).toBe(true)
    expect(stored, 'the chips themselves are never stored').not.toHaveProperty('actionChips')

    const [restored] = loadTranscript(SID)!.messages
    expect(restored.actionChips, 'no consent button comes back').toBeUndefined()
    expect(turnOfferedConsent(restored)).toBe(true)
  })

  it('CONTROL: a turn whose chips ask for no consent stores no fact', () => {
    saveTranscript(SID, [
      assistantTurn('t1', [{ id: 'agent-run-analysis', label: 'Run analysis' }, { id: 'agent-amend-proposal', label: 'Change something first' }]),
      assistantTurn('t2', undefined),
    ])
    for (const stored of savedRaw()) expect(stored).not.toHaveProperty('consentOffered')
    for (const restored of loadTranscript(SID)!.messages) expect(turnOfferedConsent(restored)).toBe(false)
  })

  it('a restored consent turn keeps the fact when it is saved again (a second reload)', () => {
    saveTranscript(SID, [assistantTurn('t1', [{ id: APPROVE, label: 'Use as starting assumptions' }])])
    const once = loadTranscript(SID)!.messages
    saveTranscript(SID, once)
    expect(savedRaw()[0].consentOffered).toBe(true)
    expect(turnOfferedConsent(loadTranscript(SID)!.messages[0])).toBe(true)
  })

  it('an older save with no field loads exactly as before', () => {
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({ [SID]: { savedAt: '2026-09-24T20:00:00Z', pageLoadId: 'old', dropped: 0, messages: [{ id: 't1', role: 'assistant', content: 'Hi.', ts: '2026-09-24T20:00:00Z' }] } }),
    )
    const [restored] = loadTranscript(SID)!.messages
    expect(restored).not.toHaveProperty('consentOffered')
    expect(turnOfferedConsent(restored)).toBe(false)
  })
})

// ── Mounted: the served consent turn, live and after a reload ───────────────

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

const runCardLine = () =>
  document.querySelector(`[data-testid="coaching-line-${RUN_CARD_ID}"]`) as HTMLDetailsElement | null
const runCard = () => document.querySelector(`[data-block-id="${RUN_CARD_ID}"]`) as HTMLElement | null
const approveChip = () => document.querySelector('[data-testid^="suggested-chip-agent-approve-proposal"]')

/** The layout the user sees at rest: the run card closed inside its line, not on the face. */
function expectRunCardKeepsItsLine(when: string): void {
  const line = runCardLine()
  expect(line, `${when}: the run card keeps its line (not promoted)`).not.toBeNull()
  expect(line!.open, `${when}: the line is closed at rest`).toBe(false)
  const card = runCard()
  if (card) expect(line!.contains(card), `${when}: the card is inside its line`).toBe(true)
}

describe('the served consent turn keeps its layout after a reload (e39f6e0)', () => {
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
      const body = queue.shift()
      if (!body) throw new Error('the UI sent a request no served turn answers')
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('live: consent pair + the run card as a closed line; reload: the same layout, and no consent button', async () => {
    await mountPanel()
    queue.push(C1)
    await act(async () => {
      await conv.current!.sendMessage('We sell a Pro plan at £49/month. Should we raise it to £59 with the next feature release?')
    })

    // LIVE — the served layout (the acceptance spec's own assertion, as the baseline).
    expect(approveChip(), 'live: the consent chip is offered').not.toBeNull()
    expectRunCardKeepsItsLine('live')
    await waitFor(() => expect(savedRaw().some((m) => m.consentOffered === true)).toBe(true))

    // RELOAD — nothing survives but localStorage.
    cleanup()
    restampAsEarlierPageLoad()
    await mountPanel()
    await waitFor(() => expect(runCard(), 'reload: the restored turn renders its run card').not.toBeNull())

    // Anti-vacuity: this really is the restored turn, and its chips really are gone.
    expect(approveChip(), 'reload: no consent button comes back to click again').toBeNull()
    expect(conv.current!.messages.some((m) => (m.actionChips ?? []).some((c) => c.id === APPROVE))).toBe(false)

    expectRunCardKeepsItsLine('after reload')
  })
})

describe('the fact is per turn, never sticky (R&C 5829256737: served row R1)', () => {
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
      const body = queue.shift()
      if (!body) throw new Error('the UI sent a request no served turn answers')
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  /** The Run card is promoted: on the face of its reply, not inside a closed line. */
  const promoted = (id: string) =>
    document.querySelector(`[data-block-id="${id}"]`) !== null &&
    document.querySelector(`[data-testid="coaching-line-${id}"]`) === null

  it('a consent turn, then a Run with no consent offer: live and after a reload, only the consent turn keeps its line', async () => {
    await mountPanel()
    queue.push(C1)
    await act(async () => { await conv.current!.sendMessage('We sell a Pro plan at £49/month. Should we raise it to £59?') })
    queue.push(C2_RUN)
    await act(async () => { await conv.current!.sendMessage('Go ahead.') })

    expectRunCardKeepsItsLine('live, the consent turn')
    expect(promoted(C2_CARD_ID), 'live: the later Run card is on the face').toBe(true)
    await waitFor(() => expect(savedRaw().filter((m) => m.consentOffered === true)).toHaveLength(1))

    cleanup()
    restampAsEarlierPageLoad()
    await mountPanel()
    await waitFor(() => expect(runCard(), 'reload: the restored turns render').not.toBeNull())

    expectRunCardKeepsItsLine('after reload, the consent turn')
    expect(promoted(C2_CARD_ID), 'after reload: the later Run card is STILL on the face (no sticky consent)').toBe(true)
  })
})

afterEach(() => { cleanup() })

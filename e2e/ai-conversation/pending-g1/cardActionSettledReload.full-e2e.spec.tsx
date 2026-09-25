/**
 * G1 — A CARD ACTION THE USER ALREADY TOOK IS NOT LIVE AGAIN AFTER A RELOAD.
 *
 * ## The defect (proved by the prior probe)
 * A coaching chip's `settled` was component state and a held proposal's
 * Confirm was settled only in `patchBlockStates` (in-memory). The transcript is
 * restored from localStorage on a reload, the card comes back with it, and the
 * action is live again: one more click sends a second turn.
 *
 * ## The rule under test (the design, built as proposed)
 * "Settled after reload" means a DELIVERED user message created by that card's
 * action exists in the saved transcript. The message carries `sourceBlockKey`
 * (`coach:<turnId>:<block_id>` / `held:<turnId>:<proposal_id>`), the transcript
 * store persists it, and the restored conversation derives settlement from it.
 *
 * ## What is real and what is mocked
 * REAL: `ConversationProvider` → `useConversation` (send, bubble, persist,
 * mount-restore), `OlumiTabBody` → `ConversationPanel` (the `_sendChip`
 * registration and its meta → chip hop), `InlineBlocks` → `V5CoachingBlock` →
 * `ActionChip`, `V5HeldProposalBlock`, and `saveTranscript`/`loadTranscript`
 * against jsdom's localStorage. MOCKED: the network runner only
 * (`callV5Turn`, or `fetch` for the wire-byte case), plus the auth/scenario
 * bridges. NO MODEL CALLS.
 *
 * ## What a "reload" is here
 * Unmount the provider, re-stamp the saved transcript as written by an EARLIER
 * page load (a transcript this page load wrote is deliberately not restored —
 * see `transcriptStore.PAGE_LOAD_ID`), and mount a FRESH provider. Nothing
 * survives but localStorage, which is exactly what a reload keeps.
 *
 * CLAIM TYPE: jsdom DOM + localStorage. Not the deployed build.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor, within, act, cleanup } from '@testing-library/react'

import { ConversationProvider } from '../ConversationContext'
import { OlumiTabBody } from '../../components/OlumiTabBody'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import {
  saveTranscript,
  loadTranscript,
  settledSourceBlockKeys,
  TRANSCRIPT_STORAGE_KEY,
  __resetTranscriptTombstonesForTests,
} from '../utils/transcriptStore'
import { coachingSourceBlockKey, heldProposalSourceBlockKey } from '../sourceBlockKey'
import type {
  ConversationBlock,
  ConversationMessage,
  V5CoachingBlock as V5CoachingBlockType,
} from '../types'

// ---------------------------------------------------------------------------
// Mocks — the network runner and the auth/scenario bridges ONLY.
// ---------------------------------------------------------------------------

vi.mock('../turnService', () => ({
  callOrchestratorTurn: () => new Promise(() => {}),
  streamOrchestratorTurn: async function* () { /* never yields */ },
  OrchestratorError: class extends Error {},
}))

const mockCallV5Turn = vi.fn()
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
    getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
  }
})

// The streamed sibling refuses, so every turn takes the buffered runner above —
// the same explicit construction `useConversation.sendChipWireIntent.spec.ts` uses.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true as const }),
    isV5CanonicalRunPath: () => flags.isV5CanonicalAnalysisEnabled(),
  }
})

vi.mock('../../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/supabase')>()
  return {
    ...actual,
    getUserId: async () => null,
    getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  }
})

vi.mock('../../../services/scenarioService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/scenarioService')>()
  return { ...actual, loadScenario: async () => null }
})

vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A UUID, so `sendTurn` never mints a replacement scenario id. */
const SID = '7c1f5a52-3d0e-4b8a-9f61-2a4d6e8c0b13'

const TURN_A = 'a-turn-coach-1'
const TURN_B = 'a-turn-coach-2'

const CARD_X = 'blk-coach-x'
const CARD_Y = 'blk-coach-y'
const HANDLE = 'gmh_1a2b3c4d5e6f'

function coachingCard(
  blockId: string,
  title: string,
  extra: Partial<V5CoachingBlockType> = {},
): V5CoachingBlockType {
  return {
    type: 'v5_coaching',
    block_id: blockId,
    title,
    body: `${title}: the producer's body.`,
    coaching_kind: 'strengthen',
    source: 'decision_review',
    category: 'must_fix',
    target_refs: [],
    action_label: `Do ${title}`,
    action_prompt: `Please help me with ${title}.`,
    ...extra,
  }
}

function heldBlock(handle: string, summary: string): ConversationBlock {
  return {
    type: 'v5_held_proposal',
    proposal_id: handle,
    summary,
    mutation_class: 'structural',
    reason_code: 'STRUCTURAL_APPLY_HELD',
    confirm: { label: 'Confirm these changes', message: `confirm ${handle}` },
  } as unknown as ConversationBlock
}

function assistantTurn(id: string, blocks: ConversationBlock[]): ConversationMessage {
  return {
    id,
    role: 'assistant',
    content: 'Here is what I found.',
    timestamp: new Date('2026-09-24T10:00:00Z'),
    blocks,
  }
}

const V5_SUCCESS = {
  kind: 'response' as const,
  response: {
    response_version: 2,
    assistant_text: 'Done.',
    blocks: [] as unknown[],
    suggested_actions: [] as unknown[],
    insights: [] as unknown[],
    stage_indicator: 'frame',
  },
}

/**
 * Write `messages` as the saved transcript of an EARLIER page load — "the user
 * was here, closed the tab, and came back".
 */
function storePriorSession(messages: ConversationMessage[]): void {
  saveTranscript(SID, messages)
  restampAsEarlierPageLoad()
}

function restampAsEarlierPageLoad(): void {
  const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
  expect(raw, 'a transcript must be saved before a reload can restore it').not.toBeNull()
  const file = JSON.parse(raw!)
  file[SID].pageLoadId = 'an-earlier-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

function mountPanel() {
  return render(
    <ConversationProvider>
      <OlumiTabBody />
    </ConversationProvider>,
  )
}

/** The reload: nothing survives but localStorage. */
async function reload() {
  cleanup()
  restampAsEarlierPageLoad()
  mountPanel()
  await screen.findAllByTestId('chat-message-assistant')
  expandCollapsedTiers()
}

/** Open every "Show N more" tier, so a demoted card is mounted and clickable. */
function expandCollapsedTiers(): void {
  for (const toggle of screen.queryAllByTestId('block-detail-toggle')) {
    if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  }
}

/**
 * The ONE coaching card with this block id AND title — bound by identity
 * (block id) and by the turn-unique title, asserted to length 1 (trap 19).
 */
function coachingCardEl(blockId: string, title: string): HTMLElement {
  const matches = screen
    .getAllByTestId('v5-coaching')
    .filter(
      (el) =>
        el.getAttribute('data-block-id') === blockId &&
        within(el).queryByText(`${title}: the producer's body.`) !== null,
    )
  expect(matches, `exactly one card ${blockId} / ${title}`).toHaveLength(1)
  return matches[0]
}

function chipOf(blockId: string, title: string): HTMLButtonElement {
  return within(coachingCardEl(blockId, title)).getByTestId('v5-coaching-action') as HTMLButtonElement
}

function heldCard(handle: string): HTMLElement {
  const matches = screen
    .getAllByTestId('v5-held-proposal')
    .filter((el) => el.getAttribute('data-block-id') === handle)
  expect(matches).toHaveLength(1)
  return matches[0]
}

/** Payloads the runner actually received. */
function sentPayloads(): Array<{ message?: string; chip?: Record<string, unknown> }> {
  return mockCallV5Turn.mock.calls.map((c) => c[0] as { message?: string; chip?: Record<string, unknown> })
}

/** The user messages the SAVED transcript holds (what a reload would restore). */
function savedUserMessages(): ConversationMessage[] {
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '{}')
  const stored = (file[SID]?.messages ?? []) as Array<{ role: string }>
  return stored.filter((m) => m.role === 'user') as unknown as ConversationMessage[]
}

/** Click a live chip and wait until the turn it sent has resolved and been saved. */
async function clickAndSettle(button: HTMLButtonElement, expectedKey: string): Promise<void> {
  const before = mockCallV5Turn.mock.calls.length
  await act(async () => {
    fireEvent.click(button)
  })
  await waitFor(() => expect(mockCallV5Turn.mock.calls.length).toBe(before + 1))
  await waitFor(() => {
    const saved = savedUserMessages().filter((m) => m.sourceBlockKey === expectedKey)
    expect(saved, `a delivered user message carrying ${expectedKey} is saved`).toHaveLength(1)
  })
}

beforeEach(() => {
  localStorage.clear()
  __resetTranscriptTombstonesForTests()
  mockCallV5Turn.mockReset()
  mockCallV5Turn.mockResolvedValue(V5_SUCCESS)
  useGuidanceStore.setState({ _sendChip: null } as never)
  useCanvasStore.setState({
    currentScenarioId: SID,
    nodes: [],
    edges: [],
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never)
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useGuidanceStore.setState({ _sendChip: null } as never)
})

// ---------------------------------------------------------------------------

describe('the keys are a stored contract', () => {
  it('coaching and held keys have the designed shapes, scoped by turn', () => {
    expect(coachingSourceBlockKey(TURN_A, CARD_X)).toBe(`coach:${TURN_A}:${CARD_X}`)
    expect(heldProposalSourceBlockKey(TURN_A, HANDLE)).toBe(`held:${TURN_A}:${HANDLE}`)
    // No turn ⇒ no key: an unscoped key would settle a later re-issue too.
    expect(coachingSourceBlockKey(undefined, CARD_X)).toBeUndefined()
    expect(heldProposalSourceBlockKey(undefined, HANDLE)).toBeUndefined()
  })
})

describe('(a)/(b)/(c) coaching chip — settled after reload iff its action was taken', () => {
  beforeEach(() => {
    storePriorSession([
      assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha'), coachingCard(CARD_Y, 'Bravo')]),
    ])
  })

  it('(a) clicked → reload → settled, and a click sends 0 turns', async () => {
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    expandCollapsedTiers()

    const key = coachingSourceBlockKey(TURN_A, CARD_X)!
    await clickAndSettle(chipOf(CARD_X, 'Alpha'), key)
    // The turn that went out is the producer's prompt, unchanged.
    expect(sentPayloads()[0].message).toBe('Please help me with Alpha.')

    await reload()

    const chip = chipOf(CARD_X, 'Alpha')
    expect(chip).toBeDisabled()
    expect(chip).toHaveAttribute('data-settled', 'true')
    // No "Sent" receipt (RC ruling): settlement is the only thing the chip says.
    expect(coachingCardEl(CARD_X, 'Alpha').textContent ?? '').not.toMatch(/\bsent\b|sending/i)

    const before = mockCallV5Turn.mock.calls.length
    await act(async () => {
      fireEvent.click(chip)
      chip.click()
    })
    expect(mockCallV5Turn.mock.calls.length).toBe(before)
  })

  it('(b) never clicked → reload → live, and a click sends exactly once', async () => {
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    await reload()

    const chip = chipOf(CARD_X, 'Alpha')
    expect(chip).not.toBeDisabled()
    expect(chip).not.toHaveAttribute('data-settled')

    await act(async () => {
      fireEvent.click(chip)
      chip.click()
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    expect(sentPayloads()[0].message).toBe('Please help me with Alpha.')
  })

  it('(c) two cards on one turn: clicking one settles only that one, live and after reload', async () => {
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    expandCollapsedTiers()

    await clickAndSettle(chipOf(CARD_X, 'Alpha'), coachingSourceBlockKey(TURN_A, CARD_X)!)
    expect(chipOf(CARD_X, 'Alpha')).toBeDisabled()
    expect(chipOf(CARD_Y, 'Bravo')).not.toBeDisabled()

    await reload()

    expect(chipOf(CARD_X, 'Alpha')).toBeDisabled()
    const other = chipOf(CARD_Y, 'Bravo')
    expect(other).not.toBeDisabled()
    expect(other).not.toHaveAttribute('data-settled')

    const before = mockCallV5Turn.mock.calls.length
    await act(async () => {
      fireEvent.click(other)
    })
    await waitFor(() => expect(mockCallV5Turn.mock.calls.length).toBe(before + 1))
    expect(sentPayloads().at(-1)?.message).toBe('Please help me with Bravo.')
  })
})

describe('(d) the same block_id on a different turn is a different card', () => {
  it('settling turn A’s card leaves turn B’s card (same block_id) live after reload', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')]),
      assistantTurn(TURN_B, [coachingCard(CARD_X, 'Charlie')]),
    ])
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    expandCollapsedTiers()
    // Precondition: the SAME block id really is on screen twice.
    expect(
      screen.getAllByTestId('v5-coaching').filter((el) => el.getAttribute('data-block-id') === CARD_X),
    ).toHaveLength(2)

    await clickAndSettle(chipOf(CARD_X, 'Alpha'), coachingSourceBlockKey(TURN_A, CARD_X)!)
    await reload()

    expect(chipOf(CARD_X, 'Alpha')).toBeDisabled()
    const later = chipOf(CARD_X, 'Charlie')
    expect(later).not.toBeDisabled()
    expect(later).not.toHaveAttribute('data-settled')
  })
})

describe('(e) a send that never went out does not settle the card after reload', () => {
  it('failed send → the bubble is not saved → reload → live, and it sends once', async () => {
    storePriorSession([assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')])])
    mockCallV5Turn.mockReset()
    mockCallV5Turn.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    expandCollapsedTiers()

    await act(async () => {
      fireEvent.click(chipOf(CARD_X, 'Alpha'))
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    // Precondition: the send really FAILED, and the live transcript says so
    // (the chip-initiated bubble's own "Not delivered" marker).
    await screen.findByTestId('send-failed-indicator')
    // In-session the clicked chip stays settled (one chip, one turn) — the
    // bubble's own retry affordance is the way to try again.
    expect(chipOf(CARD_X, 'Alpha')).toBeDisabled()
    // …and the failed bubble was never committed to the saved transcript.
    expect(savedUserMessages()).toHaveLength(0)

    mockCallV5Turn.mockResolvedValue(V5_SUCCESS)
    await reload()

    const chip = chipOf(CARD_X, 'Alpha')
    expect(chip).not.toBeDisabled()
    await act(async () => {
      fireEvent.click(chip)
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(2))
  })

  it('PIN — the store drops failed and pending sends, so they can never settle a card', () => {
    const at = new Date('2026-09-24T10:00:00Z')
    const key = (n: string) => `coach:${TURN_A}:${n}`
    saveTranscript(SID, [
      assistantTurn(TURN_A, [coachingCard('f', 'F')]),
      { id: 'u-failed', role: 'user', content: 'x', timestamp: at, deliveryState: 'failed', sourceBlockKey: key('failed') },
      { id: 'u-pending', role: 'user', content: 'x', timestamp: at, deliveryState: 'pending', sourceBlockKey: key('pending') },
      { id: 'u-sent', role: 'user', content: 'x', timestamp: at, deliveryState: 'sent', sourceBlockKey: key('sent') },
      { id: 'u-unconfirmed', role: 'user', content: 'x', timestamp: at, deliveryState: 'unconfirmed', sourceBlockKey: key('unconfirmed') },
      { id: 'u-legacy', role: 'user', content: 'x', timestamp: at, sourceBlockKey: key('legacy') },
    ])
    const loaded = loadTranscript(SID)!
    expect(loaded.messages.map((m) => m.id)).toEqual([TURN_A, 'u-sent', 'u-unconfirmed', 'u-legacy'])
    expect([...settledSourceBlockKeys(loaded.messages)].sort()).toEqual(
      [key('legacy'), key('sent'), key('unconfirmed')].sort(),
    )
    // Read LIVE, the same rule applies: a failed or pending message settles nothing.
    expect(
      settledSourceBlockKeys([
        { id: 'p', role: 'user', content: 'x', timestamp: at, deliveryState: 'pending', sourceBlockKey: key('p') },
        { id: 'f', role: 'user', content: 'x', timestamp: at, deliveryState: 'failed', sourceBlockKey: key('f') },
        // An assistant message can never settle a card, whatever it carries.
        { id: 'a', role: 'assistant', content: 'x', timestamp: at, sourceBlockKey: key('a') },
      ]).size,
    ).toBe(0)
  })
})

describe('(f) held proposal Confirm — confirmed → reload → settled, not re-confirmable', () => {
  it('the restored card shows the confirmed state and offers no Confirm', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')]),
    ])
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    expandCollapsedTiers()

    const key = heldProposalSourceBlockKey(TURN_A, HANDLE)!
    await clickAndSettle(
      within(heldCard(HANDLE)).getByTestId('v5-held-proposal-confirm') as HTMLButtonElement,
      key,
    )
    expect(sentPayloads()[0].message).toBe(`confirm ${HANDLE}`)

    await reload()

    const card = heldCard(HANDLE)
    expect(card).toHaveAttribute('data-settled', 'accepted')
    expect(within(card).queryByTestId('v5-held-proposal-confirm')).toBeNull()
    expect(within(card).queryByTestId('v5-held-proposal-dismiss')).toBeNull()
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  })

  it('CONTROL — never confirmed → reload → Confirm is live and sends once', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')]),
    ])
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    await reload()

    const card = heldCard(HANDLE)
    expect(card).not.toHaveAttribute('data-settled')
    await act(async () => {
      fireEvent.click(within(card).getByTestId('v5-held-proposal-confirm'))
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
  })

  it('a LATER turn re-issuing the same handle stays live after reload (turn-scoped key)', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')]),
    ])
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    await clickAndSettle(
      within(heldCard(HANDLE)).getByTestId('v5-held-proposal-confirm') as HTMLButtonElement,
      heldProposalSourceBlockKey(TURN_A, HANDLE)!,
    )
    cleanup()

    // CEE later re-issues the same handle on a new turn (a different offer).
    const saved = loadTranscript(SID)!.messages
    saveTranscript(SID, [...saved, assistantTurn(TURN_B, [heldBlock(HANDLE, 'Rename the Pricing node')])])
    await reload()

    const cards = screen
      .getAllByTestId('v5-held-proposal')
      .filter((el) => el.getAttribute('data-block-id') === HANDLE)
    expect(cards).toHaveLength(2)
    const [earlier, later] = cards
    expect(earlier).toHaveAttribute('data-settled', 'accepted')
    expect(later).not.toHaveAttribute('data-settled')
    expect(within(later).getByTestId('v5-held-proposal-confirm')).toBeInTheDocument()
  })
})

describe('(g) an old transcript with no sourceBlockKey loads exactly as before', () => {
  it('pre-G1 save: loads unchanged, and every card is live', async () => {
    // Written by hand in the PRE-G1 stored shape — no `sourceBlockKey` anywhere.
    const legacyFile = {
      [SID]: {
        savedAt: '2026-09-20T09:00:00.000Z',
        pageLoadId: 'an-earlier-page-load',
        dropped: 0,
        messages: [
          { id: 'u-old', role: 'user', content: 'Please help me with Alpha.', ts: '2026-09-20T08:59:00.000Z', displayContent: 'Do Alpha', chipInitiated: true },
          {
            id: TURN_A,
            role: 'assistant',
            content: 'Here is what I found.',
            ts: '2026-09-20T09:00:00.000Z',
            blocks: [coachingCard(CARD_X, 'Alpha'), heldBlock(HANDLE, 'Remove the Pricing node')],
          },
        ],
      },
    }
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(legacyFile))

    const loaded = loadTranscript(SID)!
    expect(loaded.messages).toEqual([
      {
        id: 'u-old',
        role: 'user',
        content: 'Please help me with Alpha.',
        timestamp: new Date('2026-09-20T08:59:00.000Z'),
        displayContent: 'Do Alpha',
        chipInitiated: true,
      },
      {
        id: TURN_A,
        role: 'assistant',
        content: 'Here is what I found.',
        timestamp: new Date('2026-09-20T09:00:00.000Z'),
        blocks: [coachingCard(CARD_X, 'Alpha'), heldBlock(HANDLE, 'Remove the Pricing node')],
      },
    ])
    expect(loaded.messages.some((m) => 'sourceBlockKey' in m)).toBe(false)
    expect(settledSourceBlockKeys(loaded.messages).size).toBe(0)

    // Round trip: re-saving a key-less transcript writes no key.
    saveTranscript(SID, loaded.messages)
    expect(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)).not.toContain('sourceBlockKey')

    restampAsEarlierPageLoad()
    mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    expandCollapsedTiers()
    expect(chipOf(CARD_X, 'Alpha')).not.toBeDisabled()
    expect(heldCard(HANDLE)).not.toHaveAttribute('data-settled')
  })
})

describe('(h) the key never reaches the wire — the POSTed body is byte-identical', () => {
  const V5_ENDPOINT = 'https://cee.test/orchestrate/v2/turn'

  /**
   * Drive the REAL `_sendChip` seam (registered by the real ConversationPanel)
   * down to the REAL `callV5Turn`, capturing the exact string handed to
   * `fetch`. Ids that are minted per send (`crypto.randomUUID`, the panel's
   * `evidence-apply-${Date.now()}` chip id) are made deterministic so the two
   * bodies can be compared byte for byte.
   */
  async function postedBodyFor(meta: Record<string, unknown>): Promise<{ body: string; userKeys: (string | undefined)[] }> {
    const bodies: string[] = []
    const actual = await vi.importActual<typeof import('../../../v5/v5Adapter')>('../../../v5/v5Adapter')
    vi.stubEnv('VITE_V5_ENDPOINT', V5_ENDPOINT)
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      // Only the TURN is under test. A successful turn is followed by the
      // graph registration (`/bff/cee/scenarios/:id/graph`), a separate write.
      if (String(url) === V5_ENDPOINT) bodies.push(String(init?.body))
      return new Response(JSON.stringify(V5_SUCCESS.response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchImpl)
    mockCallV5Turn.mockImplementation((payload: unknown, opts: unknown) =>
      actual.callV5Turn(payload as never, opts as never),
    )

    storePriorSession([assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')])])
    const view = mountPanel()
    await screen.findAllByTestId('chat-message-assistant')
    await waitFor(() => expect(useGuidanceStore.getState()._sendChip).not.toBeNull())

    let n = 0
    const uuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000)
    try {
      await act(async () => {
        useGuidanceStore.getState()._sendChip!('Do Alpha', 'Please help me with Alpha.', meta)
      })
    } finally {
      uuid.mockRestore()
      now.mockRestore()
    }
    await waitFor(() => expect(bodies).toHaveLength(1))
    const savedKeys = await waitFor(() => {
      const users = savedUserMessages()
      expect(users.length).toBeGreaterThan(0)
      return users.map((m) => m.sourceBlockKey)
    })
    view.unmount()
    localStorage.clear()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    return { body: bodies[0], userKeys: savedKeys }
  }

  it('coaching meta: body with the key === body without it; the key rode only the bubble', async () => {
    const key = coachingSourceBlockKey(TURN_A, CARD_X)!
    const without = await postedBodyFor({ intent: 'add_option' })
    const withKey = await postedBodyFor({ intent: 'add_option', sourceBlockKey: key })

    expect(withKey.body).toBe(without.body)
    expect(withKey.body).not.toContain(key)
    expect(withKey.body).not.toContain('sourceBlockKey')
    // Discriminating: the key DID travel — to the saved user message, not the wire.
    expect(withKey.userKeys).toEqual([key])
    expect(without.userKeys).toEqual([undefined])
    // The intent pass-through is untouched by the key riding beside it.
    expect(JSON.parse(withKey.body).chip?.intent).toBe('add_option')
  })

  it('held meta: body with the key === body without it', async () => {
    const key = heldProposalSourceBlockKey(TURN_A, HANDLE)!
    const without = await postedBodyFor({})
    const withKey = await postedBodyFor({ sourceBlockKey: key })

    expect(withKey.body).toBe(without.body)
    expect(withKey.body).not.toContain(key)
    expect(withKey.userKeys).toEqual([key])
  })
})

/**
 * G1 — A CARD ACTION THE USER ALREADY TOOK IS NOT LIVE AGAIN AFTER A RELOAD.
 *
 * ## The defect (proved by the prior probe)
 * A coaching chip's `settled` was component state and a held proposal's
 * Confirm was settled only in `patchBlockStates` (in-memory). The transcript is
 * restored from localStorage on a reload, the card comes back with it, and the
 * action is live again: one more click sends a second turn.
 *
 * ## The rule under test (the design, as ruled GO — #63 5824401606)
 * "Settled after reload" means a DELIVERED user message created by that card's
 * action exists in the saved transcript. The message carries `sourceBlockKey`
 * (`coach:<turnId>:<block_id>` / `held:<turnId>:<proposal_id>`), the transcript
 * store persists it, and the restored conversation derives settlement from it.
 *
 * ## The layers
 *   1. CARD → SEAM: `ActionChip` (and `V5HeldProposalBlock`'s Confirm) puts its
 *      key in the `_sendChip` meta.
 *   2. SEAM → CHIP: the registered `_sendChip` (`ConversationPanel`
 *      `sendChipByLabelMessage`) builds the chip from the meta, key included.
 *   3. CHIP → BUBBLE → SAVE: `useConversation.sendChip` stamps the key on the
 *      user bubble; the store saves it once delivered.
 *   4. RELOAD → SETTLED: the restored transcript settles the card (coaching via
 *      the conversation context; held via the registry the card already reads).
 * Each layer has its own block below, and "end to end" drives all four in one
 * go: a real click in the mounted panel, then a reload.
 *
 * ## What is real and what is mocked
 * REAL: `useConversation` (send, bubble, persist, mount-restore, seeding),
 * `ConversationProvider`, `OlumiTabBody` → `ConversationPanel` → `InlineBlocks`
 * → `V5CoachingBlock` → `ActionChip`, `V5HeldProposalBlock`, and
 * `saveTranscript`/`loadTranscript` against jsdom localStorage. MOCKED: the
 * network runner (`callV5Turn`, or `fetch` for the wire-byte case) and the
 * auth/scenario bridges. NO MODEL CALLS.
 *
 * ## What a "reload" is here
 * Unmount, re-stamp the saved transcript as written by an EARLIER page load (a
 * transcript this page load wrote is deliberately not restored — see
 * `transcriptStore.PAGE_LOAD_ID`), and mount fresh. Nothing survives but
 * localStorage, which is exactly what a reload keeps.
 *
 * CLAIM TYPE: jsdom DOM + localStorage. Not the deployed build.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import {
  render,
  renderHook,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
  cleanup,
} from '@testing-library/react'

import { ConversationProvider } from '../ConversationContext'
import { OlumiTabBody } from '../../components/OlumiTabBody'
import { useConversation, type SourceKeyedChip } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import {
  saveTranscript,
  loadTranscript,
  settledSourceBlockKeys,
  coachingSourceBlockKey,
  heldProposalSourceBlockKey,
  TRANSCRIPT_STORAGE_KEY,
  __resetTranscriptTombstonesForTests,
  type SourceKeyedMessage,
} from '../utils/transcriptStore'
import { V5CoachingBlock } from '../../../v5/blocks/V5CoachingBlock'
import type { ConversationBlock, V5CoachingBlock as V5CoachingBlockType } from '../types'

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
const TURN_C = 'a-turn-coach-3'

const CARD_X = 'blk-coach-x'
const CARD_Y = 'blk-coach-y'
const HANDLE = 'gmh_1a2b3c4d5e6f'

const KEY_X = coachingSourceBlockKey(TURN_A, CARD_X)!
const KEY_HELD = heldProposalSourceBlockKey(TURN_A, HANDLE)!

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

const AT = new Date('2026-09-24T10:00:00Z')

function assistantTurn(id: string, blocks: ConversationBlock[]): SourceKeyedMessage {
  return { id, role: 'assistant', content: 'Here is what I found.', timestamp: AT, blocks }
}

/** A user message a card action created, in the given delivery state. */
function cardActionMessage(
  id: string,
  key: string,
  deliveryState?: SourceKeyedMessage['deliveryState'],
): SourceKeyedMessage {
  return {
    id,
    role: 'user',
    content: 'Please help me with it.',
    displayContent: 'Do it',
    chipInitiated: true,
    timestamp: AT,
    sourceBlockKey: key,
    ...(deliveryState ? { deliveryState } : {}),
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

function restampAsEarlierPageLoad(): void {
  const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
  expect(raw, 'a transcript must be saved before a reload can restore it').not.toBeNull()
  const file = JSON.parse(raw!)
  file[SID].pageLoadId = 'an-earlier-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

/** Save `messages` through the REAL store, as an earlier page load. */
function storePriorSession(messages: SourceKeyedMessage[]): void {
  saveTranscript(SID, messages)
  restampAsEarlierPageLoad()
}

/** The reload a returning user performs: a fresh provider over localStorage. */
async function mountRestoredPanel(): Promise<void> {
  render(
    <ConversationProvider>
      <OlumiTabBody />
    </ConversationProvider>,
  )
  await screen.findAllByTestId('chat-message-assistant')
  openAllTiers()
}

/** Open every "Show N more" tier, so a demoted card is mounted and clickable. */
function openAllTiers(): void {
  for (const toggle of screen.queryAllByTestId('block-detail-toggle')) {
    if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  }
}

/** A reload after THIS page load's own sends: unmount, re-stamp, mount fresh. */
async function reloadPanel(): Promise<void> {
  cleanup()
  restampAsEarlierPageLoad()
  await mountRestoredPanel()
}

/**
 * The ONE coaching card with this block id AND title — bound by identity
 * (block id) plus the turn-unique title, asserted to length 1 (trap 19).
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

function heldCards(handle: string): HTMLElement[] {
  return screen
    .getAllByTestId('v5-held-proposal')
    .filter((el) => el.getAttribute('data-block-id') === handle)
}

/** The user messages the SAVED transcript holds (what a reload would restore). */
function savedUserMessages(): SourceKeyedMessage[] {
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY) ?? '{}')
  const stored = (file[SID]?.messages ?? []) as Array<{ role: string }>
  return stored.filter((m) => m.role === 'user') as unknown as SourceKeyedMessage[]
}

/** The chip exactly as the registered seam will hand it over once it forwards the key. */
function cardChip(key: string | undefined, extra: Partial<SourceKeyedChip> = {}): SourceKeyedChip {
  return {
    id: 'chip-card-x',
    label: 'Do Alpha',
    message: 'Please help me with Alpha.',
    intent: 'primary',
    ...(key ? { sourceBlockKey: key } : {}),
    ...extra,
  }
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
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  useGuidanceStore.setState({ _sendChip: null } as never)
})

// ---------------------------------------------------------------------------

describe('the keys are a stored contract', () => {
  it('coaching and held keys have the designed shapes, scoped by turn', () => {
    expect(KEY_X).toBe(`coach:${TURN_A}:${CARD_X}`)
    expect(KEY_HELD).toBe(`held:${TURN_A}:${HANDLE}`)
    // No turn ⇒ no key: an unscoped key would settle a later re-issue too.
    expect(coachingSourceBlockKey(undefined, CARD_X)).toBeUndefined()
    expect(heldProposalSourceBlockKey(undefined, HANDLE)).toBeUndefined()
  })
})

describe('layer 1 — the card puts its own key in the send meta', () => {
  it('a mounted card sends its turn-scoped key beside the producer intent (intent unchanged)', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    render(
      <V5CoachingBlock block={coachingCard(CARD_X, 'Alpha', { action_intent: 'add_option' })} turnId={TURN_A} />,
    )
    const chip = screen.getByTestId('v5-coaching-action') as HTMLButtonElement
    // The same-tick ref guard still holds: two clicks, one send.
    act(() => {
      chip.click()
      chip.click()
    })
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith('Do Alpha', 'Please help me with Alpha.', {
      intent: 'add_option',
      sourceBlockKey: KEY_X,
    })
    expect(chip).toBeDisabled()
    // No "Sent" receipt (RC ruling): settlement is the only thing the chip says.
    expect(screen.getByTestId('v5-coaching').textContent ?? '').not.toMatch(/\bsent\b|sending/i)
  })

  it('no turn ⇒ no key ⇒ the meta is exactly what it was before G1', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    render(<V5CoachingBlock block={coachingCard(CARD_X, 'Alpha')} />)
    fireEvent.click(screen.getByTestId('v5-coaching-action'))
    expect(sendChip).toHaveBeenCalledWith('Do Alpha', 'Please help me with Alpha.', undefined)
  })

  it('no conversation provider ⇒ settlement is local state alone', () => {
    useGuidanceStore.setState({ _sendChip: vi.fn() } as never)
    render(<V5CoachingBlock block={coachingCard(CARD_X, 'Alpha')} turnId={TURN_A} />)
    const chip = screen.getByTestId('v5-coaching-action') as HTMLButtonElement
    expect(chip).not.toBeDisabled()
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('data-settled', 'true')
  })
})

describe('layer 3 — a delivered card send is saved with its key (real useConversation)', () => {
  /** The returning user's conversation: the card's turn, restored from storage. */
  async function restoredConversation() {
    storePriorSession([assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')])])
    const view = renderHook(() => useConversation())
    await waitFor(() => expect(view.result.current.messages.some((m) => m.id === TURN_A)).toBe(true))
    return view
  }

  it('(a) the key lands on the user bubble, is saved once delivered, and a reload reads it back', async () => {
    const first = await restoredConversation()
    await act(async () => {
      await first.result.current.sendChip(cardChip(KEY_X))
    })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    const bubble = first.result.current.messages.find((m) => m.role === 'user') as SourceKeyedMessage
    expect(bubble.sourceBlockKey).toBe(KEY_X)
    expect(bubble.deliveryState).toBe('sent')
    expect(first.result.current.settledSourceBlockKeys.has(KEY_X)).toBe(true)
    await waitFor(() =>
      expect(savedUserMessages().map((m) => m.sourceBlockKey)).toEqual([KEY_X]),
    )

    first.unmount()
    restampAsEarlierPageLoad()
    const reloaded = renderHook(() => useConversation())
    await waitFor(() => expect(reloaded.result.current.messages.length).toBeGreaterThan(0))
    expect(reloaded.result.current.settledSourceBlockKeys.has(KEY_X)).toBe(true)
  })

  it('(e) a send that never went out is never saved, so after reload nothing is settled', async () => {
    mockCallV5Turn.mockReset()
    mockCallV5Turn.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const first = await restoredConversation()
    await act(async () => {
      await first.result.current.sendChip(cardChip(KEY_X))
    })
    const bubble = first.result.current.messages.find((m) => m.role === 'user') as SourceKeyedMessage
    // Precondition: the send really FAILED and the bubble says so.
    expect(bubble.deliveryState).toBe('failed')
    expect(bubble.sourceBlockKey).toBe(KEY_X)
    // A failed bubble settles nothing — live, and after a reload.
    expect(first.result.current.settledSourceBlockKeys.size).toBe(0)
    // The saved transcript keeps the card's turn and never the failed bubble.
    expect(loadTranscript(SID)?.messages.some((m) => m.id === TURN_A)).toBe(true)
    expect(savedUserMessages()).toHaveLength(0)

    first.unmount()
    restampAsEarlierPageLoad()
    const reloaded = renderHook(() => useConversation())
    await waitFor(() => expect(reloaded.result.current.messages.length).toBeGreaterThan(0))
    expect(reloaded.result.current.settledSourceBlockKeys.size).toBe(0)
  })

  it('PIN — the store drops failed and pending sends; delivered ones keep their key', () => {
    const key = (n: string) => `coach:${TURN_A}:${n}`
    saveTranscript(SID, [
      assistantTurn(TURN_A, [coachingCard('f', 'F')]),
      cardActionMessage('u-failed', key('failed'), 'failed'),
      cardActionMessage('u-pending', key('pending'), 'pending'),
      cardActionMessage('u-sent', key('sent'), 'sent'),
      cardActionMessage('u-unconfirmed', key('unconfirmed'), 'unconfirmed'),
      cardActionMessage('u-legacy', key('legacy')),
    ])
    const loaded = loadTranscript(SID)!
    expect(loaded.messages.map((m) => m.id)).toEqual([TURN_A, 'u-sent', 'u-unconfirmed', 'u-legacy'])
    expect([...settledSourceBlockKeys(loaded.messages)].sort()).toEqual(
      [key('legacy'), key('sent'), key('unconfirmed')].sort(),
    )
    // Read LIVE, the same rule: failed/pending settle nothing, and an assistant
    // message never settles a card whatever it carries.
    expect(
      settledSourceBlockKeys([
        cardActionMessage('p', key('p'), 'pending'),
        cardActionMessage('f', key('f'), 'failed'),
        { ...assistantTurn('a', []), sourceBlockKey: key('a') },
      ]).size,
    ).toBe(0)
  })

  it('(f) a restored held confirm seeds the ONE registry the held card reads', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')]),
      cardActionMessage('u-confirm', KEY_HELD, 'sent'),
    ])
    const { result } = renderHook(() => useConversation())
    await waitFor(() => expect(result.current.patchBlockStates.get(KEY_HELD)).toBe('accepted'))
    // A coaching key never writes the held registry.
    expect([...result.current.patchBlockStates.keys()]).toEqual([KEY_HELD])
  })
})

describe('layer 4 — after a reload the card is settled iff the transcript records its action', () => {
  it('(a)+(c) the recorded card is settled and sends 0 turns; its sibling on the same turn stays live and sends once', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha'), coachingCard(CARD_Y, 'Bravo')]),
      cardActionMessage('u-x', KEY_X, 'sent'),
    ])
    await mountRestoredPanel()

    const taken = chipOf(CARD_X, 'Alpha')
    expect(taken).toBeDisabled()
    expect(taken).toHaveAttribute('data-settled', 'true')
    await act(async () => {
      fireEvent.click(taken)
      taken.click()
    })
    expect(mockCallV5Turn).not.toHaveBeenCalled()

    const sibling = chipOf(CARD_Y, 'Bravo')
    expect(sibling).not.toBeDisabled()
    expect(sibling).not.toHaveAttribute('data-settled')
    await act(async () => {
      fireEvent.click(sibling)
      sibling.click()
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    expect((mockCallV5Turn.mock.calls[0][0] as { message: string }).message).toBe('Please help me with Bravo.')
    // …and clicking the sibling settles only the sibling.
    expect(chipOf(CARD_Y, 'Bravo')).toBeDisabled()
    expect(chipOf(CARD_X, 'Alpha')).toBeDisabled()
  })

  it('(b) never clicked → reload → live, and a click sends exactly once', async () => {
    storePriorSession([assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')])])
    await mountRestoredPanel()

    const chip = chipOf(CARD_X, 'Alpha')
    expect(chip).not.toBeDisabled()
    expect(chip).not.toHaveAttribute('data-settled')
    await act(async () => {
      fireEvent.click(chip)
      chip.click()
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    expect((mockCallV5Turn.mock.calls[0][0] as { message: string }).message).toBe('Please help me with Alpha.')
  })

  it('(d) the same block_id on a different turn is a different card: it stays live', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')]),
      cardActionMessage('u-x', KEY_X, 'sent'),
      assistantTurn(TURN_B, [coachingCard(CARD_X, 'Charlie')]),
    ])
    await mountRestoredPanel()
    // Precondition: the SAME block id really is on screen twice.
    expect(
      screen.getAllByTestId('v5-coaching').filter((el) => el.getAttribute('data-block-id') === CARD_X),
    ).toHaveLength(2)

    expect(chipOf(CARD_X, 'Alpha')).toBeDisabled()
    const later = chipOf(CARD_X, 'Charlie')
    expect(later).not.toBeDisabled()
    expect(later).not.toHaveAttribute('data-settled')
  })

  it('(e) the transcript a failed send leaves behind restores the card live, and it sends once', async () => {
    // Saved through the real store WITH the failed bubble in it — the store's
    // own rule, not this fixture, is what keeps it out.
    storePriorSession([
      assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')]),
      cardActionMessage('u-x', KEY_X, 'failed'),
    ])
    await mountRestoredPanel()

    const chip = chipOf(CARD_X, 'Alpha')
    expect(chip).not.toBeDisabled()
    await act(async () => {
      fireEvent.click(chip)
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
  })

  it('(f) held Confirm confirmed → reload → settled, not re-confirmable; a LATER re-issue stays live', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')]),
      cardActionMessage('u-confirm', KEY_HELD, 'sent'),
      // CEE later re-issues the same handle on a new turn — a different offer.
      assistantTurn(TURN_B, [heldBlock(HANDLE, 'Rename the Pricing node')]),
    ])
    await mountRestoredPanel()

    const [confirmed, later] = heldCards(HANDLE)
    expect(heldCards(HANDLE)).toHaveLength(2)
    expect(confirmed).toHaveAttribute('data-settled', 'accepted')
    expect(within(confirmed).queryByTestId('v5-held-proposal-confirm')).toBeNull()
    expect(within(confirmed).queryByTestId('v5-held-proposal-dismiss')).toBeNull()

    expect(later).not.toHaveAttribute('data-settled')
    expect(within(later).getByTestId('v5-held-proposal-confirm')).toBeInTheDocument()
    expect(mockCallV5Turn).not.toHaveBeenCalled()
  })

  it('(f) CONTROL — never confirmed → reload → Confirm is live', async () => {
    storePriorSession([assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')])])
    await mountRestoredPanel()
    const [card] = heldCards(HANDLE)
    expect(card).not.toHaveAttribute('data-settled')
    expect(within(card).getByTestId('v5-held-proposal-confirm')).toBeInTheDocument()
  })
})

describe('end to end — a real click in the mounted panel, delivered, then a reload', () => {
  it('coaching: the key survives the registered seam; after reload the card is settled and its sibling is live', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha'), coachingCard(CARD_Y, 'Bravo')]),
    ])
    await mountRestoredPanel()

    await act(async () => {
      fireEvent.click(chipOf(CARD_X, 'Alpha'))
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    // The turn that went out is the producer's prompt, unchanged.
    expect((mockCallV5Turn.mock.calls[0][0] as { message: string }).message).toBe('Please help me with Alpha.')
    // Layer 2: the seam carried the key, so the saved bubble names this card.
    await waitFor(() =>
      expect(savedUserMessages().map((m) => m.sourceBlockKey)).toEqual([KEY_X]),
    )

    await reloadPanel()

    const taken = chipOf(CARD_X, 'Alpha')
    expect(taken).toBeDisabled()
    expect(taken).toHaveAttribute('data-settled', 'true')
    await act(async () => {
      fireEvent.click(taken)
      taken.click()
    })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(chipOf(CARD_Y, 'Bravo')).not.toBeDisabled()
  })

  it('held: Confirm through the real seam → reload → the card reads confirmed and offers no Confirm', async () => {
    storePriorSession([assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')])])
    await mountRestoredPanel()

    await act(async () => {
      fireEvent.click(within(heldCards(HANDLE)[0]).getByTestId('v5-held-proposal-confirm'))
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    // CEE resolves a confirm by its exact message, so it goes out untouched.
    expect((mockCallV5Turn.mock.calls[0][0] as { message: string }).message).toBe(`confirm ${HANDLE}`)
    await waitFor(() =>
      expect(savedUserMessages().map((m) => m.sourceBlockKey)).toEqual([KEY_HELD]),
    )

    await reloadPanel()

    const [restored] = heldCards(HANDLE)
    expect(restored).toHaveAttribute('data-settled', 'accepted')
    expect(within(restored).queryByTestId('v5-held-proposal-confirm')).toBeNull()
    expect(within(restored).queryByTestId('v5-held-proposal-dismiss')).toBeNull()
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  })

  // Independent review of 06648ffd (#1985 5825570570): CEE re-issues a handle
  // to supersede it, and a confirm retires every copy at or before its acting
  // turn (`heldProposalRetirementKeys`). The restore must apply that same rule,
  // not just the acting card's own key, or the earlier copy comes back live.
  it('held, re-issued: a reload restores the whole retirement — earlier copies stay settled; a LATER re-issue stays live', async () => {
    storePriorSession([
      assistantTurn(TURN_A, [heldBlock(HANDLE, 'Remove the Pricing node')]),
      assistantTurn(TURN_B, [heldBlock(HANDLE, 'Remove the Pricing node')]),
    ])
    await mountRestoredPanel()
    expect(heldCards(HANDLE)).toHaveLength(2)

    await act(async () => {
      fireEvent.click(within(heldCards(HANDLE)[1]).getByTestId('v5-held-proposal-confirm'))
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    // In session, both copies retire together.
    expect(heldCards(HANDLE).map((el) => el.getAttribute('data-settled'))).toEqual(['accepted', 'accepted'])
    // Only the acting card's key is saved; the restore derives the rest.
    await waitFor(() =>
      expect(savedUserMessages().map((m) => m.sourceBlockKey)).toEqual([
        heldProposalSourceBlockKey(TURN_B, HANDLE),
      ]),
    )

    // CEE later re-issues the same handle once more: a NEW offer.
    cleanup()
    const saved = loadTranscript(SID)!.messages
    saveTranscript(SID, [...saved, assistantTurn(TURN_C, [heldBlock(HANDLE, 'Rename the Pricing node')])])
    restampAsEarlierPageLoad()
    await mountRestoredPanel()

    const cards = heldCards(HANDLE)
    expect(cards.map((el) => el.getAttribute('data-settled'))).toEqual(['accepted', 'accepted', null])
    expect(within(cards[0]).queryByTestId('v5-held-proposal-confirm')).toBeNull()
    expect(within(cards[1]).queryByTestId('v5-held-proposal-confirm')).toBeNull()
    expect(within(cards[2]).getByTestId('v5-held-proposal-confirm')).toBeInTheDocument()
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  })

  // R&C (#63 5824576658 §4): ChatThread can remount a message's subtree within
  // the session (e.g. when the next reply swaps its chip group). That resets
  // ActionChip's LOCAL settled state, so settlement must not live there alone.
  it('a remount within the session keeps the taken card settled — local state dies, the transcript does not', async () => {
    storePriorSession([assistantTurn(TURN_A, [coachingCard(CARD_X, 'Alpha')])])
    const view = render(
      <ConversationProvider>
        <OlumiTabBody key="first-mount" />
      </ConversationProvider>,
    )
    await screen.findAllByTestId('chat-message-assistant')
    openAllTiers()

    const before = chipOf(CARD_X, 'Alpha')
    await act(async () => {
      fireEvent.click(before)
    })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))

    // Same provider (same conversation), fresh panel subtree.
    view.rerender(
      <ConversationProvider>
        <OlumiTabBody key="second-mount" />
      </ConversationProvider>,
    )
    await screen.findAllByTestId('chat-message-assistant')
    openAllTiers()

    const after = chipOf(CARD_X, 'Alpha')
    // Precondition: the chip really is a new node, so its local state is new.
    expect(after).not.toBe(before)
    expect(after).toBeDisabled()
    expect(after).toHaveAttribute('data-settled', 'true')
    await act(async () => {
      fireEvent.click(after)
      after.click()
    })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  })
})

describe('(g) an old transcript with no sourceBlockKey loads exactly as before', () => {
  it('pre-G1 save: loads unchanged, re-saves without a key, and every card is live', async () => {
    // Written by hand in the PRE-G1 stored shape — no `sourceBlockKey` anywhere.
    const legacyFile = {
      [SID]: {
        savedAt: '2026-09-20T09:00:00.000Z',
        pageLoadId: 'an-earlier-page-load',
        dropped: 0,
        messages: [
          {
            id: TURN_A,
            role: 'assistant',
            content: 'Here is what I found.',
            ts: '2026-09-20T09:00:00.000Z',
            blocks: [coachingCard(CARD_X, 'Alpha'), heldBlock(HANDLE, 'Remove the Pricing node')],
          },
          { id: 'u-old', role: 'user', content: 'Please help me with Alpha.', ts: '2026-09-20T09:01:00.000Z', displayContent: 'Do Alpha', chipInitiated: true },
        ],
      },
    }
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(legacyFile))

    const loaded = loadTranscript(SID)!
    expect(loaded.messages).toEqual([
      {
        id: TURN_A,
        role: 'assistant',
        content: 'Here is what I found.',
        timestamp: new Date('2026-09-20T09:00:00.000Z'),
        blocks: [coachingCard(CARD_X, 'Alpha'), heldBlock(HANDLE, 'Remove the Pricing node')],
      },
      {
        id: 'u-old',
        role: 'user',
        content: 'Please help me with Alpha.',
        timestamp: new Date('2026-09-20T09:01:00.000Z'),
        displayContent: 'Do Alpha',
        chipInitiated: true,
      },
    ])
    expect(loaded.messages.some((m) => 'sourceBlockKey' in m)).toBe(false)
    expect(settledSourceBlockKeys(loaded.messages).size).toBe(0)

    // Round trip: re-saving a key-less transcript writes no key.
    saveTranscript(SID, loaded.messages)
    expect(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)).not.toContain('sourceBlockKey')

    restampAsEarlierPageLoad()
    await mountRestoredPanel()
    expect(chipOf(CARD_X, 'Alpha')).not.toBeDisabled()
    expect(heldCards(HANDLE)[0]).not.toHaveAttribute('data-settled')
  })
})

describe('(h) the key never reaches the wire — the POSTed body is byte-identical', () => {
  const V5_ENDPOINT = 'https://cee.test/orchestrate/v2/turn'

  /**
   * Drive the REAL `useConversation.sendChip` down to the REAL `callV5Turn`,
   * capturing the exact string handed to `fetch`. `crypto.randomUUID` is made
   * deterministic so two sends can be compared byte for byte.
   */
  async function postedBodyFor(chip: SourceKeyedChip): Promise<{ body: string; bubbleKey: string | undefined }> {
    const bodies: string[] = []
    const actual = await vi.importActual<typeof import('../../../v5/v5Adapter')>('../../../v5/v5Adapter')
    vi.stubEnv('VITE_V5_ENDPOINT', V5_ENDPOINT)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: RequestInit) => {
        // Only the TURN is under test; a successful turn is followed by a
        // separate graph registration write.
        if (String(url) === V5_ENDPOINT) bodies.push(String(init?.body))
        return new Response(JSON.stringify(V5_SUCCESS.response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
    mockCallV5Turn.mockImplementation((payload: unknown, opts: unknown) =>
      actual.callV5Turn(payload as never, opts as never),
    )

    const view = renderHook(() => useConversation())
    let n = 0
    const uuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockImplementation(
        () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`,
      )
    try {
      await act(async () => {
        await view.result.current.sendChip(chip)
      })
    } finally {
      uuid.mockRestore()
    }
    await waitFor(() => expect(bodies).toHaveLength(1))
    const bubble = view.result.current.messages.find((m) => m.role === 'user') as SourceKeyedMessage
    view.unmount()
    localStorage.clear()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    return { body: bodies[0], bubbleKey: bubble.sourceBlockKey }
  }

  it('coaching: body with the key === body without it; the key rode only the bubble', async () => {
    const without = await postedBodyFor(cardChip(undefined, { wire_intent: 'add_option' }))
    const withKey = await postedBodyFor(cardChip(KEY_X, { wire_intent: 'add_option' }))

    expect(withKey.body).toBe(without.body)
    expect(withKey.body).not.toContain(KEY_X)
    expect(withKey.body).not.toContain('sourceBlockKey')
    // Discriminating: the key DID travel — to the bubble, not the wire.
    expect(withKey.bubbleKey).toBe(KEY_X)
    expect(without.bubbleKey).toBeUndefined()
    // The intent pass-through is untouched by the key riding beside it.
    expect(JSON.parse(withKey.body).chip?.intent).toBe('add_option')
  })

  it('held: body with the key === body without it', async () => {
    const held = { id: 'chip-held', label: 'Confirm these changes', message: `confirm ${HANDLE}` }
    const without = await postedBodyFor(cardChip(undefined, held))
    const withKey = await postedBodyFor(cardChip(KEY_HELD, held))

    expect(withKey.body).toBe(without.body)
    expect(withKey.body).not.toContain(KEY_HELD)
    expect(withKey.bubbleKey).toBe(KEY_HELD)
  })
})

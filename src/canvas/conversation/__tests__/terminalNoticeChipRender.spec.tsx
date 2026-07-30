/**
 * ROADMAP 2.138 — the terminal-notice recovery chip must RENDER, not just exist.
 *
 * WHY THIS FILE EXISTS AT ALL (the blindness lesson).
 * `streamedDraftTurn.spec.ts` already pins the chip — but it pins it on the
 * MESSAGE OBJECT (`notice.actionChips.map(c => c.id)`), and that assertion is
 * satisfied by a chip no user can ever see. 2.134's live probe found the
 * consequence: both terminal notices rendered with an EMPTY chip wrapper, so the
 * copy named the remedy ("start a new draft…") and gave the user no button.
 * Guarantee-theatre, invisible to every existing spec.
 *
 * So every assertion here is RENDER-LEVEL: the real ConversationPanel is
 * rendered with the real notice text and the chip built EXACTLY as
 * `useConversation` builds it, and the pins are "a button is in the DOM" and
 * "clicking it reaches `startNewDraft`". Both terminal notices are covered —
 * the stopped-draft one (Stop button / 130 s timeout) and the connection-drop
 * one — because both mint the same chip at different sites.
 *
 * NEGATIVE CONTROL (kept deliberately): a message-less chip with an id NOTHING
 * routes locally must still be dropped. Without it, "the chip renders" would
 * also pass under a renderer that had simply stopped filtering, which is the
 * bug in the other direction — a chip that promises an action and throws.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ConversationPanel } from '../ConversationPanel'
import { useCanvasStore } from '../../store'
import { START_NEW_DRAFT_CHIP_ID } from '../useConversation'
import {
  STOPPED_DRAFT_NOTICE,
  UNSETTLED_DRAFT_NOTICE,
  EARLY_STOP_NOT_SAVED_NOTICE,
  EARLY_STOP_ALREADY_SAVED_NOTICE,
  EARLY_STOP_UNCONFIRMED_NOTICE,
} from '../../components/DraftLoadingAnimation'
import type { ActionChip, ConversationMessage } from '../types'
import type { UseConversationReturn } from '../useConversation'

// ---------------------------------------------------------------------------
// The chip, built exactly as useConversation.ts mints it at BOTH notice sites.
// Written out longhand rather than imported so that a change to the mint shape
// (e.g. someone "fixing" this by bolting on a decoy `message`) shows up here as
// a diff to reason about, not as a silently-satisfied import.
// ---------------------------------------------------------------------------
const START_NEW_DRAFT_CHIP: ActionChip = {
  id: START_NEW_DRAFT_CHIP_ID,
  label: 'Start a new draft',
  intent: 'primary',
}

function noticeMessage(content: string, chips: ActionChip[]): ConversationMessage {
  return {
    id: 'notice-1',
    role: 'assistant',
    synthetic: true,
    content,
    actionChips: chips,
    timestamp: new Date(),
  }
}

function makeMockConversation(messages: ConversationMessage[]) {
  const startNewDraft = vi.fn(async () => {})
  const sendChip = vi.fn().mockResolvedValue(undefined)
  const retryLast = vi.fn().mockResolvedValue(undefined)

  const conversation: UseConversationReturn = {
    messages,
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    dispatchAction: vi.fn().mockResolvedValue(undefined),
    cancelTurn: vi.fn(),
    startNewDraft,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent: vi.fn().mockResolvedValue(undefined),
    sendChip,
    clearHistory: vi.fn(),
    retryLast,
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }

  return { conversation, startNewDraft, sendChip, retryLast }
}

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({
    // A stopped draft leaves STRUCTURE on the canvas — a non-empty graph is the
    // real state this notice is shown in, and it also keeps ChatThread's
    // EmptyState from taking over the surface.
    nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
    edges: [],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' } as never,
    _externalMutationActive: 0,
  } as never)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})


/**
 * The positive control, DERIVED from whichever notice is under test.
 *
 * It used to be a hardcoded clause ("start a new draft to get a model with
 * settled values") true of the two original notices and of nothing else — so
 * widening the table to the three stop-fence notices failed here immediately.
 * That is the GOOD failure: a hand-written needle silently pins one copy string,
 * and the next author either widens the table and gets a red they do not
 * understand, or quietly drops the control (trap 13).
 *
 * · Longest em-dash-free run: the live chat renderer rewrites em dashes
 *   (2.134 §2c), so a needle spanning one fails on punctuation rather than on
 *   the button this file exists to pin.
 * · `getAllByText` + non-empty rather than `getByText`: the needle matches every
 *   ancestor whose textContent contains it.
 * · This proves the harness can SEE the bubble. It is NOT a visibility claim —
 *   jsdom cannot make one (CLAUDE.md trap 3).
 */
function expectNoticeVisible(notice: string): void {
  const needle = notice
    .split('\u2014')
    .map((part) => part.trim())
    .sort((a, b) => b.length - a.length)[0]
  expect(
    screen.getAllByText((_text, node) => node?.textContent?.includes(needle) === true, {
      selector: 'p,div,span',
    }).length,
  ).toBeGreaterThan(0)
}

// ---------------------------------------------------------------------------
// The pin, for BOTH terminal notices
// ---------------------------------------------------------------------------

describe.each([
  ['stopped-draft notice', STOPPED_DRAFT_NOTICE],
  ['connection-drop (unsettled) notice', UNSETTLED_DRAFT_NOTICE],
  // Stop-fence (Codex P0). All three explicit-Stop notices mint the SAME chip at
  // the SAME site, and every one of them can now be reached with an EMPTY canvas
  // (an early Stop, before GRAPH_READY) — which the two originals never could.
  // A chip nobody can click is exactly the guarantee-theatre 2.134's live probe
  // found on the first two, so the new copy joins the same render-level pin
  // rather than settling for "the chip is on the message object".
  ['early-stop: cancelled before saved', EARLY_STOP_NOT_SAVED_NOTICE],
  ['early-stop: already saved', EARLY_STOP_ALREADY_SAVED_NOTICE],
  ['early-stop: could not confirm', EARLY_STOP_UNCONFIRMED_NOTICE],
])('2.138 — %s renders a clickable "Start a new draft" chip', (_name, notice) => {
  it('renders the notice AND a button for its remedy', () => {
    const { conversation } = makeMockConversation([
      noticeMessage(notice, [START_NEW_DRAFT_CHIP]),
    ])
    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />)

    // Positive control FIRST (trap 13): prove this harness can see the bubble at
    // all. Without it, a missing-button assertion could pass on an empty render.
    // Matched on a distinctive clause rather than the whole string — the live
    // chat renderer rewrites the em dash (2.134 §2c), and this test must pin the
    // BUTTON, not punctuation.
    expectNoticeVisible(notice)

    const button = screen.getByRole('button', { name: 'Start a new draft' })
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
    expect(button).not.toBeDisabled()
    expect(button).toHaveTextContent('Start a new draft')
  })

  it('clicking the chip reaches startNewDraft — not sendChip, not retryLast', async () => {
    const { conversation, startNewDraft, sendChip, retryLast } = makeMockConversation([
      noticeMessage(notice, [START_NEW_DRAFT_CHIP]),
    ])
    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start a new draft' }))

    await waitFor(() => {
      expect(startNewDraft).toHaveBeenCalledTimes(1)
    })
    // The chip carries no `message`. If it ever reached sendChip it would throw
    // ("has no message field") — the id-route in ConversationPanel is what makes
    // it work, and this asserts the route, not just the outcome.
    expect(sendChip).not.toHaveBeenCalled()
    expect(retryLast).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Negative control — the widening must stay narrow
// ---------------------------------------------------------------------------

describe('2.138 — the render guard is widened, not removed', () => {
  it('still drops a message-less chip that no local handler routes', () => {
    const orphan: ActionChip = { id: 'mystery_action', label: 'Do a thing', intent: 'primary' }
    const { conversation } = makeMockConversation([
      noticeMessage(STOPPED_DRAFT_NOTICE, [orphan]),
    ])
    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />)

    // The bubble is on screen (positive control) …
    expectNoticeVisible(STOPPED_DRAFT_NOTICE)
    // … and the undispatchable chip is not.
    expect(screen.queryByRole('button', { name: 'Do a thing' })).not.toBeInTheDocument()
  })

  it('renders the recovery chip even when an undispatchable sibling is present', () => {
    const orphan: ActionChip = { id: 'mystery_action', label: 'Do a thing', intent: 'primary' }
    const { conversation } = makeMockConversation([
      noticeMessage(STOPPED_DRAFT_NOTICE, [orphan, START_NEW_DRAFT_CHIP]),
    ])
    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Start a new draft' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Do a thing' })).not.toBeInTheDocument()
  })
})

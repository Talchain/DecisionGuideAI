/**
 * ChatThread — the dialogue stays put while a turn is in flight (Paul, 7 Oct 2026).
 *
 * SPEC, in Paul's words: "the text doesn't move. You can still look at your
 * dialogue while it's loading. It shouldn't go blank or do anything weird."
 * Nothing on the thread changes during a pending turn except the existing
 * thinking indicator, and when the reply lands the messages already on screen
 * are the SAME elements they were — appended to, never rebuilt.
 *
 * Every assertion binds by IDENTITY: the DOM node of a message found by its
 * `data-message-id`, compared with `toBe` across renders. A value predicate
 * ("some assistant message is present") would be satisfied by a remounted
 * copy, which is exactly the defect.
 *
 * ⚠ What jsdom cannot prove: pixels. A remount is the mechanism behind a
 * flash, a lost "show more" state and a re-run of entry animations; whether a
 * given remount is VISIBLE is a real-browser question, recorded in the PR.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatThread, THREAD_TESTID_DOCKED } from '../zones/ChatThread'
import { MESSAGE_ID_ATTRIBUTE } from '../hooks/useSmartScroll'
import type { ConversationMessage, ActionChip } from '../types'

// `ChatThread` reaches `src/lib/supabase.ts`, which throws at module scope
// without env (sibling spec ChatThread.contentGrowthScroll.spec.tsx) — a
// collection-time failure would make every row below vanish silently.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => any) => selector({ nodes: [], edges: [] }),
    { getState: () => ({ nodes: [], edges: [] }), setState: vi.fn(), subscribe: vi.fn() },
  ),
}))

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => any) => selector({}),
    { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() },
  ),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ guidanceItems: [], _dispatchAction: vi.fn() }),
    { getState: () => ({ guidanceItems: [], _dispatchAction: vi.fn(), dismissItem: vi.fn() }) },
  ),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const t0 = new Date('2026-10-07T09:00:00Z')
const chip: ActionChip = { id: 'agent-next-pre-mortem', label: 'Run a pre-mortem', intent: 'secondary', message: 'Run a pre-mortem' }

const reply1: ConversationMessage = {
  id: 'a1', role: 'assistant', content: 'First reply about hiring a tech lead.', timestamp: t0, actionChips: [chip],
}
const ask1: ConversationMessage = { id: 'u1', role: 'user', content: 'Suggest risks I have not considered.', timestamp: t0 }
const reply2: ConversationMessage = {
  id: 'a2', role: 'assistant', content: 'Four more risks to test.', timestamp: t0, actionChips: [chip],
}
const reply1NoChips: ConversationMessage = { ...reply1, actionChips: undefined }

function props(messages: ConversationMessage[], isThinking: boolean) {
  return {
    messages,
    isThinking,
    longRunningHint: null,
    nodeCount: 3,
    patchBlockStates: new Map(),
    patchRejections: new Map(),
    onChipClick: vi.fn().mockResolvedValue(undefined),
    onPatchAccept: vi.fn(),
    onPatchDismiss: vi.fn(),
    onFeedback: vi.fn(),
    onRetry: vi.fn(),
  }
}

/** The message's root element, found by its id: the identity every row binds to. */
function messageNode(id: string): HTMLElement {
  const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
  const el = thread.querySelector<HTMLElement>(`[${MESSAGE_ID_ATTRIBUTE}="${id}"]`)
  if (!el) throw new Error(`message ${id} is not in the thread`)
  return el
}

describe('ChatThread: the dialogue is stable while a turn is in flight', () => {
  it('pending: every message already on screen stays the SAME element, with its text, and the only addition is the thinking indicator', () => {
    const { rerender } = render(<ChatThread {...props([reply1], false)} />)
    const a1 = messageNode('a1')
    const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
    expect(screen.queryByTestId('thinking-indicator')).toBeNull()

    // The user sends: their message is appended and the turn goes pending.
    rerender(<ChatThread {...props([reply1, ask1], true)} />)
    const u1 = messageNode('u1')
    expect(messageNode('a1'), 'the previous reply was rebuilt when the turn went pending').toBe(a1)
    expect(a1.isConnected).toBe(true)
    expect(a1.textContent).toContain('First reply about hiring a tech lead.')
    expect(screen.getByTestId(THREAD_TESTID_DOCKED), 'the thread container itself was rebuilt').toBe(thread)
    expect(screen.getByTestId('thinking-indicator')).toBeInTheDocument()

    // Still pending on a later commit (e.g. the waiting line rotates): nothing moves.
    rerender(<ChatThread {...props([reply1, ask1], true)} />)
    expect(messageNode('a1')).toBe(a1)
    expect(messageNode('u1')).toBe(u1)
  })

  it('pending → complete: the reply is APPENDED; the previous reply and the user message are the same elements as before', () => {
    const { rerender } = render(<ChatThread {...props([reply1, ask1], true)} />)
    const a1 = messageNode('a1')
    const u1 = messageNode('u1')

    rerender(<ChatThread {...props([reply1, ask1, reply2], false)} />)
    expect(messageNode('a1'), 'the previous reply was rebuilt when the new reply landed').toBe(a1)
    expect(messageNode('u1')).toBe(u1)
    expect(a1.isConnected).toBe(true)
    expect(messageNode('a2').textContent).toContain('Four more risks to test.')
    expect(screen.queryByTestId('thinking-indicator')).toBeNull()
  })

  it('control: a previous reply that carried NO chips was never wrapped, and also stays the same element', () => {
    // Contrast for the row above: a reply with no chip group had no wrapper to
    // lose, so it must pass on base and after the fix alike.
    const { rerender } = render(<ChatThread {...props([reply1NoChips, ask1], true)} />)
    const a1 = messageNode('a1')
    rerender(<ChatThread {...props([reply1NoChips, ask1, reply2], false)} />)
    expect(messageNode('a1')).toBe(a1)
  })

  it('the reader\'s scroll position is not reset through pending → complete', () => {
    const { rerender } = render(<ChatThread {...props([reply1, ask1], false)} />)
    const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
    thread.scrollTop = 140
    rerender(<ChatThread {...props([reply1, ask1], true)} />)
    expect(screen.getByTestId(THREAD_TESTID_DOCKED)).toBe(thread)
    expect(thread.scrollTop).toBe(140)
    rerender(<ChatThread {...props([reply1, ask1, reply2], false)} />)
    expect(screen.getByTestId(THREAD_TESTID_DOCKED)).toBe(thread)
    expect(thread.scrollTop).toBe(140)
  })

  it('the chip group still wraps ONLY the latest reply after the reply lands (existing contract kept)', () => {
    const { rerender } = render(<ChatThread {...props([reply1, ask1], true)} />)
    rerender(<ChatThread {...props([reply1, ask1, reply2], false)} />)
    const groups = screen.getAllByTestId('response-chip-group')
    expect(groups).toHaveLength(1)
    expect(groups[0].contains(messageNode('a2'))).toBe(true)
    expect(groups[0].contains(messageNode('a1'))).toBe(false)
  })
})

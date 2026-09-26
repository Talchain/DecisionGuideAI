/**
 * UI N2 (DL #70 5845149326; Canonical's #1978 review N2): the message menu's
 * follow-ups ("Please explain that in more detail.") are OLUMI's copy. Through
 * `sendMessage` they reached CEE as a `composer` turn — words the USER typed —
 * which the grounding reads as the user's own statement. They now travel as a
 * chip carrying its identity (and, on the agent lane, no consent to write or run).
 *
 * Harness: the same mock conversation as `terminalNoticeChipRender.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ConversationPanel } from '../ConversationPanel'
import { useCanvasStore } from '../../store'
import type { ConversationMessage } from '../types'
import type { UseConversationReturn } from '../useConversation'

const REPLY: ConversationMessage = {
  id: 'a1',
  role: 'assistant',
  content: 'Here is the answer.',
  timestamp: new Date(),
}

function makeMockConversation(messages: ConversationMessage[]) {
  const dispatchAction = vi.fn().mockResolvedValue(undefined)
  const sendMessage = vi.fn().mockResolvedValue(undefined)
  const conversation: UseConversationReturn = {
    messages,
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    dispatchAction,
    cancelTurn: vi.fn(),
    startNewDraft: vi.fn(async () => {}),
    sendMessage,
    sendSystemEvent: vi.fn().mockResolvedValue(undefined),
    sendChip: vi.fn().mockResolvedValue(undefined),
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    settledSourceBlockKeys: new Set<string>(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }
  return { conversation, dispatchAction, sendMessage }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({
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

describe('UI N2 — a message-menu follow-up is Olumi\'s text, never the user\'s typed words', () => {
  it.each([
    ['explain', 'Please explain that in more detail.'],
    ['summarise', 'Please summarise that as concise bullets.'],
  ])('"%s" goes out as a chip carrying its identity; sendMessage is never the route', (key, text) => {
    const { conversation, dispatchAction, sendMessage } = makeMockConversation([REPLY])
    render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />)
    fireEvent.click(screen.getByTestId('message-menu-trigger'))
    fireEvent.click(screen.getByTestId(`message-menu-${key}`))
    expect(sendMessage).not.toHaveBeenCalled()
    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction.mock.calls[0][0]).toEqual({
      id: 'ai_panel_artefact_action',
      label: text,
      message: text,
      source: 'chip',
    })
  })
})

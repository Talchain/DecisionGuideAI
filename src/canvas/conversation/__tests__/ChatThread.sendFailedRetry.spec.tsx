/**
 * ChatThread: failed-send retry wiring — dress-rehearsal trust item #3.
 *
 * The retry affordance on a failed user message must only appear on the
 * message that retryLast would actually resend (the LAST user message).
 * Older failed attempts keep the "Not delivered" marker without a retry
 * button — clicking retry there would resend a DIFFERENT text than the
 * bubble shows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

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

let seq = 0
function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  seq += 1
  return {
    id: `msg-${seq}`,
    role: 'user',
    content: 'text',
    timestamp: new Date(),
    ...overrides,
  } as ConversationMessage
}

const noop = vi.fn().mockResolvedValue(undefined)

function renderThread(messages: ConversationMessage[], onRetry = vi.fn()) {
  render(
    <ChatThread
      messages={messages}
      isThinking={false}
      longRunningHint={null}
      nodeCount={1}
      patchBlockStates={new Map()}
      patchRejections={new Map()}
      onChipClick={noop}
      onPatchAccept={vi.fn()}
      onPatchDismiss={vi.fn()}
      onFeedback={vi.fn()}
      onRetry={onRetry}
    />,
  )
  return onRetry
}

describe('ChatThread: failed-send retry wiring', () => {
  it('last failed user message gets the retry affordance; clicking fires onRetry', async () => {
    const onRetry = renderThread([
      makeMsg({ content: 'failed brief', deliveryState: 'failed' }),
      makeMsg({ role: 'assistant', content: 'error copy', synthetic: true }),
    ])
    const btn = screen.getByTestId('send-failed-retry')
    await userEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('older failed attempts keep the marker but NOT the retry affordance', () => {
    renderThread([
      makeMsg({ content: 'first failed', deliveryState: 'failed' }),
      makeMsg({ role: 'assistant', content: 'error copy', synthetic: true }),
      makeMsg({ content: 'second failed', deliveryState: 'failed' }),
      makeMsg({ role: 'assistant', content: 'error copy 2', synthetic: true }),
    ])
    const markers = screen.getAllByTestId('send-failed-indicator')
    expect(markers).toHaveLength(2)
    // Only ONE retry affordance — on the last user message.
    const retries = screen.getAllByTestId('send-failed-retry')
    expect(retries).toHaveLength(1)
  })

  it('a failed message followed by a newer DELIVERED user message gets no retry affordance', () => {
    renderThread([
      makeMsg({ content: 'failed brief', deliveryState: 'failed' }),
      makeMsg({ role: 'assistant', content: 'error copy', synthetic: true }),
      makeMsg({ content: 'newer delivered', deliveryState: 'sent' }),
      makeMsg({ role: 'assistant', content: 'reply' }),
    ])
    expect(screen.getByTestId('send-failed-indicator')).toBeTruthy()
    expect(screen.queryByTestId('send-failed-retry')).toBeNull()
  })
})

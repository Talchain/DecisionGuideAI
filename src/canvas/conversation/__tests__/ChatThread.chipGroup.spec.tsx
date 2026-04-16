/**
 * ChatThread: chip grouping (Fix 2)
 *
 * Verifies that SuggestedChips are wrapped in a response-chip-group
 * container with the last assistant message, not rendered as a
 * standalone sibling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage, ActionChip } from '../types'

// ---------------------------------------------------------------------------
// Mocks — keep ChatThread rendering lightweight
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Hello',
    timestamp: new Date(),
    ...overrides,
  }
}

const chip: ActionChip = {
  id: 'c1',
  label: 'Continue',
  intent: 'primary',
  message: 'continue please',
}

const noop = vi.fn().mockResolvedValue(undefined)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatThread: chip grouping', () => {
  it('wraps last assistant message and chips in response-chip-group', () => {
    const messages = [makeMsg({ actionChips: [chip] })]
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
        onRetry={vi.fn()}
      />,
    )

    const group = screen.getByTestId('response-chip-group')
    expect(group).toBeInTheDocument()
    // Chips are inside the group, not standalone
    const chips = screen.getByTestId('suggested-chips')
    expect(group.contains(chips)).toBe(true)
    // Assistant message is also inside the group
    const assistantMsg = screen.getByTestId('chat-message-assistant')
    expect(group.contains(assistantMsg)).toBe(true)
  })

  it('does not render response-chip-group when no chips', () => {
    const messages = [makeMsg()]
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
        onRetry={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('response-chip-group')).not.toBeInTheDocument()
  })
})

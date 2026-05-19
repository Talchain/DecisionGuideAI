/**
 * aiPanelV2 UX polish — regression coverage for the PR #148 polish pass.
 *
 * Covers:
 *  - Item 1: docked Olumi tab shows a placeholder ("Olumi is open in the
 *    floating panel") with Focus + Dock actions when floating is open.
 *  - Item 4: AIInputBar shows "Generating your decision model…" and
 *    disables typing when isThinking + canvas is empty (model-generation
 *    turn in flight).
 *  - Item 5: PersistentInputStrip status mode uses fixed copy ("Olumi is
 *    open · Focus →") — not a truncated last-message preview.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

// Heavy imports — same stub pattern as the interactions spec.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

// Canvas store mock — tests flip `canvasMockState.nodes` between empty
// (generating) and populated.
const canvasMockState: { nodes: Array<{ id: string }> } = { nodes: [{ id: 'n1' }] }
vi.mock('../../store', () => ({
  useCanvasStore: (selector: (s: any) => any) => selector(canvasMockState),
}))

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask about this model…',
}))
vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
}))
vi.mock('../../hooks/useSelectionContext', () => ({
  useSelectionContext: () => null,
}))

// useConversation mock — `messages` and `isThinking` are mutable so tests
// can drive different states. Stable mock fns to avoid identity churn.
const conversationMockState: {
  messages: Array<{ id: string; role: string; content?: string; synthetic?: boolean }>
  isThinking: boolean
} = { messages: [], isThinking: false }

vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      const [sendSystemEvent] = useState(() => vi.fn())
      const [sendChip] = useState(() => vi.fn())
      const [retryLast] = useState(() => vi.fn())
      const [setPatchBlockState] = useState(() => vi.fn())
      const [setPatchRejection] = useState(() => vi.fn())
      return {
        messages: conversationMockState.messages,
        isThinking: conversationMockState.isThinking,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage,
        sendSystemEvent,
        sendChip,
        retryLast,
        patchBlockStates: new Map(),
        setPatchBlockState,
        patchRejections: new Map(),
        setPatchRejection,
      }
    },
  }
})

import { ConversationProvider, useConversationContext } from '../../conversation/ConversationContext'
import { AIInputBar } from '../AIInputBar'
import { OlumiTabBody } from '../OlumiTabBody'
import { PersistentInputStrip } from '../PersistentInputStrip'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  canvasMockState.nodes = [{ id: 'n1' }]
  conversationMockState.messages = []
  conversationMockState.isThinking = false
})

describe('Item 1 — Olumi tab placeholder when floating is open', () => {
  it('renders the floating-state placeholder (not the conversation) when isOpen', () => {
    useFloatingPanelState.getState().open('user')
    render(<OlumiTabBody onFloatOut={() => {}} />, { wrapper: Wrapper })
    expect(screen.getByTestId('olumi-tab-floating-placeholder')).toBeInTheDocument()
    expect(screen.getByText(/Olumi is open in the floating panel\./i)).toBeInTheDocument()
    expect(screen.getByTestId('olumi-tab-focus-floating')).toBeInTheDocument()
    expect(screen.getByTestId('olumi-tab-dock-here')).toBeInTheDocument()
    // The empty-state body must NOT also render — one readable surface only.
    expect(screen.queryByTestId('olumi-tab-empty')).toBeNull()
    expect(screen.queryByTestId('olumi-tab-body')).toBeNull()
  })

  it('Dock here closes the floating panel', () => {
    useFloatingPanelState.getState().open('user')
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    render(<OlumiTabBody onFloatOut={() => {}} />, { wrapper: Wrapper })
    fireEvent.click(screen.getByTestId('olumi-tab-dock-here'))
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
  })

  it('falls back to the existing empty-state body when floating is closed and no messages', () => {
    render(<OlumiTabBody onFloatOut={() => {}} />, { wrapper: Wrapper })
    expect(screen.getByTestId('olumi-tab-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('olumi-tab-floating-placeholder')).toBeNull()
  })
})

describe('Item 4 — AIInputBar generating state (isThinking + empty canvas)', () => {
  beforeEach(() => {
    canvasMockState.nodes = []
  })

  it('shows "Generating your decision model…" placeholder and disables typing during a generate turn', () => {
    conversationMockState.isThinking = true
    render(<AIInputBar variant="first-use" hideChevron testId="gen" />, { wrapper: Wrapper })
    const textarea = screen.getByTestId('gen-textarea') as HTMLTextAreaElement
    expect(textarea.placeholder).toBe('Generating your decision model…')
    expect(textarea).toBeDisabled()
  })

  it('does NOT disable typing when isThinking but nodes already exist (chat-mode thinking)', () => {
    canvasMockState.nodes = [{ id: 'n1' }]
    conversationMockState.isThinking = true
    render(<AIInputBar variant="docked-tab" hideChevron testId="chat" />, { wrapper: Wrapper })
    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement
    // Chat-mode thinking still blocks Enter via handleSend, but the textarea
    // stays editable so the user can compose follow-up while waiting.
    expect(textarea).not.toBeDisabled()
    expect(textarea.placeholder).not.toMatch(/Generating/i)
  })

  it('prevents duplicate sends while a generate turn is in flight', () => {
    conversationMockState.isThinking = true
    canvasMockState.nodes = []
    let capturedSendMessage: any = null
    function Capture() {
      capturedSendMessage = useConversationContext().sendMessage
      return null
    }
    render(
      <Wrapper>
        <Capture />
        <AIInputBar variant="first-use" hideChevron testId="gen" />
      </Wrapper>,
    )
    const textarea = screen.getByTestId('gen-textarea') as HTMLTextAreaElement
    // The textarea is disabled so fireEvent.change would normally be a no-op,
    // but jsdom permits programmatic value mutation. Still — pressing Enter
    // must not dispatch a send because handleSend's isThinking guard rejects.
    act(() => {
      fireEvent.change(textarea, { target: { value: 'try to interrupt' } })
    })
    act(() => {
      fireEvent.keyDown(textarea, { key: 'Enter' })
    })
    expect((capturedSendMessage as any).mock?.calls ?? []).toHaveLength(0)
  })
})

describe('Item 5 — PersistentInputStrip status copy is fixed (no truncated preview)', () => {
  it('shows "Olumi is open" + "Focus →" instead of the last assistant message preview', () => {
    useFloatingPanelState.getState().open('user')
    conversationMockState.messages = [
      { id: 'a-0', role: 'assistant', content: 'A very long assistant message that would previously appear truncated to fifty characters in the strip status.' },
    ]
    render(
      <PersistentInputStrip
        isOlumiTabActive={true}
        onOpenFloating={() => {}}
        onFocusFloating={() => {}}
        onCogClick={() => {}}
      />,
      { wrapper: Wrapper },
    )
    const status = screen.getByTestId('persistent-strip-status')
    expect(status).toHaveTextContent(/Olumi is open/)
    expect(status).toHaveTextContent(/Focus/)
    // The previous preview substring must not leak through.
    expect(status).not.toHaveTextContent(/A very long assistant message/)
    expect(status).not.toHaveTextContent(/Thinking/)
  })

  it('keeps the fixed copy even while a turn is in flight (no "Thinking…" override)', () => {
    useFloatingPanelState.getState().open('user')
    conversationMockState.isThinking = true
    render(
      <PersistentInputStrip
        isOlumiTabActive={true}
        onOpenFloating={() => {}}
        onFocusFloating={() => {}}
        onCogClick={() => {}}
      />,
      { wrapper: Wrapper },
    )
    const status = screen.getByTestId('persistent-strip-status')
    expect(status).toHaveTextContent(/Olumi is open/)
    expect(status).not.toHaveTextContent(/Thinking/)
  })
})

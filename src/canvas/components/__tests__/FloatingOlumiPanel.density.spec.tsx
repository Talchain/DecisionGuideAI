/**
 * Floating-density scope guard (UX correction P0.3).
 *
 * The CSS module `Conversation.module.css` adds scoped compact rules
 * under `:global(.floating-density)`. This spec proves:
 *
 *   1. The floating panel mounts ConversationPanel inside a
 *      `floating-density` wrapper, so the compact CSS rules apply.
 *   2. The docked OlumiTabBody does NOT wrap ConversationPanel in
 *      `floating-density`, so the docked surface keeps normal density.
 *
 * Combined with the existing aiPanelV2.parity.spec.tsx (FF-off renders no
 * floating panel at all), this confirms there is no density leak into
 * either the docked Olumi tab or DraftChat.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

const canvasMockState = {
  nodes: [{ id: 'n1' }] as Array<{ id: string }>,
  edges: [] as Array<unknown>,
  results: { status: 'idle' as const },
  _internal: {} as Record<string, unknown>,
  selection: null,
  ceeAnalysisReady: null as any,
  graphHealth: null as any,
  runMeta: {} as any,
}
vi.mock('../../store', () => {
  const useCanvasStore: any = (selector: (s: any) => any) => selector(canvasMockState)
  useCanvasStore.getState = () => canvasMockState
  useCanvasStore.setState = (patch: any) => Object.assign(canvasMockState, patch)
  useCanvasStore.subscribe = () => () => {}
  return {
    useCanvasStore,
    selectResultsStatus: (s: any) => s.results?.status,
    selectReport: (s: any) => s.results?.report,
    selectError: (s: any) => s.results?.error,
    selectResultsSource: (s: any) => s.results?.source,
  }
})

// Stub ConversationPanel so we can observe the `compact` prop value
// — which the FloatingOlumiPanel is expected to pass through so the
// MessageBubble swaps from typography.body (16px) to panelBody (12px).
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: (props: { compact?: boolean }) => (
    <div
      data-testid="mocked-conversation-panel"
      data-compact={String(props.compact ?? false)}
    />
  ),
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask',
}))

vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      return {
        messages: [
          // Non-empty so OlumiTabBody renders the conversation branch
          // (not the empty-state branch).
          { id: 'a-0', role: 'assistant', content: 'hi', synthetic: false },
        ],
        isThinking: false,
        longRunningHint: null,
        sendMessage,
        sendSystemEvent: vi.fn(),
        sendChip: vi.fn(),
        retryLast: vi.fn(),
        patchBlockStates: new Map(),
        setPatchBlockState: vi.fn(),
        patchRejections: new Map(),
        setPatchRejection: vi.fn(),
      }
    },
    isNonConversationalContent: () => false,
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FloatingOlumiPanel } from '../FloatingOlumiPanel'
import { OlumiTabBody } from '../OlumiTabBody'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
})

describe('floating-density scope', () => {
  it('floating panel wraps ConversationPanel in a .floating-density container', () => {
    useFloatingPanelState.getState().open('user')
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    const cp = document.querySelector('[data-testid="mocked-conversation-panel"]') as HTMLElement
    expect(cp).toBeTruthy()
    // Walk up — at least one ancestor must carry the `floating-density` class.
    let ancestor: HTMLElement | null = cp.parentElement
    let found = false
    while (ancestor) {
      if (ancestor.classList.contains('floating-density')) {
        found = true
        break
      }
      ancestor = ancestor.parentElement
    }
    expect(found).toBe(true)
  })

  it('floating panel passes compact=true to ConversationPanel (typography lever)', () => {
    // The CSS scope wrapper tightens GAPS but font-size lives in
    // MessageBubble's typography choice (panelBody vs body). The
    // `compact` prop is the React-level lever; this spec pins that
    // FloatingOlumiPanel passes it. Without this, message body text
    // stays at 16px even when surrounded by tighter chrome.
    useFloatingPanelState.getState().open('user')
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    const cp = document.querySelector('[data-testid="mocked-conversation-panel"]') as HTMLElement
    expect(cp).toBeTruthy()
    expect(cp.getAttribute('data-compact')).toBe('true')
  })

  it('docked OlumiTabBody does NOT wrap ConversationPanel in .floating-density', () => {
    render(<OlumiTabBody onFloatOut={() => {}} />, { wrapper: Wrapper })
    const cp = document.querySelector('[data-testid="mocked-conversation-panel"]') as HTMLElement
    expect(cp).toBeTruthy()
    // No ancestor must carry `floating-density` — otherwise the compact
    // CSS rules would leak into the docked tab.
    let ancestor: HTMLElement | null = cp.parentElement
    while (ancestor) {
      expect(ancestor.classList.contains('floating-density')).toBe(false)
      ancestor = ancestor.parentElement
    }
  })

  it('docked OlumiTabBody passes compact=true to ConversationPanel (round-7: matches floating typography)', () => {
    // Round-7 typography unification (brief item 9): docked and floating
    // Olumi conversation surfaces must share the same panelBody typography
    // (12px) so the docked text doesn't read as larger than the floating
    // text. Both now pass `compact=true`. The CSS-level density (via the
    // `.floating-density` wrapper class) remains floating-only because
    // the wrapper governs message-bubble spacing/padding, not font-size.
    render(<OlumiTabBody onFloatOut={() => {}} />, { wrapper: Wrapper })
    const cp = document.querySelector('[data-testid="mocked-conversation-panel"]') as HTMLElement
    expect(cp).toBeTruthy()
    expect(cp.getAttribute('data-compact')).toBe('true')
  })
})

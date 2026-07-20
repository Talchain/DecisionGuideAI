/**
 * FirstUseComposer — point-of-failure feedback (dress-rehearsal trust
 * item #3, paired defect).
 *
 * On a fresh guest's first-use hero, a failed draft send used to reset the
 * composer to pristine while the only error copy rendered inside the
 * collapsed-by-default outputs dock — the user's text appeared to vanish
 * into silence. The hero is the one Olumi surface with no visible
 * transcript, so failure feedback must appear HERE, where the user is
 * looking:
 *  - an honest failure notice below the composer (transport copy for the
 *    504/network class — no fake "server processing" claim);
 *  - the user's text restored into the composer so nothing reads as lost.
 *
 * Single-live-region invariant: the notice is plain visible content — the
 * conversation's role="log" owner does the announcing; this surface adds
 * NO aria-live region for the failure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))

const canvasMockState: {
  nodes: Array<{ id: string }>
  edges: Array<unknown>
  results: { status: string }
  _internal: Record<string, unknown>
  selection: null
} = { nodes: [], edges: [], results: { status: 'idle' }, _internal: {}, selection: null }
vi.mock('../../store', () => {
  const useCanvasStore: any = (selector: (s: any) => any) => selector(canvasMockState)
  useCanvasStore.getState = () => canvasMockState
  return {
    useCanvasStore,
    selectResultsStatus: (s: any) => s.results?.status,
    selectReport: (s: any) => s.results?.report,
    selectError: (s: any) => s.results?.error,
    selectResultsSource: (s: any) => s.results?.source,
  }
})
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))
vi.mock('../../hooks/useSelectionContext', () => ({
  useSelectionContext: () => null,
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))
vi.mock('../../../adapters/plot', () => ({
  plot: {
    templates: () => new Promise(() => {}),
  },
}))

// Mutable mocked conversation state the tests reconfigure.
const messagesMockState: { messages: Array<{ id: string; role: string; synthetic?: boolean }> } = {
  messages: [],
}
const thinkingMockState: { isThinking: boolean } = { isThinking: false }
const failureMockState: {
  lastSendFailure: { kind: string; retryable: boolean; inputText: string } | null
} = { lastSendFailure: null }

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
        messages: messagesMockState.messages,
        isThinking: thinkingMockState.isThinking,
        longRunningHint: null,
        lastFailedInput: failureMockState.lastSendFailure?.inputText ?? null,
        lastSendFailure: failureMockState.lastSendFailure,
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

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FirstUseComposer } from '../FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  useFloatingPanelState.getState().open('system-first-use')
  canvasMockState.nodes = []
  messagesMockState.messages = []
  thinkingMockState.isThinking = false
  failureMockState.lastSendFailure = null
})

describe('FirstUseComposer — send-failure notice at the point of failure', () => {
  it('transport failure: notice renders with honest transport copy and the text restores into the composer', () => {
    failureMockState.lastSendFailure = {
      kind: 'transport',
      retryable: true,
      inputText: 'my lost coffee brief',
    }
    messagesMockState.messages = [{ id: 'u1', role: 'user' }]

    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })

    const notice = screen.getByTestId('first-use-send-failure')
    expect(notice.textContent).toMatch(/didn’t get through|didn't get through/)
    expect(notice.textContent).toMatch(/wasn’t lost|wasn't lost|not lost/)
    // No false server-fault claim on the transport class.
    expect(notice.textContent).not.toContain('Something went wrong on our side')

    // The user's text is back in the composer — nothing reads as vanished.
    const input = screen.getByTestId('first-use-input-bar-textarea') as HTMLTextAreaElement
    expect(input.value).toBe('my lost coffee brief')
  })

  it('no notice when there is no failure', () => {
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(screen.queryByTestId('first-use-send-failure')).toBeNull()
  })

  it('notice hides while a new attempt is generating', () => {
    failureMockState.lastSendFailure = {
      kind: 'transport',
      retryable: true,
      inputText: 'retrying brief',
    }
    thinkingMockState.isThinking = true

    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(screen.queryByTestId('first-use-send-failure')).toBeNull()
  })

  it('single-live-region invariant: the notice carries no aria-live and no alert role', () => {
    failureMockState.lastSendFailure = {
      kind: 'transport',
      retryable: true,
      inputText: 'brief',
    }
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const notice = screen.getByTestId('first-use-send-failure')
    expect(notice.getAttribute('aria-live')).toBeNull()
    expect(notice.getAttribute('role')).not.toBe('alert')
    expect(notice.querySelector('[aria-live]')).toBeNull()
    expect(notice.querySelector('[role="alert"]')).toBeNull()
  })

  it('server-class failure still gets a notice (the hero must never fail silently)', () => {
    failureMockState.lastSendFailure = {
      kind: 'server',
      retryable: true,
      inputText: 'brief that CEE rejected',
    }
    render(<FirstUseComposer onCogClick={() => {}} />, { wrapper: Wrapper })
    const notice = screen.getByTestId('first-use-send-failure')
    expect(notice.textContent).toMatch(/couldn’t be processed|couldn't be processed/)
  })
})

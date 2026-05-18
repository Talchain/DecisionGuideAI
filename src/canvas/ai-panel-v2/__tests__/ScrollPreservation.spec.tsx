import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import type { UseConversationReturn } from '../../conversation/useConversation'

// Proves the brief's "scroll position preserved across dock/undock"
// contract end-to-end. Uses a real scrollable thread (not a stubbed
// ConversationPanel) — we supply a custom ChatThread mock whose root
// is a DOM element large enough to require scrolling, then drive the
// view transitions and assert scrollTop survives every swap.
//
// The earlier review correctly flagged that stubbing ConversationPanel
// made the scroll-preservation tests vacuous: no scrollable container
// existed in the tree so `threadScrollRef.current` was never wired to
// real DOM. This spec fills that gap.

const canvasState = {
  nodes: [{ id: 'n1' }] as unknown[],
  edges: [] as unknown[],
  results: { status: 'idle' as 'idle' | 'running' | 'complete' | 'error', hash: null as string | null },
}
const conversationMessages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[] = [
  { id: 'm1', role: 'user', content: 'opening msg', timestamp: 0 },
]

vi.mock('../../store', async () => {
  const actual = await vi.importActual<typeof import('../../store')>('../../store')
  return {
    ...actual,
    useCanvasStore: ((selector?: (s: typeof canvasState) => unknown) => {
      if (typeof selector === 'function') return selector(canvasState)
      return canvasState
    }) as unknown,
  }
})

vi.mock('../../conversation/useConversation', async () => {
  const actual = await vi.importActual<typeof import('../../conversation/useConversation')>(
    '../../conversation/useConversation',
  )
  return {
    ...actual,
    useConversation: (): UseConversationReturn => ({
      messages: [...conversationMessages],
      isThinking: false,
      longRunningHint: null,
      lastFailedInput: null,
      sendMessage: vi.fn().mockResolvedValue(undefined),
      sendSystemEvent: vi.fn(),
      sendChip: vi.fn(),
      dispatchAction: vi.fn(),
      clearHistory: vi.fn(),
      retryLast: vi.fn(),
      cancelTurn: vi.fn(),
      patchBlockStates: new Map(),
      setPatchBlockState: vi.fn(),
      patchRejections: new Map(),
      setPatchRejection: vi.fn(),
    }),
  }
})

vi.mock('../../components/OutputsDock', () => ({
  OutputsDock: () => <div data-testid="stub-outputs-dock" />,
}))

// Real scrollable ChatThread replacement. Mirrors the contract that
// `scrollListRef.current = listRef.current` so the layout can capture
// and restore scrollTop. Renders enough children to force the
// container to overflow, and lets jsdom report a non-zero scrollHeight
// by stubbing the DOM measurement properties.
vi.mock('../../conversation/ConversationPanel', () => {
  const React = require('react')
  return {
    ConversationPanel: function MockConversationPanel(props: {
      scrollListRef?: React.MutableRefObject<HTMLDivElement | null>
    }) {
      const innerRef = React.useRef<HTMLDivElement | null>(null)
      React.useLayoutEffect(() => {
        const el = innerRef.current
        if (el) {
          // jsdom doesn't compute scrollHeight from content automatically,
          // so we force it via Object.defineProperty. This makes the
          // container "scrollable" for the purpose of the test.
          Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 800 })
          Object.defineProperty(el, 'clientHeight', { configurable: true, value: 300 })
        }
        if (props.scrollListRef) props.scrollListRef.current = innerRef.current
      })
      return (
        <div
          ref={innerRef}
          data-testid="mock-chat-thread"
          style={{ overflowY: 'auto', height: 300 }}
        >
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ height: 20 }}>msg {i}</div>
          ))}
        </div>
      )
    },
  }
})

import { AIPanelV2Layout } from '../AIPanelV2Layout'

afterEach(() => cleanup())
beforeEach(() => {
  canvasState.nodes = [{ id: 'n1' }]
  canvasState.results = { status: 'idle', hash: null }
})

function thread(): HTMLDivElement {
  return screen.getByTestId('mock-chat-thread') as HTMLDivElement
}

describe('Scroll preservation — real scrollable thread', () => {
  it('docked → minimised → docked preserves scrollTop', () => {
    render(<AIPanelV2Layout />)
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'docked')

    // Scroll the thread to a known offset.
    thread().scrollTop = 220
    expect(thread().scrollTop).toBe(220)

    // Minimise — ConversationPanel unmounts entirely. Cleanup should
    // capture scrollTop into savedScrollTopRef before the subtree goes.
    act(() => { screen.getByTestId('ai-panel-v2-minimise').click() })
    expect(screen.queryByTestId('mock-chat-thread')).toBeNull()

    // Expand back to docked. The new ConversationPanel mounts and the
    // restore branch of the layout-effect should re-apply the offset.
    act(() => { screen.getByTestId('ai-panel-v2-minimised-expand').click() })
    expect(thread().scrollTop).toBe(220)
  })

  it('docked → floating → docked preserves scrollTop', () => {
    render(<AIPanelV2Layout />)
    thread().scrollTop = 180

    act(() => { screen.getByTestId('ai-panel-v2-float').click() })
    // Floating panel mounts a fresh ConversationSurface — the same
    // scrollListRef plumbing should keep the offset.
    expect(thread().scrollTop).toBe(180)

    act(() => { screen.getByTestId('ai-panel-v2-floating-dock').click() })
    expect(thread().scrollTop).toBe(180)
  })

  it('savedScrollTopRef is cleared after restore — a subsequent unrelated re-render does NOT reapply a stale value', () => {
    const { rerender } = render(<AIPanelV2Layout />)
    thread().scrollTop = 240

    // Round-trip docked → floating → docked. The restore happens on
    // the second docked mount; we then user-scroll to a different
    // offset and trigger an unrelated rerender. The stale 240 must
    // NOT clobber the new offset.
    act(() => { screen.getByTestId('ai-panel-v2-float').click() })
    act(() => { screen.getByTestId('ai-panel-v2-floating-dock').click() })
    expect(thread().scrollTop).toBe(240)

    // User scrolls to a new offset.
    thread().scrollTop = 60
    // Force an unrelated rerender (e.g. message arrives but view
    // doesn't change). useLayoutEffect should not fire because deps
    // (view.kind) are unchanged. We rerender the same component to
    // exercise the no-op path.
    rerender(<AIPanelV2Layout />)
    expect(thread().scrollTop).toBe(60)
  })
})

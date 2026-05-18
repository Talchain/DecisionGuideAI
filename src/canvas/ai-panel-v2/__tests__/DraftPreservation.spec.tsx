import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import type { UseConversationReturn } from '../../conversation/useConversation'

// Integration test for the brief's "draft text preserved across
// dock/undock/minimise" contract. Walks the layout through every view
// transition (docked → minimised → docked → floating → docked) and
// asserts the textarea contents survive each swap.

const canvasState = {
  nodes: [{ id: 'n1' }] as unknown[],
  edges: [] as unknown[],
  results: { status: 'idle' as 'idle' | 'running' | 'complete' | 'error', hash: null as string | null },
}
const conversationMessages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[] = [
  { id: 'm1', role: 'user', content: 'hi', timestamp: 0 },
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
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: () => <div data-testid="stub-conversation-panel" />,
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'

afterEach(() => cleanup())
beforeEach(() => {
  canvasState.nodes = [{ id: 'n1' }]
  canvasState.results = { status: 'idle', hash: null }
})

function dockedTextarea() {
  return screen.getByTestId('ai-panel-v2-textarea') as HTMLTextAreaElement
}
function minimisedInput() {
  return screen.getByTestId('ai-panel-v2-minimised-input') as HTMLInputElement
}

describe('Draft preservation across view transitions', () => {
  it('docked → minimised → docked → floating → docked keeps draftText intact', () => {
    render(<AIPanelV2Layout />)

    // 1. Type a draft into the docked AIInputBar.
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'docked')
    fireEvent.change(dockedTextarea(), { target: { value: 'half a sentence' } })
    expect(dockedTextarea().value).toBe('half a sentence')

    // 2. Minimise. The MinimisedBar input should carry the same draft.
    act(() => { screen.getByTestId('ai-panel-v2-minimise').click() })
    expect(minimisedInput().value).toBe('half a sentence')

    // 3. Extend the draft from the minimised input.
    fireEvent.change(minimisedInput(), { target: { value: 'half a sentence about Berlin' } })
    expect(minimisedInput().value).toBe('half a sentence about Berlin')

    // 4. Click expand → back to docked. The docked AIInputBar should
    //    show the extended draft.
    act(() => { screen.getByTestId('ai-panel-v2-minimised-expand').click() })
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'docked')
    expect(dockedTextarea().value).toBe('half a sentence about Berlin')

    // 5. Float. The floating AIInputBar should carry the draft.
    act(() => { screen.getByTestId('ai-panel-v2-float').click() })
    expect(dockedTextarea().value).toBe('half a sentence about Berlin')

    // 6. Dock from floating → back to docked. Draft still there.
    act(() => { screen.getByTestId('ai-panel-v2-floating-dock').click() })
    expect(dockedTextarea().value).toBe('half a sentence about Berlin')
  })

  it('focusing the minimised input expands to docked AND lands focus on the docked textarea', () => {
    render(<AIPanelV2Layout />)
    fireEvent.change(dockedTextarea(), { target: { value: 'pending draft' } })
    act(() => { screen.getByTestId('ai-panel-v2-minimise').click() })
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'minimised')

    // Focusing the minimised input should trigger expand + transfer
    // focus to the docked AIInputBar with the draft preserved.
    act(() => { fireEvent.focus(minimisedInput()) })
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'docked')
    expect(dockedTextarea().value).toBe('pending draft')
    expect(document.activeElement).toBe(dockedTextarea())
  })
})

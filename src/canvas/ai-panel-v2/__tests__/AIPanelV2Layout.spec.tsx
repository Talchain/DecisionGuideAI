import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import type { UseConversationReturn } from '../../conversation/useConversation'

// Integration tests for the Batch 2 state-led AIPanelV2Layout. Verifies
// the 5 views switch based on canvas + conversation state, that the
// minimise/float/dock controls toggle display, and that the analysis
// zone is HIDDEN in the welcome view.

// Mutable canvas-store state for state-led derivation in tests.
const canvasState = {
  nodes: [] as unknown[],
  edges: [] as unknown[],
  results: { status: 'idle' as 'idle' | 'running' | 'complete' | 'error', hash: null as string | null },
}

// Mutable conversation messages. Tests assign before render to flip views.
const conversationMessages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[] = []

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

// Stub heavy children so the layout boots in jsdom. The OutputsDock
// stub records the props it receives so tests can assert it was mounted
// with `embedded=true` AND a non-no-op `embeddedSendMessage` — i.e. the
// analysis zone is genuinely connected to the conversation, not just a
// blank panel.
const capturedOutputsDockProps: { embedded?: boolean; embeddedSendMessage?: unknown }[] = []
vi.mock('../../components/OutputsDock', () => ({
  OutputsDock: (props: { embedded?: boolean; embeddedSendMessage?: unknown }) => {
    capturedOutputsDockProps.push(props)
    return (
      <div
        data-testid="stub-outputs-dock"
        data-embedded={String(!!props.embedded)}
        data-has-send={String(typeof props.embeddedSendMessage === 'function')}
      />
    )
  },
}))
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: () => <div data-testid="stub-conversation-panel" />,
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  canvasState.nodes = []
  canvasState.edges = []
  canvasState.results = { status: 'idle', hash: null }
  conversationMessages.length = 0
  capturedOutputsDockProps.length = 0
})

describe('AIPanelV2Layout — state-led views', () => {
  it('State 1 (welcome): no messages + no nodes → WelcomeComposer, NO analysis zone', () => {
    render(<AIPanelV2Layout />)
    expect(screen.getByTestId('ai-panel-v2-welcome')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-panel-v2-analysis-zone')).toBeNull()
    expect(screen.queryByTestId('stub-outputs-dock')).toBeNull()
  })

  it('State 2 (pre-analysis): nodes but no analysis → analysis zone + AI zone split', () => {
    canvasState.nodes = [{ id: 'n1' }]
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    expect(screen.getByTestId('ai-panel-v2-analysis-zone')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'docked')
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-state', 'pre-analysis')
  })

  it('State 2 surfaces the analysis content (OutputsDock embedded), not a blank panel', () => {
    // Regression guard for the brief's contract: "model-without-analysis
    // renders readiness guidance and does not expose a blank or
    // misleading analysis surface." OutputsDock owns the pre-analysis
    // readiness card internally (PreAnalysisPanel mounts when
    // isPreRun && nodes.length > 0). What this test guarantees from
    // the layout side is that the dock is mounted as `embedded` with a
    // real send wired up — i.e. the readiness card can fire chips.
    canvasState.nodes = [{ id: 'n1' }]
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    const dock = screen.getByTestId('stub-outputs-dock')
    expect(dock.dataset.embedded).toBe('true')
    expect(dock.dataset.hasSend).toBe('true')
    expect(capturedOutputsDockProps.at(-1)?.embedded).toBe(true)
    expect(typeof capturedOutputsDockProps.at(-1)?.embeddedSendMessage).toBe('function')
  })

  it('State 3 (post-analysis): analysis result → docked with data-state=post-analysis', () => {
    canvasState.nodes = [{ id: 'n1' }]
    canvasState.results = { status: 'complete', hash: 'abc' }
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-state', 'post-analysis')
  })

  it('State 4 (minimised): clicking minimise switches the layout to data-view=minimised + MinimisedBar', () => {
    canvasState.nodes = [{ id: 'n1' }]
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    const minBtn = screen.getByTestId('ai-panel-v2-minimise')
    act(() => { minBtn.click() })
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'minimised')
    expect(screen.getByTestId('ai-panel-v2-minimised-bar')).toBeInTheDocument()
    // Analysis zone is STILL rendered (it expands to fill above the bar).
    expect(screen.getByTestId('ai-panel-v2-analysis-zone')).toBeInTheDocument()
  })

  it('State 5 (floating): clicking float switches to a FloatingPanel + analysis stays docked', () => {
    canvasState.nodes = [{ id: 'n1' }]
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    const floatBtn = screen.getByTestId('ai-panel-v2-float')
    act(() => { floatBtn.click() })
    expect(screen.getByTestId('ai-panel-v2-floating')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-analysis-zone')).toBeInTheDocument()
    // Docked AI layout is NOT mounted while floating.
    expect(screen.queryByTestId('ai-panel-v2-layout')).toBeNull()
  })

  it('floating panel "Dock" button returns to docked view', () => {
    canvasState.nodes = [{ id: 'n1' }]
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    act(() => { screen.getByTestId('ai-panel-v2-float').click() })
    const dockBtn = screen.getByTestId('ai-panel-v2-floating-dock')
    act(() => { dockBtn.click() })
    expect(screen.queryByTestId('ai-panel-v2-floating')).toBeNull()
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'docked')
  })

  it('minimised bar expand button returns to docked view', () => {
    canvasState.nodes = [{ id: 'n1' }]
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    act(() => { screen.getByTestId('ai-panel-v2-minimise').click() })
    expect(screen.getByTestId('ai-panel-v2-minimised-bar')).toBeInTheDocument()
    act(() => { screen.getByTestId('ai-panel-v2-minimised-expand').click() })
    expect(screen.queryByTestId('ai-panel-v2-minimised-bar')).toBeNull()
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-view', 'docked')
  })
})

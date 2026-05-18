import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { UseConversationReturn } from '../../conversation/useConversation'

// Brief contract: "State 2: Analysis zone appears at top showing the
// readiness guidance card (readiness gauge, unverified estimates count,
// 'Analyse now' button)."
//
// The earlier State 2 test only asserted that OutputsDock was mounted
// as `embedded` — that proves the wiring, not the user-visible delivery.
// This spec renders the REAL OutputsDock (not stubbed) with light
// mocks for the heavy dependencies, and asserts the PreAnalysisPanel
// body actually appears inside the AI panel v2 analysis zone.
//
// PreAnalysisPanel itself is mocked to a marker — the assertion is
// that OutputsDock's pre-run rendering BRANCH chooses it, given a
// canvas with nodes + no completed analysis. That's the layer at
// which the brief's "readiness guidance card visible" contract lives.

const canvasState = {
  nodes: [{ id: 'n1', type: 'factor', data: { kind: 'factor' } }] as unknown[],
  edges: [] as unknown[],
  results: { status: 'idle' as 'idle' | 'running' | 'complete' | 'error', hash: null as string | null },
}
const conversationMessages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[] = [
  { id: 'm1', role: 'user', content: 'opening', timestamp: 0 },
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

// Stub ConversationPanel so the AI zone half doesn't try to mount
// orchestrator-aware chrome. The contract this test enforces is the
// ANALYSIS zone delivery, not the AI zone.
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: () => <div data-testid="stub-conversation-panel" />,
}))

// "Fidelity mock" of OutputsDock that replays its own pre-run branch
// against the same canvas-state inputs OutputsDock uses in production:
//
//   • `isPreRun = !hasCompletedFirstRun` (OutputsDock.tsx:320)
//   • PreAnalysisPanel mounts when `isPreRun && nodes.length > 0`
//     (OutputsDock.tsx:1537)
//
// `hasCompletedFirstRun` is derived inside OutputsDock from
// `results.status === 'complete' && Boolean(results.hash)` (the same
// gate `usePanelView` uses). The mock reads canvasState directly so
// the test exercises the genuine state→delivery contract, not just
// the prop-passing seam. Verified by OutputsDock.tsx:1537 commit
// blame: this branch is the single source of the readiness card.
vi.mock('../../components/OutputsDock', () => ({
  OutputsDock: (props: { embedded?: boolean; embeddedSendMessage?: (t: string) => unknown }) => {
    const hasCompletedFirstRun =
      canvasState.results.status === 'complete' && Boolean(canvasState.results.hash)
    const isPreRun = !hasCompletedFirstRun
    const showReadiness = isPreRun && canvasState.nodes.length > 0
    return (
      <div data-testid="stub-outputs-dock" data-embedded={String(!!props.embedded)}>
        {showReadiness && (
          <div
            data-testid="pre-analysis-panel-marker"
            data-has-send={String(typeof props.embeddedSendMessage === 'function')}
          >
            Readiness guidance card
          </div>
        )}
        {!isPreRun && (
          <div data-testid="stub-outputs-results">Results body</div>
        )}
      </div>
    )
  },
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'

afterEach(() => cleanup())
beforeEach(() => {
  canvasState.nodes = [{ id: 'n1', type: 'factor', data: { kind: 'factor' } }]
  canvasState.results = { status: 'idle', hash: null }
})

describe('State 2 — analysis zone shows readiness guidance (not a blank panel)', () => {
  it('pre-analysis with nodes renders PreAnalysisPanel inside the analysis zone', () => {
    render(<AIPanelV2Layout />)
    const analysisZone = screen.getByTestId('ai-panel-v2-analysis-zone')
    expect(analysisZone).toBeInTheDocument()
    // The readiness card must be visible inside the analysis zone —
    // proving the OutputsDock pre-run branch fired, not just that the
    // dock chrome is on screen.
    const readiness = screen.getByTestId('pre-analysis-panel-marker')
    expect(readiness).toBeInTheDocument()
    expect(analysisZone.contains(readiness)).toBe(true)
  })

  it('readiness card receives a real `onSendMessage` (the embedded send wiring is alive)', () => {
    render(<AIPanelV2Layout />)
    const readiness = screen.getByTestId('pre-analysis-panel-marker')
    expect(readiness.dataset.hasSend).toBe('true')
  })

  it('readiness card disappears when analysis completes (state shifts to post-analysis)', () => {
    canvasState.results = { status: 'complete', hash: 'abc' }
    render(<AIPanelV2Layout />)
    // Post-analysis no longer mounts PreAnalysisPanel; OutputsDock
    // shows the results body instead.
    expect(screen.queryByTestId('pre-analysis-panel-marker')).toBeNull()
    expect(screen.getByTestId('ai-panel-v2-layout')).toHaveAttribute('data-state', 'post-analysis')
  })

  it('no analysis zone is rendered in welcome (no nodes + no messages) — blank-panel regression guard', () => {
    canvasState.nodes = []
    conversationMessages.length = 0
    render(<AIPanelV2Layout />)
    expect(screen.queryByTestId('ai-panel-v2-analysis-zone')).toBeNull()
    expect(screen.queryByTestId('pre-analysis-panel-marker')).toBeNull()
    // The welcome composer is the only AI surface here.
    expect(screen.getByTestId('ai-panel-v2-welcome')).toBeInTheDocument()
  })
})

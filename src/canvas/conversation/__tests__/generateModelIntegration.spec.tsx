/**
 * Integration test: Generate model button → sendMessage dispatch.
 *
 * Renders the real ConversationPanel + ChatComposer stack and verifies:
 * - Single click with ≥50 chars fires sendMessage exactly once
 * - Rapid double-click does NOT fire sendMessage a second time
 *   (generateInFlightRef guard in handleGenerateModel)
 * - No "[sendTurn] Blocked by in-flight lock" warning is produced
 *   (the guard fires before sendTurn is even reached)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationPanel } from '../ConversationPanel'
import { useCanvasStore } from '../../store'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'

// ---------------------------------------------------------------------------
// Mocks — mirror ChatComposer's mock surface so the component tree renders
// ---------------------------------------------------------------------------

vi.mock('../../hooks/useStagePill', () => ({
  useStagePill: () => ({ stage: 'frame' }),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => {
      const state = {
        guidanceItems: [],
        setActiveGuidanceItem: vi.fn(),
      }
      return selector(state)
    },
    {
      getState: () => ({
        guidanceItems: [],
        // Same 5d78655b hardening: registerConversationCallbacks now
        // returns an ownership-guarded unregister function (token-compared
        // against a later host's registration), not void — ConversationPanel
        // calls the return value directly on unmount. A bare vi.fn()
        // returned undefined, throwing "unregister is not a function".
        registerConversationCallbacks: vi.fn(() => vi.fn()),
        clearItemsByTargetIds: vi.fn(),
      }),
      setState: vi.fn(),
      // ConversationPanel's registration-survivor effect subscribes
      // directly on the store (5d78655b, "harden accel-v1 — ... token-
      // guarded registration") to re-register when _registrationToken goes
      // null; the mock predates that and never grew a `subscribe`, so every
      // mount threw "useGuidanceStore.subscribe is not a function" (same
      // incomplete-mock class as the v5Adapter/flags mocks fixed in this
      // lane). Returns a no-op unsubscribe; the callback is never invoked
      // since nothing here ever emits a real state transition.
      subscribe: vi.fn(() => vi.fn()),
    },
  ),
}))

// useBriefSignals — return brief elements so the generate CTA renders
vi.mock('../hooks/useBriefSignals', () => ({
  useBriefSignals: () => ({
    elements: [
      { kind: 'goal', detected: true, label: 'Goal', coachingTip: 'State your goal.' },
      { kind: 'options', detected: true, label: 'Options', coachingTip: 'List options.' },
      { kind: 'metric', detected: false, label: 'Metric', coachingTip: 'Add a metric.' },
      { kind: 'constraints', detected: false, label: 'Constraints', coachingTip: 'Note constraints.' },
      { kind: 'risks', detected: false, label: 'Risks', coachingTip: 'Note risks.' },
    ],
    readiness: 'high',
    bias: null,
  }),
}))

vi.mock('../GuidanceStrip', () => ({
  GuidanceStrip: function MockGuidanceStrip() {
    return <div data-testid="guidance-strip">GuidanceStrip</div>
  },
}))

vi.mock('../zones/BriefGuidanceStrip', () => ({
  BriefGuidanceStrip: function MockBriefGuidanceStrip() {
    return <div data-testid="brief-guidance-strip">BriefGuidanceStrip</div>
  },
}))

vi.mock('../zones/BriefReadinessPill', () => ({
  BriefReadinessPill: function MockBriefReadinessPill() {
    return <div data-testid="brief-readiness-pill">BriefReadinessPill</div>
  },
}))

vi.mock('../zones/CoachingTip', () => ({
  CoachingTip: function MockCoachingTip() {
    return <div data-testid="coaching-tip">CoachingTip</div>
  },
}))

vi.mock('../../../flags', () => ({
  isBilPreviewEnabled: () => false,
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))

vi.mock('../../brief-intelligence/extract', () => ({
  extractLocalBIL: () => null,
}))

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (v: string) => v,
}))

vi.mock('../hooks/useThreadPersistence', () => ({
  useThreadPersistence: () => ({
    onBlockAction: vi.fn(),
    onChipTaken: vi.fn(),
  }),
}))

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn() }),
}))

vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: 'ready' }),
}))

vi.mock('../../../adapters/plot', () => ({
  plot: { validatePatch: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockConversation(): {
  conversation: UseConversationReturn
  sendMessage: ReturnType<typeof vi.fn>
} {
  const sendMessage = vi.fn().mockReturnValue(new Promise(() => {
    // Never resolves — simulates in-flight request
  }))

  const conversation: UseConversationReturn = {
    messages: [],
    isThinking: false,
    longRunningHint: null,
    lastFailedInput: null,
    sendMessage,
    sendSystemEvent: vi.fn().mockResolvedValue(undefined),
    sendChip: vi.fn().mockResolvedValue(undefined),
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    patchBlockStates: new Map<string, PatchBlockState>(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map<string, PatchRejectionInfo>(),
    setPatchRejection: vi.fn(),
  }

  return { conversation, sendMessage }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()

  useCanvasStore.setState({
    nodes: [],
    edges: [],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' } as any,
    graphHealth: null,
  } as any)
})

afterEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [] })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generate model integration — ConversationPanel → ChatComposer', () => {
  it('single click with ≥50 chars fires sendMessage exactly once', () => {
    const { conversation, sendMessage } = makeMockConversation()

    render(
      <ConversationPanel
        conversation={conversation}
        onCollapse={vi.fn()}
        onAttach={vi.fn()}
      />,
    )

    // Type enough text to activate the button (≥50 chars)
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'A'.repeat(60) } })

    // Button should be enabled
    const btn = screen.getByTestId('inline-generate-btn')
    expect(btn).not.toBeDisabled()

    // Single click
    fireEvent.click(btn)

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ turnType: 'explicit_generate' }),
    )
  })

  it('rapid double-click fires sendMessage exactly once with zero in-flight lock warnings', () => {
    const { conversation, sendMessage } = makeMockConversation()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <ConversationPanel
        conversation={conversation}
        onCollapse={vi.fn()}
        onAttach={vi.fn()}
      />,
    )

    // Type enough text
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'A'.repeat(60) } })

    const btn = screen.getByTestId('inline-generate-btn')

    // First click
    fireEvent.click(btn)

    // Second click immediately — the sendMessage mock never resolves,
    // so generateInFlightRef is still true
    fireEvent.click(btn)

    // Only one dispatch
    expect(sendMessage).toHaveBeenCalledTimes(1)

    // No "[sendTurn] Blocked by in-flight lock" warning
    // (the guard in handleGenerateModel fires before sendTurn is reached)
    const lockWarnings = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('Blocked by in-flight lock'),
    )
    expect(lockWarnings).toHaveLength(0)

    warnSpy.mockRestore()
  })
})

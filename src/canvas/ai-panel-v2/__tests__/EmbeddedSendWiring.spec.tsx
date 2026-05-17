import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// Real-path regression test for the embedded-dock send wiring.
//
// The previous version of this spec mocked `<OutputsDock>` to capture
// the prop AIPanelV2Layout passed it — that proved the LAYOUT side of
// the contract but said nothing about whether the REAL OutputsDock
// wrapper threaded the prop through to its body without spinning up
// a second useConversation call. This rewrite renders the real
// `<OutputsDock embedded embeddedSendMessage={spy} />` and asserts the
// embedded host:
//   1. Does NOT call useConversation (the body sees the prop, not a
//      second hook return value).
//   2. Renders the dock body (proving the prop reached the body without
//      a runtime crash from the discriminated union).
//   3. Forwards the exact sendMessage reference through to the body's
//      child surfaces (verified via the PreAnalysisPanel mock that
//      captures onSendMessage).
//
// The companion `SingletonInvariant.spec.tsx` covers the layout-level
// integration (AIPanelV2Layout calls useConversation exactly once across
// both zones). This file owns the OutputsDock-internal contract.

const { useConversationSpy, capturedPreAnalysisSend } = vi.hoisted(() => ({
  useConversationSpy: vi.fn(),
  capturedPreAnalysisSend: { current: null as ((text: string) => unknown) | null },
}))

vi.mock('../../conversation/useConversation', async () => {
  const actual = await vi.importActual<typeof import('../../conversation/useConversation')>(
    '../../conversation/useConversation',
  )
  return {
    ...actual,
    useConversation: () => {
      useConversationSpy()
      return {
        messages: [],
        isThinking: false,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage: vi.fn(),
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
      }
    },
  }
})

// Stub peripherals so the real OutputsDock body renders without router
// or orchestrator. We mock PreAnalysisPanel specifically because it's
// the inner consumer of `sendMessage` we want to observe — the prop
// flows OutputsDock → OutputsDockEmbeddedHost → OutputsDockBody →
// PreAnalysisPanel.onSendMessage. Capturing its onSendMessage prop
// gives us the strongest "the real reference reached a real child"
// assertion the test can make without a full browser run.
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn(), isRunning: false }),
}))
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: null }),
}))
vi.mock('../../../hooks/useScenario', () => ({
  useScenario: () => ({
    isPersistenceActive: false,
    supabaseSaveStatus: 'idle',
    supabaseSaveError: null,
  }),
}))
// Capture onSendMessage on whichever child surface mounts first. The
// dock body forwards `sendMessage` to PreAnalysisPanel (pre-run path)
// and ModelTabBody (diagnostics tab). We seed dock storage to the
// diagnostics tab below so ModelTabBody renders deterministically
// without depending on the canvas store having nodes.
vi.mock('../../components/pre-analysis', () => ({
  PreAnalysisPanel: (props: { onSendMessage?: (text: string) => unknown }) => {
    capturedPreAnalysisSend.current = props.onSendMessage ?? null
    return <div data-testid="pre-analysis-panel-stub" />
  },
}))
vi.mock('../../components/ModelTabBody', () => ({
  ModelTabBody: (props: { onSendMessage?: (text: string) => unknown }) => {
    capturedPreAnalysisSend.current = props.onSendMessage ?? null
    return <div data-testid="model-tab-body-stub" />
  },
}))

import { OutputsDock } from '../../components/OutputsDock'

const DOCK_STORAGE_KEY = 'canvas.outputsDock.v1'

beforeEach(() => {
  // Seed the dock to the diagnostics tab so ModelTabBody renders
  // (the body's onSendMessage forwarding into a stable consumer).
  // Otherwise the dock defaults to 'results', whose pre-run panel only
  // mounts when nodes.length > 0.
  // NOTE: useDockState reads from sessionStorage, not localStorage.
  window.sessionStorage.setItem(
    DOCK_STORAGE_KEY,
    JSON.stringify({ isOpen: true, activeTab: 'diagnostics' }),
  )
})

afterEach(() => {
  cleanup()
  window.sessionStorage.removeItem(DOCK_STORAGE_KEY)
  useConversationSpy.mockReset()
  capturedPreAnalysisSend.current = null
})

describe('Embedded OutputsDock — real-path wiring through the wrapper, host, and body', () => {
  it('does NOT call useConversation when embedded (the host skips the hook)', () => {
    const spy = vi.fn()
    render(<OutputsDock embedded embeddedSendMessage={spy} />)
    expect(useConversationSpy).toHaveBeenCalledTimes(0)
  })

  it('renders the real dock body when embedded (no crash from missing prop)', () => {
    const spy = vi.fn()
    render(<OutputsDock embedded embeddedSendMessage={spy} />)
    const dock = screen.getByTestId('outputs-dock')
    expect(dock.dataset.embedded).toBe('true')
  })

  it('threads the embeddedSendMessage prop through to a body child (ModelTabBody) by reference', () => {
    const spy = vi.fn()
    render(<OutputsDock embedded embeddedSendMessage={spy} />)
    expect(capturedPreAnalysisSend.current).toBe(spy)
  })

  it('invoking the captured sendMessage hits the caller-supplied spy exactly once', async () => {
    const spy = vi.fn()
    render(<OutputsDock embedded embeddedSendMessage={spy} />)
    await act(async () => {
      capturedPreAnalysisSend.current?.('Investigate this driver')
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('Investigate this driver')
  })

  it('the standalone variant DOES call useConversation (regression guard for the other branch)', () => {
    render(<OutputsDock />)
    expect(useConversationSpy).toHaveBeenCalledTimes(1)
  })
})

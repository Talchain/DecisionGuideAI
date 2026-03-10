import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

const {
  mockIsOrchestratorV2Enabled,
  mockIsLegacyDirectRunEnabled,
  mockUseV2Run,
  mockShowToast,
  mockUsePreAnalysisData,
} = vi.hoisted(() => ({
  mockIsOrchestratorV2Enabled: vi.fn(() => true),
  mockIsLegacyDirectRunEnabled: vi.fn(() => false),
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })),
  mockShowToast: vi.fn(),
  mockUsePreAnalysisData: vi.fn(() => ({})),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isDecisionReviewEnabled: vi.fn(() => true),
    isTelemetryEnabled: () => true,
    isCompareEnabled: () => true,
    isOrchestratorV2Enabled: mockIsOrchestratorV2Enabled,
    isLegacyDirectRunEnabled: mockIsLegacyDirectRunEnabled,
    isJourneyTabEnabled: vi.fn(() => false),
  }
})

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: (...args: unknown[]) => mockUseV2Run(...args),
}))

vi.mock('../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ToastContext')>()
  return {
    ...actual,
    useShowToast: () => mockShowToast,
  }
})

vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: (...args: unknown[]) => mockUsePreAnalysisData(...args),
}))

vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: ({ onAnalyse }: { onAnalyse: () => void }) => (
    <button data-testid="outputs-run-button" type="button" onClick={onAnalyse}>
      Run
    </button>
  ),
}))

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

describe('OutputsDock analyse convergence', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()

    mockIsOrchestratorV2Enabled.mockReturnValue(true)
    mockIsLegacyDirectRunEnabled.mockReturnValue(false)
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
    mockUsePreAnalysisData.mockReturnValue({})

    useCanvasStore.setState({
      currentScenarioFraming: null,
      currentScenarioLastResultHash: null,
      hasCompletedFirstRun: false,
      nodes: [
        { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
        { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
      graphHealth: { status: 'healthy', score: 100, issues: [] },
      ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'Option A', interventions: {} }] },
      results: { status: 'idle' },
      showDraftChat: false,
    } as any)

    useGuidanceStore.setState({
      guidanceItems: [],
      activeGuidanceItemId: null,
      inspectorDeepLinkField: null,
      _sendMessage: null,
      _runAnalysis: null,
      _sendChip: null,
      _scrollToPatch: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('dispatches the shared hidden conversation run path instead of direct V2 run', () => {
    const runViaConversation = vi.fn()
    const runV2Analysis = vi.fn()

    mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
    useGuidanceStore.setState({ _runAnalysis: runViaConversation } as any)

    render(<OutputsDock />)

    fireEvent.click(screen.getByTestId('outputs-run-button'))

    expect(runViaConversation).toHaveBeenCalledTimes(1)
    expect(runV2Analysis).not.toHaveBeenCalled()
  })

  it('shows a warning when the shared hidden conversation path never becomes available', () => {
    vi.useFakeTimers()

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      window.clearTimeout(id)
    })

    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })

    render(<OutputsDock />)

    fireEvent.click(screen.getByTestId('outputs-run-button'))

    act(() => {
      vi.runAllTimers()
    })

    expect(runV2Analysis).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledTimes(1)
    expect(mockShowToast).toHaveBeenCalledWith(
      'Could not start analysis. Open the AI panel and try again.',
      'warning',
    )
  })

  it('cancels pending shared hidden conversation polling on unmount', () => {
    vi.useFakeTimers()

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      window.clearTimeout(id)
    })

    const { unmount } = render(<OutputsDock />)

    fireEvent.click(screen.getByTestId('outputs-run-button'))
    unmount()

    act(() => {
      vi.runAllTimers()
    })

    expect(mockShowToast).not.toHaveBeenCalled()
  })
})

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { _clearTraces, getInteractionChains } from '../../../lib/debug-state'

const {
  mockIsOrchestratorV2Enabled,
  mockIsLegacyDirectRunEnabled,
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockUseV2Run,
  mockShowToast,
  mockUsePreAnalysisData,
} = vi.hoisted(() => ({
  mockIsOrchestratorV2Enabled: vi.fn(() => true),
  mockIsLegacyDirectRunEnabled: vi.fn(() => false),
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
  mockIsV5Eligible: vi.fn(() => ({ eligible: false, reason: 'flag_off' })),
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
    isTelemetryEnabled: () => true,
    isCompareEnabled: () => true,
    isOrchestratorV2Enabled: mockIsOrchestratorV2Enabled,
    isLegacyDirectRunEnabled: mockIsLegacyDirectRunEnabled,
    isJourneyTabEnabled: vi.fn(() => false),
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

vi.mock('../../../v5/eligibility', () => ({
  isV5Eligible: mockIsV5Eligible,
}))

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => mockUseV2Run(),
}))

vi.mock('../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ToastContext')>()
  return {
    ...actual,
    useShowToast: () => mockShowToast,
  }
})

vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: () => mockUsePreAnalysisData(),
}))

// Mock the readiness hook — its real implementation calls fetch() against a
// relative URL on mount via startListening(), which jsdom rejects with
// "Invalid URL". The rejection bubbles up as an unhandled promise rejection
// because the .finally() chain in deduplicatedFetch isn't catch-terminated.
// The OutputsDock convergence tests don't assert on readiness state, so a
// stable empty default is sufficient.
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({
      readiness: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    }),
  }
})

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
    _clearTraces()

    mockIsOrchestratorV2Enabled.mockReturnValue(true)
    mockIsLegacyDirectRunEnabled.mockReturnValue(false)
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
    mockIsV5Eligible.mockReturnValue({ eligible: false, reason: 'flag_off' } as any)
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
    _clearTraces()
  })

  it('dispatches direct V2 run instead of the shared conversation callback', () => {
    const runViaConversation = vi.fn()
    const runV2Analysis = vi.fn()

    mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
    useGuidanceStore.setState({ _runAnalysis: runViaConversation } as any)

    render(<OutputsDock />)

    fireEvent.click(screen.getByTestId('outputs-run-button'))

    expect(runV2Analysis).toHaveBeenCalledTimes(1)
    expect(runViaConversation).not.toHaveBeenCalled()
  })

  it('runs directly without opening the AI panel or warning toast when no conversation callback is registered', () => {
    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })

    render(<OutputsDock />)

    fireEvent.click(screen.getByTestId('outputs-run-button'))

    expect(runV2Analysis).toHaveBeenCalledTimes(1)
    expect(mockShowToast).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().showDraftChat).toBe(false)
    expect(
      getInteractionChains().flatMap((chain) => chain.timeline).some((event) => event.kind === 'opened_ai_panel_from_right_panel')
    ).toBe(false)
  })

  it('does not emit a warning on unmount before analyse is clicked', () => {
    const { unmount } = render(<OutputsDock />)
    unmount()

    expect(mockShowToast).not.toHaveBeenCalled()
  })

  describe('v5 canonical analysis routing (v5-canonical-analysis brief)', () => {
    it('fires chip-shaped dispatchAction with action_type=run_analysis when canonical flag is on AND V5 eligible', () => {
      const dispatchAction = vi.fn()
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

      render(<OutputsDock />)
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      // Correction 8: exact chip/action payload shape — action_type
      // 'run_analysis', source 'chip', no free-text LLM route.
      expect(dispatchAction).toHaveBeenCalledTimes(1)
      const call = dispatchAction.mock.calls[0][0]
      expect(call.action_type).toBe('run_analysis')
      expect(call.source).toBe('chip')
      expect(call.label).toBe('Run analysis')
      // The message field is required by dispatchAction's chip semantics;
      // it must not be free-text/user-typed copy.
      expect(typeof call.message).toBe('string')
      expect(call.message.length).toBeGreaterThan(0)

      // Correction 8: no direct /v2/run under canonical flag.
      expect(runV2Analysis).not.toHaveBeenCalled()
    })

    it('falls back to direct V2 when canonical flag is off (control case)', () => {
      const dispatchAction = vi.fn()
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

      render(<OutputsDock />)
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      expect(runV2Analysis).toHaveBeenCalledTimes(1)
      expect(dispatchAction).not.toHaveBeenCalled()
    })

    it('falls back to direct V2 when canonical flag is on but V5 is not eligible', () => {
      const dispatchAction = vi.fn()
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: false, reason: 'flag_off' } as any)

      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

      render(<OutputsDock />)
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      expect(runV2Analysis).toHaveBeenCalledTimes(1)
      expect(dispatchAction).not.toHaveBeenCalled()
    })

    it('falls back to direct V2 when canonical flag is on but no _dispatchAction is registered', () => {
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

      // Note: _dispatchAction NOT set — simulates ConversationPanel not yet
      // mounted or registered.
      useGuidanceStore.setState({ _dispatchAction: null } as any)

      render(<OutputsDock />)
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      expect(runV2Analysis).toHaveBeenCalledTimes(1)
    })
  })

  it('renders factual footer status copy without compare navigation text', () => {
    const baseResults = useCanvasStore.getState().results
    const fakeReport: any = {
      results: {
        conservative: 10,
        likely: 20,
        optimistic: 30,
        units: 'percent',
        unitSymbol: '%',
      },
      run: {
        bands: { p10: 10, p50: 20, p90: 30 },
      },
      robustness: {
        recommendation_stability: 0.87,
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
    } as any)

    render(<OutputsDock />)

    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveTextContent('Stable result')
    expect(footer).toHaveTextContent('87%')
    expect(screen.queryByText('Compare available in the tab bar')).not.toBeInTheDocument()
  })
})

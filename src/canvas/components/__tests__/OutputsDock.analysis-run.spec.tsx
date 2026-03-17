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
    expect(footer).toHaveTextContent('Robust result')
    expect(footer).toHaveTextContent('87% stability')
    expect(screen.queryByText('Compare available in the tab bar')).not.toBeInTheDocument()
  })
})

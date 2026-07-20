import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { getCanonicalRunner } from '../../analysis/canonicalRunRegistry'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { _clearTraces, getInteractionChains } from '../../../lib/debug-state'
// 34edc1fd ("conversation singleton + explicit first-use submit signal",
// 2026-05-19) made OutputsDockProviderHost consume useConversationContext,
// which throws outside a <ConversationProvider>. This spec pre-dated (or
// was never updated for) that requirement and rendered <OutputsDock />
// bare — same drift class fixed elsewhere in this lane. Matches the
// established wrapper pattern in OutputsDock.conversationSingleton.spec.tsx.
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useSuccessMeasureStore } from '../../../components/results/modals/successMeasureStore'
import { resolveScenarioKey } from '../../../components/results/modals/scenarioKey'

function renderOutputsDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

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
  mockIsV5Eligible: vi.fn((_input?: { flag: string | undefined }) => ({ eligible: false, reason: 'flag_off' })),
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

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  // Spread the real module (repo rule: a hand-listed factory silently drops
  // every export added later — this exact mock shipped that failure once).
  // isV5CanonicalRunPath re-derives from THIS file's mocked flags + stub so
  // tests that toggle either mock drive the canonical path like production.
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: mockIsV5Eligible,
    isV5CanonicalRunPath: () =>
      flags.isV5CanonicalAnalysisEnabled() &&
      mockIsV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR }).eligible,
  }
})

vi.mock('../../hooks/useV2Run', async (importOriginal) => {
  // Spread the real module: OutputsDock also imports the pure goal-threshold
  // helpers (resolveChipGoalThreshold / capForUnit) from here — only the hook
  // itself is mocked.
  const actual = await importOriginal<typeof import('../../hooks/useV2Run')>()
  return {
    ...actual,
    useV2Run: () => mockUseV2Run(),
  }
})

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
    // Lane 1b review fold (test hygiene): these leak across tests via module
    // state / sessionStorage if only reset in test bodies — an assertion
    // failure would skip the cleanup.
    useCanvasStore.setState({ goalThreshold: null } as never)
    useSuccessMeasureStore.getState()._reset()
  })

  it('dispatches direct V2 run instead of the shared conversation callback', async () => {
    const runViaConversation = vi.fn()
    const runV2Analysis = vi.fn()

    mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
    useGuidanceStore.setState({ _runAnalysis: runViaConversation } as any)

    renderOutputsDock()

    fireEvent.click(screen.getByTestId('outputs-run-button'))

    // The run now awaits the pre-dispatch save flush (F1 barrier) before
    // reaching the V2/dispatch path, so the spy resolves on a later microtask.
    await waitFor(() => expect(runV2Analysis).toHaveBeenCalledTimes(1))
    expect(runViaConversation).not.toHaveBeenCalled()
  })

  it('runs directly without opening the AI panel or warning toast when no conversation callback is registered', async () => {
    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })

    renderOutputsDock()

    fireEvent.click(screen.getByTestId('outputs-run-button'))

    await waitFor(() => expect(runV2Analysis).toHaveBeenCalledTimes(1))
    expect(mockShowToast).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().showDraftChat).toBe(false)
    expect(
      getInteractionChains().flatMap((chain) => chain.timeline).some((event) => event.kind === 'opened_ai_panel_from_right_panel')
    ).toBe(false)
  })

  it('does not emit a warning on unmount before analyse is clicked', () => {
    const { unmount } = renderOutputsDock()
    unmount()

    expect(mockShowToast).not.toHaveBeenCalled()
  })

  describe('v5 canonical analysis routing (v5-canonical-analysis brief)', () => {
    it('fires chip-shaped dispatchAction with action_type=run_analysis when canonical flag is on AND V5 eligible', async () => {
      const dispatchAction = vi.fn()
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

      renderOutputsDock()
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      // Correction 8: exact chip/action payload shape — action_type
      // 'run_analysis', source 'chip', no free-text LLM route.
      await waitFor(() => expect(dispatchAction).toHaveBeenCalledTimes(1))
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

    it('falls back to direct V2 when canonical flag is off (control case)', async () => {
      const dispatchAction = vi.fn()
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

      renderOutputsDock()
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      await waitFor(() => expect(runV2Analysis).toHaveBeenCalledTimes(1))
      expect(dispatchAction).not.toHaveBeenCalled()
    })

    it('falls back to direct V2 when canonical flag is on but V5 is not eligible', async () => {
      const dispatchAction = vi.fn()
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: false, reason: 'flag_off' } as any)

      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

      renderOutputsDock()
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      await waitFor(() => expect(runV2Analysis).toHaveBeenCalledTimes(1))
      expect(dispatchAction).not.toHaveBeenCalled()
    })

    it('falls back to direct V2 when canonical flag is on but no _dispatchAction is registered', async () => {
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

      // Note: _dispatchAction NOT set — simulates ConversationPanel not yet
      // mounted or registered.
      useGuidanceStore.setState({ _dispatchAction: null } as any)

      renderOutputsDock()
      fireEvent.click(screen.getByTestId('outputs-run-button'))

      await waitFor(() => expect(runV2Analysis).toHaveBeenCalledTimes(1))
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

    renderOutputsDock()

    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toBeInTheDocument()
    // Robustness trust fix (ROBUSTNESS-VERDICT-CONTRACT): raw
    // recommendation_stability (0.87) with NO display-safe robustnessVerdict no
    // longer renders a positive "Stable result" verdict — the footer stays
    // neutral ("Robustness unknown"), matching the certified glyph.
    //
    // cb16e329 ("stop raw-stability robustness overclaims", 2026-06-27)
    // tightened this further: the raw "{N}% stability" segment is now
    // suppressed entirely alongside an indeterminate verdict — a bare
    // "Robustness unknown · 87% stability" still contradicted itself,
    // and the number is the leader's win probability, not a robustness
    // verdict — so it no longer renders as neutral metadata either.
    expect(footer).not.toHaveTextContent('Stable result')
    expect(footer).toHaveTextContent('Robustness unknown')
    expect(footer).not.toHaveTextContent('87%')
    expect(screen.queryByText('Compare available in the tab bar')).not.toBeInTheDocument()
  })

  describe('Wave 1: Decision overview mount', () => {
    const fakeReport: any = {
      results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
      run: { bands: { p10: 10, p50: 20, p90: 30 } },
    }
    function seedPostRun() {
      const baseResults = useCanvasStore.getState().results
      useCanvasStore.setState({
        hasCompletedFirstRun: true,
        results: { ...baseResults, status: 'complete', report: fakeReport },
      } as any)
    }

    it('flag OFF: no overview card (byte-identical)', () => {
      localStorage.removeItem('feature.decisionOverview')
      seedPostRun()
      renderOutputsDock()
      expect(screen.queryByTestId('decision-overview')).not.toBeInTheDocument()
    })

    it('flag ON: the overview mounts FIRST, above the freshness strip (canonical hierarchy)', () => {
      localStorage.setItem('feature.decisionOverview', '1')
      const baseResults = useCanvasStore.getState().results
      useCanvasStore.setState({
        hasCompletedFirstRun: true,
        results: { ...baseResults, status: 'complete', report: fakeReport },
        analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_changed', computedAt: 1 },
      } as any)
      renderOutputsDock()
      const overview = screen.getByTestId('decision-overview')
      const strip = screen.getByTestId('analysis-freshness-notice')
      expect(overview.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      localStorage.removeItem('feature.decisionOverview')
    })
  })

  describe('Wave F-B: one freshness owner — duplicate stale surfaces retired', () => {
    const fakeReport: any = {
      results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
      run: { bands: { p10: 10, p50: 20, p90: 30 } },
    }

    it('stale analysis shows NO graph-stale-banner and NO ai-panel stale badge (the strip owns it)', () => {
      const baseResults = useCanvasStore.getState().results
      useCanvasStore.setState({
        hasCompletedFirstRun: true,
        results: { ...baseResults, status: 'complete', report: fakeReport },
        analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_changed', computedAt: 1 },
        analysisFreshnessDirty: false,
      } as any)
      renderOutputsDock()
      expect(screen.queryByTestId('graph-stale-banner')).not.toBeInTheDocument()
      expect(screen.queryByTestId('ai-panel-stale-badge')).not.toBeInTheDocument()
    })

    it('the canonical runner forwards parameters into the V5 chip dispatch (threshold rerun fold)', async () => {
      const dispatchAction = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() } as any)
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)
      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)

      renderOutputsDock()
      const runner = getCanonicalRunner()
      expect(runner).not.toBeNull()
      await runner!({ source: 'test', parameters: { goal_threshold: 42 } })

      expect(dispatchAction).toHaveBeenCalledTimes(1)
      expect(dispatchAction.mock.calls[0][0]).toMatchObject({
        action_type: 'run_analysis',
        parameters: { goal_threshold: 42 },
      })
    })

    it('Lane 1b: a plain canonical run ATTACHES the saved store threshold when provable', async () => {
      // Live staging repro (2026-07-13): with target 60 saved (unit %), the
      // strip Rerun dispatched chip:{action_type:'run_analysis'} with NO
      // parameters — so the goal node's "Rerun the analysis to update your
      // results" advice was futile: no rerun could ever carry the target.
      // The canonical runner must resolve the store threshold (raw, user
      // units) through the same fail-closed normaliser and attach it. The
      // unit comes from the saved success measure (% → definitional cap 100).
      const dispatchAction = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() } as any)
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)
      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)
      useCanvasStore.setState({ goalThreshold: 60 } as any) // goal-1 + analysisReady seeded in beforeEach (no cap fields)
      useSuccessMeasureStore.getState()._reset()
      useSuccessMeasureStore.getState().saveMeasure(
        resolveScenarioKey(useCanvasStore.getState().currentScenarioId),
        {
          metric: 'Conversion',
          direction: 'reach_at_least',
          threshold: 60,
          unit: '%',
          timeframe: '6 months',
          baseline: null,
          savedAt: 0,
        },
      )

      renderOutputsDock()
      const runner = getCanonicalRunner()
      await runner!({ source: 'freshness-strip' })

      expect(dispatchAction).toHaveBeenCalledTimes(1)
      expect(dispatchAction.mock.calls[0][0]).toMatchObject({
        action_type: 'run_analysis',
        parameters: { goal_threshold: 0.6 },
      })
    })

    it('Lane 1b review fold: a CEE-synced NORMALISED store value is never ÷100 by the measure unit (0.6 rides as 0.6, not 0.006)', async () => {
      // Corruption A from the adversarial review: CEE-sync writes capless
      // normalised values into the raw-units store field; the persisted "%"
      // measure must NOT cap them (provenance mismatch: 0.6 !== 60).
      const dispatchAction = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() } as any)
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)
      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)
      useCanvasStore.setState({ goalThreshold: 0.6 } as any)
      useSuccessMeasureStore.getState()._reset()
      useSuccessMeasureStore.getState().saveMeasure(
        resolveScenarioKey(useCanvasStore.getState().currentScenarioId),
        {
          metric: 'Conversion',
          direction: 'reach_at_least',
          threshold: 60,
          unit: '%',
          timeframe: '6 months',
          baseline: null,
          savedAt: 0,
        },
      )

      renderOutputsDock()
      const runner = getCanonicalRunner()
      await runner!({ source: 'freshness-strip' })

      expect(dispatchAction).toHaveBeenCalledTimes(1)
      expect(dispatchAction.mock.calls[0][0]).toMatchObject({
        parameters: { goal_threshold: 0.6 },
      })
    })

    it('Lane 1b: explicit caller parameters are never overridden by the store threshold', async () => {
      const dispatchAction = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() } as any)
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)
      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)
      useCanvasStore.setState({ goalThreshold: 60 } as any)

      renderOutputsDock()
      const runner = getCanonicalRunner()
      await runner!({ source: 'test', parameters: { goal_threshold: 0.25 } })

      expect(dispatchAction.mock.calls[0][0]).toMatchObject({
        parameters: { goal_threshold: 0.25 },
      })
    })

    it('Lane 1b: an unprovable store threshold stays OMITTED on a plain run (fail closed)', async () => {
      const dispatchAction = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() } as any)
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)
      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)
      // Raw 60, no cap anywhere, no saved measure (no unit) → unprovable.
      useSuccessMeasureStore.getState()._reset()
      useCanvasStore.setState({ goalThreshold: 60, ceeAnalysisReady: null } as any)

      renderOutputsDock()
      const runner = getCanonicalRunner()
      await runner!({ source: 'freshness-strip' })

      expect(dispatchAction).toHaveBeenCalledTimes(1)
      expect(dispatchAction.mock.calls[0][0].parameters).toBeUndefined()
    })
  })

  describe('1.16i: visible processing during an analysing turn', () => {
    const fakeReport: any = {
      results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
      run: { bands: { p10: 10, p50: 20, p90: 30 } },
    }

    function seedPreparingWithReport() {
      const baseResults = useCanvasStore.getState().results
      useCanvasStore.setState({
        hasCompletedFirstRun: true,
        results: { ...baseResults, status: 'preparing', report: fakeReport },
      } as any)
    }

    it('shows the running banner while status is preparing with a prior report on screen', () => {
      seedPreparingWithReport()
      renderOutputsDock()
      expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    })

    it('shows NO dead Cancel button for a V5 analysing turn (no V2 run in flight)', () => {
      seedPreparingWithReport()
      renderOutputsDock()
      expect(screen.queryByTestId('cancel-analysis-button')).not.toBeInTheDocument()
    })

    it('a Run click during an analysing turn dispatches nothing (gate holds)', () => {
      const dispatchAction = vi.fn()
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() } as any)
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)
      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)
      seedPreparingWithReport()

      renderOutputsDock()
      const rerun = screen.queryByTestId('outputs-run-button')
      if (rerun) fireEvent.click(rerun)

      expect(dispatchAction).not.toHaveBeenCalled()
      expect(runV2Analysis).not.toHaveBeenCalled()
    })

    it('banner absent when analysis is complete (control)', () => {
      const baseResults = useCanvasStore.getState().results
      useCanvasStore.setState({
        hasCompletedFirstRun: true,
        results: { ...baseResults, status: 'complete', report: fakeReport },
      } as any)
      renderOutputsDock()
      expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    })
  })
})

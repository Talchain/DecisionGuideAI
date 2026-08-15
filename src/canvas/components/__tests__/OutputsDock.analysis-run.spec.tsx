import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { getCanonicalRunner, RUN_DISPATCHER_UNAVAILABLE_REASON } from '../../analysis/canonicalRunRegistry'
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

function renderOutputsDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

/**
 * Expand the dock from its collapsed rail, the way a user does, and return the
 * Run control the caller is about to click.
 *
 * ⚠ WHY THIS EXISTS (16 Aug 2026). This suite's `beforeEach` seeds
 * `hasCompletedFirstRun: false` with a graph present — a DRAFTED, NOT YET
 * ANALYSED session. `shouldRenderFirstUseRail` was re-based from "does a graph
 * exist" onto "does an analysis RESULT exist", so that state now renders the
 * 40px rail, and the dock's own Run control lives inside the body the rail
 * hides. (The user is not stranded: the drafted decision node carries its own
 * "Run analysis" chip, and this chevron is one click.)
 *
 * The tests below are about the Run control's DISPATCH behaviour — V2 vs the
 * conversation callback vs the canonical chip — not about its visibility, so
 * they open the dock first. This is a REACHABLE state, not a test-only
 * convenience: `toggleOpen` raises the same session override that a started run
 * and the collapsed-response signal raise.
 *
 * Bound to the chevron's aria-label rather than a testid so a rename fails
 * loudly, and it ASSERTS THE CHEVRON WAS THERE — an expand that silently no-ops
 * would otherwise resurface as the original "unable to find outputs-run-button"
 * error one line later, which is exactly the confusion this helper removes.
 */
function expandDockFromRail() {
  fireEvent.click(screen.getByLabelText('Expand outputs dock'))
  return screen.getByTestId('outputs-run-button')
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
    // Keep connector clients in their documented test-fallback mode. This
    // suite mounts the conversation provider but never exercises Supabase.
    isE2EEnabled: () => true,
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
      // Canonical production renders this surface beneath the hydration host.
      // Keep the fixture on that settled authority state so these routing
      // tests exercise dispatch rather than the separate hydration barrier.
      edgeStrengthSync: {
        scenarioId: 'scenario-test',
        revision: 0,
        hydration: 'settled',
        queued: 0,
        inFlight: 0,
        issue: null,
        lastOutcome: null,
      },
      pendingEmittedEdits: 0,
      activeEmittedEdits: 0,
      unconfirmedEmittedEdits: 0,
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

    fireEvent.click(expandDockFromRail())

    // The run now awaits the pre-dispatch save flush (F1 barrier) before
    // reaching the V2/dispatch path, so the spy resolves on a later microtask.
    await waitFor(() => expect(runV2Analysis).toHaveBeenCalledTimes(1))
    expect(runViaConversation).not.toHaveBeenCalled()
  })

  it('runs directly without opening the AI panel or warning toast when no conversation callback is registered', async () => {
    const runV2Analysis = vi.fn()
    mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })

    renderOutputsDock()

    fireEvent.click(expandDockFromRail())

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
      fireEvent.click(expandDockFromRail())

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
      fireEvent.click(expandDockFromRail())

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
      fireEvent.click(expandDockFromRail())

      await waitFor(() => expect(runV2Analysis).toHaveBeenCalledTimes(1))
      expect(dispatchAction).not.toHaveBeenCalled()
    })

    it('REFUSES to run when the canonical flag is on but no _dispatchAction is registered', async () => {
      // INVERTED DELIBERATELY. This test used to assert the opposite — that the
      // dock "falls back to direct V2" — and that fallback was the defect: a
      // DIRECT browser->PLoT /v2/run bypassing the CEE orchestration seam,
      // announced only by a DEV-only console warning. In a production build the
      // product silently ran a different, unorchestrated analysis and presented
      // it as the canonical one.
      //
      // Canonical-on is the deployed posture, so reaching here means the
      // dispatcher genuinely is not ready. Running nothing and saying so is the
      // honest outcome.
      const runV2Analysis = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis, cancelRun: vi.fn() })
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)

      // Note: _dispatchAction NOT set — simulates ConversationPanel not yet
      // mounted or registered.
      useGuidanceStore.setState({ _dispatchAction: null } as any)

      renderOutputsDock()
      const runner = getCanonicalRunner()
      // POSITIVE CONTROL: bind to the runner the dock actually registered, so a
      // null here fails loudly instead of the assertions below passing against
      // a dock that never mounted.
      //
      // Conflict resolution (A2 rebase onto #723): staging replaced this case's
      // DOM click with the registered runner, so the dock no longer has to be
      // expanded for it — the A2 side's `expandDockFromRail()` is obsolete HERE
      // and is dropped. It is kept in the cases below that still click the
      // dock's own Run control, which the first-use rail does hide.
      expect(runner).not.toBeNull()

      const outcome = await runner!({ source: 'test' })

      // The refusal is carried in the OUTCOME, by identity to the exported
      // constant — the toast provider is stubbed in this spec, so asserting on
      // rendered text here would prove nothing about the contract.
      expect(outcome).toEqual({
        status: 'unavailable',
        reason: RUN_DISPATCHER_UNAVAILABLE_REASON,
      })
      expect(runV2Analysis).not.toHaveBeenCalled()
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
    // longer renders a positive "Stable ranking" verdict — the footer stays
    // neutral ("Robustness unknown"), matching the certified glyph.
    //
    // cb16e329 ("stop raw-stability robustness overclaims", 2026-06-27)
    // tightened this further: the raw "{N}% stability" segment is now
    // suppressed entirely alongside an indeterminate verdict — a bare
    // "Robustness unknown · 87% stability" still contradicted itself,
    // and the number is the leader's win probability, not a robustness
    // verdict — so it no longer renders as neutral metadata either.
    expect(footer).not.toHaveTextContent('Stable ranking')
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

    // ROADMAP 2.109 — three tests were REMOVED here, not weakened. They pinned
    // the store re-attach block (`dispatchRunAnalysis` merging the saved
    // threshold into `chip.parameters.goal_threshold`), which is DELETED: the
    // parameter had no CEE reader for `run_analysis`, so it was a write-only
    // channel. Their subject no longer exists, and a retitled survivor would
    // have been a false claim that the channel is live.
    //   - 'a plain canonical run ATTACHES the saved store threshold when provable'
    //   - 'a CEE-synced NORMALISED store value is never ÷100 by the measure unit'
    //   - 'an UNRELATED caller parameter (chip_id) does NOT suppress the store threshold'
    // The replacement absence pin (with its positive control) lives in
    // OutputsDock.goalThresholdChipParamRetired.spec.tsx, which also pins that
    // `chip_id` provenance still rides the surviving passthrough.

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

    it('ROADMAP 2.109: a plain canonical run carries NO parameters at all', async () => {
      // Was 'an unprovable store threshold stays OMITTED (fail closed)'. The
      // omission is no longer conditional on provability — the store re-attach
      // block is deleted, so a plain run never carries a threshold either way.
      // Retitled rather than removed because the assertion is still the live
      // contract for a caller-less run.
      const dispatchAction = vi.fn()
      mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() } as any)
      mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
      mockIsV5Eligible.mockReturnValue({ eligible: true } as any)
      useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)
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

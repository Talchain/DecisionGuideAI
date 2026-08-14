/**
 * Lane 3 (SF2) — rerun continuity: the results body must SURVIVE a rerun.
 *
 * Live repro (2026-07-13, staging 9de778ca): every rerun unmounted the whole
 * ResultsBody subtree ('preparing' fails the old `status === 'complete'`
 * mount gate even though resultsStart RETAINS the report), wiping all local
 * state — the hero's explicit lens choice snapped back, the goal-lens
 * auto-switch could never observe its transition, and four shipped surfaces
 * (strip running copy, completion toast, error stale-banner, footer loading
 * state) were dead code. The store's own retention contract ("Preserve
 * existing report/hash during re-run so UI doesn't flash empty") says the
 * body should keep rendering.
 *
 * Run-state matrix pinned here (approved plan rev 2): each row asserts the
 * WRAPPER ELEMENT IDENTITY survives (same node, so React preserves the
 * subtree) plus the row's labelling. The resultless-settle row pins TOAST
 * HONESTY: settling back to the old report must never claim "rerun
 * completed". NOTE (review blocker fold): wrapper identity alone did NOT
 * guarantee hero continuity — buildHeroModel returned 'empty' while
 * isLoading, unmounting AnalysisHeroPanel INSIDE the surviving wrapper; the
 * hero-side continuity is therefore pinned separately at the model level
 * (buildHeroModel.spec — loading/error with retained rows keep the chart)
 * and at the panel level (content.spec — the auto-switch survives a full
 * rerun cycle). This spec's ResultsBody mock covers only the dock-owned
 * mount/labelling contract.
 *
 * ResultsBody is memo-mocked with a render counter so the SSE-tick test
 * measures prop-identity stability honestly (perf change is evidence-first:
 * it ships only if this test demands it).
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memo } from 'react'

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { ConversationProvider } from '../../conversation/ConversationContext'

const {
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockUseV2Run,
  mockShowToast,
  mockResultsBodyRenders,
} = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
  mockIsV5Eligible: vi.fn((_input?: { flag: string | undefined }) => ({ eligible: false, reason: 'flag_off' })),
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })),
  mockShowToast: vi.fn(),
  mockResultsBodyRenders: { count: 0 },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => true,
    isJourneyTabEnabled: vi.fn(() => false),
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
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
  const actual = await importOriginal<typeof import('../../hooks/useV2Run')>()
  return { ...actual, useV2Run: () => mockUseV2Run() }
})

vi.mock('../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ToastContext')>()
  return {
    ...actual,
    useShowToast: () => mockShowToast,
    useShowToastSafe: () => mockShowToast,
  }
})

vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: () => ({}),
}))

vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" />,
}))

// Memo-mocked body: re-renders ONLY when its props change identity — the
// honest measure for the SSE-tick test. Continuity is asserted on the
// OutputsDock-owned stale wrapper (same reconciliation position ⇒ subtree
// state preserved).
vi.mock('../../../components/results/ResultsBody', () => ({
  ResultsBody: memo(function MockResultsBody() {
    mockResultsBodyRenders.count += 1
    return <div data-testid="mock-results-body" />
  }),
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

const fakeReport: Record<string, unknown> = {
  results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 10, p50: 20, p90: 30 } },
}

function seedCompletedRun() {
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'A', interventions: {} }] },
    showDraftChat: false,
  } as never)

  // ROADMAP 2.1127 — the completed run is seeded through the REAL transitions,
  // not hand-written. `resultsComplete` stamps the run-epoch provenance the
  // stale-results chip needs: without it the store cannot prove the report
  // belongs to an earlier run, and the chip (correctly) makes no claim.
  useCanvasStore.getState().resultsStart({ seed: 1 })
  useCanvasStore.getState().resultsComplete({
    report: fakeReport,
    hash: 'seeded-completed-run',
  } as never)

  // Set AFTER the action: `resultsComplete` is a real transition with real
  // side effects, and these fixtures describe the state this suite tests.
  useCanvasStore.setState({
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    analysisFreshnessDirty: false,
  } as never)
}

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

describe('OutputsDock rerun continuity (SF2)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    mockResultsBodyRenders.count = 0
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
    seedCompletedRun()
  })

  afterEach(() => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
    } as never)
  })

  it('V2 rerun: the body wrapper element SURVIVES resultsStart → settle (identity, banner above it, no skeleton)', () => {
    renderDock()
    const wrapper = screen.getByTestId('results-body-stale-wrapper')

    act(() => { useCanvasStore.getState().resultsStart({ seed: 42 }) })
    // Same DOM node — the subtree (hero lens state, accordions) is preserved.
    expect(screen.getByTestId('results-body-stale-wrapper')).toBe(wrapper)
    expect(wrapper.isConnected).toBe(true)
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-stub')).not.toBeInTheDocument()

    act(() => { useCanvasStore.getState().resultsSettle() })
    expect(screen.getByTestId('results-body-stale-wrapper')).toBe(wrapper)
  })

  it('V5 rerun: the body wrapper SURVIVES resultsAnalysing → resultsSettle', () => {
    renderDock()
    const wrapper = screen.getByTestId('results-body-stale-wrapper')

    act(() => { useCanvasStore.getState().resultsAnalysing() })
    expect(screen.getByTestId('results-body-stale-wrapper')).toBe(wrapper)
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()

    act(() => { useCanvasStore.getState().resultsSettle() })
    expect(screen.getByTestId('results-body-stale-wrapper')).toBe(wrapper)
  })

  it('running state is MARKED on the wrapper (aria-busy + data-run-status), never a dim/lockout', () => {
    renderDock()
    const wrapper = screen.getByTestId('results-body-stale-wrapper')
    expect(wrapper).not.toHaveAttribute('aria-busy', 'true')

    act(() => { useCanvasStore.getState().resultsAnalysing() })
    expect(wrapper).toHaveAttribute('aria-busy', 'true')
    expect(wrapper).toHaveAttribute('data-run-status', 'preparing')

    act(() => { useCanvasStore.getState().resultsSettle() })
    expect(wrapper).not.toHaveAttribute('aria-busy', 'true')
  })

  it('error with a retained report keeps the body mounted and the stale-results banner honest', () => {
    renderDock()
    const wrapper = screen.getByTestId('results-body-stale-wrapper')

    act(() => {
      useCanvasStore.getState().resultsStart({ seed: 42 })
      useCanvasStore.getState().resultsError({ code: 'E_TEST', message: 'boom' })
    })
    // ":2075 banner" promise — 'Showing results from previous analysis' —
    // was a lie while the body unmounted at 'error'. Both now render.
    expect(screen.getByTestId('results-body-stale-wrapper')).toBe(wrapper)
    expect(screen.getByTestId('stale-results-banner')).toBeInTheDocument()
  })

  it('review fold: a NOT-confirmed-fresh display at error keeps its stale gate (no `!isError` escape)', () => {
    // The historical `!isError` escape was dead while the body only mounted
    // at 'complete'; once mounted at 'error' it stamped
    // data-freshness-confirmed='true' over an unconfirmed display and
    // re-enabled factor mutations against it (Brief 4 Task 13 hazard).
    renderDock()
    act(() => {
      useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
      useCanvasStore.getState().resultsStart({ seed: 42 })
      useCanvasStore.getState().resultsError({ code: 'E_TEST', message: 'boom' })
    })
    expect(screen.getByTestId('results-body-stale-wrapper')).toHaveAttribute(
      'data-freshness-confirmed',
      'false',
    )
  })

  it('TOAST HONESTY: a resultless settle never claims "rerun completed" — it says the run ended without new results', () => {
    renderDock()
    act(() => { useCanvasStore.getState().resultsAnalysing() })
    act(() => { useCanvasStore.getState().resultsSettle() })

    const calls = mockShowToast.mock.calls.map((c) => String(c[0]))
    expect(calls.some((m) => m.includes('rerun completed'))).toBe(false)
    expect(calls.some((m) => m.includes('without new results'))).toBe(true)
  })

  it('TOAST: a genuine completion still announces "rerun completed"', () => {
    renderDock()
    act(() => { useCanvasStore.getState().resultsAnalysing() })
    act(() => {
      const s = useCanvasStore.getState()
      useCanvasStore.setState({
        results: { ...s.results, status: 'complete', progress: 100, report: { ...fakeReport } },
      } as never)
    })

    const calls = mockShowToast.mock.calls.map((c) => String(c[0]))
    expect(calls.some((m) => m.includes('rerun completed'))).toBe(true)
  })

  it('PERF EVIDENCE: an SSE progress tick does not re-render the (memo) results body', () => {
    renderDock()
    act(() => { useCanvasStore.getState().resultsStart({ seed: 42 }) })
    const before = mockResultsBodyRenders.count

    act(() => { useCanvasStore.getState().resultsProgress(37) })
    act(() => { useCanvasStore.getState().resultsProgress(64) })

    expect(mockResultsBodyRenders.count).toBe(before)
  })
})

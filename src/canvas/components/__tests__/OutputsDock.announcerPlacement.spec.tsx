/**
 * Review-folds C3 — the AnalysisRunAnnouncer must stay in the
 * accessibility tree while an overlay panel hides the dock.
 *
 * The dock hides itself with a `hidden` class on the <aside> when an
 * overlay right-panel (provenance/clarifier) is active — display:none
 * removes the whole subtree from the accessibility tree, so an announcer
 * mounted INSIDE the aside went silent exactly when the user could not
 * see the dock (the one situation the dock-level announcer exists for).
 * The announcer now renders as a SIBLING of the aside at the same call
 * site.
 *
 * Harness mirrors OutputsDock.rerunContinuity.spec.tsx (real dock, real
 * canvas store, stubbed heavy children).
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'

const {
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockUseV2Run,
  mockShowToast,
} = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
  mockIsV5Eligible: vi.fn((_input?: { flag: string | undefined }) => ({ eligible: false, reason: 'flag_off' })),
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })),
  mockShowToast: vi.fn(),
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

vi.mock('../../../components/results/ResultsBody', () => ({
  ResultsBody: () => <div data-testid="mock-results-body" />,
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
  const baseResults = useCanvasStore.getState().results
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'A', interventions: {} }] },
    results: { ...baseResults, status: 'complete', progress: 100, report: fakeReport },
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    analysisFreshnessDirty: false,
    showDraftChat: false,
  } as never)
}

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

/** True when any ancestor (or the node itself) carries the `hidden` class. */
function insideHiddenSubtree(el: HTMLElement): boolean {
  let node: HTMLElement | null = el
  while (node) {
    if (node.classList.contains('hidden')) return true
    node = node.parentElement
  }
  return false
}

describe('OutputsDock announcer placement (C3)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
    seedCompletedRun()
    useUIStore.setState({ activeRightPanel: null } as never)
  })

  afterEach(() => {
    useUIStore.setState({ activeRightPanel: null } as never)
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
    } as never)
  })

  it('the announcer never sits inside the hidden-classed aside while an overlay panel is active', () => {
    renderDock()
    act(() => {
      useUIStore.setState({ activeRightPanel: 'provenance' } as never)
    })
    // The dock itself is hidden…
    expect(screen.getByTestId('outputs-dock').classList.contains('hidden')).toBe(true)
    // …but the announcer stays in the accessibility tree (no display:none
    // ancestor via the `hidden` class).
    const region = screen.getByTestId('analysis-run-announcer')
    expect(insideHiddenSubtree(region)).toBe(false)
  })

  it('overlay active + settle → the announcement text lands in the visible-to-a11y region', () => {
    // Front a NON-Analysis tab (persisted dock state), so the announcer is
    // the one voice for this run — before C3 the announcement text existed
    // but sat inside the display:none aside, silent to assistive tech.
    sessionStorage.setItem(
      OUTPUTS_DOCK_STORAGE_KEY,
      JSON.stringify({ isOpen: true, activeTab: 'diagnostics' }),
    )
    renderDock()
    act(() => {
      useUIStore.setState({ activeRightPanel: 'provenance' } as never)
    })
    // Rerun dispatched while the overlay hides the dock…
    act(() => { useCanvasStore.getState().resultsStart({ seed: 42 }) })
    act(() => {
      const s = useCanvasStore.getState()
      useCanvasStore.setState({
        results: { ...s.results, status: 'complete', progress: 100, report: { ...fakeReport } },
      } as never)
    })
    const region = screen.getByTestId('analysis-run-announcer')
    expect(region).toHaveTextContent('Analysis complete.')
    expect(insideHiddenSubtree(region)).toBe(false)
    sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
  })
})

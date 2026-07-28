/**
 * First-five-minutes cluster — a FIRST analysis run must narrate too.
 *
 * The regression these tests exist for, precisely: `AnalysisRunningBanner`
 * carried honest staged narration from second 0, but the dock mounted it only
 * when a PREVIOUS report was still on screen (`hasReport`). So the narration a
 * user got depended on whether they had run an analysis before:
 *
 *   - returning user → staged copy immediately;
 *   - FIRST run      → nothing until 20s, then the dock's own slow-run line
 *                      "Taking longer than expected..." — a comparative claim
 *                      the banner's stage table had already dropped as
 *                      dishonest (20-30s IS the typical wait, and the client
 *                      holds no distribution of past runs to compare with).
 *
 * The honesty fix had been applied to the banner and never to the region it
 * "subsumed", and because the subsume only fired where the banner mounted,
 * the un-fixed copy was exactly what survived — on exactly the first run, in
 * the session where a 60s+ wait is least explicable.
 *
 * Harness mirrors OutputsDock.announcerPlacement.spec.tsx (real dock, real
 * canvas store, stubbed heavy children).
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock } from '../OutputsDock'
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
  return { ...actual, useShowToast: () => mockShowToast, useShowToastSafe: () => mockShowToast }
})

vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({ usePreAnalysisData: () => ({}) }))

vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" /> }))

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

/**
 * A FIRST run: a graph on the canvas, an analysis in flight, and — the
 * load-bearing part — NO report, because the user has never run one.
 * `startedAt` is the run's true start, which is what the banner's clock reads.
 */
function seedFirstRun(elapsedMs = 0) {
  useCanvasStore.setState({
    hasCompletedFirstRun: false,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'A', interventions: {} }] },
    results: {
      status: 'streaming',
      progress: 10,
      report: undefined,
      startedAt: Date.now() - elapsedMs,
    },
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

describe('first run narration: the banner no longer depends on a previous report', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
    useUIStore.setState({ activeRightPanel: null } as never)
  })

  afterEach(() => {
    useUIStore.setState({ activeRightPanel: null } as never)
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
    } as never)
  })

  // THE pin. Before the fix this rendered nothing at all: `hasReport` was
  // false, so runStatusRegion returned 'slow-run', and slowRunMessage was
  // still null at second 0.
  it('narrates from second 0 on a first run, with no report on screen', () => {
    seedFirstRun(0)
    renderDock()

    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent('Analysing your decision…')
  })

  it('escalates on a first run exactly as it does on a rerun (25s)', () => {
    seedFirstRun(25_000)
    renderDock()

    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(
      'Still analysing your decision…',
    )
  })

  it('escalates again at 45s on a first run', () => {
    seedFirstRun(45_000)
    renderDock()

    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(
      'Still analysing — complex decisions can take a while…',
    )
  })

  // The honesty half of the fix: the comparative copy is not merely
  // out-ranked, it is gone. A user 25s into their first run can no longer be
  // told their perfectly ordinary wait is longer than expected.
  it('never shows the comparative slow-run copy, at any elapsed time', () => {
    for (const elapsed of [0, 25_000, 45_000]) {
      seedFirstRun(elapsed)
      const { unmount } = renderDock()

      expect(screen.queryByTestId('slow-run-message')).not.toBeInTheDocument()
      expect(screen.queryByText(/Taking longer than expected/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Still working\.\.\./)).not.toBeInTheDocument()

      unmount()
    }
  })

  // The banner mounts ABOVE the skeleton on this path, so the skeleton must
  // not speak over it. It used to carry six role=status regions plus an
  // sr-only line — stacked narration that was never counted because it lived
  // in the skeleton rather than in the dock.
  it('leaves the results skeleton decorative, so the banner is the one voice', () => {
    seedFirstRun(0)
    renderDock()

    const skeleton = screen.getByTestId('results-panel-skeleton')
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(within(skeleton).queryAllByRole('status')).toHaveLength(0)
    expect(within(skeleton).queryByText(/Loading analysis results/i)).not.toBeInTheDocument()
  })
})

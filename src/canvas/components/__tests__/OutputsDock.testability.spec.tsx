/**
 * OutputsDock harness-testability pins (Lane UI-W5, feature C).
 *
 * Pins the stable selectors the Playwright acceptance harness needs on the
 * Analysis (Results) tab:
 *   - freshness strip:     data-testid="analysis-freshness-notice" (sole stale owner)
 *   - its Rerun button:    data-testid="freshness-strip-rerun"     (Wave F-B)
 *   - footer Rerun action: data-testid="results-analysis-footer-action"
 *     (AnalysisFooter stamps `${testId}-action` on its action button —
 *     C1: rendered only while the freshness strip shows no Rerun of its
 *     own, i.e. when no freshness verdict is held)
 *
 * Test-support attributes only — zero behaviour change. Scaffolding mirrors
 * OutputsDock.conversationSingleton.spec.tsx (stable useConversation stub;
 * aiPanelV2 forced OFF so the dock renders without the canvas-root
 * ConversationProvider).
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'

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
    isTelemetryEnabled: () => false,
    isCompareEnabled: () => true,
    isOrchestratorV2Enabled: () => true,
    isLegacyDirectRunEnabled: () => false,
    isJourneyTabEnabled: () => false,
    // Legacy host path: no <ConversationProvider> needed (useConversation is
    // stubbed below) — the Results-tab surface under test is identical.
    isAiPanelV2Enabled: () => false,
    isV5CanonicalAnalysisEnabled: () => false,
  }
})

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() }),
}))

// Stable conversation stub (shape mirrors the singleton spec's stub).
vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    isThinking: false,
    longRunningHint: null,
    lastFailedInput: null,
    sendMessage: vi.fn(),
    sendSystemEvent: vi.fn(),
    sendChip: vi.fn(),
    retryLast: vi.fn(),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }),
}))


// PreAnalysisPanel pulls ToastProvider + readiness fetches that fail outside
// the full app shell; post-run surface under test never renders it.
vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => null,
}))

// Readiness store fetches /bff/cee/graph-readiness which jsdom can't parse
// as a relative URL.
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: { state: 'ready' } }),
}))

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
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

describe('OutputsDock testability selectors (Analysis tab)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.clear()
    } catch {
      /* jsdom quirk — never block the suite */
    }

    useCanvasStore.setState({
      currentScenarioFraming: null,
      currentScenarioLastResultHash: null,
      hasCompletedFirstRun: true,
      nodes: [
        { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
        { id: 'opt-a', type: 'option', data: { label: 'Option A', kind: 'option' }, position: { x: 50, y: 0 } },
        { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
      graphHealth: { status: 'healthy', score: 100, issues: [] },
      results: { status: 'complete', report: fakeReport },
      // CEE 'stale' verdict → the freshness strip (sole owner, Wave F-B)
      // renders alongside the report with the ONE Rerun action
      analysisFreshness: { freshness: 'stale', computedAt: '2026-07-07T00:00:00.000Z' },
      analysisFreshnessDirty: false,
      showDraftChat: false,
    } as never)
  })

  it('the freshness strip and its Rerun are the ONE stale surface (Wave F-B)', () => {
    render(<OutputsDock />)

    // The old top-level banner is retired — the strip owns stale + Rerun.
    expect(screen.queryByTestId('graph-stale-banner')).not.toBeInTheDocument()
    const strip = screen.getByTestId('analysis-freshness-notice')
    expect(strip).toHaveAttribute('data-freshness', 'stale')
    const rerun = screen.getByTestId('freshness-strip-rerun')
    expect(rerun).toBeInTheDocument()
    expect(rerun).toHaveTextContent('Rerun')
  })

  it('stale: the footer is STATUS-ONLY (C1 — the strip above owns the one Rerun)', () => {
    // RETIRED PIN: this test formerly asserted the footer action rendered
    // alongside the stale strip — two always-visible Reruns in one viewport.
    render(<OutputsDock />)

    expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()
  })

  it('AnalysisFooter action button derives `${testId}-action` (no freshness verdict → footer keeps its Rerun)', () => {
    // With no verdict held the strip renders nothing, so the footer is the
    // tab's only recovery affordance and keeps its action.
    useCanvasStore.setState({ analysisFreshness: null } as never)
    render(<OutputsDock />)

    expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
    expect(screen.getByTestId('results-analysis-footer-action')).toBeInTheDocument()
  })
})

/**
 * OutputsDock harness-testability pins (Lane UI-W5, feature C).
 *
 * Pins the stable selectors the Playwright acceptance harness needs on the
 * Analysis (Results) tab:
 *   - stale banner:        data-testid="graph-stale-banner"        (pre-existing)
 *   - its Rerun button:    data-testid="graph-stale-rerun-button"  (added)
 *   - footer Rerun action: data-testid="results-analysis-footer-action"
 *     (AnalysisFooter now stamps `${testId}-action` on its action button)
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

vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
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
      // CEE 'stale' verdict → graph-stale-banner renders alongside the report
      analysisFreshness: { freshness: 'stale', computedAt: '2026-07-07T00:00:00.000Z' },
      analysisFreshnessDirty: false,
      showDraftChat: false,
    } as never)
  })

  it('stale banner and its Rerun button are reachable via data-testid', () => {
    render(<OutputsDock />)

    expect(screen.getByTestId('graph-stale-banner')).toBeInTheDocument()
    const rerun = screen.getByTestId('graph-stale-rerun-button')
    expect(rerun).toBeInTheDocument()
    expect(rerun).toHaveTextContent('Rerun analysis')
  })

  it('AnalysisFooter action button derives `${testId}-action`', () => {
    render(<OutputsDock />)

    expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
    expect(screen.getByTestId('results-analysis-footer-action')).toBeInTheDocument()
  })
})

/**
 * OutputsDock — ONE Rerun owner per viewport (lane C1).
 *
 * Doctrine (Wave F-B, brief §5 / §2.2): AnalysisFreshnessNotice is the sole
 * freshness owner and carries THE one Rerun; the same action is never
 * repeated across surfaces in one viewport. This spec pins the post-run
 * Analysis-tab matrix:
 *
 *   - stale / unknown / fresh verdict → the strip renders its Rerun and the
 *     sticky AnalysisFooter is STATUS-ONLY (robustness verdict + producer
 *     meta stay; no `results-analysis-footer-action`), and no hero-side
 *     rerun exists anywhere in the tab tree;
 *   - no freshness verdict held (strip renders nothing) → the footer KEEPS
 *     its Rerun action, so the tab never loses its only recovery affordance;
 *   - orphan banner active (V5 canonical flag on, no V5 fact) → the footer
 *     is suppressed under BOTH hero flags (V17 AND analysisHeroPanel), so
 *     the banner's own action can never stack on a footer Rerun.
 *
 * Scaffolding mirrors OutputsDock.testability.spec.tsx (real ResultsBody,
 * stable useConversation stub, aiPanelV2 OFF).
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'

const { mockIsV5CanonicalAnalysisEnabled, mockIsAnalysisHeroV17Enabled, mockIsAnalysisHeroPanelEnabled } =
  vi.hoisted(() => ({
    mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
    mockIsAnalysisHeroV17Enabled: vi.fn(() => false),
    mockIsAnalysisHeroPanelEnabled: vi.fn(() => false),
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
    isTelemetryEnabled: () => false,
    isCompareEnabled: () => true,
    isOrchestratorV2Enabled: () => true,
    isLegacyDirectRunEnabled: () => false,
    isJourneyTabEnabled: () => false,
    // Legacy host path: no <ConversationProvider> needed (useConversation is
    // stubbed below) — the Results-tab surface under test is identical.
    isAiPanelV2Enabled: () => false,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
    isAnalysisHeroV17Enabled: mockIsAnalysisHeroV17Enabled,
    isAnalysisHeroPanelEnabled: mockIsAnalysisHeroPanelEnabled,
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

function seedPostRun(overrides: Record<string, unknown> = {}) {
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
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    v5AnalysisFact: null,
    showDraftChat: false,
    ...overrides,
  } as never)
}

describe('OutputsDock — one Rerun owner per viewport (C1)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.clear()
    } catch {
      /* jsdom quirk — never block the suite */
    }
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
    mockIsAnalysisHeroV17Enabled.mockReturnValue(false)
    mockIsAnalysisHeroPanelEnabled.mockReturnValue(false)
  })

  it.each(['stale', 'unknown'] as const)(
    'CEE %s verdict: the strip Rerun is the ONLY rerun control — footer is status-only, no hero rerun',
    (freshness) => {
      mockIsAnalysisHeroPanelEnabled.mockReturnValue(true)
      seedPostRun({
        analysisFreshness: { freshness, computedAt: '2026-07-15T00:00:00.000Z' },
      })
      render(<OutputsDock />)

      // The strip owns recovery — its Rerun renders.
      expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', freshness)
      expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()

      // No hero-side rerun anywhere in the tab tree (v6: the hero has no
      // stale affordance of its own).
      expect(screen.queryByTestId('hero-rerun')).not.toBeInTheDocument()

      // The footer keeps its robustness STATUS but drops its Rerun action.
      expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
      expect(screen.getByTestId('results-analysis-footer')).toHaveTextContent('Robustness unknown')
      expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()

      // Exactly ONE always-visible rerun control in the whole tab tree.
      expect(screen.getAllByRole('button', { name: /rerun|re-run/i })).toHaveLength(1)
    },
  )

  it('fresh verdict: strip Rerun (parity: rerun is always legitimate) + status-only footer', () => {
    seedPostRun({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    })
    render(<OutputsDock />)

    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'fresh')
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
    expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()
  })

  it('local dirty overlay (fresh downgraded to unknown): still one owner — footer stays status-only', () => {
    seedPostRun({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
      analysisFreshnessDirty: true,
    })
    render(<OutputsDock />)

    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'unknown')
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()
  })

  it('NO freshness verdict held: the strip renders nothing and the footer KEEPS its Rerun (no affordance loss)', () => {
    seedPostRun({ analysisFreshness: null })
    render(<OutputsDock />)

    // The strip never asserts a freshness state it does not hold.
    expect(screen.queryByTestId('analysis-freshness-notice')).not.toBeInTheDocument()
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()

    // Existing footer affordance preserved — it is the tab's only recovery.
    const action = screen.getByTestId('results-analysis-footer-action')
    expect(action).toBeInTheDocument()
    expect(action).toHaveTextContent('Rerun')
  })

  it('orphan banner + analysisHeroPanel flag: the footer is suppressed (4-CTA corner case closed)', () => {
    // V5 canonical flag on with a report but NO v5 fact → orphan banner.
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsAnalysisHeroPanelEnabled.mockReturnValue(true)
    mockIsAnalysisHeroV17Enabled.mockReturnValue(false)
    seedPostRun({
      analysisFreshness: { freshness: 'stale', computedAt: 1 },
      v5AnalysisFact: null,
    })
    render(<OutputsDock />)

    expect(screen.queryByTestId('results-analysis-footer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('results-analysis-footer-action')).not.toBeInTheDocument()
  })

  it('orphan banner + V17 flag: existing suppression unchanged', () => {
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsAnalysisHeroV17Enabled.mockReturnValue(true)
    seedPostRun({
      analysisFreshness: { freshness: 'stale', computedAt: 1 },
      v5AnalysisFact: null,
    })
    render(<OutputsDock />)

    expect(screen.queryByTestId('results-analysis-footer')).not.toBeInTheDocument()
  })

  it('orphan banner with BOTH hero flags off: legacy path unaffected — footer still renders', () => {
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    seedPostRun({
      analysisFreshness: { freshness: 'stale', computedAt: 1 },
      v5AnalysisFact: null,
    })
    render(<OutputsDock />)

    expect(screen.getByTestId('results-analysis-footer')).toBeInTheDocument()
  })
})

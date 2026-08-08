/**
 * OutputsDock — the bottom anchor keeps the run-analysis control (Paul, 21-Jul).
 *
 * Paul's finding: opening the canvas onto a completed analysis, "the bottom
 * anchor panel shows the robustness verdict ('Ranking sensitive to assumptions…') in
 * the slot where the RUN-ANALYSIS control should be — instead of the
 * functionality to run the analysis."
 *
 * Root cause: the post-run AnalysisFooter (the sticky bottom anchor) dropped
 * its Rerun action in every held-verdict state (`freshnessStripOwnsRerun`),
 * yielding the recovery affordance to the top freshness strip and leaving the
 * anchor showing ONLY the robustness verdict.
 *
 * Fix (ownership relocated to the anchor): the always-visible bottom footer is
 * the SOLE Rerun owner in every post-run state — it renders the robustness
 * verdict AND the Rerun action, ALONGSIDE each other, never verdict-in-place-
 * of-control. The freshness strip stays (it still states fresh/stale/unknown)
 * but no longer carries a Rerun button, so there is never a duplicate.
 *
 * This is the anti-regression pin for the anchor-run-control fix. The broader
 * one-owner matrix lives in OutputsDock.rerunSingleOwner.spec.tsx.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { collectRerunControls } from '../../../../tests/helpers/rerunControls'

const { mockIsV5CanonicalAnalysisEnabled, mockIsAnalysisHeroV17Enabled, mockIsAnalysisHeroPanelEnabled } =
  vi.hoisted(() => ({
    mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
    mockIsAnalysisHeroV17Enabled: vi.fn(() => false),
    mockIsAnalysisHeroPanelEnabled: vi.fn(() => false),
  }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
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
    isAiPanelV2Enabled: () => false,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
    isAnalysisHeroV17Enabled: mockIsAnalysisHeroV17Enabled,
    isAnalysisHeroPanelEnabled: mockIsAnalysisHeroPanelEnabled,
  }
})

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() }),
}))

vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    isThinking: false,
    longRunningHint: null,
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

vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => null }))
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

// robustness.recommendation_stability 0.42 → a display-safe 'fragile'/'moderate'
// verdict → the "Ranking sensitive to assumptions" footer label Paul reported. The exact
// verdict token is derived upstream; the point of THIS pin is that whatever the
// verdict, the anchor also carries the run control.
const fakeReport: Record<string, unknown> = {
  results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 10, p50: 20, p90: 30 } },
  robustness: { recommendation_stability: 0.42 },
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

const SCROLLER_RE = /overflow-y-auto|overflow-y-scroll|(^|\s)overflow-auto(\s|$)/
const classOf = (el: Element) => el.getAttribute('class') ?? ''

/** Walk up to the nearest scrolling ancestor (null when outside every scroller). */
function nearestScroller(control: Element): Element | null {
  let node: Element | null = control.parentElement
  while (node && node !== document.body) {
    if (SCROLLER_RE.test(classOf(node))) return node
    node = node.parentElement
  }
  return null
}

describe('OutputsDock — the bottom anchor keeps the run-analysis control (anchor-run-control)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.clear()
    } catch {
      /* jsdom quirk */
    }
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
    mockIsAnalysisHeroV17Enabled.mockReturnValue(false)
    mockIsAnalysisHeroPanelEnabled.mockReturnValue(false)
  })

  // The exact state Paul hit: a completed run, freshness confirmed 'fresh'. The
  // old code made THIS the state where the footer showed the verdict and NO
  // action (freshnessStripOwnsRerun === true for a held 'fresh' verdict).
  it("fresh post-run (Paul's repro): the anchor shows the verdict AND a Rerun control", () => {
    seedPostRun({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    })
    render(<OutputsDock />)

    const footer = screen.getByTestId('results-analysis-footer')
    // The robustness verdict still lives in the anchor (never removed)…
    expect(footer).toHaveTextContent(/Ranking sensitive to assumptions|Stable ranking|Robustness/)
    // …ALONGSIDE the run control, not in place of it.
    const action = screen.getByTestId('results-analysis-footer-action')
    expect(action).toBeInTheDocument()
    expect(action).toHaveTextContent('Rerun')

    // The freshness strip no longer carries its own Rerun — no duplicate.
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()

    // Exactly ONE rerun control in the whole tab, and it is the anchor's.
    expect([...collectRerunControls(document.body as HTMLElement)]).toEqual([action])

    // The anchor sits OUTSIDE the scroller — always visible without a pin.
    expect(nearestScroller(action)).toBeNull()
  })

  it.each(['stale', 'unknown'] as const)(
    '%s post-run: the anchor still owns the one Rerun (verdict + control together)',
    (freshness) => {
      seedPostRun({ analysisFreshness: { freshness, computedAt: '2026-07-15T00:00:00.000Z' } })
      render(<OutputsDock />)

      const action = screen.getByTestId('results-analysis-footer-action')
      expect(action).toBeInTheDocument()
      expect(action).toHaveTextContent('Rerun')
      expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
      expect([...collectRerunControls(document.body as HTMLElement)]).toEqual([action])
    },
  )

  it('orphaned result (canonical flag on, no v5 fact): the anchor owns the one Rerun', () => {
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    seedPostRun({ analysisFreshness: { freshness: 'stale', computedAt: 1 }, v5AnalysisFact: null })
    render(<OutputsDock />)

    const action = screen.getByTestId('results-analysis-footer-action')
    expect(action).toBeInTheDocument()
    // The strip still communicates freshness, but carries no Rerun.
    expect(screen.getByTestId('analysis-freshness-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
    expect([...collectRerunControls(document.body as HTMLElement)]).toEqual([action])
  })
})

/**
 * "Stable ranking" only where the Run's licence supports a stability statement.
 *
 * ⚠ WITNESSED ON THE SERVED BUILD (PL #94 6135017311; capture
 * `live/runs/2026-10-14T201048Z-legacy-e2e-de659cfd-ffb2b138/legacy`): the run's
 * admission was `quantified_provisional` (`USER_STATED_PARAMETERS_NOT_MATERIAL`),
 * `leader_licence: withheld`, PLoT `display_verdict: robust` — and the dock's
 * post-run footer read "Stable ranking". The footer read PLoT's verdict alone;
 * the one authority for a strength word, `analysisClaimPolicy(rec)
 * .mayStateStability`, was never asked.
 *
 * ⭐ ONE VARIABLE. Every arm is the same report; only the run's own admission
 * mode differs. The licensed arm is the positive control: it proves the fixture
 * reaches the footer with a robust verdict, so the withheld arms observe a
 * SUPPRESSION rather than a fixture that never delivered one.
 *
 * Bound by testid to the surfaces the dock mounts on the Analysis tab: the
 * post-run `results-analysis-footer` and the receipts row
 * `receipt-result-stability` inside "Advanced and receipts".
 */

import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { derivePostFooterStatus } from '../utils/postAnalysisFooter'
import { seedDockOnAnalysisTab } from './helpers/dockTabFixture'
import type { PermittedAnalysisMode } from '../../../adapters/cee/types'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isJourneyTabEnabled: () => false,
    isAiPanelV2Enabled: () => false,
  }
})

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

const OPTION_A = 'opt_hire'
const OPTION_B = 'opt_carry_on'
/** The producer's sentence, verbatim from the served capture (turns/07.json). */
const PRODUCER_REASON = 'this run held up under the changes we tested'
/** Derived from the same helper the component uses, never retyped. */
const STABLE = derivePostFooterStatus('robust', true).label
const NOT_ESTABLISHED = derivePostFooterStatus('robust', false).label

const reportFor = (mode: PermittedAnalysisMode): Record<string, unknown> => ({
  results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 10, p50: 20, p90: 30 } },
  option_probabilities: {
    [OPTION_A]: { win_probability: 0.9 },
    [OPTION_B]: { win_probability: 0.1 },
  },
  robustness: {
    recommendation_stability: 0.9,
    near_tie: { is_tie: false, top_option_id: OPTION_A },
    display_verdict: 'robust',
    display_verdict_reason: PRODUCER_REASON,
  },
  run_analysis_admission: { permitted_analysis_mode: mode, reasons: [] },
})

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

function seedPostRun(mode: PermittedAnalysisMode) {
  useCanvasStore.setState({
    currentScenarioFraming: null,
    currentScenarioLastResultHash: null,
    hasCompletedFirstRun: true,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: OPTION_A, type: 'option', data: { label: 'Add two developers', kind: 'option' }, position: { x: 50, y: 0 } },
      { id: OPTION_B, type: 'option', data: { label: 'Carry on as now', kind: 'option' }, position: { x: 90, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 130, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    results: { status: 'complete', report: reportFor(mode) },
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    analysisFreshnessDirty: false,
    v5AnalysisFact: null,
    showDraftChat: false,
  } as never)
}

const footer = () => {
  const el = screen.queryByTestId('results-analysis-footer')
  expect(el, 'the post-run footer did not mount — every assertion below would be vacuous').toBeTruthy()
  return el as HTMLElement
}

/** Open "Advanced and receipts" and return its stability receipt row. */
const receiptRow = () => {
  const accordion = screen.getByTestId('accordion-advanced')
  fireEvent.click(within(accordion).getByText('Advanced and receipts'))
  return screen.getByTestId('receipt-result-stability')
}

beforeEach(() => {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
    seedDockOnAnalysisTab()
  } catch {
    /* jsdom quirk */
  }
})
afterEach(() => cleanup())

describe('the stability label follows the Run\'s licence, not PLoT\'s verdict alone', () => {
  it('CONTROL: a comparative_leader run with a robust verdict says "Stable ranking" on the footer and the receipt', () => {
    seedPostRun('comparative_leader')
    render(<OutputsDock />)

    expect(within(footer()).getByText(STABLE)).toBeInTheDocument()
    expect(footer().textContent).toContain(PRODUCER_REASON)
    expect(receiptRow()).toHaveTextContent(STABLE)
  })

  it.each<PermittedAnalysisMode>(['quantified_provisional', 'exploratory', 'none'])(
    '⛔ a %s run with a robust verdict states no ranking verdict anywhere on the tab',
    (mode) => {
      seedPostRun(mode)
      render(<OutputsDock />)

      expect(footer().textContent).not.toContain(STABLE)
      expect(within(footer()).getByText(NOT_ESTABLISHED)).toBeInTheDocument()
      // The producer's reason is the same claim in its own words.
      expect(footer().textContent).not.toContain(PRODUCER_REASON)
      expect(receiptRow()).toHaveTextContent(NOT_ESTABLISHED)
      expect(document.body.textContent).not.toContain(STABLE)
      expect(document.body.textContent).not.toContain('Ranking sensitive to assumptions')
    },
  )
})

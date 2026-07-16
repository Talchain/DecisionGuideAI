/**
 * Issue #353 — a bands-less hydrated report must not hard-crash the canvas.
 *
 * Live repro (2026-07-15, PR #352 browser acceptance): a Supabase-hydrated
 * report carrying only `option_comparison`/`option_probabilities` — no
 * `results` bands block, no `run.bands` — threw
 * `Cannot read properties of undefined (reading 'likely')` at
 * OutputsDock.tsx:1131 (`report?.results.likely` guards `report` but not
 * `.results`) and took the whole canvas down to the error-boundary screen.
 *
 * The hydration invariant (`resultsHydrateFromSupabase`) checks ONLY
 * `status === 'complete' && report` — nothing upstream guarantees the bands
 * block, so the dock must fail closed at the read: `mostLikelyValue`
 * becomes null (the same honest absent treatment the neighbouring
 * `verdict = mostLikelyValue !== null ? … : null` already takes), never a
 * fabricated value, never a throw.
 *
 * Harness mirrors OutputsDock.rerunContinuity.spec.tsx (proven to mount
 * OutputsDockBody, where line 1131 executes unconditionally). ResultsBody is
 * stub-mocked so this spec pins exactly the dock-owned read, not descendant
 * readers (which were verified guarded — see PR body).
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { ConversationProvider } from '../../conversation/ConversationContext'

const { mockUseV2Run, mockShowToast } = vi.hoisted(() => ({
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
    isV5CanonicalAnalysisEnabled: vi.fn(() => false),
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

/**
 * The exact defect shape from #353: a real hydrated report with NO `results`
 * block and NO `run.bands` — only the option-level blocks the live repro
 * carried. Do not "complete" this fixture: its incompleteness IS the pin.
 */
const bandslessHydratedReport: Record<string, unknown> = {
  schema: 'report.v1',
  meta: { seed: null, response_id: 'resp-353', elapsed_ms: 1200 },
  model_card: { response_hash: 'hash-353', response_hash_algo: 'sha256', normalized: true },
  option_probabilities: {
    'opt-a': { goal_probability: 0.62, confidence: 0.8, win_probability: 0.7 },
    'opt-b': { goal_probability: 0.41, confidence: 0.75, win_probability: 0.3 },
  },
  option_comparison: [
    { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.7 },
    { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.3 },
  ],
}

function seedGraph() {
  useCanvasStore.setState({
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'A', interventions: {} }] },
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

describe('OutputsDock bands-less hydrated report (#353)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
    seedGraph()
  })

  afterEach(() => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
    } as never)
  })

  it('POSITIVE CONTROL: the hydration invariant ADMITS the bands-less report (nothing upstream guarantees the bands block)', () => {
    act(() => {
      useCanvasStore.getState().resultsHydrateFromSupabase({
        results: { status: 'complete', progress: 100, report: bandslessHydratedReport },
        runMeta: {},
      } as never)
    })

    const { results } = useCanvasStore.getState()
    expect(results.status).toBe('complete')
    expect(results.report).toBe(bandslessHydratedReport)
    // The defect precondition, asserted so this spec fails loud if a future
    // upstream guarantee makes the render-side pin vacuous.
    expect((results.report as unknown as Record<string, unknown>).results).toBeUndefined()
    expect((results.report as unknown as Record<string, unknown>).run).toBeUndefined()
  })

  it('renders the dock WITHOUT throwing on the bands-less report, keeping the results body mounted (fail closed, no fabricated value)', () => {
    act(() => {
      useCanvasStore.getState().resultsHydrateFromSupabase({
        results: { status: 'complete', progress: 100, report: bandslessHydratedReport },
        runMeta: {},
      } as never)
    })

    // Pre-fix this throws `Cannot read properties of undefined (reading
    // 'likely')` from OutputsDock.tsx:1131 — the whole-canvas crash of #353.
    expect(() => renderDock()).not.toThrow()

    // The honest treatment: the body stays mounted (retained-report
    // contract), it does not blank or fall back to the pre-analysis panel.
    expect(screen.getByTestId('results-body-stale-wrapper')).toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-stub')).not.toBeInTheDocument()
  })
})

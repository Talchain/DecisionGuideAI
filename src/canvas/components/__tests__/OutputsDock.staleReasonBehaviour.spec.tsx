/**
 * THE BEHAVIOURAL PIN FOR THE STALE SENTENCE — what the syntactic pin in
 * `analysisNew/__tests__/staleReason.spec.ts` structurally cannot see.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * That pin was hardened over four review rounds against attacks on the
 * IDENTIFIER: an alias import, an import never called, a local shadow, a
 * re-export shim at a matching path. An independent reviewer then walked past
 * all four by changing the ARGUMENT, which is what this PR actually changes:
 *
 *   const analysisStaleReason = staleReasonFromTrustSemantic(displayedFreshness)
 *
 * `'changed'` is not a member of `AnalysisFreshnessValue`, so the panel returns
 * `'unconfirmed'` unconditionally and renders "We cannot confirm whether this
 * analysis reflects the current model." forever — beside a footer four inches
 * away saying "Model changed. Results may be out of date." That is the exact
 * on-screen contradiction this change was written to close, and it shipped past
 * typecheck, eslint and **2,682 green tests**.
 *
 * A syntactic pin on a callee can never see the callee's INPUTS, and the input
 * is the fix. This renders the real dock instead.
 *
 * ── THE STATE, DERIVED AT THE BYTES RATHER THAN CHOSEN ──────────────────────
 *
 * `{ freshness: 'fresh', dirty: true, importHold: false }`:
 *   · `resolveDisplayedFreshness` → 'unknown'  (fresh + dirty, analysisFreshness.ts)
 *   · `classifyFreshnessForDisplay` → 'changed' (dirty && freshness === 'fresh')
 *
 * So `displayedFreshness === 'unknown'` while `semantic === 'changed'` — the one
 * place the two authorities give different answers, and therefore the only
 * state that can discriminate between them. It is not a contrived fixture: it
 * is a user who has edited a value on the canvas since the run, which
 * `staleReason.ts`'s own header names as the reachable defect.
 *
 * Under the fix the panel must say the model CHANGED. Under any of the defects
 * — the pre-PR call, the argument substitution, a discarded result — it says it
 * cannot confirm. One assertion separates all of them.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'
import {
  classifyFreshnessForDisplay,
  resolveDisplayedFreshness,
} from '../../store/analysisFreshness'
import type { AnalysisFreshnessState } from '../../store/analysisFreshness'

const {
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockShowToast,
} = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
  mockIsV5Eligible: vi.fn((_input?: { flag: string | undefined }) => ({ eligible: false, reason: 'flag_off' })),
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

vi.mock('../../ToastContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ToastContext')>()
  return {
    ...actual,
    useShowToast: () => mockShowToast,
    useShowToastSafe: () => mockShowToast,
  }
})

vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({ usePreAnalysisData: () => ({}) }))
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" /> }))
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})
vi.mock('../../../components/results/ResultsBody', () => ({
  ResultsBody: () => <div data-testid="mock-results-body" />,
}))
// ⚠ `AnalysisNewTabBody` is DELIBERATELY NOT MOCKED. It is the consumer under
// test — the whole point is that the value the dock computes reaches the
// sentence it renders.

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

/**
 * CEE says fresh; the user has edited since. See the header for the derivation.
 *
 * ⚠ TYPED, NOT CAST. The first cut wrote `computedAt: 1` and the typecheck
 * ratchet caught it: `computedAt` is an ISO TIMESTAMP STRING. A fixture reached
 * only through `setState(… as never)` would have hidden that — this one is
 * passed to the real functions, so the compiler gets to check it, and the
 * annotation is what makes it do so.
 */
const FRESH_VERDICT: AnalysisFreshnessState = {
  freshness: 'fresh',
  freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-05T00:00:00.000Z',
}

/** CEE could not tell, and nothing was edited — an absence, never a change. */
const UNKNOWN_VERDICT: AnalysisFreshnessState = {
  freshness: 'unknown',
  freshnessReason: 'cee_unknown',
  computedAt: '2026-09-05T00:00:00.000Z',
}

function seedEditedSinceRun() {
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
    analysisFreshness: FRESH_VERDICT,
    analysisFreshnessDirty: true,
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

function frontedTab(): string | null {
  const selected = document.querySelector('[role="tab"][aria-selected="true"]')
  return selected?.getAttribute('data-testid')?.replace('outputs-dock-tab-', '') ?? null
}

function frontAndAssert(tab: 'analysisNew' | 'results') {
  if (frontedTab() !== tab) {
    act(() => { screen.getByTestId(`outputs-dock-tab-${tab}`).click() })
  }
  expect(frontedTab()).toBe(tab)
}

describe('the Reasoning tab says the model CHANGED, not that it cannot tell', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    sessionStorage.clear()
    useUIStore.setState({ activeRightPanel: null } as never)
  })

  afterEach(() => {
    sessionStorage.clear()
    useUIStore.setState({ activeRightPanel: null } as never)
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 },
      hasCompletedFirstRun: false,
      analysisFreshness: null,
      analysisFreshnessDirty: false,
    } as never)
  })

  /**
   * ⭐ THE PRECONDITION, AND WITHOUT IT THE TEST BELOW IS A TAUTOLOGY.
   *
   * The whole discriminating power of this file rests on the two authorities
   * giving DIFFERENT answers on this state. If a future change to
   * `analysisFreshness.ts` made them agree, the behavioural assertion would
   * still pass while distinguishing nothing at all — trap 13b, a guard whose
   * power depends on an unpinned fixture. This asserts the disagreement itself,
   * from the real functions, before anything is rendered.
   */
  it('the seeded state really is one where the two authorities disagree', () => {
    const displayed = resolveDisplayedFreshness(FRESH_VERDICT, true)
    const semantic = classifyFreshnessForDisplay(FRESH_VERDICT, true, false)
    expect(displayed, 'the dock\'s displayed freshness on this state').toBe('unknown')
    expect(semantic, 'the composed trust semantic on the SAME state').toBe('changed')
    expect(
      displayed === semantic,
      'if these ever agree, this file discriminates nothing and must be re-derived',
    ).toBe(false)
    // …and the state must also be one the panel renders a freshness line on at
    // all: `analysisNotConfirmedFresh` is `stale || unknown`.
    expect(displayed === 'stale' || displayed === 'unknown').toBe(true)
  })

  it('renders the CHANGED sentence when the user has edited since the run', () => {
    seedEditedSinceRun()
    sessionStorage.setItem(
      OUTPUTS_DOCK_STORAGE_KEY,
      JSON.stringify({ isOpen: true, activeTab: 'analysisNew' }),
    )
    renderDock()
    frontAndAssert('analysisNew')

    expect(
      screen.queryByTestId('analysis-new-status-stale'),
      'the panel must state the change the footer beside it is already stating — ' +
        'reading the DISPLAYED FRESHNESS here yields "unknown", and every defect ' +
        'in this family (the pre-PR call, an argument substitution, a discarded ' +
        'result) lands on the cannot-confirm sentence instead',
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('analysis-new-status-freshness-unknown'),
      'and it must not ALSO hedge — the two sentences answer one question',
    ).not.toBeInTheDocument()
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. Without it, the fix could be
   * `() => 'changed'` — asserting a change from an absence of evidence, which is
   * the defect `staleReason.ts` exists to forbid — and the case above would
   * still pass.
   */
  it('still hedges when the authority itself cannot confirm', () => {
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
      // A CEE-STATED 'unknown' with no local edit: the server said it could not
      // tell and the user has changed nothing. `classifyFreshnessForDisplay`
      // returns 'cannot_confirm' — an absence of evidence, never a change.
      analysisFreshness: UNKNOWN_VERDICT,
      analysisFreshnessDirty: false,
      showDraftChat: false,
    } as never)
    // PRECONDITION: this state's semantic is NOT 'changed', so a pass below is
    // the code's doing and not the fixture's.
    expect(classifyFreshnessForDisplay(UNKNOWN_VERDICT, false, false)).not.toBe('changed')

    sessionStorage.setItem(
      OUTPUTS_DOCK_STORAGE_KEY,
      JSON.stringify({ isOpen: true, activeTab: 'analysisNew' }),
    )
    renderDock()
    frontAndAssert('analysisNew')

    expect(
      screen.queryByTestId('analysis-new-status-freshness-unknown'),
      'a change must never be asserted from an absence of evidence',
    ).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-status-stale')).not.toBeInTheDocument()
  })
})

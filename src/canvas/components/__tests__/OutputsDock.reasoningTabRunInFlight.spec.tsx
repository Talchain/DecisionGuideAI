/**
 * UI #1198 — the Reasoning tab must SHOW a run that is in flight.
 *
 * ── THE DEFECT, DERIVED RATHER THAN OBSERVED ────────────────────────────────
 *
 * `AnalysisRunStateCover` is, in its own words, "the shared in-flight treatment
 * for dock surfaces OUTSIDE the Analysis tab". Compare (`CompareTabBody:231`),
 * Model (`ModelTabBody:888`) and the coaching panel (`CoachingPanel:64`) all
 * adopt it. The Reasoning tab — added later, 27 Aug 2026 — never did, so
 * dispatching a run with it fronted changed NOTHING on screen: the precise
 * situation the cover was built for, on the one surface that skipped it.
 *
 * ⚠ AND THE REACHABLE PATH IS THE TAB'S OWN PRIMARY CONTROL, not an edge case.
 * The dock auto-switches to `results` on run start ONLY when the previous
 * status was idle/cancelled (`OutputsDock` auto-switch effect: `wasInactive`).
 * A RE-RUN from a completed state does not qualify — so a user who presses this
 * tab's own "Re-analyse" stays here, and watched a full past-tense report sit
 * still for the whole run.
 *
 * ⚠ IT WAS NOT SILENT FOR EVERYONE, AND THAT IS THE SHARP PART. The dock-level
 * `AnalysisRunAnnouncer` yields only when the *Analysis* tab is fronted, so on
 * this tab it announced "Analysis started." — assistive tech was told and a
 * sighted user was not. The fix is therefore VISUAL ONLY, and adding a second
 * live region here would be a regression, not an improvement. That is why the
 * cover mounts the banner with `announces={false}` and why the fourth test
 * below pins it.
 *
 * ── WHY THESE FIVE TESTS AND NOT ONE ────────────────────────────────────────
 *
 * A single "the banner appears" assertion would pass for at least three wrong
 * reasons: the auto-switch could have moved us to `results` and we would be
 * measuring THAT branch's long-standing banner; the retained/empty split could
 * be inverted; and the live-region rule could regress silently. Each of those
 * gets its own test, and the precondition test exists so a future change to the
 * auto-switch rule REDs here loudly instead of quietly relocating what this
 * file measures.
 *
 * Harness mirrors `OutputsDock.announcerPlacement.spec.tsx` (real dock, real
 * canvas store, stubbed heavy children) — same file, same directory, so the two
 * run-narration suites cannot drift apart in their setup.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'

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

/**
 * ⚠ THE TAB BODY IS STUBBED ON PURPOSE, AND IT DOES NOT WEAKEN THE TEST.
 * The cover is a SIBLING of the body inside the dock's `analysisNew` branch,
 * so what is measured here is the MOUNT PATH — the thing that was missing —
 * and not anything the body renders. Stubbing also keeps this suite from
 * failing for reasons that belong to the body's own specs.
 */
vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({
  AnalysisNewTabBody: () => <div data-testid="mock-analysis-new-body" />,
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

/** A completed first run, retained on screen — the re-run precondition. */
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

/** No run has ever completed — nothing to retain. */
function seedNeverRun() {
  const baseResults = useCanvasStore.getState().results
  useCanvasStore.setState({
    hasCompletedFirstRun: false,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
    ],
    edges: [],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    ceeAnalysisReady: { goal_node_id: 'goal-1', options: [{ id: 'opt-a', label: 'A', interventions: {} }] },
    results: { ...baseResults, status: 'idle', progress: 0, report: undefined },
    showDraftChat: false,
  } as never)
}

function frontTab(tab: 'analysisNew' | 'results') {
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: tab }))
}

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

function startRun() {
  act(() => { useCanvasStore.getState().resultsStart({ seed: 42 }) })
}

/** The tab actually fronted right now, read from the live tablist. */
function frontedTab(): string | null {
  const selected = document.querySelector('[role="tab"][aria-selected="true"]')
  return selected?.getAttribute('data-testid')?.replace('outputs-dock-tab-', '') ?? null
}

/**
 * ⭐ FRONT A TAB AND PROVE IT.
 *
 * The dock's tab state outlives a render within one file, so seeding
 * `sessionStorage` does not by itself decide which branch a test measures —
 * and the WRONG branch here is `results`, which has had its own banner since
 * Wave1-L2. A test that queried `analysis-running-banner` while sitting on the
 * Analysis tab would pass with this fix reverted. Every test therefore fronts
 * by CLICK and asserts, so the object under test is bound by identity rather
 * than by whatever the previous test left behind.
 */
function frontAndAssert(tab: 'analysisNew' | 'results') {
  if (frontedTab() !== tab) {
    act(() => { screen.getByTestId(`outputs-dock-tab-${tab}`).click() })
  }
  expect(frontedTab()).toBe(tab)
}

/**
 * A contract-valid `AnalysisStateV1`, built through the REAL parser exactly as
 * `analysisStateSelector.spec.ts` does. Hand-casting it would let this suite
 * assert behaviour over a payload no producer could send.
 */
function wireVerdict(over: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  const parsed = AnalysisStateV1Schema.safeParse({
    run_state: { kind: 'complete_current', computed_at: '2026-08-16T10:00:00.000Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  })
  if (!parsed.success) {
    throw new Error(`fixture does not satisfy AnalysisStateV1: ${JSON.stringify(parsed.error.issues)}`)
  }
  return parsed.data
}

describe('the Reasoning tab shows a run in flight (#1198)', () => {
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
    } as never)
  })

  /**
   * ⭐ THE PRECONDITION, PINNED IN-TEST AND RUN FIRST.
   *
   * Every other test in this file is a statement about the `analysisNew`
   * branch. If a run silently relocated the user to `results`, they would all
   * still pass — against the OTHER tab's banner, which has been there since
   * Wave1-L2. This asserts the situation the suite claims to be measuring.
   */
  it('a re-run does not move the user off the Reasoning tab', () => {
    seedCompletedRun()
    frontTab('analysisNew')
    renderDock()
    frontAndAssert('analysisNew')
    startRun()
    expect(
      frontedTab(),
      'The auto-switch fires only from idle/cancelled. If this RED, the re-run ' +
        'path changed and every assertion in this file is now about the wrong branch.',
    ).toBe('analysisNew')
    // …and the body under test really is the Reasoning tab's.
    expect(screen.getByTestId('mock-analysis-new-body')).toBeInTheDocument()
  })

  it('a re-run started from the Reasoning tab is shown on the Reasoning tab', () => {
    seedCompletedRun()
    frontTab('analysisNew')
    renderDock()
    frontAndAssert('analysisNew')
    // PRECONDITION: nothing is narrating before the run starts, so a pass
    // below cannot come from furniture that was already on screen.
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    startRun()
    expect(
      screen.getByTestId('analysis-running-banner'),
      'A run dispatched from this tab changed nothing on screen. Compare, Model ' +
        'and the coaching panel all mount AnalysisRunStateCover for exactly this.',
    ).toBeInTheDocument()
  })

  it('the run treatment is VISUAL only — the dock announcer stays the single voice', () => {
    seedCompletedRun()
    frontTab('analysisNew')
    renderDock()
    frontAndAssert('analysisNew')
    startRun()
    const banner = screen.getByTestId('analysis-running-banner')
    // PRECONDITION: the announcer is mounted, so "exactly one" is a real count
    // and not an artefact of nothing being there.
    expect(screen.getByTestId('analysis-run-announcer')).toBeInTheDocument()
    expect(
      banner.getAttribute('role'),
      'The banner must mount with announces={false} here. The dock-level ' +
        'announcer already speaks on this tab (it yields only for `results`), ' +
        'so a live region here announces the same run twice.',
    ).toBeNull()
    expect(banner.getAttribute('aria-live')).toBeNull()
  })

  /**
   * ⚠ THE FIRST-RUN PATH IS DIFFERENT, AND THE FIRST CUT OF THIS TEST GOT IT
   * WRONG — usefully. It seeded a never-run state, fronted this tab, started a
   * run and looked for the skeleton. It RED'd because a FIRST run DOES trip the
   * auto-switch (`wasInactive` is true from `idle`), so the assertion was being
   * made against the `results` branch. The reachable way to be here with nothing
   * retained is to come BACK mid-run, which is what this now drives — and the
   * auto-switch is asserted on the way through rather than assumed, so if that
   * rule ever changes this test says so instead of quietly moving.
   */
  it('with no completed run to retain, the Reasoning tab shows the skeleton, not the banner', () => {
    seedNeverRun()
    frontTab('analysisNew')
    renderDock()
    frontAndAssert('analysisNew')
    startRun()
    // PRECONDITION: a FIRST run does move the user — unlike the re-run above.
    expect(
      frontedTab(),
      'A first run should auto-switch to `results` (wasInactive from idle). If ' +
        'this RED, the return-to-this-tab step below is measuring nothing.',
    ).toBe('results')
    act(() => { screen.getByTestId('outputs-dock-tab-analysisNew').click() })
    expect(frontedTab()).toBe('analysisNew')
    expect(screen.getByTestId('analysis-run-skeleton')).toBeInTheDocument()
    expect(
      screen.queryByTestId('analysis-running-banner'),
      'Retained/empty must not be inverted: a banner "above the retained report" ' +
        'with no report is a frame around nothing.',
    ).not.toBeInTheDocument()
  })

  /**
   * ⭐ THE DISCRIMINATING CONTROL. This one passes BEFORE the fix as well as
   * after: it is here so a change that moves the Analysis tab's own narration
   * while adding this tab's REDs, rather than trading one silence for another.
   */
  /**
   * ⭐⭐ THE TEST THAT SEPARATES THE TWO AUTHORITIES — and the reason the mount
   * reads `useAnalysisTrust()` rather than the dock's local `isRunning`.
   *
   * The first cut of this fix fed the cover from the dock's local derivation
   * (`resultsStatus` ∈ preparing/connecting/streaming) on the reasoning that it
   * avoided a second run-state source at one call site. That was backwards, and
   * every test above passed with EITHER implementation — so the correction had
   * no guard until this one existed.
   *
   * `analysisStateSelector.ts:477-500` states the rule: running is a
   * DISJUNCTION of the local slice and the wire's `run_state.kind === 'running'`,
   * because the two sources know different things and neither may veto the
   * other. A wire-asserted run with no local run is precisely the case the
   * local-only read cannot see — and it is the case that produced the measured
   * F9 defect. Compare, Model and the coaching panel all read the trust pair;
   * this asserts the Reasoning tab is not the one surface that cannot.
   */
  it('a run the WIRE asserts is shown here too, with no local run in flight', () => {
    seedCompletedRun()
    frontTab('analysisNew')
    renderDock()
    frontAndAssert('analysisNew')
    // PRECONDITION 1: no local run — `results.status` stays 'complete', so the
    // dock's own `isRunning` is false and cannot be what makes this pass.
    expect(useCanvasStore.getState().results.status).toBe('complete')
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    act(() => {
      useCanvasStore.setState({
        analysisStateV1: wireVerdict({
          run_state: { kind: 'running', started_at: '2026-08-16T09:30:00.000Z' },
        }),
      } as never)
    })
    // PRECONDITION 2: still no local run after the wire verdict lands.
    expect(useCanvasStore.getState().results.status).toBe('complete')
    expect(
      screen.getByTestId('analysis-running-banner'),
      'The wire says a run is in flight and this surface did not show it. That ' +
        'is the local-only read: it sees `resultsStatus` and nothing else.',
    ).toBeInTheDocument()
  })

  it('the Analysis tab keeps its own run narration', () => {
    seedCompletedRun()
    frontTab('results')
    renderDock()
    frontAndAssert('results')
    startRun()
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
  })
})

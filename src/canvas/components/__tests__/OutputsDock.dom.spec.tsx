 import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { STORAGE_KEY as RUN_HISTORY_STORAGE_KEY } from '../../store/runHistory'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../../lib/telemetry'
import { useGuidanceStore } from '../../stores/guidanceStore'
// 34edc1fd ("conversation singleton + explicit first-use submit signal",
// 2026-05-19) made OutputsDockProviderHost consume useConversationContext,
// which throws outside a <ConversationProvider>. aiPanelV2 defaults ON, so
// OutputsDock() takes the provider branch. This spec was dead when that
// requirement landed and so still rendered <OutputsDock /> bare. Wrapper
// matches the established pattern in OutputsDock.analysis-run.spec.tsx /
// OutputsDock.conversationSingleton.spec.tsx.
import { ConversationProvider } from '../../conversation/ConversationContext'
// PreAnalysisPanel (rendered in the pre-run state this spec pins) calls
// useShowToast(), which throws outside a <ToastProvider>. Using the REAL
// provider rather than mocking the hook keeps the toast path exercised.
import { ToastProvider } from '../../ToastContext'

function withProviders(node: React.ReactNode) {
  return (
    <ToastProvider>
      <ConversationProvider>{node}</ConversationProvider>
    </ToastProvider>
  )
}

function renderOutputsDock() {
  return render(withProviders(<OutputsDock />))
}

const { mockIsOrchestratorV2Enabled, mockIsLegacyDirectRunEnabled, mockUseV2Run } = vi.hoisted(() => ({
  mockIsOrchestratorV2Enabled: vi.fn(() => false),
  mockIsLegacyDirectRunEnabled: vi.fn(() => true),
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })),
}))

// Mock react-router-dom (useScenario calls useNavigate)
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  }
})

// Mock flags module with all required exports
// Spread the REAL flags module and override only what this spec pins.
//
// This was a hand-listed allowlist of 6 flags. Because a vi.mock factory
// REPLACES the whole module, every flag added to src/flags.ts since was
// silently absent, and the first consumer to import one threw at collection
// ("No isRequireLoginEnabled export is defined on the ../../../flags mock" —
// via lib/poc.ts <- AuthContext). That is what actually kept this file dead,
// NOT the "needs network mock (fetch /bff/cee)" the exclude claimed.
//
// importOriginal makes the mock drift-proof: new flags arrive with their real
// implementations, so this spec cannot rot again the same way.
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => true,
    isCompareEnabled: () => true,
    // The dock's Compare tab is gated on isCompareTabEnabled() (a distinct,
    // default-OFF flag), NOT isCompareEnabled() — the gate moved in 3c290f2f
    // ("feat(ai-panel-v2): OutputsDock — drop embedded mode, add Olumi tab +
    // footer stack", 2026-05-19). This spec only ever forced the old flag, so
    // once importOriginal started supplying the REAL isCompareTabEnabled the
    // Compare tab vanished. Forcing the flag the dock actually reads preserves
    // this spec's original intent (Compare present).
    isCompareTabEnabled: () => true,
    isOrchestratorV2Enabled: mockIsOrchestratorV2Enabled,
    isLegacyDirectRunEnabled: mockIsLegacyDirectRunEnabled,
    isJourneyTabEnabled: vi.fn(() => false),
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    // Pre-analysis v3 gate stays off here: this spec pins the LEGACY pre-run
    // panel; the v3 panel has its own suite under pre-analysis-v3/__tests__.
    isPreAnalysisV3Enabled: vi.fn(() => false),
  }
})

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: (...args: unknown[]) => mockUseV2Run(...args),
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

// Module scope, not describe scope: the 'I.2a' block below also seeds this key
// and threw `ReferenceError: STORAGE_KEY is not defined` when it was a const
// local to the first describe. Now aliased to the key the dock actually
// exports rather than a re-typed literal, so it cannot drift.
const STORAGE_KEY = OUTPUTS_DOCK_STORAGE_KEY

// Captured before any test mutates the store, so `results` can be returned to
// a genuinely pristine value between tests. The spec never reset `results` at
// all: a leaked `report` from an earlier test flips runStatusRegion() from
// 'slow-run' to 'banner' (isRunning && hasReport wins — analysisRunStatus.ts),
// which is why the slow-run cases could not find their live region.
const PRISTINE_RESULTS = useCanvasStore.getState().results

function resetDockEnvironment() {
  ensureMatchMedia()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
  try {
    window.history.replaceState({}, '', '/canvas')
  } catch {}
  try {
    localStorage.removeItem(RUN_HISTORY_STORAGE_KEY)
  } catch {}
  useCanvasStore.setState({
      // Seed a minimal graph. 3c290f2f ("feat(ai-panel-v2): OutputsDock — drop
      // embedded mode, add Olumi tab + footer stack", 2026-05-19) added the
      // first-use rail: `isFirstUse = aiPanelV2On && !hasGraphContent` forces
      // effectiveIsOpen=false, so an EMPTY canvas renders the 40px icon rail
      // with no dock body at all. Every test here asserts on dock-body content
      // in states that presuppose a graph (pre-run Run button, Results, Compare),
      // so an empty store was simply the wrong fixture — the spec was written
      // before the rail existed and never reset `nodes` at all (it also leaked
      // nodes between tests). Setup only: no assertion relaxed.
      nodes: [
        { id: 'seed-goal', type: 'goal', data: { label: 'Seed Goal' }, position: { x: 0, y: 0 } },
        { id: 'seed-decision', type: 'decision', data: { label: 'Seed Decision' }, position: { x: 100, y: 100 } },
      ],
      edges: [{ id: 'seed-e1', source: 'seed-decision', target: 'seed-goal' }],
      results: PRISTINE_RESULTS,
      currentScenarioFraming: null,
      currentScenarioLastResultHash: null,
      hasCompletedFirstRun: false,
    } as any)
  useGuidanceStore.setState({
    guidanceItems: [],
    activeGuidanceItemId: null,
    inspectorDeepLinkField: null,
    _sendMessage: null,
    _runAnalysis: null,
    _sendChip: null,
    _scrollToPatch: null,
  })
  mockIsOrchestratorV2Enabled.mockReturnValue(false)
  mockIsLegacyDirectRunEnabled.mockReturnValue(true)
  mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })
}

describe('OutputsDock DOM', () => {
  beforeEach(resetDockEnvironment)

  it('renders with correct ARIA attributes and sections', () => {
    renderOutputsDock()

    const aside = screen.getByLabelText('Outputs dock')
    expect(aside).toBeInTheDocument()

    // Tab set updated for two DELIBERATE product changes this spec pre-dates
    // (it pinned the pre-March-2026 bar). Still an exact, ordered, whole-list
    // assertion — nothing loosened:
    //   - dbf4092b (2026-03-08) "feat(ui): rename Results tab to Analysis"
    //     → the 'results' tab's label is 'Analysis'.
    //   - 3c290f2f (2026-05-19) "feat(ai-panel-v2): OutputsDock — drop
    //     embedded mode, add Olumi tab + footer stack" → an 'Olumi' tab leads
    //     the bar whenever aiPanelV2 is on (it defaults ON).
    //
    // Scoped to the tab nav rather than matching button names across the whole
    // dock: the old free-floating /Model/ name regex also swept up the
    // composer's "Ask about this model…" control. Scoping TIGHTENS this — it
    // now pins the tab bar's exact contents and order, and cannot be satisfied
    // by an unrelated button that happens to share a word.
    const tabNav = screen.getByRole('navigation', { name: 'Outputs sections' })
    const tabs = within(tabNav).getAllByRole('button')

    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Olumi',
      'Analysis',
      'Compare',
      'Model',
    ])
  })

  it('shows Model tab verify badge when factors need verification', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
        { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A', observedState: { source: 'cee_inference' } } },
        { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'B', observedState: { source: 'user' } } },
      ],
    } as any)
    renderOutputsDock()
    const badge = screen.getByTestId('model-tab-verify-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('1')
  })

  it('hides Model tab verify badge when no factors need verification', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A', observedState: { source: 'user' } } },
      ],
    } as any)
    renderOutputsDock()
    expect(screen.queryByTestId('model-tab-verify-badge')).not.toBeInTheDocument()
  })

  it('shows a collapsed icon strip when closed and reopens on icon click', () => {
    renderOutputsDock()

    const collapseButton = screen.getByRole('button', { name: 'Collapse outputs dock' })
    fireEvent.click(collapseButton)

    expect(screen.queryByTestId('outputs-dock-body')).toBeNull()

    const resultsIcon = screen.getByRole('button', { name: 'Analysis' })
    const compareIcon = screen.getByRole('button', { name: 'Compare' })
    const modelIcon = screen.getByRole('button', { name: 'Model' })

    expect(resultsIcon).toBeInTheDocument()
    expect(compareIcon).toBeInTheDocument()
    expect(modelIcon).toBeInTheDocument()

    fireEvent.click(modelIcon)

    const headerLabel = screen.getByText('Model', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('persists active tab and open state via useDockState', () => {
    const { unmount } = renderOutputsDock()

    // Switch to Compare tab and leave dock open
    const compareTab = screen.getByRole('button', { name: 'Compare' })
    fireEvent.click(compareTab)

    // Unmount and remount to verify persisted state
    unmount()

    renderOutputsDock()

    const aside = screen.getByLabelText('Outputs dock') as HTMLElement
    // Width style should reflect expanded state via CSS variable
    expect(aside.style.width).toContain('var(--dock-right-expanded')
    // Dock should reserve space for the bottom toolbar via CSS variable in bottom position
    expect(aside.style.bottom).toContain('var(--bottombar-h)')

    // Header label (aria-live) should reflect active tab
    const headerLabel = screen.getByText('Compare', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('reads initial active tab from ?tab= query parameter', () => {
    try {
      window.history.replaceState({}, '', '/canvas?tab=diagnostics')
    } catch {}

    renderOutputsDock()

    const headerLabel = screen.getByText('Model', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('updates ?tab= query parameter when tabs are clicked', () => {
    renderOutputsDock()

    // Switch to Model tab
    const structureTab = screen.getByRole('button', { name: 'Model' })
    fireEvent.click(structureTab)

    let params = new URLSearchParams(window.location.search)
    expect(params.get('tab')).toBe('diagnostics')

    // Switch back to Results tab, which should clear the tab parameter
    const resultsTab = screen.getByRole('button', { name: 'Analysis' })
    fireEvent.click(resultsTab)

    params = new URLSearchParams(window.location.search)
    expect(params.get('tab')).toBeNull()
  })

  it('emits sandbox.compare.opened when Compare tab is opened', () => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()

    renderOutputsDock()

    const compareTab = screen.getByRole('button', { name: 'Compare' })
    fireEvent.click(compareTab)

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.compare.opened']).toBe(1)
  })

  it('auto-switches back to Results tab when results become active', () => {
    renderOutputsDock()

    // Move away from Results tab
    const structureTab = screen.getByRole('button', { name: 'Model' })
    fireEvent.click(structureTab)

    const structureHeader = screen.getByText('Model', {
      selector: 'span[aria-live="polite"]',
    })
    expect(structureHeader).toBeInTheDocument()

    // Simulate results starting to stream
    const currentResults = useCanvasStore.getState().results
    act(() => {
      useCanvasStore.setState({
        results: { ...currentResults, status: 'streaming' },
      } as any)
    })

    const resultsHeader = screen.getByText('Analysis', {
      selector: 'span[aria-live="polite"]',
    })
    expect(resultsHeader).toBeInTheDocument()
  })

  it('does not render VerdictCard when decision readiness has blockers', () => {
    const baseResults = useCanvasStore.getState().results

    const fakeReport: any = {
      schema: 'report.v1',
      meta: { seed: 101, response_id: 'ready-1', elapsed_ms: 1000 },
      model_card: {
        response_hash: 'hash-ready-1',
        response_hash_algo: 'sha256',
        normalized: true,
      },
      results: {
        conservative: 0.1,
        likely: 0.2,
        optimistic: 0.3,
        units: 'percent' as const,
        unitSymbol: '%',
      },
      run: {
        responseHash: 'hash-ready-1',
        bands: { p10: 0.1, p50: 0.2, p90: 0.3 },
      },
      decision_readiness: {
        ready: false,
        confidence: 'low',
        blockers: ['Graph has unresolved blockers'],
        warnings: [],
        passed: [],
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
    } as any)

    renderOutputsDock()

    expect(screen.queryByTestId('verdict-card')).not.toBeInTheDocument()
  })

  // C5: isDecisionReviewEnabled retired — decision review is always on.
  // Test "does NOT render Decision Review when flag disabled" removed.

  it('renders an error banner in Results tab when results status is error', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'error',
        error: {
          code: 'SERVER_ERROR',
          message: 'Something went wrong.',
        },
      },
    } as any)

    renderOutputsDock()

    const banner = screen.getByTestId('outputs-error-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('SERVER_ERROR')
    // Trailing period dropped by 2d5181dc (2025-12-21) "feat(ux): P0 Results
    // Panel UX improvements (Pilot Gate)", which routed the banner through
    // userFriendlyErrors.ts — its SERVER_ERROR entry is `headline: 'Something
    // went wrong'`. Copy change only; the banner still renders and still
    // carries the code, which the line above pins.
    expect(banner).toHaveTextContent('Something went wrong')
  })

  it('renders user-friendly error and request_id in error banner when provided', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'error',
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests.',
          // retryAfter: reserved for future rate-limit handling, not currently displayed
          retryAfter: 42,
          request_id: 'req-error-123',
        },
      },
    } as any)

    renderOutputsDock()

    const banner = screen.getByTestId('outputs-error-banner')
    expect(banner).toBeInTheDocument()
    // User-friendly headline from userFriendlyErrors mapping
    expect(banner).toHaveTextContent('Too many requests')
    // Debug section shows code and request_id in DEV mode
    expect(banner).toHaveTextContent('Request ID: req-error-123')
  })
})

// NOTE: Graph health card tests removed - GraphHealthCard component was removed from Structure tab
// Graph health information is now shown inline in GraphTextView and ValidationPanel

// These cases were written as BARE top-level `it`s with no beforeEach of any
// kind, so they ran against whatever store state the preceding describe
// happened to leave behind — including a leaked `results.report`, which flips
// the run-status region from 'slow-run' to 'banner' and hid the slow-run live
// region these very tests assert on. Wrapping them in a describe that runs the
// same reset as every other block gives them the isolation they always
// assumed. Grouping + setup only: no assertion touched.
describe('OutputsDock DOM: non-blocking CEE + slow-run narration', () => {
  beforeEach(resetDockEnvironment)

// Phase 1 Section 3.3: Non-blocking CEE and degraded banner tests

// Phase 2 Sprint 1B: Slow-run UX feedback tests
it('shows "Taking longer than expected..." message after 20 seconds', async () => {
  vi.useFakeTimers()

  renderOutputsDock()

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // Initially no message
  expect(screen.queryByTestId('slow-run-message')).not.toBeInTheDocument()

  // After 20 seconds, show first message
  act(() => {
    vi.advanceTimersByTime(20000)
  })

  expect(screen.getByTestId('slow-run-message')).toBeInTheDocument()
  expect(screen.getByText('Taking longer than expected...')).toBeInTheDocument()

  vi.useRealTimers()
})

it('escalates to "Still working..." message after 40 seconds', async () => {
  vi.useFakeTimers()

  renderOutputsDock()

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // After 40 seconds, show escalated message
  act(() => {
    vi.advanceTimersByTime(40000)
  })

  expect(screen.getByTestId('slow-run-message')).toBeInTheDocument()
  expect(screen.getByText('Still working...')).toBeInTheDocument()

  vi.useRealTimers()
})

it('clears slow-run message when analysis completes', async () => {
  vi.useFakeTimers()

  renderOutputsDock()

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // Advance to 20s to show message
  act(() => {
    vi.advanceTimersByTime(20000)
  })

  expect(screen.getByTestId('slow-run-message')).toBeInTheDocument()
  expect(screen.getByText('Taking longer than expected...')).toBeInTheDocument()

  // Complete the analysis
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'complete' },
    } as any)
  })

  // Message should be cleared
  expect(screen.queryByTestId('slow-run-message')).not.toBeInTheDocument()

  vi.useRealTimers()
})

it('slow-run message has proper accessibility attributes', async () => {
  vi.useFakeTimers()

  renderOutputsDock()

  // Simulate a long-running analysis
  const currentResults = useCanvasStore.getState().results
  act(() => {
    useCanvasStore.setState({
      results: { ...currentResults, status: 'streaming' },
      hasCompletedFirstRun: true,
    } as any)
  })

  // Advance to 20s to show message
  act(() => {
    vi.advanceTimersByTime(20000)
  })

  const message = screen.getByTestId('slow-run-message')
  expect(message).toHaveAttribute('role', 'status')
  expect(message).toHaveAttribute('aria-live', 'polite')

  vi.useRealTimers()
})

}) // end 'OutputsDock DOM: non-blocking CEE + slow-run narration'

// P0 Engine Integration: IdentifiabilityBadge in Results tab
describe('P0 Engine: IdentifiabilityBadge', () => {
  beforeEach(resetDockEnvironment)
  it('renders IdentifiabilityBadge when model_card has identifiability_tag', () => {
    const baseResults = useCanvasStore.getState().results
    const fakeReport: any = {
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
      model_card: {
        response_hash: 'abc123',
        response_hash_algo: 'sha256',
        normalized: true,
        identifiability_tag: 'identifiable',
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
    } as any)

    renderOutputsDock()

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    // Scoped to the badge: a page-wide getByText('Identifiable') is now
    // ambiguous (the results body renders the word too) and threw
    // "Found multiple elements". Scoping TIGHTENS the assertion — it pins the
    // text to the BADGE rather than to anywhere on the page.
    expect(within(badge).getByText('Identifiable')).toBeInTheDocument()
  })

  it('renders underidentified status with amber styling', () => {
    const baseResults = useCanvasStore.getState().results
    const fakeReport: any = {
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
      model_card: {
        response_hash: 'abc123',
        response_hash_algo: 'sha256',
        normalized: true,
        identifiability_tag: 'underidentified',
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
    } as any)

    renderOutputsDock()

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Under-identified')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-paper-50')
  })

  it('does NOT render IdentifiabilityBadge when identifiability_tag is absent', () => {
    const baseResults = useCanvasStore.getState().results
    const fakeReport: any = {
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
      model_card: {
        response_hash: 'abc123',
        response_hash_algo: 'sha256',
        normalized: true,
        // No identifiability_tag
      },
    }

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReport,
      },
    } as any)

    renderOutputsDock()

    expect(screen.queryByTestId('identifiability-badge')).not.toBeInTheDocument()
  })

  it('does NOT render IdentifiabilityBadge in pre-run state', () => {
    useCanvasStore.setState({
      hasCompletedFirstRun: false,
      results: {
        status: 'idle',
        report: null,
      },
    } as any)

    renderOutputsDock()

    expect(screen.queryByTestId('identifiability-badge')).not.toBeInTheDocument()
  })
})

// NOTE: EvidenceCoverage tests removed - component was intentionally removed from Structure tab
// Evidence metrics are now displayed inline in GraphTextView instead




function openStructureTab() {
  const structureTab = screen.getByRole('button', { name: 'Model' })
  fireEvent.click(structureTab)
}

// I.1 & I.2: Phase 1 UI fix tests
// These tests use consistent node setup to ensure OutputsDock renders properly.
const testNodes = [
  { id: 'goal-1', type: 'goal', data: { label: 'Test Goal' }, position: { x: 0, y: 0 } },
  { id: 'decision-1', type: 'decision', data: { label: 'Test Decision' }, position: { x: 100, y: 100 } },
]
const testEdges = [{ id: 'e1', source: 'goal-1', target: 'decision-1' }]
const fakeReportForTests: any = {
  results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 10, p50: 20, p90: 30 } },
}

// Was a near-duplicate of the first describe's beforeEach that drifted from it:
// it re-typed the storage key as a literal, never reset `results` or the
// guidance store, and — decisively — never seeded `nodes`, so every case using
// it that didn't set its own graph rendered the aiPanelV2 first-use rail with
// no dock body (see resetDockEnvironment). Delegating removes the drift.
function cleanupDockState() {
  resetDockEnvironment()
}

describe('I.1: Model tab auto-switch guard', () => {
  beforeEach(cleanupDockState)
  it('does NOT auto-switch away from Model tab when status remains complete', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReportForTests,
      },
    } as any)

    renderOutputsDock()

    // User navigates to Model tab
    openStructureTab()

    const structureHeader = screen.getByText('Model', {
      selector: 'span[aria-live="polite"]',
    })
    expect(structureHeader).toBeInTheDocument()

    // Trigger a re-render with status still 'complete' (simulates React re-render)
    act(() => {
      useCanvasStore.setState({
        results: {
          ...useCanvasStore.getState().results,
          status: 'complete',
        },
      } as any)
    })

    // Should remain on Model tab — not yanked back to Results
    const structureHeaderAfter = screen.getByText('Model', {
      selector: 'span[aria-live="polite"]',
    })
    expect(structureHeaderAfter).toBeInTheDocument()
  })

  it('auto-switches to Results tab on idle → preparing transition', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReportForTests,
      },
    } as any)

    renderOutputsDock()

    // User navigates to Model tab after a completed run
    openStructureTab()
    expect(screen.getByText('Model', {
      selector: 'span[aria-live="polite"]',
    })).toBeInTheDocument()

    // Reset status to idle (simulates resultsReset), then start a new run
    act(() => {
      useCanvasStore.setState({
        results: { ...useCanvasStore.getState().results, status: 'idle' },
      } as any)
    })

    // Now start a new analysis (idle → preparing)
    act(() => {
      useCanvasStore.setState({
        results: { ...useCanvasStore.getState().results, status: 'preparing' },
      } as any)
    })

    // Should auto-switch to Results tab
    expect(screen.getByText('Analysis', {
      selector: 'span[aria-live="polite"]',
    })).toBeInTheDocument()
  })
})

describe('I.2b: Cancel button during analysis', () => {
  beforeEach(cleanupDockState)
  it('shows cancel button when a V2 run is in flight (the run cancelRun can actually cancel)', () => {
    const baseResults = useCanvasStore.getState().results

    // 1.16i: Cancel is gated on useV2Run's OWN in-flight flag, not the
    // derived store status — cancelRun only aborts the V2 request, so a
    // Cancel rendered for a V5 turn would be a dead control.
    mockUseV2Run.mockReturnValue({
      runV2Analysis: vi.fn(),
      cancelRun: vi.fn(),
      isRunning: true,
    } as any)

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'streaming',
        report: fakeReportForTests,
      },
    } as any)

    renderOutputsDock()

    const cancelButton = screen.getByTestId('cancel-analysis-button')
    expect(cancelButton).toBeInTheDocument()
    expect(cancelButton).toHaveTextContent('Cancel')
  })

  it('1.16i: NO cancel button on a V5 analysing turn (preparing without a V2 run) — but the running banner shows', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'preparing',
        report: fakeReportForTests,
      },
    } as any)

    renderOutputsDock()

    expect(screen.queryByTestId('cancel-analysis-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
  })

  it('hides cancel button when analysis is complete', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'complete',
        report: fakeReportForTests,
      },
    } as any)

    renderOutputsDock()

    expect(screen.queryByTestId('cancel-analysis-button')).not.toBeInTheDocument()
  })
})

describe('I.2c: Stale results indicator', () => {
  beforeEach(cleanupDockState)
  it('shows stale results banner when error occurs with previous results', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'error',
        report: fakeReportForTests,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to fetch',
          canRetry: true,
        },
      },
    } as any)

    renderOutputsDock()

    const banner = screen.getByTestId('stale-results-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('Showing results from previous analysis')
  })

  it('does NOT show stale results banner on first-run error (no previous results)', () => {
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'error',
        report: null,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to fetch',
          canRetry: true,
        },
      },
    } as any)

    renderOutputsDock()

    expect(screen.queryByTestId('stale-results-banner')).not.toBeInTheDocument()
  })
})

describe('I.2a: Secondary action button interaction', () => {
  beforeEach(cleanupDockState)
  it('clicking secondary action button closes the dock', () => {
    const baseResults = useCanvasStore.getState().results

    // SERVICE_UNAVAILABLE has secondaryActionText: 'Continue Without'
    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'error',
        report: null,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service is down.',
          canRetry: true,
        },
      },
    } as any)

    renderOutputsDock()

    // Verify secondary button is rendered with expected text
    const secondaryButton = screen.getByTestId('error-secondary-action')
    expect(secondaryButton).toBeInTheDocument()
    expect(secondaryButton).toHaveTextContent('Continue Without')

    // Click the secondary action
    fireEvent.click(secondaryButton)

    // After click, dock should close — the error banner should no longer be visible
    expect(screen.queryByTestId('outputs-error-banner')).not.toBeInTheDocument()
  })

  it('falls back to Results when persisted activeTab is journey but flag is OFF (regression)', () => {
    // Seed sessionStorage with journey tab persisted
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'journey' }))

    renderOutputsDock()

    // Journey tab should NOT appear in the tab bar
    expect(screen.queryByRole('button', { name: 'Journey' })).not.toBeInTheDocument()

    // Should fall back to Results
    const headerLabel = screen.getByText('Analysis', {
      selector: 'span[aria-live="polite"]',
    })
    expect(headerLabel).toBeInTheDocument()
  })

  it('shows Journey tab when flag is ON', async () => {
    const { isJourneyTabEnabled } = await import('../../../flags')
    vi.mocked(isJourneyTabEnabled).mockReturnValue(true)

    // Need to re-evaluate OUTPUT_TABS with flag on — use dynamic import
    vi.resetModules()

    // Re-mock flags with journey enabled. Same importOriginal spread as the
    // module-level mock, and for the same reason: a hand-listed factory
    // REPLACES the module, so every flag the import graph has gained since
    // (isRequireLoginEnabled via lib/poc.ts <- AuthContext, isAiPanelV2Enabled,
    // isCompareTabEnabled, ...) went missing and threw. Also forces
    // isCompareTabEnabled — the dock's real Compare gate (3c290f2f).
    vi.doMock('../../../flags', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../../flags')>()
      return {
        ...actual,
        isTelemetryEnabled: () => true,
        isCompareEnabled: () => true,
        isCompareTabEnabled: () => true,
        isOrchestratorV2Enabled: () => false,
        isLegacyDirectRunEnabled: () => true,
        isJourneyTabEnabled: vi.fn(() => true),
      }
    })

    const { OutputsDock: FreshOutputsDock } = await import('../OutputsDock')
    // The providers MUST come from the post-resetModules graph. The top-level
    // `withProviders` closes over the ConversationContext imported before the
    // reset, so its React context object is a different instance from the one
    // FreshOutputsDock consumes — the provider would be invisible to it and
    // useConversationContext would throw as if unwrapped.
    const { ConversationProvider: FreshConversationProvider } = await import(
      '../../conversation/ConversationContext'
    )
    const { ToastProvider: FreshToastProvider } = await import('../../ToastContext')
    // Same reason, for the store: resetModules gives FreshOutputsDock a fresh
    // zustand instance, so the graph seeded by beforeEach (on the ORIGINAL
    // store module) is invisible to it and it renders the empty-canvas
    // first-use rail — icon buttons with no text — instead of the tab bar.
    const { useCanvasStore: freshCanvasStore } = await import('../../store')
    freshCanvasStore.setState({
      nodes: [
        { id: 'seed-goal', type: 'goal', data: { label: 'Seed Goal' }, position: { x: 0, y: 0 } },
        { id: 'seed-decision', type: 'decision', data: { label: 'Seed Decision' }, position: { x: 100, y: 100 } },
      ],
      edges: [{ id: 'seed-e1', source: 'seed-decision', target: 'seed-goal' }],
    } as any)
    render(
      <FreshToastProvider>
        <FreshConversationProvider>
          <FreshOutputsDock />
        </FreshConversationProvider>
      </FreshToastProvider>,
    )

    // Same two deliberate renames as the ARIA/sections case above
    // (dbf4092b Results→Analysis; 3c290f2f adds the leading Olumi tab), and
    // the same tighter nav-scoped query. Journey still appends last, which is
    // what this case is about.
    const tabNav = screen.getByRole('navigation', { name: 'Outputs sections' })
    const tabs = within(tabNav).getAllByRole('button')
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Olumi',
      'Analysis',
      'Compare',
      'Model',
      'Journey',
    ])
  })
})

/**
 * Wave1-L2 (seam D-M): the run-status narration must be ONE live region.
 *
 * The pre-existing slowRunMessage (>=20s / >=40s) and the new
 * AnalysisRunningBanner narration both render role=status aria-live=polite.
 * Before the fix they stacked from ~20s — directly above one another, making
 * opposing progress claims in exactly the window this lane targets, and a
 * screen-reader user heard both. The banner subsumes the slow-run thresholds
 * into its stage table, so the standalone slow-run region must yield whenever
 * the banner is mounted (isRunning && report).
 *
 * These cases NOW GATE. The file's `exclude` entry in vitest.config.ts has
 * been removed and the harness repaired (provider wrappers, drift-proof flags
 * mock, graph fixture), so the default suite runs them. The pure decision in
 * analysisRunStatus.ts + its spec remains the primary gate for this
 * invariant; these are the integration-level check on top of it.
 */
describe('Wave1-L2: single run-status live region', () => {
  beforeEach(cleanupDockState)

  /** The run-status live regions this dock can render. */
  function runStatusRegions() {
    return [
      ...screen.queryAllByTestId('slow-run-message'),
      ...screen.queryAllByTestId('analysis-running-banner'),
    ]
  }

  it('renders exactly ONE run-status live region at 25s when a report is on screen', () => {
    vi.useFakeTimers()
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'streaming',
        report: fakeReportForTests,
      },
    } as any)

    renderOutputsDock()

    // 25s: inside the window where slowRunMessage used to stack on the banner.
    act(() => {
      vi.advanceTimersByTime(25_000)
    })

    const regions = runStatusRegions()
    expect(
      regions,
      'two stacked aria-live run-status regions make opposing progress claims',
    ).toHaveLength(1)
    // The banner is the one that survives: it carries the staged narration.
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('slow-run-message')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('the surviving region still acknowledges the long wait at 25s (no regression in slow-run behaviour)', () => {
    vi.useFakeTimers()
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'streaming',
        report: fakeReportForTests,
        // Stamp the run start the way EVERY store path into a running status
        // does (#327 / 1d6d84cd). The banner's narration clock reads
        // results.startedAt (selectResultsStartedAt -> AnalysisRunningBanner
        // startedAt prop); omitting it drops the banner onto its documented
        // "defensive fallback" — mount time — which is the very origin the
        // #327 round-2 regression used. Seeding it points this case at the
        // real clock source. See the report: this case still does NOT gate
        // the mid-run-mount regression (mount ~= run start here); that gate
        // is AnalysisRunningBanner.spec.tsx, which does run.
        startedAt: Date.now(),
      },
    } as any)

    renderOutputsDock()

    act(() => {
      vi.advanceTimersByTime(25_000)
    })
    // Flush the 200ms narration crossfade. The stage swap is deliberately not
    // instant (CROSSFADE_MS in AnalysisRunningBanner.tsx): the effect that
    // schedules the swap only runs once the 25s advance has flushed, so
    // without this the assertion reads the pre-fade line and the test would
    // fail on a banner that is behaving correctly.
    act(() => {
      vi.advanceTimersByTime(250)
    })

    // The banner's own stage table carries the >=20s long-wait acknowledgement
    // that slowRunMessage used to provide, so the user loses nothing.
    //
    // Copy updated for #327 (1d6d84cd) round-2 "P1 HONESTY", which retired
    // 'This is taking longer than usual — still analysing…': 20-30s IS the
    // typical wait, so the comparative claim was false on an ordinary run, and
    // "usual" isn't derivable from elapsed time (the client holds no
    // distribution of past run durations). The 20s stage is now the
    // non-comparative 'Still analysing your decision…' (NARRATION_STAGES in
    // AnalysisRunningBanner.tsx). #327's own commit message disclosed this pin
    // as stale and left it for this revival lane: "its narration assertion is
    // stale (old copy) — left untouched to avoid colliding with the lane
    // reviving it."
    expect(screen.getByTestId('analysis-running-banner')).toHaveTextContent(
      'Still analysing your decision…',
    )

    vi.useRealTimers()
  })

  it('keeps the standalone slow-run message when there is NO report (banner not mounted)', () => {
    vi.useFakeTimers()
    const baseResults = useCanvasStore.getState().results

    useCanvasStore.setState({
      hasCompletedFirstRun: true,
      results: {
        ...baseResults,
        status: 'streaming',
        report: null,
      },
    } as any)

    renderOutputsDock()

    act(() => {
      vi.advanceTimersByTime(25_000)
    })

    // Skeleton case: the banner does not mount, so the pre-existing slow-run
    // region is still the single run-status live region and must survive.
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('slow-run-message')).toBeInTheDocument()
    expect(runStatusRegions()).toHaveLength(1)

    vi.useRealTimers()
  })
})

/**
 * F9 (UI brief 2026-07-16 item 3): run start/settle is announced by ONE
 * dock-level live region, whichever tab is fronted.
 *
 * The Wave1-L2 rule above guarantees at most one ONGOING narration region
 * inside the Analysis tab. These cases pin its F9 extension: a single
 * always-mounted announcer speaks run START and SETTLE for every other tab,
 * and YIELDS while the Analysis tab is fronted, whose own furniture (the
 * banner's narration div at start, the completion toast at settle) already
 * announces there. Without the yield, an Analysis-tab run start would be
 * spoken twice (the #329 narration-div trap).
 */
describe('F9: dock-level run announcer (single voice for start/settle)', () => {
  beforeEach(cleanupDockState)

  function seedIdle(withReport: boolean) {
    const baseResults = useCanvasStore.getState().results
    useCanvasStore.setState({
      nodes: testNodes,
      edges: testEdges,
      hasCompletedFirstRun: withReport,
      results: {
        ...baseResults,
        status: withReport ? 'complete' : 'idle',
        report: withReport ? fakeReportForTests : null,
      },
    } as any)
  }

  function startRun(withReport: boolean) {
    const current = useCanvasStore.getState().results
    act(() => {
      useCanvasStore.setState({
        results: {
          ...current,
          status: 'streaming',
          startedAt: Date.now(),
          report: withReport ? fakeReportForTests : null,
        },
      } as any)
    })
  }

  function settleRun(status: 'complete' | 'error') {
    const current = useCanvasStore.getState().results
    act(() => {
      useCanvasStore.setState({
        results: { ...current, status },
      } as any)
    })
  }

  it('mounts exactly one announcer at dock level', () => {
    seedIdle(false)
    renderOutputsDock()
    expect(screen.getAllByTestId('analysis-run-announcer')).toHaveLength(1)
  })

  it('announces rerun start and settle while the Compare tab is fronted, exactly once', () => {
    // A RERUN (complete -> streaming) does not trip the I.1 auto-switch, so
    // Compare stays fronted for the whole run — exactly the F9 scenario
    // (rerun dispatched with another tab in view was silent and frozen).
    seedIdle(true)
    renderOutputsDock()
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))

    startRun(true)
    expect(screen.getByTestId('analysis-run-announcer')).toHaveTextContent(
      'Analysis started.',
    )
    // Structural single-voice pin: no OTHER live region carries the
    // announcement (one aria-live announcement per transition).
    const speakingRegions = Array.from(
      document.querySelectorAll('[aria-live]'),
    ).filter((el) => (el.textContent ?? '').includes('Analysis started.'))
    expect(speakingRegions).toHaveLength(1)

    settleRun('complete')
    expect(screen.getByTestId('analysis-run-announcer')).toHaveTextContent(
      'Analysis complete.',
    )
  })

  it('announces rerun failure honestly while the Model tab is fronted', () => {
    seedIdle(true)
    renderOutputsDock()
    fireEvent.click(screen.getByRole('button', { name: 'Model' }))

    startRun(true)
    settleRun('error')
    expect(screen.getByTestId('analysis-run-announcer')).toHaveTextContent(
      'Analysis failed.',
    )
  })

  it('stays silent on a FIRST run: the auto-switch fronts the Analysis tab, whose furniture speaks', () => {
    seedIdle(false)
    renderOutputsDock()
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))

    startRun(false)
    // The I.1 auto-switch yanked the dock to the Analysis tab, where the
    // results skeleton is the visible run furniture...
    expect(screen.getByTestId('headline-skeleton')).toBeInTheDocument()
    // ...so the announcer yields the start rather than double-announcing.
    expect(screen.getByTestId('analysis-run-announcer')).toHaveTextContent('')
  })

  it('yields while the Analysis tab is fronted: the narration banner speaks, the announcer stays silent', () => {
    seedIdle(true)
    renderOutputsDock()

    startRun(true)
    // The Analysis tab's own narration region is the run-start voice here.
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-run-announcer')).toHaveTextContent('')
  })
})

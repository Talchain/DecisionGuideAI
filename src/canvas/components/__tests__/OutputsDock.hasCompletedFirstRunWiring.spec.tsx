/**
 * OutputsDock — A5 follow-up (independent review of PR #2043, verdict
 * `CHANGES_REQUIRED`, blocker 2). `hasCompletedFirstRun` reaches the footer
 * THROUGH THE REAL WIRING, not as an injected prop.
 *
 * ⚠ Why this file exists. The original A5 fix added an optional
 * `hasCompletedFirstRun` parameter to `composeReadinessBlockedReason` (with a
 * defensive `= true` default) and to `WorkspaceShellTabStrip`'s props, and
 * proved the new behaviour with component-level specs that pass the value as
 * a prop directly. That proves the copy is correct WHEN GIVEN the flag — it
 * proves nothing about whether the real dock ever passes it. The reviewer
 * found exactly that gap: `canRunAnalysis.ts`'s only production caller of
 * `composeReadinessBlockedReason` still passed 3 arguments, so every real
 * render fell back to the `= true` default regardless of the model's actual
 * history — the fix was a no-op in the shipped product even though its own
 * specs were green.
 *
 * So this spec renders the REAL <OutputsDock/>, seeds only STATE (a stale
 * readiness verdict the side-car itself is refusing, plus the store's own
 * `hasCompletedFirstRun` boolean), and asserts the sentence that comes out the
 * other end. Every link is live: `useCanvasStore.hasCompletedFirstRun` →
 * `canRunAnalysisUtil({ hasCompletedFirstRun })` → `composeReadinessBlockedReason`
 * → `runBlockedTooltip` → `<ReanalyseBar blockedReason=.../>`'s
 * `reanalyse-blocked-reason` subline.
 *
 * The Model tab's `ReanalyseBar` is the right surface for THIS spec (rather
 * than the pre-analysis-v3 footer the sibling file measures): its headline
 * already reads the store's `hasCompletedFirstRun` directly (the first A5
 * fix), so mounting there with the flag false forces `neverRun` down BOTH
 * paths at once — the bar renders regardless (never-run keeps the bar
 * mounted), so the ONLY thing that can still be wrong is the gate's own
 * composed subline, which is exactly what blocker 2 named.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { BLOCKED_REASON_COPY } from '../../utils/composeBlockedReason'

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
    isPreAnalysisV3Enabled: () => true,
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

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

/**
 * A verdict the side-car ITSELF refuses (`can_run_analysis: false`), with no
 * `scaffold_plan.will_scaffold_options` — so `readinessObjectsToRun` refuses
 * and the gate takes the legacy `analysisReadiness == null` branch that calls
 * `composeReadinessBlockedReason` (the one the reviewer named).
 */
const REFUSING_VERDICT = {
  readiness_score: 40,
  readiness_level: 'needs_work' as const,
  can_run_analysis: false,
  confidence_explanation: 'V3 analysis not ready',
  improvements: [],
  scaffold_plan: { will_scaffold_options: false },
  options_ready: 5,
  options_total: 5,
  goal_node_valid: true,
}

const OPTION_LABELS: Record<string, string> = {
  opt_build: 'Build it in house',
  opt_buy: 'Buy a vendor platform',
}

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

function seedCanvas(hasCompletedFirstRun: boolean) {
  const nodes = [
    { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'Build or buy?' } },
    { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Increase delivery output' } },
    ...Object.entries(OPTION_LABELS).map(([id, label], i) => ({
      id,
      type: 'option',
      position: { x: 10 * i, y: 0 },
      data: { kind: 'option', label },
    })),
    { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Ramp-up time' } },
  ]
  useCanvasStore.setState({
    nodes: nodes as never,
    edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }] as never,
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    // The flag under test — read directly by `OutputsDock`, not injected.
    hasCompletedFirstRun,
    results: { status: 'idle', progress: 0 },
    showDraftChat: false,
    v5AnalysisFact: null,
    // A CEE-stated 'stale' so `useAnalysisTrust`'s `semantic` is 'changed' and
    // `ReanalyseBar` renders in BOTH cases below — its own `neverRun` read
    // (from `hasCompletedFirstRun`) decides `data-reason`, never this. This
    // isolates the thing under test: whether the GATE's composed subline
    // (`runBlockedTooltip`, via `canRunAnalysisUtil`) also received the flag.
    analysisFreshness: { freshness: 'stale', computedAt: new Date().toISOString() },
    ceeAnalysisReady: {
      goal_node_id: 'g1',
      status: 'ready',
      options: Object.keys(OPTION_LABELS).map((id) => ({ id, status: 'ready' })),
    },
    analysisStateV1: null,
  } as never)
}

/**
 * Seed the verdict directly AND keep it stale — durably, not just at the
 * instant of seeding.
 *
 * ⚠ WHY THE TRANSPORT REJECTS. `useGraphReadiness` fires an immediate fetch on
 * first mount (`startListening`'s "Fire immediately on first listen"), and a
 * SUCCESSFUL answer clears `stale` the moment it resolves — `readinessStore`'s
 * own comment: "cleared only when this verdict describes the model on the
 * canvas", which this seeded model always does. A spec that stubs a matching
 * 200 therefore wins the race against its own assertion: the mount's
 * background fetch resolves before (or during) `findByTestId`'s polling and
 * launders the seeded `stale: true` back to `false` — measured directly, not
 * assumed: with a 200 stub here, `hasCompletedFirstRun: true` rendered
 * `BLOCKED_REASON_COPY.unspecified`, not `staleRecheck`, because staleness
 * was already gone by the time the DOM was read.
 *
 * A REJECTING transport hits `readinessStore`'s network-failure catch, whose
 * own comment says the opposite: *"`stale` is deliberately NOT touched … if
 * the model changed since that retained verdict, it is still stale, and
 * saying so is the truth"*. So the seeded state survives for the life of the
 * test — not a race won by timing, but a state the store's own contract keeps
 * held for exactly this reason.
 */
function seedStaleRefusingVerdict() {
  clearInflightCache()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network error (test transport)') }))
  useReadinessStore.setState({
    readiness: REFUSING_VERDICT,
    loading: false,
    error: null,
    stale: true,
    // `publishCheckFailure` discriminates a retained SERVER answer from a
    // locally-composed one by `verdictAtMs === null`, and drops the latter to
    // `null` on the mount's own failed background re-check (see this file's
    // stubbed transport above). Stamping it marks this verdict as answered,
    // exactly like a real fetch response would, so it survives that re-check.
    verdictAtMs: Date.now(),
  })
}

beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

/** Put the session on the Model tab, through the dock's own persisted state. */
function seedDockOnModelTab(): void {
  sessionStorage.setItem(
    OUTPUTS_DOCK_STORAGE_KEY,
    JSON.stringify({ isOpen: true, activeTab: 'diagnostics' }),
  )
}

beforeEach(() => {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
    seedDockOnModelTab()
  } catch {
    /* jsdom quirk */
  }
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// The remainder ReanalyseBar prints when its composed subline IS the
// stale-recheck sentence (it strips the first clause to avoid repeating its
// own headline) — derived here from the same shared constant the component
// derives it from, not a second hand-typed copy of it.
const STALE_RECHECK_REMAINDER = BLOCKED_REASON_COPY.staleRecheck.split('. ').slice(1).join('. ')

describe('OutputsDock → hasCompletedFirstRun reaches the Model tab gate copy through the real wiring', () => {
  it('a model that HAS completed a run gets the stale-recheck sentence', async () => {
    seedCanvas(true)
    seedStaleRefusingVerdict()

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const bar = await screen.findByTestId('reanalyse-bar', {}, { timeout: 20_000 })
    expect(bar).toHaveAttribute('data-reason', 'model-changed')
    const reason = await screen.findByTestId('reanalyse-blocked-reason', {}, { timeout: 20_000 })
    expect(reason).toHaveTextContent(STALE_RECHECK_REMAINDER)
  }, 30_000)

  it('RED/A5: a model that has NEVER completed a run does not claim its analysis changed', async () => {
    seedCanvas(false)
    seedStaleRefusingVerdict()

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const bar = await screen.findByTestId('reanalyse-bar', {}, { timeout: 20_000 })
    expect(bar).toHaveAttribute('data-reason', 'never-run')
    const reason = await screen.findByTestId('reanalyse-blocked-reason', {}, { timeout: 20_000 })
    // The gate's OWN composed subline — not just the bar's own headline — must
    // not assert a prior check this never-run model never had.
    expect(reason).not.toHaveTextContent(STALE_RECHECK_REMAINDER)
    expect(reason).not.toHaveTextContent('Your model changed since the last check')
  }, 30_000)
})

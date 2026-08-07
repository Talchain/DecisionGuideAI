/**
 * OutputsDock — a stale analysis does not HIDE the engine critique
 * (ROADMAP 2.651, the UI half of Paul's Ruling 3; design §3.3.2 lock U2).
 *
 * THE RULING. Staleness is a displayed property of RESULTS, never a lock on
 * an affordance. CEE #834 built that server-side — the graph is always
 * editable. This dock still carried the retired conflation:
 *
 *   {!isPreRun && !analysisNotConfirmedFresh && report?.run?.critique && …}
 *
 * `analysisNotConfirmedFresh` is displayed 'stale' OR 'unknown', and ANY
 * analysis-affecting local edit downgrades a retained 'fresh' verdict to
 * 'unknown' (`resolveDisplayedFreshness`). So the user's FIRST edit hid the
 * blocker critique — and with it the ValidationPanel's Auto-fix control, a
 * graph MUTATION affordance — for the rest of the session.
 *
 * WHY HIDING IT WAS THE WRONG ANSWER TO A REAL PROBLEM. The suppressed
 * rationale (RCA-C/F18) is that a critique bakes the run-time limit into its
 * free text ("Graph too large: 16 nodes (limit: 12)"), which a newer live
 * limit could contradict. That is an argument about what the display CLAIMS,
 * and the tab already answers it: `AnalysisFreshnessNotice` states "Model
 * changed since this analysis. Re-run to update." above this panel. The
 * ruling's line is that out-of-date results are labelled, not withheld — the
 * same doctrine this file's own neighbour already records: "v6 keeps stale
 * results fully readable … No dimming, no aria-disabled lockout."
 *
 * WHAT SURVIVES BYTE-IDENTICALLY. `!isPreRun` (pre-run validation speaks
 * through live `graphHealth`, not through a critique that does not exist yet)
 * and the BLOCKER-severity filter. Both are pinned below and both stay GREEN
 * across the change; the mutants prove each limb is independently bound.
 *
 * ⚠ SURFACE BINDING (CLAUDE.md trap 3b). Unlike its sibling lock in
 * `ResultsBody`, this panel sits on the surface the DEPLOYED FLAGS mount: it
 * is inside `effectiveIsOpen && effectiveActiveTab === 'results'` with no
 * feature-flag arm above it. The first test asserts that mount path so this
 * file fails loud rather than quietly testing something no deployment
 * renders.
 *
 * ⚠ SCOPE (CLAUDE.md trap 3): DOM-content assertions only. Nothing here
 * claims visibility, layout, or that anything is above the fold.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

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
    // Matches `netlify.toml` VITE_FEATURE_PRE_ANALYSIS_V3 = "1".
    isPreAnalysisV3Enabled: () => true,
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

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

/**
 * The one critique this spec is about, named once. Assertions bind to this
 * MESSAGE, not to "a critique" or "the panel is non-empty" (CLAUDE.md trap
 * 19) — only this item can produce this sentence, so a different critique
 * leaking in cannot satisfy them.
 */
const BLOCKER_MESSAGE = 'Graph too large: 16 nodes (limit: 12)'
const WARNING_MESSAGE = 'Edge weight normalised on Ramp-up time'

const BLOCKER_CRITIQUE = [
  { severity: 'BLOCKER', code: 'GRAPH_TOO_LARGE', message: BLOCKER_MESSAGE },
]
const WARNING_ONLY_CRITIQUE = [
  { severity: 'WARNING', code: 'WEIGHTS_NORMALIZED', message: WARNING_MESSAGE },
]

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

type Freshness = 'fresh' | 'stale' | 'unknown'

interface SeedOpts {
  /** false ⇒ pre-run: the `!isPreRun` limb, which this change must not touch. */
  completedFirstRun?: boolean
  freshness?: Freshness
  /** The local dirty overlay — what an analysis-affecting edit sets. */
  dirty?: boolean
  critique?: unknown[]
}

/**
 * A completed run whose results are on screen, with an engine critique
 * attached — the state a user is in the moment they edit the graph.
 */
function seedPostRunCanvas({
  completedFirstRun = true,
  freshness = 'fresh',
  dirty = false,
  critique = BLOCKER_CRITIQUE,
}: SeedOpts = {}) {
  clearInflightCache()
  // Held in flight: a settling readiness fetch would clear the state under
  // test mid-assertion (same reason as OutputsDock.staleVerdictCopy.spec).
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

  const nodes = [
    { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'Build or buy?' } },
    { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Increase delivery output' } },
    { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Build it in house' } },
    { id: 'opt_b', type: 'option', position: { x: 10, y: 0 }, data: { kind: 'option', label: 'Buy a vendor platform' } },
    { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Ramp-up time' } },
  ]

  useCanvasStore.setState({
    nodes: nodes as never,
    edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }] as never,
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    hasCompletedFirstRun: completedFirstRun,
    results: {
      status: 'complete',
      progress: 100,
      report: { run: { critique } },
    },
    showDraftChat: false,
    v5AnalysisFact: null,
    analysisFreshness: {
      freshness,
      graphHashAtRun: 'hash_at_run',
      currentGraphHash: dirty || freshness !== 'fresh' ? 'hash_now_different' : 'hash_at_run',
    },
    analysisFreshnessDirty: dirty,
  } as never)
}

function renderDock() {
  return render(
    <ToastProvider>
      <OutputsDock />
    </ToastProvider>,
  )
}

const findCritiquePanel = () =>
  screen.findByTestId('outputs-engine-critique', {}, { timeout: 20_000 })
const queryCritiquePanel = () => screen.queryByTestId('outputs-engine-critique')

beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

beforeEach(() => {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.unstubAllGlobals()
})

describe('OutputsDock — staleness labels results, it does not hide the engine critique (2.651 / U2)', () => {
  /**
   * CONTROL (CLAUDE.md trap 13) + MOUNT PATH (trap 3b). Every assertion that
   * the panel is PRESENT is vacuous unless this fixture can render it at all,
   * and every assertion in this file is worthless if the deployment does not
   * mount this surface. Both are settled here, before anything else is
   * claimed.
   */
  it('control — on CURRENT results the deployed surface mounts and names the blocker', async () => {
    seedPostRunCanvas({ freshness: 'fresh' })
    renderDock()
    const panel = await findCritiquePanel()
    expect(within(panel).getByText(BLOCKER_MESSAGE)).toBeInTheDocument()
  }, 40_000)

  /**
   * RED at pristine — CEE itself says the model changed.
   */
  it('a CEE "stale" verdict still shows the blocker critique', async () => {
    seedPostRunCanvas({ freshness: 'stale' })
    renderDock()
    const panel = await findCritiquePanel()
    expect(within(panel).getByText(BLOCKER_MESSAGE)).toBeInTheDocument()
  }, 40_000)

  /**
   * RED at pristine — THE USER'S FIRST EDIT. The realistic path: CEE's
   * verdict is still 'fresh', the local dirty overlay downgrades the DISPLAY
   * to cannot-confirm, and the panel vanished. This is the case the ruling is
   * actually about, and it fires on every session.
   */
  it('after the user edits the graph (cannot-confirm) the blocker critique is still shown', async () => {
    seedPostRunCanvas({ freshness: 'fresh', dirty: true })
    renderDock()
    const panel = await findCritiquePanel()
    expect(within(panel).getByText(BLOCKER_MESSAGE)).toBeInTheDocument()
  }, 40_000)

  it('a CEE "unknown" verdict still shows the blocker critique', async () => {
    seedPostRunCanvas({ freshness: 'unknown' })
    renderDock()
    const panel = await findCritiquePanel()
    expect(within(panel).getByText(BLOCKER_MESSAGE)).toBeInTheDocument()
  }, 40_000)

  /**
   * The wiring witness (CLAUDE.md trap 16 — a symbol proves presence in the
   * repo, never presence on the live path). The same `analysisNotConfirmedFresh`
   * value that gated this panel is also what the dock hands `ResultsBody` as
   * its `isStale` prop, and it is stamped on the results wrapper. Asserting it
   * here proves the store → dock derivation is LIVE, so the sibling
   * prop-level spec (`ResultsBody.staleMutationAffordances.spec.tsx`) is
   * describing a state the product actually reaches rather than a fixture.
   *
   * Deliberately independent of the critique panel: it is GREEN before and
   * after this change, so it witnesses the derivation itself rather than the
   * fix. And it is the counterpart invariant — removing the LOCK must not
   * remove the honest LABEL.
   */
  it('the same edit marks the results wrapper not-confirmed — the display still tells the truth', async () => {
    seedPostRunCanvas({ freshness: 'fresh', dirty: true })
    renderDock()
    const wrapper = await screen.findByTestId('results-body-stale-wrapper', {}, { timeout: 20_000 })
    expect(wrapper).toHaveAttribute('data-freshness-confirmed', 'false')
  }, 40_000)

  /**
   * ⭐ LIMB THAT SURVIVES #1 — `!isPreRun`. Before the first run there is no
   * engine critique to show; pre-run validation speaks through live
   * `graphHealth`. GREEN before and after; a mutant deleting this limb must
   * RED here and nowhere else.
   */
  it('before the first run no engine critique panel is mounted', async () => {
    seedPostRunCanvas({ completedFirstRun: false, freshness: 'fresh' })
    renderDock()
    // The dock renders its pre-run surface; the critique panel must not exist.
    await screen.findByTestId('outputs-pre-run-v3', {}, { timeout: 20_000 })
    expect(queryCritiquePanel()).not.toBeInTheDocument()
  }, 40_000)

  /**
   * ⭐ LIMB THAT SURVIVES #2 — BLOCKER severity. Warnings have their own
   * surface (`WarningBanner`); this panel is the blocked-run story only.
   */
  it('a warning-only critique does not mount the blocker panel, stale or fresh', async () => {
    seedPostRunCanvas({ freshness: 'stale', critique: WARNING_ONLY_CRITIQUE })
    renderDock()
    expect(await screen.findByTestId('results-body-stale-wrapper', {}, { timeout: 20_000 })).toBeTruthy()
    expect(queryCritiquePanel()).not.toBeInTheDocument()
  }, 40_000)
})

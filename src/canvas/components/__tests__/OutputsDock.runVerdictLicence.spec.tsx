/**
 * OutputsDock — a run is bound to the verdict that licensed it
 * (ROADMAP 2.635, invariant I-4).
 *
 * ── The gap ──────────────────────────────────────────────────────────────
 * The run gate is evaluated during RENDER. The click that acts on it dispatches
 * later, and `runCanonicalAnalysis` awaits `flushPendingSaves()` in between —
 * the F1 barrier that persists an in-flight autosave before a canonical V5 run
 * (which carries a scenario id, not a graph). That await is a real window: a
 * fresh readiness verdict can land inside it.
 *
 * Until 2.635 nothing tied the dispatch to the verdict that opened the gate, so
 * a run licensed by a verdict that had since been REPLACED BY A REFUSAL looked
 * exactly like one licensed by a current verdict — and the resulting doomed run
 * was un-attributable. The user presses Analyse, the run goes out against a
 * model the server has just said it cannot analyse, and the failure surfaces as
 * an engine error rather than as the readiness refusal it actually is.
 *
 * ── What this file pins, and why it needs a PAIR ─────────────────────────
 * A single "blocked" assertion would be satisfied by a barrier that refuses
 * whenever the verdict identity moves at all — which would be a far worse
 * defect than the one it fixes, because staleness marks flip on ordinary canvas
 * churn and the Run button would fail whenever the user touched anything. So
 * the discrimination is proved with a pair (CLAUDE.md trap 19):
 *
 *   · licence moved AND the new verdict OBJECTS   ⇒ must refuse
 *   · licence moved AND the new verdict PERMITS   ⇒ must run
 *
 * Neither alone shows the binding. The first proves sensitivity to something;
 * the second proves it is sensitive to the OBJECTION rather than to the mere
 * fact of change.
 *
 * ⚠ Surface binding (trap 3b): `netlify.toml` sets
 * `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"`, and the canonical runner under test is
 * the one `OutputsDock` registers regardless of that flag; the flag mock below
 * matches the deployment so the component mounts the surface a user loads.
 */

import '@testing-library/jest-dom/vitest'
import { render, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { getCanonicalRunner } from '../../analysis/canonicalRunRegistry'
import { RUN_LICENCE_SUPERSEDED_REFUSAL } from '../../utils/canRunAnalysis'

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
    // Force the V2 fallback so a permitted run has an observable, local
    // terminal outcome (`status: 'v2'`) instead of a fire-and-forget V5 stream.
    isV5CanonicalRunPath: () => false,
  }
})

const runV2Analysis = vi.fn(async () => {})
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: (...a: unknown[]) => runV2Analysis(...(a as [])), cancelRun: vi.fn() }),
}))

/**
 * The seam this file exists to exercise. `flushPendingSaves` is awaited between
 * the render-time gate and the dispatch, so whatever it does to the readiness
 * store happens INSIDE the window under test. Each test installs its own.
 */
let flushBehaviour: () => void | Promise<void> = () => {}

vi.mock('../../../hooks/useScenario', () => ({
  useScenario: () => ({
    setAnalysisRunning: vi.fn(),
    resetAnalysisStatus: vi.fn(),
    persistAnalysisSuccess: vi.fn(),
    persistAnalysisFailure: vi.fn(),
    isPersistenceActive: false,
    flushPendingSaves: async () => {
      await flushBehaviour()
    },
  }),
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

const LICENSING_VERDICT_AT_MS = 1_000_000

/** The verdict that OPENS the gate — the licence the run is issued against. */
const RUNNABLE_VERDICT = {
  readiness_score: 90,
  readiness_level: 'ready' as const,
  can_run_analysis: true,
  confidence_explanation: 'Ready to analyse',
  improvements: [],
  scaffold_plan: { will_scaffold_options: false },
  options_ready: 5,
  options_total: 5,
  goal_node_valid: true,
}

/** A LATER verdict that objects — identifiable by its own sentence. */
const SUPERSEDING_BLOCKED_VERDICT = {
  ...RUNNABLE_VERDICT,
  can_run_analysis: false,
  confidence_explanation: 'One option lost its effect values (verdict D2)',
  options_ready: 4,
}

/** A LATER verdict that still permits — the discriminating half. */
const SUPERSEDING_RUNNABLE_VERDICT = {
  ...RUNNABLE_VERDICT,
  confidence_explanation: 'Still ready to analyse (verdict D3)',
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

function seedPreRunCanvas() {
  const nodes = [
    { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'Build or buy?' } },
    { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Increase delivery output' } },
    { id: 'opt_build', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Build it in house' } },
    { id: 'opt_buy', type: 'option', position: { x: 10, y: 0 }, data: { kind: 'option', label: 'Buy a vendor platform' } },
    { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Ramp-up time' } },
  ]
  useCanvasStore.setState({
    nodes: nodes as never,
    edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }] as never,
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    hasCompletedFirstRun: false,
    results: { status: 'idle', progress: 0 },
    showDraftChat: false,
    v5AnalysisFact: null,
    analysisFreshness: null,
    ceeAnalysisReady: {
      goal_node_id: 'g1',
      status: 'ready',
      options: [
        { id: 'opt_build', status: 'ready' },
        { id: 'opt_buy', status: 'ready' },
      ],
    },
  } as never)
}

/** Hold the licensing verdict; the transport never settles so nothing else lands. */
function seedLicensingVerdict() {
  clearInflightCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
  useReadinessStore.setState({
    readiness: RUNNABLE_VERDICT,
    loading: false,
    error: null,
    stale: false,
    verdictAtMs: LICENSING_VERDICT_AT_MS,
  })
}

/** Land a NEW verdict, with a NEW timestamp — i.e. supersede the licence. */
function landVerdict(verdict: typeof RUNNABLE_VERDICT) {
  useReadinessStore.setState({
    readiness: verdict,
    loading: false,
    error: null,
    stale: false,
    verdictAtMs: LICENSING_VERDICT_AT_MS + 5_000,
  })
}

async function mountDockAndTakeRunner() {
  render(
    <ToastProvider>
      <OutputsDock />
    </ToastProvider>,
  )
  await waitFor(() => expect(getCanonicalRunner()).not.toBeNull(), { timeout: 20_000 })
  return getCanonicalRunner()!
}

beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

beforeEach(() => {
  ensureMatchMedia()
  runV2Analysis.mockClear()
  flushBehaviour = () => {}
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
  seedPreRunCanvas()
  seedLicensingVerdict()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.unstubAllGlobals()
})

describe('OutputsDock — the run is bound to the verdict that licensed it (I-4)', () => {
  // ── Control (trap 13): the gate is genuinely OPEN and the run genuinely
  // reaches the pipeline. Without this, "blocked" below could be the gate
  // refusing for some unrelated reason and the barrier never running at all.
  it('control — with the licence intact the run reaches the analysis pipeline', async () => {
    const run = await mountDockAndTakeRunner()

    const outcome = await run()

    expect(outcome).toEqual({ status: 'v2' })
    expect(runV2Analysis).toHaveBeenCalledTimes(1)
  }, 40_000)

  // ── The defect ───────────────────────────────────────────────────
  it('refuses when the licensing verdict is replaced by a refusal mid-dispatch', async () => {
    const run = await mountDockAndTakeRunner()
    // The refusal lands INSIDE the persistence-flush await — the real window.
    flushBehaviour = () => landVerdict(SUPERSEDING_BLOCKED_VERDICT)

    const outcome = await run()

    expect(outcome).toEqual({ status: 'blocked', reason: RUN_LICENCE_SUPERSEDED_REFUSAL })
    // The point of the barrier: the doomed run never went out.
    expect(runV2Analysis).not.toHaveBeenCalled()
  }, 40_000)

  // ── The discriminating half (trap 19) ────────────────────────────
  it('still runs when the licence moves but the new verdict permits', async () => {
    const run = await mountDockAndTakeRunner()
    // Identity moves — a genuinely new verdict, new timestamp — but it does not
    // object. A barrier keyed on identity ALONE would refuse here, and would
    // brick the Run button on ordinary re-check churn.
    flushBehaviour = () => landVerdict(SUPERSEDING_RUNNABLE_VERDICT)

    const outcome = await run()

    expect(outcome).toEqual({ status: 'v2' })
    expect(runV2Analysis).toHaveBeenCalledTimes(1)
  }, 40_000)

  it('still runs when a staleness mark lands mid-dispatch on a permitting verdict', async () => {
    const run = await mountDockAndTakeRunner()
    // The commonest case by far: the user nudges the canvas, `stale` flips, the
    // refetch is in flight. Ruling 3 — uncertainty must not lock the user out.
    flushBehaviour = () => useReadinessStore.setState({ stale: true })

    const outcome = await run()

    expect(outcome).toEqual({ status: 'v2' })
    expect(runV2Analysis).toHaveBeenCalledTimes(1)
  }, 40_000)
})

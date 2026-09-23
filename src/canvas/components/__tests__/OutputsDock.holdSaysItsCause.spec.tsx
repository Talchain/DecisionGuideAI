/**
 * OutputsDock → a hold says its operative cause, THROUGH THE REAL WIRING.
 *
 * The companion of `utils/__tests__/aHoldSaysItsOperativeCause.spec.tsx`. That
 * spec pins the shared authority and the light surfaces; this one mounts the
 * dock, because the two surfaces a starter user actually reads the hold on are
 * rendered here and nowhere else:
 *
 *   · Analysis tab — the V3 pre-analysis footer (`pre-analysis-v3-footer`) and
 *     its Analyse button's title, fed by `canRunAnalysis` in this component;
 *   · Model tab    — `ReanalyseBar`'s blocked subline and button title, fed by
 *     the SAME gate result (`runBlockedTooltip`).
 *
 * Neither receives its sentence as a prop from a test: the state is seeded
 * through the store and the module registers production writes, and the dock
 * computes the rest. This is the file class `OutputsDock.blockedReasonWiring`
 * exists for — a mutant that dropped the hold input from the dock's gate once
 * survived 261 function-level tests.
 *
 * The verdict is `can_run_analysis: true`, so the hold is the ONLY blocker and
 * a refusal cannot be satisfied by some other rung.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useReadinessStore } from '../../stores/readinessStore'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { VERDICT_ABSENT_FROM_PAYLOAD } from '../../store/analysisFreshness'
import * as held from '../../utils/analysisHeldOnInjectedModel'
import { ANALYSIS_HELD_NOTICE } from '../../utils/analysisHeldOnInjectedModel'
import {
  CAUSE_MUST_NAME,
  HOLD_CAUSES,
  acknowledgeCurrentGraph,
  arrangeHoldCause,
  resetEditHoldRegisters,
  seedHeldCanvas,
  type HoldCause,
} from '../../registration/__tests__/helpers/editHoldCauses'

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
    // The surface staging mounts (`netlify.toml` bakes it on).
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

const RUNNABLE_VERDICT = {
  readiness_score: 90,
  readiness_level: 'ready' as const,
  can_run_analysis: true,
  confidence_explanation: 'Ready',
  improvements: [],
  scaffold_plan: { will_scaffold_options: false },
  options_ready: 2,
  options_total: 2,
  goal_node_valid: true,
}

const REDRAFT = /re-?draft/i

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

function seedVerdict() {
  clearInflightCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...RUNNABLE_VERDICT, confidence_level: 'high' }),
      text: async () => '',
      headers: new Headers(),
    })),
  )
  useReadinessStore.setState({ readiness: RUNNABLE_VERDICT, loading: false, error: null } as never)
}

function seedTab(activeTab: 'results' | 'diagnostics') {
  try {
    sessionStorage.clear()
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab }))
  } catch {
    /* jsdom quirk — the render assertions will say so */
  }
}

function seedCanonicalRunPath() {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
}

function renderDock() {
  return render(
    <ToastProvider>
      <OutputsDock />
    </ToastProvider>,
  )
}

function sharedSentence(): string | null {
  const reason = held.heldReason(useCanvasStore.getState() as never)
  return reason === null ? null : reason.sentence
}

function expectNamesTheCause(text: string | null | undefined, cause: HoldCause) {
  expect(text, `no hold sentence for ${cause}`).toBeTruthy()
  const s = text as string
  expect(s, `${cause}: offers re-draft while a user edit is unresolved`).not.toMatch(REDRAFT)
  expect(s, `${cause}: still blames a saved example`).not.toContain('saved example')
  for (const needle of CAUSE_MUST_NAME[cause]) {
    if (typeof needle === 'string') expect(s, `${cause}: does not name "${needle}"`).toContain(needle)
    else expect(s, `${cause}: does not say ${needle}`).toMatch(needle)
  }
}

/** Analysis tab: the footer's subline and the Analyse button's title. */
async function readAnalysisTab(): Promise<{ footer: string; title: string | null }> {
  seedTab('results')
  renderDock()
  const footer = await screen.findByTestId('pre-analysis-v3-footer', {}, { timeout: 20_000 })
  const analyse = screen.getByTestId('pre-analysis-v3-analyse')
  expect(analyse, 'the hold must still refuse').toBeDisabled()
  const out = { footer: footer.textContent ?? '', title: analyse.getAttribute('title') }
  cleanup()
  return out
}

/** Model tab: the reanalyse bar's blocked subline and its button's title. */
async function readModelTab(): Promise<{ subline: string; title: string | null }> {
  seedTab('diagnostics')
  renderDock()
  const subline = await screen.findByTestId('reanalyse-blocked-reason', {}, { timeout: 20_000 })
  const button = screen.getByTestId('reanalyse-button')
  expect(button, 'the hold must still refuse').toBeDisabled()
  const out = { subline: subline.textContent ?? '', title: button.getAttribute('title') }
  cleanup()
  return out
}

beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

beforeEach(() => {
  ensureMatchMedia()
  seedCanonicalRunPath()
  seedVerdict()
  resetEditHoldRegisters()
  seedHeldCanvas()
  useCanvasStore.setState({
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    hasCompletedFirstRun: false,
    results: { status: 'idle', progress: 0 },
    showDraftChat: false,
    v5AnalysisFact: null,
    // The state the deployed never-run saved example was measured in
    // (`neverRunIsNotOutOfDate.spec.ts`): no verdict on the payload. Without
    // it the Model tab's bar has nothing to say and renders nothing at all.
    analysisFreshness: { freshness: 'unknown', freshnessReason: VERDICT_ABSENT_FROM_PAYLOAD },
  } as never)
})

afterEach(() => {
  cleanup()
  resetEditHoldRegisters()
  useReadinessStore.getState().reset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  try {
    localStorage.removeItem('feature.v5CanonicalAnalysis')
    sessionStorage.clear()
  } catch { /* jsdom quirk */ }
})

describe('OutputsDock → an edit-caused hold names its cause on the footer AND the Model-tab bar', () => {
  it.each(HOLD_CAUSES)('%s', async (cause) => {
    arrangeHoldCause(cause)

    // What the user reads, first — asserted before any comparison, so the RED
    // at the base is a statement about the screen, not about a missing export.
    const analysis = await readAnalysisTab()
    expectNamesTheCause(analysis.footer, cause)
    expectNamesTheCause(analysis.title, cause)
    const model = await readModelTab()
    expectNamesTheCause(model.subline, cause)
    expectNamesTheCause(model.title, cause)

    // …and it is ONE sentence: the shared authority's, on all four.
    const shared = sharedSentence()
    expect(analysis.footer, 'footer prints the shared sentence').toContain(shared as string)
    expect(analysis.title, 'Analyse title is the same sentence').toBe(shared)
    expect(model.subline, 'reanalyse bar prints the shared sentence').toBe(shared)
    expect(model.title, 'reanalyse title is the same sentence').toBe(shared)
  }, 60_000)
})

describe('OutputsDock → CONTROLS', () => {
  it('no edit unresolved: both surfaces keep the saved-example sentence, unchanged', async () => {
    const analysis = await readAnalysisTab()
    expect(analysis.footer).toContain(ANALYSIS_HELD_NOTICE.starter)
    expect(analysis.title).toBe(ANALYSIS_HELD_NOTICE.starter)
    const model = await readModelTab()
    expect(model.subline).toBe(ANALYSIS_HELD_NOTICE.starter)
  }, 60_000)

  it('model acknowledged + an unconfirmed value: no hold text, the Analyse control is live', async () => {
    arrangeHoldCause('unconfirmed_value')
    acknowledgeCurrentGraph()
    seedTab('results')
    renderDock()
    const analyse = await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    expect(analyse).toBeEnabled()
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).not.toHaveTextContent('Analysis is held')
    expect(footer.textContent ?? '').not.toMatch(/couldn['’]t confirm|still being saved/i)
  }, 60_000)
})

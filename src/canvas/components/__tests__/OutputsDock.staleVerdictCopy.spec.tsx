/**
 * OutputsDock — a stale verdict is not quoted as current, THROUGH THE REAL
 * WIRING (ROADMAP 2.635, invariants I-3 and I-4).
 *
 * ⚠ Why this file exists alongside `canRunAnalysis.staleVerdict.spec.ts`.
 * That spec proves the GATE withholds specific copy when told the verdict is
 * stale. It proves nothing about whether anything ever tells it. This is the
 * exact defect shape `OutputsDock.blockedReasonWiring.spec.tsx` was written for
 * after mutation survivor M3: reverting the dock's wiring hunk alone left the
 * whole suite green while the headline behaviour silently vanished.
 *
 * ⚠ Surface binding (CLAUDE.md trap 3b). The assertions below are bound to the
 * surface the DEPLOYED FLAGS mount. `netlify.toml` sets
 * `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"`, so `OutputsDock` renders
 * `PreAnalysisPanelV3` and the footer under test is `pre-analysis-v3-footer`.
 * The mock below pins `isPreAnalysisV3Enabled: () => true` to match, and the
 * first test asserts the MOUNT PATH itself, so this binding fails loud if the
 * flag ever moves — a green suite is not evidence about a component the
 * deployment does not render.
 *
 * ⚠ Scope (CLAUDE.md trap 3): these are DOM-content assertions, not layout or
 * visibility claims. Nothing here asserts anything is above the fold.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
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
    // Matches `netlify.toml` VITE_FEATURE_PRE_ANALYSIS_V3 = "1" — the surface
    // the deployment actually mounts.
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

/** The verdict from the failing journey: one option not ready, gate closed. */
const BLOCKED_VERDICT = {
  readiness_score: 90,
  readiness_level: 'ready' as const,
  can_run_analysis: false,
  confidence_explanation: 'V3 analysis not ready: 1 option(s) blocked: opt_extend',
  improvements: [],
  scaffold_plan: { will_scaffold_options: false },
  options_ready: 4,
  options_total: 5,
  goal_node_valid: true,
}

const OPTION_LABELS: Record<string, string> = {
  opt_build: 'Build it in house',
  opt_buy: 'Buy a vendor platform',
  opt_hybrid: 'Hybrid build and buy',
  opt_wait: 'Wait a year',
  opt_extend: 'Partner with a consultancy',
}

const SPECIFIC_SENTENCE = BLOCKED_REASON_COPY.oneOption('Partner with a consultancy', true)

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
    hasCompletedFirstRun: false,
    results: { status: 'idle', progress: 0 },
    showDraftChat: false,
    v5AnalysisFact: null,
    analysisFreshness: null,
  } as never)
}

function seedCeeAnalysisReady(notReadyIds: string[]) {
  useCanvasStore.setState({
    ceeAnalysisReady: {
      goal_node_id: 'g1',
      status: 'needs_input',
      options: Object.keys(OPTION_LABELS).map((id) => ({
        id,
        status: notReadyIds.includes(id) ? 'needs_encoding' : 'ready',
      })),
    },
  } as never)
}

/**
 * Put the store into the exact state under test and HOLD it there.
 *
 * The transport is stubbed with a promise that never settles. That is not a
 * convenience — it IS the state this row is about: a verdict has landed, the
 * canvas has since moved, the staleness mark is set, and the refetch that will
 * answer for the new model is IN FLIGHT. The window between those two events is
 * precisely when a surface can quote an outgrown verdict as current, and it is
 * the window the user sits in every time they act on a remedy chip.
 *
 * A resolving stub cannot express it: the dock's own `startListening()` fetch
 * lands on mount and clears `stale` (readinessStore `:841`), so the fixture
 * would silently become the fresh case and every assertion below would be about
 * the wrong state.
 */
function seedVerdict({ stale }: { stale: boolean }) {
  clearInflightCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
  useReadinessStore.setState({
    readiness: BLOCKED_VERDICT,
    loading: false,
    error: null,
    stale,
    verdictAtMs: Date.now(),
  })
}

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

describe('OutputsDock → the blocked footer, when the verdict is stale (I-3)', () => {
  // ── Control: the mount path, and that specific copy is REACHABLE ──
  //
  // Both halves matter. The mount assertion is trap 3b: it fails loud if the
  // deployed flag ever stops mounting this surface, instead of the whole file
  // quietly testing a component nobody renders. The copy assertion is trap 13:
  // it proves the specific sentence can arrive here at all, so the withholding
  // assertions below cannot pass by testing nothing.
  it('control — a FRESH verdict mounts the deployed surface and names the option', async () => {
    seedPreRunCanvas()
    seedCeeAnalysisReady(['opt_extend'])
    seedVerdict({ stale: false })

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    // The mount path itself — the V3 branch of OutputsDock's flag fork.
    expect(await screen.findByTestId('outputs-pre-run-v3', {}, { timeout: 20_000 })).toBeTruthy()

    const footer = await screen.findByTestId('pre-analysis-v3-footer', {}, { timeout: 20_000 })
    expect(footer).toHaveTextContent(SPECIFIC_SENTENCE)
  }, 40_000)

  it('a stale verdict does not name the option it graded', async () => {
    seedPreRunCanvas()
    seedCeeAnalysisReady(['opt_extend'])
    seedVerdict({ stale: true })

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const footer = await screen.findByTestId('pre-analysis-v3-footer', {}, { timeout: 20_000 })
    // The user may have just described this very option. Naming it again, from
    // a verdict that was never re-asked, is the false reason PC1 forbids.
    expect(footer).not.toHaveTextContent('Partner with a consultancy')
    expect(footer).not.toHaveTextContent(SPECIFIC_SENTENCE)
  }, 40_000)

  it('a stale verdict says the model changed and the check is being redone', async () => {
    seedPreRunCanvas()
    seedCeeAnalysisReady(['opt_extend'])
    seedVerdict({ stale: true })

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const footer = await screen.findByTestId('pre-analysis-v3-footer', {}, { timeout: 20_000 })
    expect(footer).toHaveTextContent(BLOCKED_REASON_COPY.staleRecheck)
  }, 40_000)

  it('the Run button carries the same stale sentence — one state, one story', async () => {
    seedPreRunCanvas()
    seedCeeAnalysisReady(['opt_extend'])
    seedVerdict({ stale: true })

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const analyse = await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    // Still disabled: staleness does not open the gate (that would be inventing
    // a verdict in the permissive direction). Only the CLAIM changes.
    expect(analyse).toBeDisabled()
    expect(analyse).toHaveAttribute('title', BLOCKED_REASON_COPY.staleRecheck)
  }, 40_000)
})

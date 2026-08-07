/**
 * OutputsDock — the blocked-state reason reaches the footer THROUGH THE REAL
 * WIRING (adversarial review of PR #520, 28 Jul — MUTATION SURVIVOR M3).
 *
 * ⚠ Why this file exists. The PR's panel specs inject the composed sentence as a
 * PROP (`renderPanel({ blockedReason: BLOCKED_REASON_COPY.oneOption(...) })`).
 * That proves the footer renders composed copy WHEN GIVEN IT — it proves
 * nothing about whether anything ever gives it. Reverting the OutputsDock hunk
 * alone (the `optionsNeedingValues` memo + the gate parameter) left 268/268
 * tests GREEN while the headline behaviour — naming the option the user must
 * describe — silently vanished into the generic `unspecified` line.
 *
 * So this spec renders the REAL <OutputsDock/>, seeds only STATE (canvas nodes,
 * `ceeAnalysisReady`, the readiness verdict), and asserts the sentence that
 * comes out of the footer. Every link is live: the label map built from canvas
 * nodes → `selectOptionsNeedingValues` → `canRunAnalysis` → `getRunButtonTooltip`
 * → the panel's `blockedReason` prop → `PanelFooter`.
 *
 * The option deliberately carries NO label in `ceeAnalysisReady`, so the ONLY
 * route to the user-visible name is the dock's own node-label map.
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
import { FOOTER_COPY } from '../pre-analysis-v3/constants'

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
    // The surface under test.
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
 * The readiness verdict CEE returned on Paul's failing journey: five options,
 * four ready, goal present, `can_run_analysis: false`, and a refusal sentence
 * carrying a banned term and an internal id. Held in the store directly AND
 * served by the stubbed transport, so a background refetch cannot flip it.
 */
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

/** Pre-run canvas: a decision, a goal and five options — Paul's actual model. */
function seedPreRunCanvas(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  } as never)
}

/**
 * `ceeAnalysisReady` as the wire delivers it. NOTE: no `label` on the options —
 * the only path to the user-visible name is the dock's node-label map.
 */
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

// The panel is lazy-loaded behind <Suspense>; warm the chunk once so the
// per-test wait is a render, not a module graph.
beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

/**
 * Hold the verdict in the store AND serve the identical body from the stubbed
 * transport, so the store's own debounced refetch cannot quietly swap the
 * fixture out from under the assertion mid-test.
 */
function seedVerdict(overrides: Partial<typeof BLOCKED_VERDICT> = {}) {
  const verdict = { ...BLOCKED_VERDICT, ...overrides }
  clearInflightCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...verdict, confidence_level: 'high' }),
      text: async () => '',
      headers: new Headers(),
    })),
  )
  useReadinessStore.setState({ readiness: verdict, loading: false, error: null })
}

beforeEach(() => {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
  seedVerdict()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.unstubAllGlobals()
})

describe('OutputsDock → the blocked footer, through the real wiring', () => {
  it('names the option the user must describe (no prop injection anywhere)', async () => {
    seedPreRunCanvas()
    seedCeeAnalysisReady(['opt_extend'])

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const footer = await screen.findByTestId('pre-analysis-v3-footer', {}, { timeout: 20_000 })
    expect(footer).toHaveTextContent('Not ready for analysis yet')
    expect(footer).toHaveTextContent(
      BLOCKED_REASON_COPY.oneOption('Partner with a consultancy', true),
    )

    // The three strings the surfaces used to show instead.
    expect(footer).not.toHaveTextContent('V3 analysis not ready')
    expect(footer).not.toHaveTextContent('opt_extend')
    expect(footer).not.toHaveTextContent('Add a decision, a goal and at least two options')
    // And not the non-committal line — that is what an unwired dock produces.
    expect(footer).not.toHaveTextContent(FOOTER_COPY.notReadySubFallback)
  }, 30_000)

  it('names two options when the verdict grades two not-ready', async () => {
    seedPreRunCanvas()
    seedCeeAnalysisReady(['opt_extend', 'opt_wait'])
    seedVerdict({ options_ready: 3 })

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const footer = await screen.findByTestId('pre-analysis-v3-footer', {}, { timeout: 20_000 })
    expect(footer).toHaveTextContent(
      BLOCKED_REASON_COPY.twoOptions('Wait a year', 'Partner with a consultancy', true),
    )
  }, 30_000)

  it('the Run button carries the same sentence — one state, one story', async () => {
    seedPreRunCanvas()
    seedCeeAnalysisReady(['opt_extend'])

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const analyse = await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    expect(analyse).toBeDisabled()
    expect(analyse).toHaveAttribute(
      'title',
      BLOCKED_REASON_COPY.oneOption('Partner with a consultancy', true),
    )
  }, 30_000)
})

/**
 * THE SENDABLE BLOCKER, REPRODUCED ON THE MOUNTED SURFACE AND KILLED THERE.
 *
 * ── THE CAPTURE THIS FILE IS BUILT FROM ────────────────────────────────────
 * Frozen quartet, 19 Aug 2026, fresh guest, governed brief
 * `04-conflicting-constraints`, 16-node model drafted successfully.
 * `useCanvasStore.getState()` read:
 *
 *   analysisStateV1.readiness = { status: 'ready', blockers: [] }
 *   analysisStateV1.run_state = { kind: 'never_run' }
 *   ceeAnalysisReady.status   = 'ready'    (every option 'ready')
 *
 * …and `[data-testid="pre-analysis-v3-analyse"]` was DISABLED, titled
 * *"Olumi needs something more from this model before the next analysis. Ask in
 * the chat and it will explain what is missing."* The producer had just said
 * nothing was missing. The product asserted an untruth about the user's own
 * model, and the chat route it pointed at was itself silent.
 *
 * ── WHY A MOUNTED SPEC, WHEN THE GATE IS ALREADY PINNED PURE ───────────────
 * `canonicalReadinessAuthority.spec.ts` proves `canRunAnalysis` answers
 * correctly. It proves NOTHING about whether the dock asks it correctly — and
 * this repo has the receipt: the sibling `OutputsDock.blockedReasonWiring.spec`
 * exists because reverting the dock's wiring hunk alone left 268/268 tests green
 * while the headline behaviour vanished. A pure-function fix nothing mounts is
 * the estate's most familiar dark capability, and this IS the blocker, so the
 * evidence has to reach the pixel the user cannot click.
 *
 * Every link here is live: canvas state → `useAnalysisReadinessAuthority`
 * → `canRunAnalysis` → `getRunButtonTooltip` → the panel's `canRun` /
 * `blockedReason` props → `PanelFooter`'s button. Nothing is injected as a prop.
 *
 * Scope (trap 3): the button's DISABLED state and its TITLE on the mounted
 * footer. Not layout, not visibility, not above-the-fold.
 *
 * Trap 3b: `pre-analysis-v3-analyse` and `pre-analysis-v3-footer` are the ids
 * the affordance sweep read off deployed builds, and `isPreAnalysisV3Enabled`
 * is forced on below to mount the surface the deployment mounts.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * ⚠ NOT INVENTED. This is field-for-field the verdict `readinessStore`'s
 * empty-canvas arm composes and then RETAINS across a failed refetch — five
 * fields, no `goal_node_valid`, no `options_total`, no `scaffold_plan`. Those
 * absences are exactly why `composeReadinessBlockedReason` falls through to
 * `unspecified`, and therefore why the deployed tooltip read the way it did.
 * A fixture outside the producer's output domain proves nothing (trap 16); this
 * one is inside it.
 */
const SIDE_CAR_OBJECTS_WITHOUT_A_CAUSE = {
  readiness_score: 0,
  readiness_level: 'needs_work' as const,
  can_run_analysis: false,
  confidence_explanation: 'Add some nodes to get started',
  improvements: [],
}

const OPTION_LABELS: Record<string, string> = {
  opt_extend: 'Extend the free trial',
  opt_hold: 'Hold the current price',
  opt_bundle: 'Bundle onboarding in',
}

function analysisState(readiness: AnalysisStateV1['readiness']): AnalysisStateV1 {
  return {
    run_state: { kind: 'never_run' },
    readiness,
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
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

/** The captured canvas: a decision, a goal, three options, one factor. */
function seedCapturedCanvas() {
  const nodes = [
    { id: 'd1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'How do we protect retention?' } },
    { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Grow retained revenue' } },
    ...Object.entries(OPTION_LABELS).map(([id, label], i) => ({
      id,
      type: 'option',
      position: { x: 10 * i, y: 0 },
      data: { kind: 'option', label },
    })),
    { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Support headcount' } },
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
    // The capture's value: the legacy slice agreed the model was ready. It is
    // seeded so this test cannot pass merely because that slice was empty.
    ceeAnalysisReady: {
      goal_node_id: 'g1',
      status: 'ready',
      options: Object.keys(OPTION_LABELS).map((id) => ({ id, status: 'ready' })),
    },
  } as never)
}

/**
 * Hold the side-car verdict in the store AND serve the identical body from the
 * stubbed transport, so its own debounced refetch cannot swap the fixture out
 * mid-assertion (the sibling spec's rule, and it is load-bearing here: the whole
 * point is that this verdict OBJECTS throughout).
 */
function seedObjectingSideCar() {
  clearInflightCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ...SIDE_CAR_OBJECTS_WITHOUT_A_CAUSE }),
      text: async () => '',
      headers: new Headers(),
    })),
  )
  useReadinessStore.setState({
    readiness: SIDE_CAR_OBJECTS_WITHOUT_A_CAUSE,
    loading: false,
    error: null,
    stale: false,
    verdictAtMs: null,
  })
}

beforeAll(async () => {
  await import('../pre-analysis-v3')
}, 30_000)

beforeEach(() => {
  ensureMatchMedia()
  try { sessionStorage.clear() } catch { /* jsdom quirk */ }
  seedObjectingSideCar()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  useCanvasStore.setState({ analysisStateV1: null } as never)
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ═══════════════════════════════════════════════════════════════════════════

describe('the frozen capture, on the mounted control', () => {
  it('AC1 — producer-ready with ZERO blockers: the Analyse control is ENABLED', async () => {
    seedCapturedCanvas()
    useCanvasStore.setState({
      analysisStateV1: analysisState({ status: 'ready', blockers: [] }),
    } as never)

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const analyse = await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    expect(analyse).toBeEnabled()
    // An open gate makes no claim at all. `title` is set only while blocked.
    expect(analyse).not.toHaveAttribute('title')

    // And the sentence that was on the deployed build is gone from the surface.
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).not.toHaveTextContent(BLOCKED_REASON_COPY.unspecified)
    expect(footer).not.toHaveTextContent(FOOTER_COPY.notReadySubFallback)
    expect(footer).not.toHaveTextContent(FOOTER_COPY.notReady)
  }, 30_000)

  it('AC2 — real blockers: DISABLED, and the tooltip NAMES one, not a constant', async () => {
    seedCapturedCanvas()
    useCanvasStore.setState({
      analysisStateV1: analysisState({
        status: 'not_ready',
        blockers: [
          {
            code: 'OPTION_NOT_READY',
            category: 'options',
            message: 'The option has no effect values.',
            repairability: 'user_repairable',
            option_id: 'opt_extend',
            option_label: 'Extend the free trial',
          },
        ],
      }),
    } as never)

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    const analyse = await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    expect(analyse).toBeDisabled()
    expect(analyse).toHaveAttribute(
      'title',
      BLOCKED_REASON_COPY.canonicalOneBlocker('Extend the free trial'),
    )
    // Never the generic sentence, and never the raw identifier.
    expect(analyse).not.toHaveAttribute('title', BLOCKED_REASON_COPY.unspecified)
    expect(analyse.getAttribute('title')).not.toContain('opt_extend')

    // One state, one story: the footer subline says the SAME thing as the title.
    expect(screen.getByTestId('pre-analysis-v3-footer')).toHaveTextContent(
      BLOCKED_REASON_COPY.canonicalOneBlocker('Extend the free trial'),
    )
  }, 30_000)

  it('DISCRIMINATION — the two cases above differ ONLY in the producer verdict', async () => {
    // The side-car objects identically in all three tests. If the dock were
    // still gating on it, no producer verdict could move this control — so the
    // enabled/disabled flip observed across these tests is attributable to the
    // canonical authority and to nothing else in the fixture.
    seedCapturedCanvas()
    useCanvasStore.setState({
      analysisStateV1: analysisState({ status: 'ready', blockers: [] }),
    } as never)

    render(
      <ToastProvider>
        <OutputsDock />
      </ToastProvider>,
    )

    await screen.findByTestId('pre-analysis-v3-analyse', {}, { timeout: 20_000 })
    // The competitor is still objecting, in the store, at assertion time.
    expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(false)
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeEnabled()
  }, 30_000)
})

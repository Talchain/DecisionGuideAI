/**
 * ROADMAP 2.109 — the write-only `goal_threshold` CHIP PARAMETER is retired.
 *
 * WHY THIS IS A DELETION AND NOT A WIRING JOB. `chip.parameters.goal_threshold`
 * was a WRITE-ONLY channel: at CEE staging tip `1ba181e7` the complete manifest
 * of non-test `chip.parameters` readers is two sites — the `add_option` ingress
 * (`route-v2.ts:2684`) and the typed-chip mutation pre-route
 * (`turn-executor.ts:4536`, whose per-action_type reader map covers exactly
 * `set_factor_value` / `adjust_edge_strength` / `add_constraint`). NEITHER is
 * `run_analysis`, and the `run_analysis` handler
 * (`orchestrator-v5/tools/handlers/run-analysis.ts`) contains ZERO occurrences
 * of `parameters` or `goal_threshold` (checked with `rg -a`; the file is not
 * NUL-bearing, so the zero is a real absence and not trap 17). CEE says so in
 * its own source: "NOT WIRED HERE — the run-canonical `goal_threshold`
 * parameter … write-only today".
 *
 * The user's target reaches CEE through the GRAPH (`goal_threshold_raw`), which
 * is the channel that actually closed the defect. Wiring this second channel is
 * FORBIDDEN — a second writer racing the raw-anchored graph channel is the
 * split-brain class.
 *
 * WHAT THIS SPEC PINS. Three producer sites wrote the parameter; all three are
 * deleted. This spec drives two of them through the REAL dispatch seam and
 * asserts the dispatched `run_analysis` chip carries no `goal_threshold`:
 *   site 1 — the store re-attach block in `dispatchRunAnalysis`
 *   site 2 — `handleApplyThreshold` (inline target apply)
 * Site 3 (`DefineSuccessModal`) is pinned in that component's own spec.
 *
 * TRAP 13 — an absence assertion is vacuous unless it can first SEE a presence.
 * The positive control below is a REAL presence at the IDENTICAL seam, not a
 * synthetic literal: the generic `parameters` passthrough deliberately SURVIVES
 * this change (it carries `chip_id` provenance from node chips), so a caller
 * that explicitly supplies `goal_threshold` still rides. That control proves
 * the capture path and the assertion helper can observe the key when present.
 * The final test pins the passthrough's survival, so a future over-deletion of
 * the whole channel REDs here rather than silently dropping provenance.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { getCanonicalRunner } from '../../analysis/canonicalRunRegistry'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useSuccessMeasureStore } from '../../../components/results/modals/successMeasureStore'
import { resolveScenarioKey } from '../../../components/results/modals/scenarioKey'

const {
  mockIsV5CanonicalAnalysisEnabled,
  mockIsV5Eligible,
  mockUseV2Run,
  mockShowToast,
  capturedResultsBodyProps,
} = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => true),
  mockIsV5Eligible: vi.fn((_input?: { flag: string | undefined }) => ({ eligible: true })),
  mockUseV2Run: vi.fn(() => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() })),
  mockShowToast: vi.fn(),
  capturedResultsBodyProps: { current: null as Record<string, unknown> | null },
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
  // Spread the real module (repo rule: a hand-listed factory silently drops
  // every export added later — this exact mock shipped that failure once).
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

vi.mock('../../hooks/useV2Run', async (importOriginal) => {
  // Spread the real module: OutputsDock also imports the pure goal-threshold
  // helpers from here — only the hook itself is mocked.
  const actual = await importOriginal<typeof import('../../hooks/useV2Run')>()
  return { ...actual, useV2Run: () => mockUseV2Run() }
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

vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" />,
}))

vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

// Prop-capturing body stub: `handleApplyThreshold` (producer site 2) is only
// reachable as the `onApplyThreshold` prop OutputsDock hands down, so the mock
// captures props rather than counting renders.
vi.mock('../../../components/results/ResultsBody', () => ({
  ResultsBody: (props: Record<string, unknown>) => {
    capturedResultsBodyProps.current = props
    return <div data-testid="mock-results-body" />
  },
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

/**
 * Seeds a completed run AND a provable goal threshold. Provability matters:
 * at pristine the store re-attach block resolved raw 60 against the saved
 * "%" measure (definitional cap 100) to 0.6 and attached it — which is
 * exactly what makes these absence assertions RED before the deletion.
 */
function seedCompletedRunWithProvableThreshold() {
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
    goalThreshold: 60,
  } as never)

  useSuccessMeasureStore.getState()._reset()
  useSuccessMeasureStore.getState().saveMeasure(
    resolveScenarioKey(useCanvasStore.getState().currentScenarioId),
    {
      metric: 'Conversion',
      direction: 'reach_at_least',
      threshold: 60,
      unit: '%',
      timeframe: '6 months',
      baseline: null,
      savedAt: 0,
    },
  )
}

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

type ChipAction = { action_type?: string; parameters?: Record<string, unknown> }

/**
 * Bound by IDENTITY to the chip under test — the dispatched `run_analysis`
 * chip action — never a generic sweep over an arbitrary payload.
 */
function runAnalysisChips(dispatchAction: { mock: { calls: unknown[][] } }): ChipAction[] {
  return dispatchAction.mock.calls
    .map((call) => call[0] as ChipAction)
    .filter((action) => action?.action_type === 'run_analysis')
}

function goalThresholdParamOf(chip: ChipAction): unknown {
  return chip.parameters?.goal_threshold
}

describe('ROADMAP 2.109 — producer-side goal_threshold chip parameter is retired', () => {
  beforeEach(() => {
    ensureMatchMedia()
    vi.clearAllMocks()
    capturedResultsBodyProps.current = null
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
    mockIsV5Eligible.mockReturnValue({ eligible: true } as never)
    mockUseV2Run.mockReturnValue({ runV2Analysis: vi.fn(), cancelRun: vi.fn() } as never)
    seedCompletedRunWithProvableThreshold()
  })

  it('POSITIVE CONTROL (trap 13): the capture + assertion CAN see a goal_threshold present at this exact seam', async () => {
    // Not a synthetic literal — a real dispatch through the real runner. The
    // `parameters` passthrough survives the deletion, so an explicit caller
    // value genuinely rides the wire. If this test ever goes green-by-blindness
    // (capture broken, wrong call selected, helper reading the wrong key), the
    // absence tests below would pass while proving nothing.
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as never)

    renderDock()
    const runner = getCanonicalRunner()
    await act(async () => {
      await runner!({ source: 'positive-control', parameters: { goal_threshold: 0.25 } })
    })

    const chips = runAnalysisChips(dispatchAction)
    expect(chips).toHaveLength(1)
    expect(goalThresholdParamOf(chips[0]!)).toBe(0.25)
    expect(JSON.stringify(chips[0])).toContain('goal_threshold')
  })

  it('site 1 (store re-attach): a plain canonical run dispatches NO goal_threshold parameter', async () => {
    // Pristine behaviour: the store threshold (raw 60) normalised against the
    // saved "%" measure to 0.6 and was attached to every plain run. The block
    // that did that is deleted; the target now reaches CEE via the graph only.
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as never)

    renderDock()
    const runner = getCanonicalRunner()
    await act(async () => {
      await runner!({ source: 'freshness-strip' })
    })

    const chips = runAnalysisChips(dispatchAction)
    expect(chips).toHaveLength(1)
    expect(goalThresholdParamOf(chips[0]!)).toBeUndefined()
    expect(chips[0]!.parameters ?? {}).not.toHaveProperty('goal_threshold')
    expect(JSON.stringify(chips[0])).not.toContain('goal_threshold')
  })

  it('site 2 (handleApplyThreshold): applying an inline target dispatches NO goal_threshold parameter', async () => {
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as never)

    renderDock()
    expect(screen.getByTestId('mock-results-body')).toBeInTheDocument()
    const onApplyThreshold = capturedResultsBodyProps.current?.onApplyThreshold as
      | ((t: number | null) => void)
      | undefined
    expect(onApplyThreshold).toBeTypeOf('function')

    await act(async () => {
      onApplyThreshold!(60)
    })

    // The apply still COMMITS the target to the store + goal node — only the
    // chip parameter is retired. That commit is what the graph channel carries.
    expect(useCanvasStore.getState().goalThreshold).toBe(60)

    const chips = runAnalysisChips(dispatchAction)
    expect(chips).toHaveLength(1)
    expect(goalThresholdParamOf(chips[0]!)).toBeUndefined()
    expect(chips[0]!.parameters ?? {}).not.toHaveProperty('goal_threshold')
    expect(JSON.stringify(chips[0])).not.toContain('goal_threshold')
  })

  it('the generic parameters passthrough SURVIVES: chip_id provenance still rides', async () => {
    // Guards the opposite error — deleting the whole channel rather than the
    // one write-only key. Node chips ship `chip_id` provenance through it.
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as never)

    renderDock()
    const runner = getCanonicalRunner()
    await act(async () => {
      await runner!({ source: 'node-chip', parameters: { chip_id: 'goal_run_analysis' } })
    })

    const chips = runAnalysisChips(dispatchAction)
    expect(chips).toHaveLength(1)
    expect(chips[0]!.parameters).toEqual({ chip_id: 'goal_run_analysis' })
    expect(goalThresholdParamOf(chips[0]!)).toBeUndefined()
  })
})

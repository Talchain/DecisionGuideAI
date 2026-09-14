/**
 * ⭐⭐ RUNNING THE ANALYSIS MUST NOT DELETE WHAT AN OPTION CHANGES, WHICH OPTION
 * IS THE BASIS OF COMPARISON, OR THAT THE BASELINE IS THE BASELINE.
 *
 * WITNESSED ON A REAL USER'S MODEL, served `fdbaa4e4`. Pre-analysis every option
 * card carried its interventions ("Pro plan monthly price £49 → £54") and its
 * "Reference: Status Quo (Hold Price, No Feature Push)" line; the Status Quo
 * card said "Baseline option". **Post-analysis all five cards carried
 * "Support percentage unavailable" and nothing else.**
 *
 * TWO GATES CAUSED IT, and both are removed:
 *   1. `structuredDeltaChipsRender` opened `!isPostAnalysis &&` — and that
 *      block renders the "Reference:" line too, so one gate took both.
 *   2. the "Baseline option" render gate opened `!isPostAnalysis &&`.
 *
 * ⚠ THE DATA WAS NEVER LOST — ONLY THE RENDER. The same session's debug bundle
 * still holds every intervention post-analysis
 * (`cee_options[].intervention_details[].display_value` = `"£54"`) and
 * `is_baseline` is still true. This removes a suppression; it adds no claim.
 *
 * ⭐ THE SIBLING SPEC SETTLED THE PRINCIPLE for the differentiator line (merged
 * #1247): the sentence is derived from the MODEL, not the result. An
 * intervention is the same kind of fact — what the user asked the analysis to
 * consider, not something it produced — and the baseline is a reference the run
 * neither chooses nor changes.
 *
 * ⚠⚠ THE FIXTURE MUST PRODUCE A CHIP, and my first cut of this file DID NOT —
 * caught by mutation, not by reading. `structuredDeltas` is empty unless a
 * DECLARED BASELINE OPTION carries a labelled value for the same factor
 * (`OptionNode.tsx:729-741`), so restoring the gate left every case GREEN. The
 * same warning is written into the sibling spec and I still walked into it.
 * Each case below therefore asserts its own PRECONDITION — the chip is present
 * pre-analysis — so a fixture that stops producing one REDs instead of passing.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom text assertions. They prove PRESENCE
 * and ABSENCE of text in the DOM, never layout or visibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** Two factors, two non-baseline options, each differing on its own factor. */
const FACTOR_HEAD = { id: 'f-head', type: 'factor', data: { label: 'Developer headcount', type: 'factor' } }
const FACTOR_COST = { id: 'f-cost', type: 'factor', data: { label: 'Coordination cost', type: 'factor' } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Hire two developers', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hire a tech lead', type: 'option' } }


const CEE_READY = {
  options: [
    { id: 'option-1', interventions: { 'f-head': 3 } },
    { id: 'option-2', interventions: { 'f-cost': 5 } },
  ],
}

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_HEAD, FACTOR_COST, OPTION_1, OPTION_2],
  edges: [],
  ceeAnalysisReady: CEE_READY,
  // A run that COMPLETED and withheld its leader: a report with no
  // option_comparison, which is what produced the captured state.
  results: { status: 'complete', report: {} },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    // This fixture has no per-option result; draft metadata must stay in
    // draft mode when a test changes the store's analysis lifecycle.
    winRate: null,
    isResultsMode: useCanvasStore((state) => state.results.status) === 'complete',
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'option-1',
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}



describe('OptionNode — the run must not delete the model content', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const SHARED_FACTOR = {
    id: 'f-head',
    type: 'factor',
    data: { label: 'Developer headcount', type: 'factor', observedState: { value: 0, unit: 'count' }, unit: 'count' },
  }
  const BASELINE_OPTION = {
    id: 'option-b',
    type: 'option',
    data: { label: 'Status quo', type: 'option', is_baseline: true, interventions: { 'f-head': { value: 0, display_value: '0 engineers' } } },
  }
  const SHARED_CEE = {
    options: [
      { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' } } },
      { id: 'option-2', interventions: { 'f-head': { value: 9, display_value: '9 engineers' } } },
    ],
  }

  const renderCard = (results: unknown, data: Record<string, unknown> = {}, id = 'option-1') => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: SHARED_CEE,
        nodes: [SHARED_FACTOR, FACTOR_COST, OPTION_1, OPTION_2, BASELINE_OPTION],
        results,
      }) as any))
    return render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} id={id} data={{ label: 'Hire two developers', type: 'option', ...data }} />
      </ReactFlowProvider>
    )
  }

  const IDLE = { status: 'idle' }
  const COMPLETE = { status: 'complete', report: {} }
  /** Bound by IDENTITY to this fixture's pair, not a substring another chip could satisfy. */
  const CHIP = '0 engineers → 3 engineers'

  it('PRECONDITION: pre-analysis the card renders the delta chip and its reference', () => {
    // Without this the two POST cases below can pass on an empty fixture — the
    // exact way the first cut of this file was vacuous.
    renderCard(IDLE)
    expect(screen.getByText(CHIP)).toBeInTheDocument()
    expect(screen.getByText(/Reference: Status quo/)).toBeInTheDocument()
  })

  it('⭐ POST-ANALYSIS: the delta chip is still on the card', () => {
    renderCard(COMPLETE)
    expect(screen.getByText(CHIP)).toBeInTheDocument()
  })

  it('⭐ POST-ANALYSIS: the reference line is still on the card', () => {
    // What the option is measured AGAINST. Without it a delta names a number
    // with no basis, and a ranking has nothing to be a ranking of.
    renderCard(COMPLETE)
    expect(screen.getByText(/Reference: Status quo/)).toBeInTheDocument()
  })

  it('⭐ POST-ANALYSIS: the baseline card still says it is the baseline', () => {
    renderCard(COMPLETE, { is_baseline: true }, 'option-b')
    expect(screen.getByText('Baseline option')).toBeInTheDocument()
  })

  it('THE TWIN: pre-analysis baseline is UNCHANGED', () => {
    // Held constant so the pair isolates `isPostAnalysis` alone: a mutant that
    // restores either gate REDs a POST case and leaves its twin GREEN.
    renderCard(IDLE, { is_baseline: true }, 'option-b')
    expect(screen.getByText('Baseline option')).toBeInTheDocument()
  })

  /**
   * ⛔ THE OPPOSITE DIRECTION. Removing a suppression risks showing a delta on
   * the card that IS the reference — a baseline states no delta because
   * everything is measured against it. A corpus testing only "the chip
   * survives" would applaud that regression.
   */
  it('the BASELINE card shows no delta chip of its own, in BOTH phases', () => {
    for (const results of [COMPLETE, IDLE]) {
      const { unmount } = renderCard(results, { is_baseline: true }, 'option-b')
      expect(screen.queryByText(CHIP)).toBeNull()
      unmount()
    }
  })
})

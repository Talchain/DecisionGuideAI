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
 *
 * ⭐ RE-POINTED BY THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep 2026: the S3
 * change rows move "to the existing hover/focus popover and inspector"; the card
 * keeps ONE line — the top change pre-run, the share post-run). The claim is
 * unchanged — the run deletes none of this — and the change row is now read in
 * the option's popover detail (`option-preview-detail-<id>`), which is mounted
 * in both phases. The baseline statement is bound by its test id and may sit on
 * the card (its one line) or in the popover (after a run); either way the run
 * has not deleted it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { changeRow } from './__helpers__/optionChangeRowText'
import { optionPreviewDetail } from './__helpers__/optionPreview'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
// Pass-through popover: the moved detail is in the DOM to be read by identity.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

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
  /**
   * Locked Canvas design (23 Sep 2026; spec §4, ED 11:52Z point 4): the
   * "Reference: <baseline>" line is gone from the face. The reference now
   * travels ON the change row: its `from` IS the baseline option's own value,
   * and the row's title names the basis. Bound by identity to this option's
   * row for this factor.
   */
  const ROW = 'option-change-row-option-1-f-head'
  const REFERENCE_TITLE = 'From Status quo (the baseline option)'
  /** option-1's popover detail — where its change rows live (bounded anatomy). */
  const preview = () => within(optionPreviewDetail('option-1')!)
  const expectReferenceOnTheRow = () => {
    const row = preview().getByTestId(ROW)
    // Paul 23 Sep contract feedback point 7: the target's source is named on the
    // row. This fixture's intervention carries no `source`, so the row says
    // "no source" — never "you", and never Olumi's estimate (Codex #63
    // 5801529767; reviewer blocker, 23 Sep). Contract v3.1 pt 7 (gap U12): a
    // muted `·` now sets the mark apart from the value so it cannot read as a unit.
    expect(row.textContent).toBe(`${CHIP} · no sourceSource not recorded`)
    // The title also restates the full row ("<factor>: <from> → <to>."); the
    // reference clause is the claim this file owns.
    expect(row.getAttribute('title')).toContain(REFERENCE_TITLE)
    // The old FACE line must not come back on the card. (After a run the
    // popover's own "What this option sets:" list names its reference in words —
    // that is the preview, which this pass-through mock now renders, not the face.)
    for (const el of screen.queryAllByText(/Reference: Status quo/)) {
      expect(screen.getByTestId('node-popover').contains(el)).toBe(true)
    }
  }

  it('PRECONDITION: pre-analysis the card renders the delta chip and its reference', () => {
    // Without this the two POST cases below can pass on an empty fixture — the
    // exact way the first cut of this file was vacuous.
    renderCard(IDLE)
    // contract v3.1 OPT-03: the row's "from" half is its own muted span, so the
    // chip is found by the change-row identity matcher, not one text node.
    expect(preview().getByText(changeRow(CHIP))).toBeInTheDocument()
    expectReferenceOnTheRow()
  })

  it('⭐ POST-ANALYSIS: the delta chip is still there — in the option\'s popover', () => {
    renderCard(COMPLETE)
    expect(preview().getByText(changeRow(CHIP))).toBeInTheDocument()
  })

  it('⭐ POST-ANALYSIS: the reference is still there — on the popover row', () => {
    // What the option is measured AGAINST. Without it a delta names a number
    // with no basis, and a ranking has nothing to be a ranking of.
    renderCard(COMPLETE)
    expectReferenceOnTheRow()
  })

  it('⭐ POST-ANALYSIS: the baseline card still says it is the baseline', () => {
    renderCard(COMPLETE, { is_baseline: true }, 'option-b')
    expect(screen.getByTestId('option-baseline-meta-option-b').textContent).toBe('Baseline option')
  })

  it('THE TWIN: pre-analysis baseline is UNCHANGED', () => {
    // Held constant so the pair isolates `isPostAnalysis` alone: a mutant that
    // restores either gate REDs a POST case and leaves its twin GREEN.
    renderCard(IDLE, { is_baseline: true }, 'option-b')
    expect(screen.getByTestId('option-baseline-meta-option-b').textContent).toBe('Baseline option')
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
      // contract v3.1 OPT-03: by identity too, or a split row passes vacuously.
      expect(screen.queryByText(changeRow(CHIP))).toBeNull()
      // Locked Canvas design (23 Sep 2026): the change rows are the delta's home.
      expect(screen.queryByTestId('option-change-rows-option-b')).toBeNull()
      unmount()
    }
  })
})

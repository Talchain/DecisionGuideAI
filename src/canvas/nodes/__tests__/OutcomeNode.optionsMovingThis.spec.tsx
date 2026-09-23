/**
 * ⭐⭐ THE OUTCOME CARD SAYS HOW MANY OPTIONS ACT ON IT — ON THE CARD, BEFORE
 * THE RUN.
 *
 * ⛔ Paul 23 Sep contract feedback point 8 NARROWED THIS LINE: it renders only
 * where it differentiates (some, not all, options connect) and names its
 * denominator — "2 of 3 options connect to this". The every-option case is
 * pinned silent in `outcomeRisk.paulContractFeedback.spec.tsx`. This fixture's
 * outcomes are reached by 2 and 1 of 3 options, so both still speak here.
 *
 * (Originally written unrun; run and green in the 23 Sep contract-feedback pass.)
 *
 * ⚠ WHAT THIS FILE PINS THAT `domain/__tests__/optionsReaching.spec.ts` CANNOT:
 * WHERE the sentence lives. The count, the de-duplication and the silence are
 * graph facts and are pinned there, against the product's own topology. This
 * file exists for the one claim a pure spec cannot make — that a user reading
 * the board sees it without hovering.
 *
 * ⭐ `NodePopover` IS NOT MOCKED HERE, AND THAT IS THE INSTRUMENT.
 * `NodePopover.tsx` is `if (!visible) return null`, so in a resting render its
 * children are ABSENT FROM THE DOM rather than merely invisible — the
 * distinction `render-matrix.spec.tsx` loses by mocking it into a plain div,
 * and the reason a whole set of coaching chips was once green in the suite and
 * absent on the deployed canvas (`cardFaceQuestions.restingState.spec.tsx`
 * carries that measurement). So anything found in the resting render below is
 * on the card face. The Standard-view case asserts a popover-only chip is
 * ABSENT in the same render, so the file stays discriminating if anyone
 * re-mocks the popover or moves the line into it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode } from '../OutcomeNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'outcome-1',
  type: 'outcome',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/**
 * The product's own shape: an option never touches an outcome directly. Across
 * the five committed starters the edge grammar is `option→factor` 58 and
 * `option→outcome` 0, so a fixture wiring one straight in would certify a path
 * the producer never emits.
 */
const NODES = [
  { id: 'decision-1', type: 'decision', data: { type: 'decision', label: 'Billing approach' } },
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Buy' } },
  { id: 'option-3', type: 'option', data: { type: 'option', label: 'Partner' } },
  { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
  { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'Licence cost' } },
  { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'Partner appetite' } },
  { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
  { id: 'outcome-2', type: 'outcome', data: { type: 'outcome', label: 'Brand reach' } },
]

const EDGES = [
  { id: 'd1', source: 'decision-1', target: 'option-1', data: {} },
  { id: 'd2', source: 'decision-1', target: 'option-2', data: {} },
  { id: 'd3', source: 'decision-1', target: 'option-3', data: {} },
  { id: 'o1f1', source: 'option-1', target: 'factor-1', data: {} },
  { id: 'o2f2', source: 'option-2', target: 'factor-2', data: {} },
  { id: 'o3f3', source: 'option-3', target: 'factor-3', data: {} },
  { id: 'f1o1', source: 'factor-1', target: 'outcome-1', data: {} },
  { id: 'f2o1', source: 'factor-2', target: 'outcome-1', data: {} },
  // option-3's factor lands on the other outcome, so the two cards must differ.
  { id: 'f3o2', source: 'factor-3', target: 'outcome-2', data: {} },
]

const applyStore = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState({ nodes: NODES, edges: EDGES, ...overrides }) as any),
  )

const renderOutcome = (id = 'outcome-1', label = 'Revenue') =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} id={id} data={{ label, type: 'outcome' }} />
    </ReactFlowProvider>,
  )

describe('OutcomeNode — how many options move this', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore()
  })

  it.each(['idle', 'complete'])(
    'states the count on the card in the %s phase — the pre-run case is the point',
    (status) => {
      applyStore({ results: { status, report: null } })
      renderOutcome()
      // Locked Canvas design (23 Sep 2026): MT-20 — the verb says what was
      // counted ("connect"), not a causal effect nothing measured ("move").
      expect(screen.getByTestId('outcome-options-moving').textContent).toBe('2 of 3 options connect to this')
    },
  )

  /**
   * ⭐ THE DISCRIMINATOR. A line reading the option TOTAL rather than the ones
   * that reach THIS card would say "3 options move this" on both cards and
   * satisfy the case above. Two cards, one board, two answers.
   */
  it('gives the other outcome on the same board its own answer, in the singular', () => {
    renderOutcome('outcome-2', 'Brand reach')
    // Locked Canvas design (23 Sep 2026): MT-20 wording, singular kept.
    expect(screen.getByTestId('outcome-options-moving').textContent).toBe('1 of 3 options connects to this')
  })

  it('says nothing when no option reaches this outcome', () => {
    applyStore({
      edges: EDGES.filter(e => e.id !== 'o1f1' && e.id !== 'o2f2'),
    })
    renderOutcome()
    // Positive control: the card itself rendered, so the absence above is the
    // component's decision and not an empty render (CLAUDE.md trap 13).
    expect(screen.getByLabelText(/outcome node/i)).toBeDefined()
    expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
  })

  it('says nothing on a board with no options at all', () => {
    applyStore({
      nodes: NODES.filter(n => n.type !== 'option'),
      edges: EDGES.filter(e => e.id === 'f1o1' || e.id === 'f2o1'),
    })
    renderOutcome()
    expect(screen.getByLabelText(/outcome node/i)).toBeDefined()
    expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
  })

  /**
   * Standard view is what a fresh user gets. The line must be on the card
   * there, and the popover-only chip must not be — one render, both halves,
   * so this stays a statement about LOCATION.
   */
  it('is on the card in Standard view, where the popover content is not', () => {
    applyStore({ viewMode: 'standard' })
    renderOutcome()
    // Locked Canvas design (23 Sep 2026): MT-20 wording.
    expect(screen.getByTestId('outcome-options-moving').textContent).toBe('2 of 3 options connect to this')
    expect(screen.queryByText('Explore consequences')).toBeNull()
  })
})

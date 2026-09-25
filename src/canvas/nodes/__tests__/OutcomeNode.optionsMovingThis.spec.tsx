/**
 * ⛔ UPDATED 24 Sep 2026 (GAP-36, DESIGN-GAP-AUDIT-20260924.md row 36;
 * contract §01): the `getByLabelText` positive controls below now match
 * "Outcome: …" (the user-facing Kind word), not the old "outcome node: …".
 *
 * ⛔⛔ RETIRED BY CONTRACT v3.1 pt 8 (gap U2, 24 Sep 2026): THE OUTCOME CARD NO
 * LONGER SAYS HOW MANY OPTIONS CONNECT TO IT — IN ANY VIEW, IN EITHER PHASE.
 *
 * This file used to pin "2 of 3 options connect to this" on the card face, before
 * the run. Paul 23 Sep point 8 first narrowed it to the some-but-not-all case;
 * v3.1 then hardened the rule — remove "N options move/connect" UNLESS it
 * genuinely differentiates, e.g. "No option moves this outcome" — and its
 * fixture removes the line from all outcomes. Paul flagged the served "2 of 3"
 * form against v3.1, so the some-but-not-all case is gone too. No zero-state
 * sentence ever existed, and none is invented here.
 *
 * The same fixture is kept because it is the one that made the line SPEAK
 * (2-of-3 and 1-of-3 on one board, in Standard and Detailed): every case below
 * would have rendered the line at base. `NodePopover` is still not mocked, so
 * an absence here is an absence from the card face, and each case keeps a
 * positive control on the card itself (trap 13).
 *
 * The graph fact (`domain/optionsReaching.ts`) is untouched and still pinned by
 * `domain/__tests__/optionsReaching.spec.ts`; only its card sentence is gone.
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

describe('OutcomeNode — no option-reach count on the card (contract v3.1 pt 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore()
  })

  const COUNT = /\boptions? connects? to this|options? moves? this|alternatives connect/i

  it.each([
    ['expert', 'idle'],
    ['expert', 'complete'],
    ['standard', 'idle'],
    ['standard', 'complete'],
  ])('%s view, %s phase: the 2-of-3 outcome carries no count line', (viewMode, status) => {
    applyStore({ viewMode, results: { status, report: null } })
    const { container } = renderOutcome()
    expect(screen.getByLabelText(/^Outcome:/i)).toBeDefined()
    expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
    expect(container.textContent).not.toMatch(COUNT)
  })

  it('the 1-of-3 outcome on the same board carries none either', () => {
    const { container } = renderOutcome('outcome-2', 'Brand reach')
    expect(screen.getByLabelText(/^Outcome:/i)).toBeDefined()
    expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
    expect(container.textContent).not.toMatch(COUNT)
  })

  it('an outcome no option reaches gains no invented "No option moves this outcome" line', () => {
    applyStore({
      edges: EDGES.filter(e => e.id !== 'o1f1' && e.id !== 'o2f2'),
    })
    const { container } = renderOutcome()
    expect(screen.getByLabelText(/^Outcome:/i)).toBeDefined()
    expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
    expect(container.textContent).not.toMatch(/No option moves/i)
  })
})

/**
 * ⛔⛔ TWO CARDS OFFER "Run analysis" ON DIFFERENT PREDICATES. THE DEFECT IS
 * REAL, THE FIRST FIX FOR IT WAS WRONG, AND THIS FILE NOW PINS THE GAP RATHER
 * THAN A REPAIR.
 *
 * MEASURED on a real render, not read from source. `cardAnatomy.measure.ts`
 * walks every visible leaf of every card on a seeded starter at 1600x1000. On
 * `pricing-model` the decision card and the goal card BOTH carry a chip reading
 * "Run analysis", with the same label, the same message and the same
 * `actionType="run_analysis"`. Their gates were not the same:
 *
 *     decision   allFactorsPresent && goalDefined     <- readiness
 *     goal       hasThreshold && !isPostAnalysis      <- a target exists
 *
 * So on a model with a goal target and a factor still missing its value, the
 * decision card correctly WITHHELD the action and named the gap, while the goal
 * card offered it anyway. That is not merely a duplicated primary action on one
 * screen — it is two surfaces answering one question with opposite answers.
 *
 * ── THE TWO QUESTIONS, WRITTEN DOWN BEFORE THE ASSERTIONS (trap 21) ─────────
 * Trap 21's remedy depends on whether the two authorities answer the SAME
 * question or two similar ones, and the two cases have OPPOSITE fixes. Checked
 * rather than assumed:
 *
 *     decision card asks   "may this model be analysed now?"
 *     goal card asked      "may this model be analysed now?"
 *
 * Identical. Both gate the identical chip with the identical message, so this
 * is the SAME question and the remedy is ONE AUTHORITY WITH TWO CONSUMERS —
 * `useModelReadiness`, extracted for exactly this. (Where the questions
 * genuinely differ the remedy is the reverse: name them apart, as
 * `GoalNode.noTargetChipCopy.spec.tsx` does. That is not this case.)
 *
 * ⚠ THE FIX MUST NOT BE "HIDE THE GOAL CHIP". A card that never offers the
 * action when the model IS ready would trade a false yes for a false no, so the
 * READY case is asserted below as well. Without it this file would pass on a
 * deletion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const GOAL_ID = 'goal-1'
const LABEL = 'Reach 110% NRR Within Four Quarters'

/** A factor whose value is present — counts as ready. */
const READY_FACTOR = {
  id: 'f-ready', type: 'factor', position: { x: 0, y: 0 },
  data: { label: 'Adoption friction', category: 'controllable', observedState: { value: 0.4, extractionType: 'inferred' } },
}
/**
 * A factor with NO value and NO prior — `useModelReadiness` counts it as
 * `missingCount`. This is the state the decision card refuses to run on.
 */
const MISSING_FACTOR = {
  id: 'f-missing', type: 'factor', position: { x: 0, y: 0 },
  data: { label: 'Enterprise churn exposure', category: 'controllable' },
}

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: 110,
  goalConstraints: [],
  nodes: [{ id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: LABEL } }],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'standard',
  selectNodeWithoutHistory: vi.fn(),
  ...overrides,
})

vi.mock('../../store', () => {
  const useCanvasStore = vi.fn() as unknown as {
    (selector: (s: unknown) => unknown): unknown
    getState: () => unknown
  }
  return { useCanvasStore }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { GoalNode } from '../GoalNode'
import { useModelReadiness } from '../../hooks/useModelReadiness'

const goalProps = {
  id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

function renderGoalWith(nodes: unknown[]) {
  const state = makeStoreState({
    nodes: [
      { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: LABEL, goal_threshold_raw: 110 } },
      ...nodes,
    ],
  })
  const mocked = vi.mocked(useCanvasStore) as unknown as {
    mockImplementation: (f: (selector: (s: unknown) => unknown) => unknown) => void
    getState: unknown
  }
  mocked.mockImplementation((selector) => selector(state))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return render(
    <ReactFlowProvider>
      <GoalNode {...goalProps} data={{ label: LABEL, goal_threshold_raw: 110, type: 'goal' }} />
    </ReactFlowProvider>,
  )
}

const runAnalysisChips = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('button, [role="button"]'))
    .filter(el => (el.textContent ?? '').trim() === 'Run analysis')

describe('"Run analysis" — the two cards, and the authority neither of them reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
      predictedOutcome: null, valueOfInformation: null, voiRank: null,
    } as never)
  })
  afterEach(() => cleanup())

  /**
   * ⛔ THIS ASSERTS THE DEFECT, DELIBERATELY, AND IT IS NOT A REGRESSION TEST
   * FOR A FIX — there is no fix yet.
   *
   * A first repair gated this chip on the decision card's own predicate. An
   * independent review refuted it: `canRunAnalysis.ts` is the authority (13
   * consumers) and weighs graph health, `analysisReadiness`, the producer's
   * `mayRun`, blockers and held states — several of which admit a run that a
   * bare missing-factor count refuses. Gating here on the narrower predicate
   * trades a false YES for a false NO.
   *
   * ⭐ SO THE GAP IS PINNED INSTEAD. A defect recorded in the suite is honest; a
   * defect invisible to it is how it survives. When both cards are moved onto
   * `canRunAnalysis`, this test REDs by design and is replaced by one asserting
   * the agreement — which is exactly the signal wanted at that moment.
   */
  it('KNOWN GAP: the goal card offers the action while a factor is still missing its value', () => {
    const { container } = renderGoalWith([READY_FACTOR, MISSING_FACTOR])
    expect(container.textContent).toContain('Reach 110% NRR')
    // The decision card would withhold here. This card does not.
    expect(runAnalysisChips(container)).toHaveLength(1)
  })

  it('…and offers it when everything IS present, so the gap is asymmetry not noise', () => {
    const { container } = renderGoalWith([READY_FACTOR])
    expect(runAnalysisChips(container)).toHaveLength(1)
  })

  it('the readiness hook is whole-graph and takes no node id', () => {
    // What DOES survive from the withdrawn change, and the reason it is worth
    // landing on its own: `useModelReadiness` moved out of `DecisionNode` and
    // lost a `decisionId` parameter that appeared exactly twice — the signature
    // and the dependency array — and never in the body. A parameter nothing
    // reads is a claim about scope the code does not make.
    expect(useModelReadiness.length).toBe(0)
  })
})

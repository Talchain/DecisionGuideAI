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
 *
 * ⭐ LOCKED CANVAS DESIGN (23 Sep 2026; ED 11:52Z points 1–2). The goal card's
 * "Run analysis" chip (`goal_run_analysis`) is REMOVED: the Question card's
 * rail carries the canvas's ONE run affordance, `decision-run-analysis-<id>`
 * (label "Run the analysis now", or the held notice), which calls
 * `runAnalysisFromCard('decision_run_analysis', …)`. So the KNOWN GAP pinned
 * below — two cards, one question, opposite answers — is closed by there being
 * ONE surface, not by the goal card adopting a predicate. The arms now assert
 * both halves: the goal card offers nothing in either state, and the Question
 * card's rail offers the run exactly when its own predicate admits it (the
 * ready case), so "hide the goal chip" cannot pass as a deletion.
 * ⚠ THE AUTHORITY IS STILL NOT READ: the Question card's gate is still
 * `allFactorsPresent && goalDefined`, not `canRunAnalysis`. That half of the
 * title remains true and is not claimed fixed here.
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

// Locked Canvas design (23 Sep 2026): the rail run icon calls the shared
// `runAnalysisFromCard`; spied here so the ready arm can bind the click to the
// canonical pipeline by its chip id. Everything else in the module is real.
vi.mock('../shared/NodeChip', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shared/NodeChip')>()),
  runAnalysisFromCard: vi.fn(),
}))

import { fireEvent } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { GoalNode } from '../GoalNode'
import { DecisionNode } from '../DecisionNode'
import { runAnalysisFromCard } from '../shared/NodeChip'
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

/**
 * Locked Canvas design (23 Sep 2026): ANY run affordance on a card — the old
 * chip text, or a rail icon's accessible name — so the goal card's absence
 * cannot pass because the action merely moved into an icon.
 */
const RUN_NAME = /^(Run analysis|Run the analysis now)$/
const anyRunAffordance = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(el =>
    RUN_NAME.test((el.textContent ?? '').trim()) || RUN_NAME.test(el.getAttribute('aria-label') ?? ''),
  )

const DECISION_ID = 'decision-1'
const DECISION_RUN = `decision-run-analysis-${DECISION_ID}`

/** The Question card on the SAME graph, with two options linked. */
function renderDecisionWith(nodes: unknown[]) {
  const state = makeStoreState({
    nodes: [
      { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: LABEL, goal_threshold_raw: 110 } },
      { id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 }, data: { type: 'decision', label: 'Which plan?' } },
      { id: 'opt-a', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Plan A' } },
      { id: 'opt-b', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Plan B' } },
      ...nodes,
    ],
    edges: [
      { id: 'd-a', source: DECISION_ID, target: 'opt-a', data: {} },
      { id: 'd-b', source: DECISION_ID, target: 'opt-b', data: {} },
    ],
  })
  vi.mocked(useCanvasStore).mockImplementation(((selector: (s: unknown) => unknown) => selector(state)) as never)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  const decisionProps = { ...goalProps, id: DECISION_ID, type: 'decision', data: { label: 'Which plan?', type: 'decision' } }
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(decisionProps as unknown as React.ComponentProps<typeof DecisionNode>)} />
    </ReactFlowProvider>,
  )
}

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
  it('GAP CLOSED (locked design): with a factor missing its value, NEITHER card offers the action', () => {
    // Locked Canvas design (23 Sep 2026; ED 11:52Z point 2): the goal card's run
    // chip is removed, so it can no longer answer "yes" where the Question card
    // answers "no".
    const goal = renderGoalWith([READY_FACTOR, MISSING_FACTOR])
    expect(goal.container.textContent).toContain('Reach 110% NRR')
    expect(runAnalysisChips(goal.container)).toHaveLength(0)
    expect(anyRunAffordance(goal.container)).toHaveLength(0)
    cleanup()

    // The Question card on the same graph withholds too — one answer, one surface.
    const decision = renderDecisionWith([READY_FACTOR, MISSING_FACTOR])
    expect(decision.container.textContent).toContain('Which plan?')
    expect(decision.queryByTestId(DECISION_RUN)).toBeNull()
    expect(anyRunAffordance(decision.container)).toHaveLength(0)
  })

  it('…and when everything IS present the ONE run affordance is the Question card\'s rail — not a deletion', () => {
    // Locked Canvas design (23 Sep 2026; ED 11:52Z point 1): the ready case must
    // still offer the run somewhere, or this file would pass on "hide it".
    const goal = renderGoalWith([READY_FACTOR])
    expect(anyRunAffordance(goal.container)).toHaveLength(0)
    cleanup()

    const decision = renderDecisionWith([READY_FACTOR])
    const icon = decision.getByTestId(DECISION_RUN)
    expect(anyRunAffordance(decision.container)).toEqual([icon])
    expect(icon.getAttribute('aria-label')).toBe('Run the analysis now')
    fireEvent.click(icon)
    expect(vi.mocked(runAnalysisFromCard)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runAnalysisFromCard).mock.calls[0][0]).toBe('decision_run_analysis')
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

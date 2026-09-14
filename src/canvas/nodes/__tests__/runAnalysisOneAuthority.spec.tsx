/**
 * ⭐⭐⭐ TWO CARDS OFFERED "Run analysis". THEY DISAGREED ABOUT WHETHER THE MODEL
 * WAS READY, AND THE ONE THAT SAID YES WAS THE ONE THAT WAS WRONG.
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
import { GoalNode } from '../GoalNode'

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

describe('"Run analysis" — one readiness authority across the cards that offer it', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => cleanup())

  it('the goal card WITHHOLDS the action while a factor is still missing its value', () => {
    const { container } = renderGoalWith([READY_FACTOR, MISSING_FACTOR])

    // PRECONDITIONS pinned in-test. A zero below must be the READINESS gate's
    // doing, so both of the OTHER conditions in the chip's expression are
    // asserted to hold first:
    //   1. the card mounted at all
    //   2. the goal carries a stated target (`hasThreshold`) — the product
    //      reads `goal_threshold_raw`, NOT the store scalar `goalThreshold`,
    //      and a fixture using the wrong key would make this pass for the
    //      wrong reason. The ready case below proves the key is right.
    expect(container.textContent).toContain('Reach 110% NRR')

    expect(runAnalysisChips(container)).toHaveLength(0)
  })

  it('…and OFFERS it once every factor has a value — the fix is not "hide the chip"', () => {
    const { container } = renderGoalWith([READY_FACTOR])
    expect(container.textContent).toContain('Reach 110% NRR')
    expect(runAnalysisChips(container)).toHaveLength(1)
  })

  it('an EXTERNAL factor with no value does not block — it is not a gap anyone can fill', () => {
    // Binds the readiness rule's own semantics rather than "any factor without
    // a value". `useModelReadiness` counts external factors separately and they
    // never reach `missingCount`; asserting otherwise would pin a rule the
    // product does not have.
    const EXTERNAL = {
      id: 'f-ext', type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Competitive pressure', category: 'external' },
    }
    const { container } = renderGoalWith([READY_FACTOR, EXTERNAL])
    expect(runAnalysisChips(container)).toHaveLength(1)
  })
})

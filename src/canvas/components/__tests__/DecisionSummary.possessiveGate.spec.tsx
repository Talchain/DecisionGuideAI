import { CHANCE_NOT_SHOWN_YET } from '@/canvas/runView/runView'
import { installCanonicalFixtureState } from '@/components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { licensedTestReport } from '../../runView/__tests__/helpers/licensedTestReport'
/**
 * DecisionSummary — THE POSSESSIVE GATE (ROADMAP 2.283).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ WHY THIS SURFACE IS GATED RATHER THAN DELETED — READ THIS FIRST
 * ─────────────────────────────────────────────────────────────────────────
 * This lane was briefed to DELETE `DecisionSummary.tsx` as review-verified
 * dead. Re-verifying liveness at tip `e5d2111c` (the brief's own instruction)
 * overturned that in two ways, so it is gated instead:
 *
 *   1. The briefed PATH does not exist. There is no
 *      `src/components/results/DecisionSummary.tsx`; the file is
 *      `src/canvas/components/DecisionSummary.tsx`.
 *   2. "Type-only importers" is TRUE but does NOT mean "safe to delete". The
 *      file also exports `RankingData`, consumed by
 *      `src/canvas/hooks/useOptionRanking.ts:14` and
 *      `src/canvas/components/ResultsPanel/OptionComparisonReveal.tsx:16`.
 *      Deleting the file emits TS2307 at both — new errors absent from the
 *      typecheck baseline, so the gate goes RED. The COMPONENT is dead; the
 *      FILE is load-bearing.
 *
 * The brief's own rule ("if either shows ANY live reference, gate instead of
 * delete and say so") therefore applies. The clean collapse — deleting the
 * whole `RankingData` cluster — is real but is a larger, separate change and
 * is rowed, not smuggled in here.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────
 * Both arms of the sentence name the USER'S GOAL over the selector's number:
 *   "{N}% chance of reaching {threshold} for {goalLabel}"
 *   "{N}% chance of achieving {goalLabel}"
 * Under `joint_goal_substituted` that number is P(all constraints jointly
 * satisfied) standing in for an absent `probability_of_goal`, and the file
 * already called `selectGoalProbability` — it read the decision and walked
 * past `.basis`, exactly as `GoalPanel` did before #556.
 *
 * Scope limit (trap 3): jsdom pins string presence/absence only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'
import { DecisionSummary } from '../DecisionSummary'
import { useCanvasStore } from '../../store'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'
import { GOAL_ANCHOR_COPY } from '../../../components/results/utils/goalAnchorCopy'

vi.mock('../../../hooks/useISLConformal', () => ({
  useISLConformal: () => ({ data: null, loading: false, predict: vi.fn() }),
}))
vi.mock('../../hooks/useComparisonDetection', () => ({
  useComparisonDetection: () => ({ optionNodes: [], isComparison: false }),
}))
vi.mock('../../utils/graphPayload', () => ({
  buildRichGraphPayload: vi.fn(() => ({ nodes: [], edges: [] })),
  getRecommendedOptionInterventions: vi.fn(() => null),
}))
vi.mock('../../utils/ceeDataAdapter', () => ({
  getRationale: vi.fn(() => ({ source: 'none', headline: '', drivers: [] })),
}))
vi.mock('../../../lib/precisionDisplay', () => ({
  getPrecisionDisplay: vi.fn(() => ({
    headline: '65%',
    isPointEstimate: true,
    secondary: null,
    qualifier: null,
  })),
}))

/** The witnessed substituted shape: joint present, goal absent, unconstrained. */
const SUBSTITUTED_OPTION = {
  probability_of_joint_goal: 0.0054,
  confidence: 0.9,
  win_probability: 0.4,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
}
/** A run carrying the REAL goal quantity — possessive earned. */
const REAL_GOAL_OPTION = {
  probability_of_goal: 0.55,
  probability_of_joint_goal: 0.0054,
  confidence: 0.9,
  win_probability: 0.4,
}
/** 29 Sep 2026 (AIQ 5882498938): a constrained option carrying its GOAL figure (0.3, distinct from the joint 0.42). */
const CONSTRAINED_OPTION = {
  probability_of_goal: 0.3,
  probability_of_joint_goal: 0.42,
  constraint_analysis: { constraints: [{ id: 'c1' }] },
  confidence: 0.9,
  win_probability: 0.4,
}
/** The same constraints with NO goal figure — withheld, exactly like the substituted run. */
const CONSTRAINED_NO_GOAL_OPTION = {
  probability_of_joint_goal: 0.42,
  constraint_analysis: { constraints: [{ id: 'c1' }] },
  confidence: 0.9,
  win_probability: 0.4,
}

const GOAL_LABEL = 'Grow Annual Revenue'

function setStore(option: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: GOAL_LABEL, kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'opt-1', type: 'option', data: { label: 'Option A', kind: 'option' }, position: { x: 0, y: 0 } },
      { id: 's1_control_option', type: 'option', data: { label: 'Control', kind: 'option' }, position: { x: 0, y: 0 } },
    ],
    edges: [],
    outcomeNodeId: 'goal-1',
    goalThreshold: null,
    results: {
      status: 'complete',
      report: licensedTestReport({
        results: { likely: 65, conservative: 40, optimistic: 90, units: 'percent', unitSymbol: '%' },
        confidence: { level: 'medium', why: 'Test reason' },
        option_probabilities: { 'opt-1': option },
      }),
    },
    runMeta: null,
    ceeAnalysisReady: null,
  } as any)
}

const absenceTextOf = () => {
  const { container } = render(<DecisionSummary />)
  const face = within(container).getByText(CHANCE_NOT_SHOWN_YET)
  expect(face.textContent).toBe(CHANCE_NOT_SHOWN_YET)
  expect(face.textContent).not.toMatch(/\d+%/)
  expect(face.textContent).not.toContain('Why?')
  return container.textContent ?? ''
}

const textOf = () => render(<DecisionSummary />).container.textContent ?? ''

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DecisionSummary — possessive gate on a substituted joint goal figure (ROADMAP 2.283)', () => {
  it('control: each fixture drives the REAL selector to the basis this suite claims for it', () => {
    // Anti-vacuity (trap 13): the absence assertions below are worthless if a
    // fixture stopped reaching its branch.
    expect(selectGoalProbability(SUBSTITUTED_OPTION).basis).toBe('joint_goal_withheld')
    // ⭐ L62: and it carries no number, which is what turns "the possessive is
    // withheld" below into "no goal claim renders at all".
    expect(selectGoalProbability(SUBSTITUTED_OPTION).goalProbability).toBeNull()
    expect(selectGoalProbability(REAL_GOAL_OPTION).basis).toBe('goal_probability')
    expect(selectGoalProbability(CONSTRAINED_OPTION).basis).toBe('goal_probability')
    expect(selectGoalProbability(CONSTRAINED_NO_GOAL_OPTION).basis).toBe('joint_goal_withheld')
    expect(selectGoalProbability(CONSTRAINED_NO_GOAL_OPTION).goalProbability).toBeNull()
  })

  it('control: the goal-probability block renders at all for this store shape', () => {
    // Proves the block is REACHED — otherwise "the possessive is gone" would
    // just mean "nothing rendered".
    expect(textOf()).toBeDefined()
    setStore(REAL_GOAL_OPTION)
    expect(absenceTextOf()).toContain(CHANCE_NOT_SHOWN_YET)
  })

  /**
   * ⭐ AMENDED BY L62. 2.283 kept the number and swapped the voice; L60 showed
   * the number is the untruth (a structural zero from a frame-blind
   * comparison), so this card states no goal claim at all on that basis. The
   * possessive assertions are unchanged and still load-bearing; the
   * "renders the withheld phrase" half is inverted.
   */
  it('L62: states NO goal claim on the witnessed substituted run — neither voice', () => {
    setStore(SUBSTITUTED_OPTION)
    const text = textOf()
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
    // Neither possessive arm survives either: both named the user's own goal.
    expect(text).not.toContain('chance of achieving')
    expect(text).not.toContain(`achieving ${GOAL_LABEL}`)
  })

  it('positive control: a REAL probability_of_goal keeps the possessive', () => {
    setStore(REAL_GOAL_OPTION)
    const text = absenceTextOf()
    expect(text).toContain(CHANCE_NOT_SHOWN_YET)
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('55%', true))
  })

  // 29 Sep 2026 (AIQ 5882498938): was "joint_goal_constrained keeps the possessive" — now the GOAL figure on a constrained option does.
  it('positive control: the goal figure on a constrained option keeps the possessive — never the joint figure', () => {
    setStore(CONSTRAINED_OPTION)
    const text = absenceTextOf()
    expect(text).toContain(CHANCE_NOT_SHOWN_YET)
    expect(text).not.toContain(`About 42% chance of meeting your goal.`)
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('30%', true))
  })

  it('a constrained option with NO goal figure states no goal claim — the joint figure never stands in', () => {
    setStore(CONSTRAINED_NO_GOAL_OPTION)
    const text = textOf()
    expect(text).not.toContain('chance of achieving')
    expect(text).not.toContain('42%')
  })
})

it('view-bearing control: DecisionSummary retains possessive goal wording and never substitutes the joint figure', () => {
  for (const [option, pct] of [[REAL_GOAL_OPTION, 55], [CONSTRAINED_OPTION, 30]] as const) {
    setStore(option)
    useCanvasStore.setState(installCanonicalFixtureState(useCanvasStore.getState()))
    const { container, unmount } = render(<DecisionSummary />)
    expect(container.textContent).toContain(`about ${pct}% chance of meeting your goal, in this model.`)
    expect(container.textContent).not.toContain('42% chance')
    expect(container.textContent).not.toContain(GOAL_ANCHOR_COPY.phrase(`${pct}%`, true))
    unmount()
  }
})

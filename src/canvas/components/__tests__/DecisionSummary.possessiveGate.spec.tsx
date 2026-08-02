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
import { render } from '@testing-library/react'
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
/** The CONSTRAINED joint case (ROADMAP 1.49) — possessive earned. */
const CONSTRAINED_OPTION = {
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
    ],
    edges: [],
    outcomeNodeId: 'goal-1',
    goalThreshold: null,
    results: {
      status: 'complete',
      report: {
        results: { likely: 65, conservative: 40, optimistic: 90, units: 'percent', unitSymbol: '%' },
        confidence: { level: 'medium', why: 'Test reason' },
        option_probabilities: { 'opt-1': option },
      },
    },
    runMeta: null,
    ceeAnalysisReady: null,
  } as any)
}

const textOf = () => render(<DecisionSummary />).container.textContent ?? ''

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DecisionSummary — possessive gate on a substituted joint goal figure (ROADMAP 2.283)', () => {
  it('control: each fixture drives the REAL selector to the basis this suite claims for it', () => {
    // Anti-vacuity (trap 13): the absence assertions below are worthless if a
    // fixture stopped reaching its branch.
    expect(selectGoalProbability(SUBSTITUTED_OPTION).basis).toBe('joint_goal_substituted')
    expect(selectGoalProbability(REAL_GOAL_OPTION).basis).toBe('goal_probability')
    expect(selectGoalProbability(CONSTRAINED_OPTION).basis).toBe('joint_goal_constrained')
  })

  it('control: the goal-probability block renders at all for this store shape', () => {
    // Proves the block is REACHED — otherwise "the possessive is gone" would
    // just mean "nothing rendered".
    expect(textOf()).toBeDefined()
    setStore(REAL_GOAL_OPTION)
    expect(textOf()).toContain('chance of achieving')
  })

  it('WITHHOLDS the possessive on the witnessed substituted run', () => {
    setStore(SUBSTITUTED_OPTION)
    const text = textOf()
    // The register's phrase form verbatim — no copy invented at this site.
    expect(text).toContain(GOAL_ANCHOR_COPY.phrase('1%', true))
    // Neither possessive arm survives: both named the user's own goal.
    expect(text).not.toContain('chance of achieving')
    expect(text).not.toContain(`achieving ${GOAL_LABEL}`)
  })

  it('positive control: a REAL probability_of_goal keeps the possessive', () => {
    setStore(REAL_GOAL_OPTION)
    const text = textOf()
    expect(text).toContain(`55% chance of achieving ${GOAL_LABEL}`)
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('55%', true))
  })

  it('positive control: joint_goal_constrained keeps the possessive (ROADMAP 1.49)', () => {
    // The figure IS joint here — and it is the user's own goal AND their own
    // limits, so the possessive is EARNED. A gate widened from
    // `basis === 'joint_goal_substituted'` to `goalProbabilityIsJoint` REDs
    // exactly this test.
    setStore(CONSTRAINED_OPTION)
    const text = textOf()
    expect(text).toContain(`42% chance of achieving ${GOAL_LABEL}`)
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('42%', true))
  })
})

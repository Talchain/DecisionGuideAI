/**
 * GOAL-PROBABILITY IDENTITY PARITY — the results panel and the canvas must
 * make the SAME decision about the same option in the same session.
 *
 * THE DEFECT THIS PINS (live at staging 201f1075, both surfaces deployed):
 * the producer emits two semantically different quantities under one display
 * name — `goal_probability` (P(this option clears the user's goal threshold))
 * and `probability_of_joint_goal` (P(all constraints jointly satisfied)) —
 * and the UI chose between them TWICE, with different rules:
 *
 *   • `components/results/utils/selectGoalProbability.ts` (results panel,
 *     hero, OptionCards, OptionNode badge) falls back to the joint value when
 *     it is the only number the run carries, and flags it as joint.
 *   • `canvas/hooks/useNodeDisplayMetadata.ts` (GoalNode, OutcomeNode,
 *     NodeInspector) took the joint value ONLY when the option carried its
 *     own `constraint_analysis` — which no live V5 producer populates
 *     (`v5/mapV5AnalysisToReport.ts` emits none; `adapters/plot/v2/
 *     responseMapper.ts` nulls it behind PLOT_PER_OPTION_CONSTRAINTS_SUSPECT)
 *     — and otherwise returned `rec.goal_probability ?? null`.
 *
 * On the documented ISL-auto-derived-goal-threshold run (`goal_probability`
 * ABSENT, `probability_of_joint_goal` PRESENT, no per-option
 * `constraint_analysis` — the case `selectGoalProbability`'s own docstring
 * names) those two rules DISAGREE: the results panel renders a percentage
 * plus its provenance caveat while the canvas GoalNode renders "This run did
 * not produce a goal probability". Same session, same option, two contrary
 * claims, with the caveat on one surface only.
 *
 * These tests therefore assert AGREEMENT, not a hard-coded number: whatever
 * the single source of truth decides, the canvas consumer must return the
 * same value and the same provenance. The positive control below fixes that
 * decision first (CLAUDE.md trap 13 — an agreement assertion is vacuous until
 * it has proved it can see a presence), so a "both surfaces returned null"
 * state can never satisfy this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useNodeDisplayMetadata } from '../useNodeDisplayMetadata'
import {
  selectGoalProbability,
  type GoalProbabilityInput,
} from '../../../components/results/utils/selectGoalProbability'
import { GoalNode } from '../../nodes/GoalNode'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../../components/results/utils/goalFitBasisCaveatCopy'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// `importOriginal`-spread over the peripheral hooks (never a bare factory — a
// factory REPLACES the module and silently drops every other export, the
// dominant defect this repo keeps rediscovering). GoalNode's freshness and
// probability-presence hooks are pinned so this file exercises the
// goal-probability path and nothing else; the consumer under test
// (`useNodeDisplayMetadata`) is deliberately REAL.
vi.mock('../useAnalysisTrust', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAnalysisTrust: () => ({ semantic: 'current', orphaned: false, isRunning: false }),
}))
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHasAnyRealProbability: () => true,
}))

/**
 * The documented ISL-auto-derived-goal-threshold shape: the run carries
 * `probability_of_joint_goal` and NO `goal_probability`, and no per-option
 * `constraint_analysis` (the live V5 path never populates one).
 */
const JOINT_ONLY_RECORD: GoalProbabilityInput & Record<string, unknown> = {
  probability_of_joint_goal: 0.62,
  confidence: 0.5,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
}

/** Control: the run carries the true per-option goal quantity. */
const GOAL_QUANTITY_RECORD: GoalProbabilityInput & Record<string, unknown> = {
  goal_probability: 0.41,
  probability_of_joint_goal: 0.62,
  confidence: 0.5,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
}

const makeReport = (optionRecord: Record<string, unknown>) => ({
  schema: 'report.v1' as const,
  meta: { seed: 1, elapsed_ms: 100 },
  result: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9, critique: '' },
  bands: { p10: 0.5, p50: 0.7, p90: 0.9 },
  robustness: { recommended_option_id: 'option-1', recommendation_stability: 0.8 },
  option_probabilities: { 'option-1': optionRecord },
})

const makeStoreState = (optionRecord: Record<string, unknown>) => ({
  results: { status: 'complete', report: makeReport(optionRecord) },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
})

let storeState = makeStoreState(JOINT_ONLY_RECORD)

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(storeState)),
}))

import { useCanvasStore } from '../../store'

const useStore = (optionRecord: Record<string, unknown>) => {
  storeState = makeStoreState(optionRecord)
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(storeState as never))
}

const goalNodeProps = {
  id: 'goal-1',
  type: 'goal',
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

/** A target is set, so GoalNode's UI-SEM-082 gate is open. */
const renderGoalNode = () =>
  render(
    <ReactFlowProvider>
      <GoalNode
        {...goalNodeProps}
        data={{
          label: 'Increase revenue',
          type: 'goal',
          goal_threshold_raw: '100',
          goal_threshold_unit: '%',
        }}
      />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  useStore(JOINT_ONLY_RECORD)
})

describe('goal-probability identity — the two consumers agree', () => {
  it('POSITIVE CONTROL: the single source of truth really does show a number and a caveat here', () => {
    // Fixes the decision before anything asserts agreement with it, so a
    // "both surfaces returned null" state can never satisfy this file.
    const decision = selectGoalProbability(JOINT_ONLY_RECORD)
    expect(decision.goalProbability).toBe(0.62)
    expect(decision.goalFitIsModelledBasis).toBe(true)
  })

  it('the canvas consumer returns the SAME value as the results-panel selector', () => {
    const decision = selectGoalProbability(JOINT_ONLY_RECORD)
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBe(decision.goalProbability)
  })

  it('the canvas consumer returns the SAME provenance caveat as the results-panel selector', () => {
    const decision = selectGoalProbability(JOINT_ONLY_RECORD)
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(
      decision.goalFitIsModelledBasis,
    )
  })

  it('agrees on the control run too (the true goal quantity is present)', () => {
    useStore(GOAL_QUANTITY_RECORD)
    const decision = selectGoalProbability(GOAL_QUANTITY_RECORD)
    expect(decision.goalProbability).toBe(0.41)
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBe(decision.goalProbability)
    expect(result.current.achievementProbabilityIsModelledBasis).toBe(
      decision.goalFitIsModelledBasis,
    )
  })
})

describe('goal-probability identity — the rendered canvas text matches the decision', () => {
  // jsdom proves TEXT CONTENT, never layout or visibility (CLAUDE.md trap 3).
  // These assert what the node says, not where or whether it appears on screen.

  it('GoalNode states the same percentage the results panel does', () => {
    renderGoalNode()
    expect(screen.getByText(/62% chance of reaching target/)).toBeDefined()
  })

  it('GoalNode does not simultaneously deny that a goal probability exists', () => {
    renderGoalNode()
    expect(screen.queryByText(/did not produce a goal probability/)).toBeNull()
  })

  it('GoalNode carries the provenance caveat the results panel carries', () => {
    renderGoalNode()
    expect(screen.getByTestId('goal-fit-basis-caveat-node')).toHaveTextContent(
      GOAL_FIT_BASIS_CAVEAT_COPY,
    )
  })
})

describe('goal-probability identity — which quantity the number IS', () => {
  it('names the substituted joint quantity as its own basis', () => {
    expect(selectGoalProbability(JOINT_ONLY_RECORD).basis).toBe('joint_goal_substituted')
  })

  it('withholds the possessive framing when the joint value stands in for an absent goal value', () => {
    // The NUMBER is still shown — it is real, computed and decision-relevant.
    // Only "YOUR goal" is withheld, because the number answers a different
    // question from the one that phrase asserts.
    const decision = selectGoalProbability(JOINT_ONLY_RECORD)
    expect(decision.goalProbability).toBe(0.62)
    expect(decision.mayUsePossessiveGoalFraming).toBe(false)
  })

  it('permits the possessive framing when the value IS the goal quantity', () => {
    const decision = selectGoalProbability(GOAL_QUANTITY_RECORD)
    expect(decision.basis).toBe('goal_probability')
    expect(decision.mayUsePossessiveGoalFraming).toBe(true)
  })

  it('permits the possessive framing for an option carrying its own constrained joint figure', () => {
    const decision = selectGoalProbability({
      goal_probability: 0.41,
      probability_of_joint_goal: 0.07,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
    })
    expect(decision.basis).toBe('joint_goal_constrained')
    expect(decision.goalProbability).toBe(0.07)
    expect(decision.mayUsePossessiveGoalFraming).toBe(true)
  })

  it('reports no basis and no framing permission when neither quantity is present', () => {
    const decision = selectGoalProbability({})
    expect(decision.basis).toBe('none')
    expect(decision.goalProbability).toBeNull()
    expect(decision.mayUsePossessiveGoalFraming).toBe(false)
  })
})

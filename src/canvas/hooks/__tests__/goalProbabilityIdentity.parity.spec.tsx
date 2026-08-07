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
import { GOAL_ANCHOR_COPY } from '../../../components/results/utils/goalAnchorCopy'

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

/**
 * ⭐ L62 — the record this file's AGREEMENT tests now anchor on.
 *
 * `JOINT_ONLY_RECORD` above no longer produces a number (the substitution is
 * withheld — L60 §5–§8), and "both consumers returned null" is exactly the
 * vacuous agreement this file's positive control exists to forbid. The
 * CONSTRAINED basis is the remaining one that carries a joint number AND the
 * modelled-basis caveat, so it is the shape that keeps the parity claim
 * non-vacuous: same number, same caveat, both surfaces.
 */
const CONSTRAINED_JOINT_RECORD: GoalProbabilityInput & Record<string, unknown> = {
  probability_of_joint_goal: 0.62,
  constraint_analysis: { constraints: [{ id: 'c1' }] },
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
  // ⭐ L62: was `JOINT_ONLY_RECORD`. Tests that need the WITHHELD shape now
  // switch to it explicitly, so the default state of this file is one where a
  // number genuinely exists and "agreement" means something.
  useStore(CONSTRAINED_JOINT_RECORD)
})

describe('goal-probability identity — the two consumers agree', () => {
  it('POSITIVE CONTROL: the single source of truth really does show a number and a caveat here', () => {
    // Fixes the decision before anything asserts agreement with it, so a
    // "both surfaces returned null" state can never satisfy this file.
    const decision = selectGoalProbability(CONSTRAINED_JOINT_RECORD)
    expect(decision.goalProbability).toBe(0.62)
    expect(decision.goalFitIsModelledBasis).toBe(true)
  })

  it('the canvas consumer returns the SAME value as the results-panel selector', () => {
    const decision = selectGoalProbability(CONSTRAINED_JOINT_RECORD)
    const { result } = renderHook(() => useNodeDisplayMetadata('goal-1', 'goal'))
    expect(result.current.achievementProbability).toBe(decision.goalProbability)
  })

  it('the canvas consumer returns the SAME provenance caveat as the results-panel selector', () => {
    const decision = selectGoalProbability(CONSTRAINED_JOINT_RECORD)
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
    // ⚠ ROADMAP 2.283 — THIS TEST WAS PINNING THE DEFECT.
    //
    // It asserted `/62% chance of reaching target/`, i.e. the POSSESSIVE voice,
    // over `JOINT_ONLY_RECORD` — a SUBSTITUTED payload. This same file asserts
    // twenty lines below that the selector publishes
    // `mayUsePossessiveGoalFraming: false` for exactly this record, and that
    // the possessive "is withheld when the joint value stands in for an absent
    // goal value". So the file pinned the withholding at the SELECTOR and the
    // possessive at the RENDER — a contradiction it could not detect, because
    // no assertion compared the two. #556 recorded `GoalNode.tsx:353` as
    // deliberately-not-gated; this expectation is where that gap was frozen.
    //
    // The test's PURPOSE is preserved exactly, and it is about the NUMBER: the
    // canvas must state the same 62% the results panel states. It still does —
    // only the register changes, and the number is asserted through the shared
    // register rather than a re-typed literal, so this cannot drift from what
    // the node renders.
    // The VOICE is derived from the selector, not hard-coded. Passing a literal
    // `true` here would re-assert by hand the very thing this file exists to
    // compare — if `JOINT_ONLY_RECORD` ever stopped classifying as substituted,
    // a hard-coded `true` would keep demanding the withheld wording and the
    // parity claim would quietly become a fiction. Asking the selector makes
    // the comparison self-contained.
    // ⭐ AMENDED BY L62 (2026-08-04). 2.283's version derived the VOICE from
    // the selector and asserted the node still stated 62% in the withheld
    // register — parity of the NUMBER across canvas and panel. L60 showed
    // that number is a structural zero from comparing a level/count threshold
    // to change-frame samples, so the selector now publishes NO number for
    // this record and the parity claim becomes parity of the ABSENCE: neither
    // surface states a figure.
    //
    // The derivation discipline the original insisted on is kept — nothing
    // here is hard-coded, everything is asked of the selector — because that
    // is what stops this test drifting into a fiction if the basis moves again.
    // ⚠ The store must be pointed at the WITHHELD record explicitly: this
    // file's `beforeEach` now anchors on `CONSTRAINED_JOINT_RECORD` so the
    // agreement tests are non-vacuous, and without this line the render below
    // would be of a run that legitimately carries 62%.
    useStore(JOINT_ONLY_RECORD)
    const decision = selectGoalProbability(JOINT_ONLY_RECORD)

    // Anti-vacuity (trap 13): pin that this record really does reach the
    // withheld arm, so the absences below cannot pass by having quietly
    // flipped to a basis that never had a figure to begin with.
    expect(decision.basis).toBe('joint_goal_withheld')
    expect(decision.jointSubstitutionWithheld).toBe(true)
    expect(decision.goalProbability).toBeNull()
    expect(decision.mayUsePossessiveGoalFraming).toBe(false)
    // The quantity itself is still published — withheld from the goal-fit
    // slot, not deleted from the payload.
    expect(decision.jointGoalProbability).toBe(0.62)

    const { container } = renderGoalNode()
    const text = container.textContent ?? ''
    // Neither voice, and no percentage: the withheld register had exactly one
    // job, captioning a substituted number, and there is no such number now.
    expect(text).not.toContain(GOAL_ANCHOR_COPY.phrase('62%', true))
    expect(text).not.toContain('62%')
    expect(screen.queryByText(/chance of reaching target/)).toBeNull()
  })

  it('GoalNode does not simultaneously deny that a goal probability exists', () => {
    // Anchored on the CONSTRAINED record (see its header): a run that DOES
    // carry a figure. On the withheld run the node SHOULD deny — that is the
    // honest state, and it is pinned as such in the test below rather than
    // being conflated with this one.
    renderGoalNode()
    expect(screen.queryByText(/did not produce a goal probability/)).toBeNull()
  })

  it('⭐ L62: on a WITHHELD run the node denies a figure, and the panel agrees — no contradiction in the other direction either', () => {
    // The mirror of the test above, and the reason this file exists. ROADMAP
    // 2.275 recorded the two surfaces disagreeing on the substituted run — the
    // node denying a probability while the Goal-fit sub-tab rendered "< 1%"
    // four times from the same report. Both now deny, and the SELECTOR is
    // asserted alongside the render so "they agree" cannot mean "both broke".
    useStore(JOINT_ONLY_RECORD)
    const decision = selectGoalProbability(JOINT_ONLY_RECORD)
    expect(decision.basis).toBe('joint_goal_withheld')
    expect(decision.goalProbability).toBeNull()

    const { container } = renderGoalNode()
    expect(container.textContent ?? '').toContain('did not produce a goal probability')
    expect(container.textContent ?? '').not.toContain('62%')
  })

  it('GoalNode carries the provenance caveat the results panel carries', () => {
    renderGoalNode()
    expect(screen.getByTestId('goal-fit-basis-caveat-node')).toHaveTextContent(
      GOAL_FIT_BASIS_CAVEAT_COPY,
    )
  })

  it('⭐ L62: and NO caveat on a withheld run — a hedge beside no number is its own claim', () => {
    useStore(JOINT_ONLY_RECORD)
    renderGoalNode()
    expect(screen.queryByTestId('goal-fit-basis-caveat-node')).toBeNull()
  })
})

describe('goal-probability identity — which quantity the number IS', () => {
  it('names the withheld joint quantity as its own basis (L62 — was `joint_goal_substituted`)', () => {
    expect(selectGoalProbability(JOINT_ONLY_RECORD).basis).toBe('joint_goal_withheld')
  })

  it('L62: withholds the NUMBER, not merely the possessive, when the joint value would stand in for an absent goal value', () => {
    // 2.283's version read: "The NUMBER is still shown — it is real, computed
    // and decision-relevant. Only 'YOUR goal' is withheld." L60 showed the
    // number is P(level-or-count threshold >= change-frame sample), i.e. a
    // structural zero that is neither about the user's goal nor about
    // anything else they asked. Both are withheld.
    const decision = selectGoalProbability(JOINT_ONLY_RECORD)
    expect(decision.goalProbability).toBeNull()
    expect(decision.mayUsePossessiveGoalFraming).toBe(false)
    expect(decision.jointSubstitutionWithheld).toBe(true)
    // Still published for the honestly-labelled joint surface.
    expect(decision.jointGoalProbability).toBe(0.62)
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

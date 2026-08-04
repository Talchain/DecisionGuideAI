/**
 * GoalNode — THE POSSESSIVE GATE (ROADMAP 2.283).
 *
 * The LAST live un-gated possessive surface in the estate. #556 gated six
 * siblings (OptionCards, GoalPanel, OptionNode, WinGauge, the hero, the V7
 * goal lens) and recorded this one as deliberately-not-gated, because
 * `useNodeDisplayMetadata` READ the selector's `basis` and DISCARDED it — the
 * discriminating datum never reached this render site. 2.283 carries it
 * (`useNodeDisplayMetadata.goalBasis.spec.ts` pins the carry through the real
 * hook); this file pins the CONSUMPTION through the real render path.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THE NODE WAS DOING
 * ─────────────────────────────────────────────────────────────────────────
 *   "{N}% chance of reaching target"
 *
 * rendered over a number whose owner had published
 * `mayUsePossessiveGoalFraming: false`. Under substitution that number is
 * P(all constraints jointly satisfied) standing in for an absent
 * `probability_of_goal` — witnessed live on staging 2026-08-01 as a ~100x
 * understatement stated in the possessive voice, contradicted by the goal lens
 * in the same render.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ THIS FILE DOES NOT MOCK `useNodeDisplayMetadata` — DELIBERATELY (trap 11)
 * ─────────────────────────────────────────────────────────────────────────
 * `GoalNode.spec.tsx` mocks that hook, which is precisely how #555's defect
 * survived: a reviewer hard-coded the flag inside the hook and every test
 * stayed green because no spec executed it through a render. Here the ONLY
 * mock is the canvas store; the store feeds the REAL hook, the real hook feeds
 * the REAL selector, and the selector's basis reaches the REAL component. A
 * mutant that hard-codes the flag in the hook REDs this file.
 *
 * FIXTURE PROVENANCE: the witnessed staging shape of 2026-08-01
 * (`witness-2258-raw/run1b|run2|run3/analysis-turn.json` — `probability_of_
 * joint_goal` present, `"probability_of_goal"` 0 occurrences,
 * `constraint_analysis` 0 occurrences). The `recommended_option_id` pointer is
 * supplied for the reason declared in the hook spec's header (ROADMAP 2.275 is
 * a separate defect and would otherwise stop the branch being reached).
 *
 * Scope limit (trap 3): jsdom pins string presence/absence only. Nothing here
 * claims anything about layout, visibility or above-the-fold.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'
import { GOAL_ANCHOR_COPY } from '../../../components/results/utils/goalAnchorCopy'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** The witnessed per-option shape: joint present, goal absent, unconstrained. */
const SUBSTITUTED_OPTION = {
  probability_of_joint_goal: 0.0054,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_revenue'] },
}
/** A run carrying the REAL goal quantity — possessive earned. */
const REAL_GOAL_OPTION = { probability_of_goal: 0.55, probability_of_joint_goal: 0.0054 }
/** The CONSTRAINED joint case (ROADMAP 1.49) — possessive earned, must survive. */
const CONSTRAINED_OPTION = {
  probability_of_joint_goal: 0.42,
  constraint_analysis: { constraints: [{ id: 'c1' }] },
}

function reportFor(option: Record<string, unknown>) {
  return {
    option_probabilities: { opt_a: option },
    robustness: { recommended_option_id: 'opt_a', recommendation_stability: 0.5 },
  }
}

let storeState: Record<string, unknown>

const makeStoreState = (report: unknown) => ({
  results: { status: 'complete', report },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  setShowInspectorPanel: vi.fn(),
})

vi.mock('../../store', () => {
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(storeState))
  // `getState` is used by the node's inline "Adjust target" handler.
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => storeState
  return { useCanvasStore }
})

// Imported AFTER the store mock so the REAL hook resolves to the mocked store.
const { GoalNode } = await import('../GoalNode')

const baseProps = {
  id: 'goal_revenue',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  // Required by `NodeProps` — `GoalNode.spec.tsx`'s older harness omits them,
  // but this file is new, so it carries no baselined diagnostic to hide behind.
  deletable: true,
  selectable: true,
  draggable: true,
}

/** A USER-set target — UI-SEM-082 gates the whole block on it. */
const USER_TARGET = { threshold_source: 'user', success_threshold: 6_000_000 }

function renderGoalWith(option: Record<string, unknown>) {
  storeState = makeStoreState(reportFor(option))
  return render(
    <ReactFlowProvider>
      <GoalNode
        {...baseProps}
        data={{ label: 'Grow Annual Revenue to £6,000,000', type: 'goal', ...USER_TARGET }}
      />
    </ReactFlowProvider>,
  )
}

const POSSESSIVE = 'chance of reaching target'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GoalNode — possessive gate on a substituted joint goal figure (ROADMAP 2.283)', () => {
  it('control: each fixture drives the REAL selector to the basis this suite claims for it', () => {
    // Anti-vacuity (trap 13): an absence assertion must first prove it can see
    // a presence. If a fixture stopped reaching its branch, the withheld/
    // permitted assertions below would pass by testing nothing.
    expect(selectGoalProbability(SUBSTITUTED_OPTION).basis).toBe('joint_goal_withheld')
    expect(selectGoalProbability(REAL_GOAL_OPTION).basis).toBe('goal_probability')
    expect(selectGoalProbability(CONSTRAINED_OPTION).basis).toBe('joint_goal_constrained')
    // ⭐ L62: the withheld basis carries NO number, which is what turns the
    // "withholds the possessive" test below into an absence-of-figure test.
    expect(selectGoalProbability(SUBSTITUTED_OPTION).goalProbability).toBeNull()
    expect(selectGoalProbability(CONSTRAINED_OPTION).goalProbability).toBe(0.42)
  })

  /**
   * ⭐ AMENDED BY L62. 2.283 pinned that the node kept the NUMBER and dropped
   * the possessive. L60 §5–§8 showed the number is the untruth — a structural
   * zero from comparing a level/count threshold to change-frame samples — so
   * the node now shows no figure at all. The possessive assertion is retained
   * verbatim; the "renders the withheld phrase" half is inverted.
   */
  it('L62: shows NO figure at all on the witnessed substituted run — neither voice', () => {
    const { container } = renderGoalWith(SUBSTITUTED_OPTION)
    expect(screen.queryByText(GOAL_ANCHOR_COPY.phrase('< 1%', true))).not.toBeInTheDocument()
    expect(screen.queryByText(new RegExp(POSSESSIVE))).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toContain('< 1%')
    // The node's own honest-absence line takes over.
    //
    // ⭐ AND NOTE WHICH ONE. Before L62 this run rendered "No overall goal
    // probability for this run — see Goal fit for each option's chance",
    // because `goalFitAvailable` was true: the per-option scan found the
    // substituted figures and pointed the user AT them. That is the
    // cross-surface contradiction ROADMAP 2.275 recorded from the other side —
    // the node denying a figure while the Goal-fit sub-tab rendered "< 1%" four
    // times from the same report. With the substitution withheld the scan finds
    // nothing admissible, so the node states the simpler truth and the two
    // surfaces finally agree. Pinned by string because the DIFFERENCE between
    // these two sentences is the user-visible consequence of the fix.
    expect(container.textContent ?? '').toContain(
      'Target set. This run did not produce a goal probability.',
    )
    expect(container.textContent ?? '').not.toContain('see Goal fit for each option')
  })

  it('positive control: a REAL probability_of_goal keeps the possessive', () => {
    renderGoalWith(REAL_GOAL_OPTION)
    expect(screen.getByText(`55% ${POSSESSIVE}`)).toBeInTheDocument()
    expect(screen.queryByText(GOAL_ANCHOR_COPY.phrase('55%', true))).not.toBeInTheDocument()
  })

  it('positive control: joint_goal_constrained keeps the possessive (ROADMAP 1.49)', () => {
    // The load-bearing scoping test. The figure IS joint here — but it is the
    // user's own goal AND their own limits, so the possessive is EARNED. A gate
    // widened from `basis === 'joint_goal_substituted'` to
    // `goalProbabilityIsJoint` REDs exactly this test and nothing else.
    renderGoalWith(CONSTRAINED_OPTION)
    expect(screen.getByText(`42% ${POSSESSIVE}`)).toBeInTheDocument()
    expect(screen.queryByText(GOAL_ANCHOR_COPY.phrase('42%', true))).not.toBeInTheDocument()
  })

  it('L62: NEITHER voice appears on a withheld run — the mutual-exclusion test, with both arms now empty', () => {
    // 2.283 pinned exactly-one-voice. Under L62 the honest count is zero of
    // both: there is no number for either voice to caption. The CONSTRAINED
    // positive control above is what stops this degenerating into "the gate
    // silenced everything".
    renderGoalWith(SUBSTITUTED_OPTION)
    expect(screen.queryAllByText(GOAL_ANCHOR_COPY.phrase('< 1%', true))).toHaveLength(0)
    expect(screen.queryAllByText(new RegExp(POSSESSIVE))).toHaveLength(0)
  })
})

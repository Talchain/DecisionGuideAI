/**
 * GoalPanel — a conditional-probability line belongs to the constraint whose
 * ID it names, never to one whose LABEL happens to match.
 *
 * ── THE DEFECT (CLASS 2: identity matched by label, not by id) ──────────────
 *
 * `GoalPanel` joined PLoT's `conditional_probabilities[]` to the goal's own
 * constraints with
 *
 *     cp => cp.constraint_a_label === (c.label ?? '')
 *
 * while `ConditionalProbability` declares `constraint_a_id: string` as
 * REQUIRED (`src/types/constraints.ts`) — and the very next line of the same
 * JSX already reads it (`key={`${cp.constraint_a_id}-${cp.constraint_b_id}`}`).
 * The constraint side carries `constraint_id ?? id`, which this component uses
 * three lines above for the row key and for `GoalConstraintProvenance`.
 *
 * This is the SIBLING of the defect fixed in #959 (`FactorNode.constraintTooltip`
 * matched a goal constraint to a factor by label string equality), in the same
 * feature, with the same two harms — and the `?? ''` reopens the empty-label
 * case #959 excluded EXPLICITLY:
 *
 *   A. UNLABELLED CONSTRAINT. `CEEGoalConstraint.label` is optional and its own
 *      doc says it is "genuinely absent in practice". `c.label ?? ''` turns
 *      every unlabelled constraint into the empty string, so any row whose
 *      `constraint_a_label` is also empty matched it — `'' === ''`. The panel
 *      then printed "If … is met, probability of … changes to N%" under a
 *      constraint the producer never conditioned on.
 *
 *   B. TWO CONSTRAINTS SHARING A LABEL. One row was printed under BOTH, so at
 *      least one of the two was false.
 *
 * ── WHY THE LABEL LEG SURVIVES, UNIQUENESS-GATED ────────────────────────────
 *
 * Nothing in this repo has ever witnessed a `conditional_probabilities` payload
 * — a fixture sweep for `constraint_a_id` across every JSON returns ZERO, and so
 * does the contrast term `joint_probability`. So PLoT's id-space is NOT
 * established here, and an id-ONLY join could silently drop every line if PLoT
 * mints its own constraint ids. Dropping a working surface to fix an attribution
 * bug would be the "hide it" move this lane is forbidden to make.
 *
 * The ladder is therefore strictly additive: an ID match is taken when the row
 * names this constraint's identity; otherwise a NON-EMPTY label is matched, and
 * only when that label is UNIQUE among the goal's constraints. Every match that
 * is correct today still fires; the two provably-wrong matches stop.
 *
 * ── BINDING (CLAUDE.md trap 19) ─────────────────────────────────────────────
 * Every assertion below binds by `constraint_id`, never by the probability
 * value — two rows can carry the same number. Proven by a discriminating mutant
 * pair recorded in the PR body: breaking the join for ALL constraints REDs
 * `'the row that names this constraint by id still renders'`, while breaking it
 * for a DIFFERENT constraint only leaves that test GREEN.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const AUTHED = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }

const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test Goal' } }

/** The sentence the panel prints for a conditional-probability row. */
const CONDITIONAL_SENTENCE = /is met, probability of .* changes to/

function setStore(overrides: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [GOAL_NODE],
    edges: [],
    results: { status: 'idle', report: null },
    goalConstraints: null,
    ...overrides,
  } as unknown as ReturnType<typeof useCanvasStore.getState>)
}

function renderPanel() {
  return render(
    <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />,
  )
}

describe('GoalPanel — conditional probabilities bind by constraint id, not by label', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReset()
    vi.mocked(useAuth).mockReturnValue(AUTHED as unknown as ReturnType<typeof useAuth>)
  })

  it('an UNLABELLED constraint still gets the row that names it by id', () => {
    // ⚠ THE LABEL LEG CANNOT SATISFY THIS TEST, AND THAT IS THE POINT.
    // The first draft of this case gave the constraint the same label as the
    // row, and mutant M1 (kill the id leg entirely) left it GREEN — it was
    // passing through the label leg while claiming to prove id binding, which
    // is CLAUDE.md trap 13b exactly. The constraint now carries NO label, so
    // the uniqueness-gated label leg is dead by construction and only
    // `constraint_a_id` can produce this row. M1 now REDs it.
    //
    // It is also the positive twin of the unlabelled-constraint harm: binding
    // by id must ADD the correct row, not merely remove the wrong one.
    setStore({
      goalConstraints: [
        { constraint_id: 'c1', node_id: 'f1', operator: '>=' as const, value: 200000, probability: 0.8 },
      ],
      results: {
        status: 'complete',
        report: {
          conditional_probabilities: [
            {
              constraint_a_id: 'c1',
              constraint_a_label: '',
              constraint_b_id: 'c9',
              constraint_b_label: 'Margin floor',
              conditional_probability: 0.9,
              marginal_probability: 0.5,
            },
          ],
        },
      },
    })
    const { getAllByText } = renderPanel()
    expect(getAllByText(CONDITIONAL_SENTENCE)).toHaveLength(1)
  })

  it('an UNLABELLED constraint is not given a row whose conditioning constraint is a different one', () => {
    // `c1` carries no label at all. The row belongs to `c2`, and PLoT rendered
    // `c2`'s label as the empty string. `(c.label ?? '') === ''` matched.
    setStore({
      goalConstraints: [
        { constraint_id: 'c1', node_id: 'f1', operator: '>=' as const, value: 200000, probability: 0.6 },
      ],
      results: {
        status: 'complete',
        report: {
          conditional_probabilities: [
            {
              constraint_a_id: 'c2',
              constraint_a_label: '',
              constraint_b_id: 'c9',
              constraint_b_label: 'Margin floor',
              conditional_probability: 0.9,
              marginal_probability: 0.5,
            },
          ],
        },
      },
    })
    const { queryAllByText } = renderPanel()
    expect(queryAllByText(CONDITIONAL_SENTENCE)).toHaveLength(0)
  })

  it('two constraints sharing a label do not both claim one row', () => {
    // The row names `c1`. `c2` shares the label and must not print it.
    setStore({
      goalConstraints: [
        { constraint_id: 'c1', node_id: 'f1', operator: '>=' as const, value: 5, label: 'Churn rate', probability: 0.8 },
        { constraint_id: 'c2', node_id: 'f2', operator: '<=' as const, value: 9, label: 'Churn rate', probability: 0.4 },
      ],
      results: {
        status: 'complete',
        report: {
          conditional_probabilities: [
            {
              constraint_a_id: 'c1',
              constraint_a_label: 'Churn rate',
              constraint_b_id: 'c9',
              constraint_b_label: 'Margin floor',
              conditional_probability: 0.9,
              marginal_probability: 0.5,
            },
          ],
        },
      },
    })
    const { getAllByText } = renderPanel()
    expect(getAllByText(CONDITIONAL_SENTENCE)).toHaveLength(1)
  })
})

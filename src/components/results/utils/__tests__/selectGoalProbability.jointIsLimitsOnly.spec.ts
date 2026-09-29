/**
 * ⭐ AIQ RULING #72 5882498938 (fail-closed): the goal-fit slot reads `probability_of_goal` and nothing else,
 * constrained or not; `probability_of_joint_goal` appears ONLY in its own row ("chance all your limits hold"); goal
 * absent + joint present → withheld. ⛔ DL #72 5882319683 item 2 (served evidence): one served run carries `probability_of_joint_goal = 1` while
 * `probability_of_goal = 0` — the joint figure is P(all LIMITS jointly hold), not P(goal ∧ limits), when the limits sit
 * on nodes other than the goal. The goal-fit slot must never show that as the goal chance.
 */
import { describe, expect, it } from 'vitest'
import { selectGoalProbability, type GoalProbabilityInput } from '../selectGoalProbability'

const LIMITS_ON_OTHER_NODES: GoalProbabilityInput = {
  probability_of_goal: 0,
  probability_of_joint_goal: 1,
  constraint_analysis: { constraints: [{ node_id: 'fac_cloud_cost' }, { node_id: 'out_downtime' }] },
} as GoalProbabilityInput

describe('the goal-fit slot is never P(limits) — goal = 0, joint = 1, limits on other nodes', () => {
  it('RED: the goal chance is 0, not 100%', () => {
    const d = selectGoalProbability(LIMITS_ON_OTHER_NODES)
    expect(d.goalProbability).toBe(0)
    expect(d.goalProbabilityIsJoint).toBe(false)
    expect(d.basis).toBe('goal_probability')
  })

  it('the joint figure stays available for its OWN row (limits), unchanged', () => {
    expect(selectGoalProbability(LIMITS_ON_OTHER_NODES).jointGoalProbability).toBe(1)
  })

  it('RED: goal = 1 / joint = 0 with a GOAL-node limit and a failing limit elsewhere → the goal slot is 100%, never 0%', () => {
    const d = selectGoalProbability({
      probability_of_goal: 1,
      probability_of_joint_goal: 0,
      constraint_analysis: { constraints: [{ node_id: 'goal_mrr' }, { node_id: 'out_downtime' }] },
    } as GoalProbabilityInput)
    expect(d.goalProbability).toBe(1)
    expect(d.goalProbabilityIsJoint).toBe(false)
    expect(d.jointGoalProbability).toBe(0)
  })

  it('goal absent + joint present (constrained) → the goal slot is WITHHELD, never the joint', () => {
    const d = selectGoalProbability({
      probability_of_joint_goal: 0.8,
      constraint_analysis: { constraints: [{ node_id: 'goal_mrr' }] },
    } as GoalProbabilityInput)
    expect(d.goalProbability).toBeNull()
    expect(d.basis).toBe('joint_goal_withheld')
    expect(d.jointSubstitutionWithheld).toBe(true)
  })

  it('⛔ CONTRAST: no constraints — the goal quantity, as today', () => {
    const d = selectGoalProbability({ probability_of_goal: 0.4, probability_of_joint_goal: 0.9 } as GoalProbabilityInput)
    expect(d.goalProbability).toBe(0.4)
    expect(d.basis).toBe('goal_probability')
  })
})

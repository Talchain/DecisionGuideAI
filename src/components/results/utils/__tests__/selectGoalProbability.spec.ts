import { describe, it, expect } from 'vitest'
import { selectGoalProbability } from '../selectGoalProbability'

describe('selectGoalProbability', () => {
  it('returns null when neither source is present', () => {
    expect(selectGoalProbability(undefined)).toEqual({ goalProbability: null, goalProbabilityIsJoint: false })
    expect(selectGoalProbability({})).toEqual({ goalProbability: null, goalProbabilityIsJoint: false })
  })

  it('uses goal_probability (unconstrained) when there are no constraints', () => {
    const result = selectGoalProbability({ goal_probability: 0.42 })
    expect(result.goalProbability).toBe(0.42)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })

  it('prefers probability_of_joint_goal when constraints exist', () => {
    const result = selectGoalProbability({
      goal_probability: 0.42,
      probability_of_joint_goal: 0.07,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
    })
    expect(result.goalProbability).toBe(0.07)
    expect(result.goalProbabilityIsJoint).toBe(true)
  })

  it('falls back to probability_of_joint_goal when goal_probability is absent and no constraint_analysis (ISL auto-derived goal threshold)', () => {
    const result = selectGoalProbability({ probability_of_joint_goal: 0.0 })
    expect(result.goalProbability).toBe(0)
    expect(result.goalProbabilityIsJoint).toBe(true)
  })

  it('does not treat unconstrained goal_probability as joint when constraints are absent', () => {
    const result = selectGoalProbability({ goal_probability: 0.55, constraint_analysis: { constraints: [] } })
    expect(result.goalProbability).toBe(0.55)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })
})

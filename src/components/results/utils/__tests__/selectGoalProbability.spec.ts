import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectGoalProbability } from '../selectGoalProbability'

// UI-SEM-088 honesty gate: selectGoalProbability reads
// PLOT_CONSTRAINT_NUMBERS_SUSPECT at call time. A mutable getter lets one file
// pin BOTH the gate-ON behaviour (default) and the positive-control gate-OFF
// flow that the restoration PR relies on.
const mockTrust = vi.hoisted(() => ({ suspect: true }))
vi.mock('../../../../adapters/plot/constraintTrust', () => ({
  get PLOT_CONSTRAINT_NUMBERS_SUSPECT() {
    return mockTrust.suspect
  },
}))

describe('selectGoalProbability — gate-independent behaviour', () => {
  beforeEach(() => {
    mockTrust.suspect = true
  })

  it('returns null when neither source is present', () => {
    expect(selectGoalProbability(undefined)).toEqual({ goalProbability: null, goalProbabilityIsJoint: false })
    expect(selectGoalProbability({})).toEqual({ goalProbability: null, goalProbabilityIsJoint: false })
  })

  it('uses goal_probability (unconstrained) when there are no constraints', () => {
    const result = selectGoalProbability({ goal_probability: 0.42 })
    expect(result.goalProbability).toBe(0.42)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })

  it('does not treat unconstrained goal_probability as joint when constraints are absent', () => {
    const result = selectGoalProbability({ goal_probability: 0.55, constraint_analysis: { constraints: [] } })
    expect(result.goalProbability).toBe(0.55)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })
})

describe('selectGoalProbability — gate ON (PLOT_CONSTRAINT_NUMBERS_SUSPECT=true, default)', () => {
  beforeEach(() => {
    mockTrust.suspect = true
  })

  it('NEVER substitutes the joint figure when constraints exist — falls back to unconstrained goal_probability', () => {
    const result = selectGoalProbability({
      goal_probability: 0.42,
      probability_of_joint_goal: 0.07, // constraint-derived, possibly INVERTED — suppressed
      constraint_analysis: { constraints: [{ id: 'c1' }] },
    })
    expect(result.goalProbability).toBe(0.42)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })

  it('returns null rather than a bare joint figure (no auto-derived joint tail while suspect)', () => {
    // goal_probability absent, only the (suspect) joint present.
    const result = selectGoalProbability({ probability_of_joint_goal: 0.99 })
    expect(result.goalProbability).toBeNull()
    expect(result.goalProbabilityIsJoint).toBe(false)
  })

  it('leaves an unconstrained-only run untouched', () => {
    const result = selectGoalProbability({ goal_probability: 0.3 })
    expect(result.goalProbability).toBe(0.3)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })
})

describe('selectGoalProbability — POSITIVE CONTROL: gate OFF (constant flipped false → full flow restored)', () => {
  beforeEach(() => {
    mockTrust.suspect = false
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

  it('still uses unconstrained goal_probability when there are no constraints', () => {
    const result = selectGoalProbability({ goal_probability: 0.42 })
    expect(result.goalProbability).toBe(0.42)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })
})

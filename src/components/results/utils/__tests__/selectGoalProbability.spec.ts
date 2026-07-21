import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectGoalProbability } from '../selectGoalProbability'

// UI-SEM-088 seam 1 (headline goal probability). selectGoalProbability reads
// PLOT_JOINT_HEADLINE_SUSPECT at call time. A mutable getter lets one file pin
// BOTH the CURRENT default (FALSE — the joint→headline flow RESTORED per A3's
// deployed PLoT fix) and the mutation proof that flipping it back to TRUE
// re-suppresses the headline. The mock replaces the whole module, so it must
// export BOTH split constants (the per-option constant is fixed here — this
// spec never exercises seam 2).
const mockTrust = vi.hoisted(() => ({ headlineSuspect: false }))
vi.mock('../../../../adapters/plot/constraintTrust', () => ({
  get PLOT_JOINT_HEADLINE_SUSPECT() {
    return mockTrust.headlineSuspect
  },
  PLOT_PER_OPTION_CONSTRAINTS_SUSPECT: true,
}))

describe('selectGoalProbability — gate-independent behaviour', () => {
  beforeEach(() => {
    mockTrust.headlineSuspect = false
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

describe('selectGoalProbability — CURRENT STATE: seam 1 RESTORED (PLOT_JOINT_HEADLINE_SUSPECT=false, default)', () => {
  beforeEach(() => {
    mockTrust.headlineSuspect = false
  })

  it('prefers probability_of_joint_goal when constraints exist (A3 fix deployed — joint is correct at source)', () => {
    const result = selectGoalProbability({
      goal_probability: 0.42,
      probability_of_joint_goal: 0.07,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
    })
    expect(result.goalProbability).toBe(0.07)
    expect(result.goalProbabilityIsJoint).toBe(true)
  })

  it('falls back to probability_of_joint_goal when goal_probability is absent (ISL auto-derived goal threshold)', () => {
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

describe('selectGoalProbability — MUTATION PROOF: flip seam 1 back to true → headline re-suppressed', () => {
  beforeEach(() => {
    mockTrust.headlineSuspect = true
  })

  it('NEVER substitutes the joint figure when suspect — falls back to unconstrained goal_probability', () => {
    const result = selectGoalProbability({
      goal_probability: 0.42,
      probability_of_joint_goal: 0.07,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
    })
    expect(result.goalProbability).toBe(0.42)
    expect(result.goalProbabilityIsJoint).toBe(false)
  })

  it('returns null rather than a bare joint figure (no auto-derived joint tail while suspect)', () => {
    const result = selectGoalProbability({ probability_of_joint_goal: 0.99 })
    expect(result.goalProbability).toBeNull()
    expect(result.goalProbabilityIsJoint).toBe(false)
  })
})

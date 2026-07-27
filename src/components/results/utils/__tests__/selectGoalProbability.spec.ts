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
    const none = {
      goalProbability: null,
      goalProbabilityIsJoint: false,
      basis: 'none' as const,
      goalFitIsModelledBasis: false,
      mayUsePossessiveGoalFraming: false,
    }
    expect(selectGoalProbability(undefined)).toEqual(none)
    expect(selectGoalProbability({})).toEqual(none)
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

  it('reports no basis and no framing permission while the seam is suppressed', () => {
    const result = selectGoalProbability({ probability_of_joint_goal: 0.99 })
    expect(result.basis).toBe('none')
    expect(result.goalFitIsModelledBasis).toBe(false)
    expect(result.mayUsePossessiveGoalFraming).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// IDENTITY — which producer quantity the number IS, and what prose may say
// about it. `basis` exists because "may we show a goal probability" is not
// answerable without knowing which of the two collapsed quantities the value
// answers; the caveat flag lives here (rather than being re-derived by each
// consumer) because two consumers deriving it independently is exactly how
// the results panel and the canvas came to disagree.
// ---------------------------------------------------------------------------
describe('selectGoalProbability — basis and framing permission', () => {
  beforeEach(() => {
    mockTrust.headlineSuspect = false
  })

  it('the unconstrained goal quantity licenses the possessive framing', () => {
    const result = selectGoalProbability({ goal_probability: 0.42 })
    expect(result.basis).toBe('goal_probability')
    expect(result.mayUsePossessiveGoalFraming).toBe(true)
  })

  it('an option carrying its own constraints yields the constrained joint basis', () => {
    const result = selectGoalProbability({
      goal_probability: 0.42,
      probability_of_joint_goal: 0.07,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
    })
    expect(result.basis).toBe('joint_goal_constrained')
    expect(result.goalProbability).toBe(0.07)
    expect(result.mayUsePossessiveGoalFraming).toBe(true)
  })

  it('a joint figure standing in for an absent goal figure shows the NUMBER but withholds the possessive', () => {
    const result = selectGoalProbability({ probability_of_joint_goal: 0.62 })
    expect(result.basis).toBe('joint_goal_substituted')
    expect(result.goalProbability).toBe(0.62)
    expect(result.goalProbabilityIsJoint).toBe(true)
    expect(result.mayUsePossessiveGoalFraming).toBe(false)
  })

  it('carries the modelled-basis caveat on a joint figure the producer marked as modelled', () => {
    const result = selectGoalProbability({
      probability_of_joint_goal: 0.62,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
    })
    expect(result.goalFitIsModelledBasis).toBe(true)
  })

  it('never applies the caveat to the unconstrained goal quantity, even when the marker is present', () => {
    const result = selectGoalProbability({
      goal_probability: 0.42,
      probability_of_joint_goal: 0.62,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
    })
    expect(result.basis).toBe('goal_probability')
    expect(result.goalFitIsModelledBasis).toBe(false)
  })

  it('never applies the caveat on a non-modelled scored_from', () => {
    const result = selectGoalProbability({
      probability_of_joint_goal: 0.62,
      goal_fit_basis: { scored_from: 'directly_elicited' },
    })
    expect(result.goalFitIsModelledBasis).toBe(false)
  })
})

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
      jointGoalProbability: null,
      basis: 'none' as const,
      goalFitIsModelledBasis: false,
      mayUsePossessiveGoalFraming: false,
      // L62: nothing was available to withhold here — 'none' means the run
      // carried no joint figure either.
      jointSubstitutionWithheld: false,
    }
    // Exact shape, deliberately: the selection is a CONTRACT, and a field that
    // appears (or vanishes) without a decision here is a field some surface will
    // start deriving for itself.
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

  /**
   * ⭐ SUPERSEDED BY L62 (2026-08-04), AND THE SUPERSESSION IS THE POINT.
   *
   * This test pinned the FALLBACK: goal_probability absent ⇒ show the joint
   * figure instead. L60 established at the bytes that the joint figure on that
   * path is P(level-or-count threshold ≥ change-frame sample) — a structural
   * zero forced by arithmetic, not a measurement of anything the user asked —
   * and that `probability_of_goal` was absent precisely BECAUSE ISL's frame
   * guard had honestly refused to produce it. The fallback was papering over a
   * refusal.
   *
   * The test is kept, inverted, rather than deleted: it is the record that this
   * behaviour was deliberate once, and it now fails loudly if the fallback is
   * ever restored. See `selectGoalProbability.l62Withhold.spec.ts` for the
   * producer-byte pins.
   */
  it('does NOT fall back to probability_of_joint_goal when goal_probability is absent (L62 — was the fallback, now withheld)', () => {
    const result = selectGoalProbability({ probability_of_joint_goal: 0.0 })
    expect(result.goalProbability).toBeNull()
    expect(result.goalProbabilityIsJoint).toBe(false)
    expect(result.basis).toBe('joint_goal_withheld')
    expect(result.jointSubstitutionWithheld).toBe(true)
    // The quantity itself is still published for the surfaces that label it
    // honestly — withheld from the goal-fit SLOT, not deleted.
    expect(result.jointGoalProbability).toBe(0)
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

  it('L62: a joint figure standing in for an absent goal figure is withheld entirely — no number, no voice', () => {
    // ROADMAP 2.282 withheld only the possessive VOICE and kept showing the
    // number. That was a copy fix over a value that should never have been
    // shown; L60 §5–§8 is why. Both are withheld now.
    const result = selectGoalProbability({ probability_of_joint_goal: 0.62 })
    expect(result.basis).toBe('joint_goal_withheld')
    expect(result.goalProbability).toBeNull()
    expect(result.goalProbabilityIsJoint).toBe(false)
    expect(result.mayUsePossessiveGoalFraming).toBe(false)
    expect(result.jointSubstitutionWithheld).toBe(true)
    expect(result.jointGoalProbability).toBe(0.62)
  })

  it('carries the modelled-basis caveat on a CONSTRAINED joint figure the producer marked as modelled', () => {
    // ⭐ L62 amended the INPUT, not the rule. The caveat still rides a joint
    // figure marked `modelled_outcome_distribution` — but only one that is
    // actually DISPLAYED, which after L62 means the constrained basis. A
    // caveat rendered beside a withheld number would be a hedge about a value
    // the user cannot see.
    const result = selectGoalProbability({
      probability_of_joint_goal: 0.62,
      constraint_analysis: { constraints: [{ id: 'c1' }] },
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
    })
    expect(result.basis).toBe('joint_goal_constrained')
    expect(result.goalFitIsModelledBasis).toBe(true)
  })

  it('L62: no modelled-basis caveat over a WITHHELD figure — there is nothing for it to qualify', () => {
    const result = selectGoalProbability({
      probability_of_joint_goal: 0.62,
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
    })
    expect(result.basis).toBe('joint_goal_withheld')
    expect(result.goalFitIsModelledBasis).toBe(false)
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

// ---------------------------------------------------------------------------
// OWNED ALIASES. `probability_of_goal` is the WIRE spelling of the same
// quantity as `goal_probability` (RawOption declares three names for it; both
// mappers read the wire name and write the internal one). The selector accepts
// both because the sites that hold a wire-shaped option — the compare-tab
// snapshot factory, the inspector's report-level reads — otherwise have no
// compliant route and end up choosing for themselves, which is the defect.
// ---------------------------------------------------------------------------
describe('selectGoalProbability — owned aliases of the goal quantity', () => {
  beforeEach(() => {
    mockTrust.headlineSuspect = false
  })

  it('accepts the wire spelling probability_of_goal', () => {
    const result = selectGoalProbability({ probability_of_goal: 0.31 })
    expect(result.goalProbability).toBe(0.31)
    expect(result.basis).toBe('goal_probability')
    expect(result.goalProbabilityIsJoint).toBe(false)
    expect(result.mayUsePossessiveGoalFraming).toBe(true)
  })

  it('prefers the mapped goal_probability when a payload carries BOTH spellings', () => {
    // Every pre-existing caller holds a post-mapper shape, so this ordering is
    // what makes the alias addition behaviour-preserving for all of them.
    const result = selectGoalProbability({ goal_probability: 0.42, probability_of_goal: 0.31 })
    expect(result.goalProbability).toBe(0.42)
  })

  it('treats a non-numeric wire value as absent rather than coercing it', () => {
    const result = selectGoalProbability({
      probability_of_goal: undefined,
      probability_of_joint_goal: 0.5,
    })
    // L62: the ALIAS behaviour under test is unchanged — `undefined` is still
    // treated as absent rather than coerced. What changed is what an absent
    // goal quantity plus a present joint one now produces.
    expect(result.basis).toBe('joint_goal_withheld')
    expect(result.goalProbability).toBeNull()
    expect(result.jointGoalProbability).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// THE JOINT QUANTITY, PUBLISHED. Two surfaces render the joint figure as its
// own separately-labelled claim next to the goal figure (the inspector's
// "chance of hitting every target" row; the compare-tab snapshot's
// jointGoalProbability). They used to read `probability_of_joint_goal` off the
// producer directly — and a surface holding the raw field can also start
// CHOOSING with it, which is how there came to be two choosers in the first
// place. It is published here so every read of the quantity goes through this
// module, for either purpose.
// ---------------------------------------------------------------------------
describe('selectGoalProbability — publishes the joint quantity it read', () => {
  it('reports the joint figure even when it is NOT the chosen claim', () => {
    mockTrust.headlineSuspect = false
    const result = selectGoalProbability({ goal_probability: 0.42, probability_of_joint_goal: 0.07 })
    expect(result.goalProbability).toBe(0.42) // the chosen claim is the goal quantity
    expect(result.basis).toBe('goal_probability')
    expect(result.jointGoalProbability).toBe(0.07) // …and the joint row still has its number
  })

  it('reports null when the producer sent no joint figure', () => {
    mockTrust.headlineSuspect = false
    expect(selectGoalProbability({ goal_probability: 0.42 }).jointGoalProbability).toBeNull()
  })

  it('preserves a producer-sent zero rather than reading it as absence', () => {
    mockTrust.headlineSuspect = false
    expect(selectGoalProbability({ probability_of_joint_goal: 0 }).jointGoalProbability).toBe(0)
  })

  it('still reports it while the headline seam is suspect (the gate governs SUBSTITUTION, not the labelled row)', () => {
    mockTrust.headlineSuspect = true
    const result = selectGoalProbability({ goal_probability: 0.42, probability_of_joint_goal: 0.07 })
    expect(result.goalProbability).toBe(0.42)
    expect(result.goalProbabilityIsJoint).toBe(false)
    expect(result.jointGoalProbability).toBe(0.07)
  })
})

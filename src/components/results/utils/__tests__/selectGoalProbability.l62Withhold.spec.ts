/**
 * L62 — the joint figure is WITHHELD from the goal-fit slot.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT (L60, verified live at the deployed tips 2026-08-04)
 * ─────────────────────────────────────────────────────────────────────────
 * ISL evaluates every goal constraint with a bare `value >= threshold` — a
 * LEVEL or COUNT threshold compared directly against CHANGE-frame Monte-Carlo
 * samples, with no frame conversion and no refusal path. P ≈ 0 is then
 * ARITHMETICALLY FORCED for every option regardless of option quality. The
 * honest channel (`probability_of_goal`) had already failed closed on all
 * three witnessed runs — ISL's frame guard refusing to guess — and
 * `selectGoalProbability` was papering over that refusal by substituting
 * `probability_of_joint_goal`, which the guard does not cover. Every option in
 * every decision then rendered a confident "< 1% chance of meeting every
 * target this run scored".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE GATE IS TOTAL — read `l62-goalfit-gate.md` §1 for the full table
 * ─────────────────────────────────────────────────────────────────────────
 * The narrower gate ("substitute only when decision-grade AND the frames are
 * compatible") is not available: nothing on the wire states the frame of a
 * constraint threshold, and `constraints_decision_grade` does not
 * discriminate — it is TRUE on two of the three fabrications below and FALSE
 * on the third. Test 2 PROVES that from the fixtures rather than asserting it,
 * so a reviewer does not have to take the derivation on trust.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DISCIPLINE
 * ─────────────────────────────────────────────────────────────────────────
 * · The fixtures are PRODUCER BYTES, generated from L60's captured artefacts —
 *   see `fixtures/l60ProducerShapes.ts` for the source files and their
 *   SHA-256. No number here was invented to make an assertion pass.
 * · Every assertion binds to its object by IDENTITY (exact option id), never
 *   by a value predicate another option could satisfy (CLAUDE.md trap 19).
 *   With four options per run all reporting joint ≈ 0, a `find(o => o.p === 0)`
 *   would happily assert about the wrong option.
 * · Test 1 is the anti-vacuity control (trap 13): it proves the fixtures are
 *   genuinely IN the substituting state — joint present, honest channel absent
 *   — BEFORE anything asserts a withhold. Without it, a fixture that simply
 *   carried no numbers at all would make every "is null" pass by testing
 *   nothing.
 * · Tests 5–6 are the positive control in the other direction: a genuinely
 *   honest goal probability must still render. A "fix" that returned null
 *   unconditionally passes 3 and 4 and fails these.
 *
 * RED-first at `bc0e4a98`: tests 3, 4, 7 and 8 fail there (the selector
 * returns the joint number with basis `'joint_goal_substituted'`).
 */

import { describe, expect, it } from 'vitest'
import {
  selectGoalProbability,
  basisWithholdsPossessive,
  type GoalProbabilityInput,
} from '../selectGoalProbability'
import {
  L60_PRICING_OPTIONS,
  L60_PEOPLE_OPTIONS,
  L60_PROBE_OPTIONS,
  L60_PRICING_CONSTRAINT_RESULTS,
  L60_PEOPLE_CONSTRAINT_RESULTS,
  L60_PROBE_CONSTRAINT_RESULTS,
} from './fixtures/l60ProducerShapes'

type ProducerOption = GoalProbabilityInput & {
  id: string
  probability_of_joint_goal?: number
  constraints_decision_grade?: boolean
}

/**
 * The three witnessed shapes, each named by the constraint flavour that drove
 * it. `expectedJointById` is transcribed from the fixture at read time — not
 * typed in — so the expectations cannot drift from the bytes.
 */
const WITNESSED = [
  {
    name: 'pricing — draft-minted fraction constraint (decision_grade FALSE)',
    options: L60_PRICING_OPTIONS as readonly ProducerOption[],
    constraintResults: L60_PRICING_CONSTRAINT_RESULTS,
  },
  {
    name: 'people — chat-minted COUNT constraint (decision_grade TRUE)',
    options: L60_PEOPLE_OPTIONS as readonly ProducerOption[],
    constraintResults: L60_PEOPLE_CONSTRAINT_RESULTS,
  },
  {
    name: 'probe — goal-target LEVEL constraint (decision_grade TRUE)',
    options: L60_PROBE_OPTIONS as readonly ProducerOption[],
    constraintResults: L60_PROBE_CONSTRAINT_RESULTS,
  },
] as const

describe('L62 — the joint figure never stands in for an absent goal probability', () => {
  it('CONTROL (anti-vacuity): every fixture option is genuinely in the substituting state — joint present, honest channel absent', () => {
    for (const shape of WITNESSED) {
      expect(shape.options.length, `${shape.name}: fixture must not be empty`).toBeGreaterThan(0)
      for (const o of shape.options) {
        // The trigger for substitution: a finite joint figure …
        expect(
          typeof o.probability_of_joint_goal === 'number' &&
            Number.isFinite(o.probability_of_joint_goal),
          `${shape.name} / ${o.id}: joint figure must be present`,
        ).toBe(true)
        // … and NO honest goal quantity, in either wire spelling.
        expect(o.goal_probability, `${shape.name} / ${o.id}`).toBeUndefined()
        expect(o.probability_of_goal, `${shape.name} / ${o.id}`).toBeUndefined()
        // … and no per-option constraint_analysis, so the 'joint_goal_constrained'
        // branch cannot be what is being exercised.
        expect(o.constraint_analysis ?? null, `${shape.name} / ${o.id}`).toBeNull()
      }
    }
  })

  it('CONTROL: `constraints_decision_grade` does NOT discriminate these fabrications — which is why the gate is total, not conditional', () => {
    const grades = WITNESSED.map((s) => ({
      name: s.name,
      // Identity-bound: read off the run's OWN options, all of which agree.
      perOption: s.options.map((o) => o.constraints_decision_grade),
      perConstraint: (
        s.constraintResults as readonly { scale_provenance?: { decision_grade?: boolean } }[]
      ).map((c) => c.scale_provenance?.decision_grade),
    }))

    // Pricing: FALSE and it rendered anyway.
    expect(grades[0].perOption.every((g) => g === false)).toBe(true)
    expect(grades[0].perConstraint.every((g) => g === false)).toBe(true)
    // People AND probe: TRUE, and both are frame-broken.
    expect(grades[1].perOption.every((g) => g === true)).toBe(true)
    expect(grades[1].perConstraint.every((g) => g === true)).toBe(true)
    expect(grades[2].perOption.every((g) => g === true)).toBe(true)
    expect(grades[2].perConstraint.every((g) => g === true)).toBe(true)

    // So a `decision_grade === true` gate would have suppressed 1 of 3 and
    // passed 2 of 3 straight through. This is the measurement behind the
    // module's "the wire cannot distinguish" claim; it is not an opinion.
    const suppressedByDecisionGrade = grades.filter((g) =>
      g.perOption.every((x) => x === false),
    ).length
    expect(suppressedByDecisionGrade).toBe(1)
  })

  for (const shape of WITNESSED) {
    it(`WITHHOLDS the fabricated figure — ${shape.name}`, () => {
      for (const o of shape.options) {
        const d = selectGoalProbability(o)
        // ⭐ THE PIN. Identity-bound: this option, by its own id.
        expect(d.goalProbability, `${shape.name} / ${o.id}: goal-fit number`).toBeNull()
        expect(d.basis, `${shape.name} / ${o.id}: basis`).toBe('joint_goal_withheld')
        expect(d.jointSubstitutionWithheld, `${shape.name} / ${o.id}`).toBe(true)
        expect(d.goalProbabilityIsJoint, `${shape.name} / ${o.id}`).toBe(false)
        // No number ⇒ no possessive, and no modelled-basis caveat to hang on a
        // number that is not there.
        expect(d.mayUsePossessiveGoalFraming, `${shape.name} / ${o.id}`).toBe(false)
        expect(d.goalFitIsModelledBasis, `${shape.name} / ${o.id}`).toBe(false)
      }
    })

    it(`leaves the JOINT channel's own labelled value untouched — ${shape.name}`, () => {
      for (const o of shape.options) {
        const d = selectGoalProbability(o)
        // Byte-for-byte the producer's value, per option, bound by id. The gate
        // governs the goal-fit SLOT; it must not silently delete the quantity
        // the inspector renders under its own honest label.
        expect(d.jointGoalProbability, `${shape.name} / ${o.id}: joint passthrough`).toBe(
          o.probability_of_joint_goal,
        )
      }
    })
  }

  it('POSITIVE CONTROL: a genuinely honest `probability_of_goal` still renders (wire spelling)', () => {
    // Minimal, traceable mutation of producer bytes: the pricing options with
    // the honest channel restored at a value the run could plausibly carry.
    // Per-option DISTINCT values so the assertions bind to an option rather
    // than to a shared constant.
    const honest = L60_PRICING_OPTIONS.map((o, i) => ({
      ...(o as ProducerOption),
      probability_of_goal: 0.11 + i * 0.13,
    }))

    for (const [i, o] of honest.entries()) {
      const d = selectGoalProbability(o)
      expect(d.goalProbability, `${o.id}`).toBe(0.11 + i * 0.13)
      expect(d.basis, `${o.id}`).toBe('goal_probability')
      expect(d.jointSubstitutionWithheld, `${o.id}`).toBe(false)
      expect(d.mayUsePossessiveGoalFraming, `${o.id}`).toBe(true)
      // And the joint value is still carried alongside, unchanged.
      expect(d.jointGoalProbability, `${o.id}`).toBe(
        (o as ProducerOption).probability_of_joint_goal,
      )
    }
  })

  it('POSITIVE CONTROL: the mapped `goal_probability` spelling renders too', () => {
    const honest = L60_PEOPLE_OPTIONS.map((o, i) => ({
      ...(o as ProducerOption),
      goal_probability: 0.2 + i * 0.15,
    }))

    for (const [i, o] of honest.entries()) {
      const d = selectGoalProbability(o)
      expect(d.goalProbability, `${o.id}`).toBe(0.2 + i * 0.15)
      expect(d.basis, `${o.id}`).toBe('goal_probability')
      expect(d.jointSubstitutionWithheld, `${o.id}`).toBe(false)
    }
  })

  it('the modelled-basis caveat cannot be raised over a withheld figure', () => {
    // The pricing bytes DO carry
    // `goal_fit_basis.scored_from === 'modelled_outcome_distribution'` — the
    // exact input that used to set `goalFitIsModelledBasis`. With the number
    // withheld there is nothing for a caveat to qualify, and a caveat rendered
    // beside no number reads as a hedge about a value the user cannot see.
    const withBasis = L60_PRICING_OPTIONS.filter(
      (o) =>
        (o as { goal_fit_basis?: { scored_from?: string } }).goal_fit_basis?.scored_from ===
        'modelled_outcome_distribution',
    )
    expect(withBasis.length, 'control: the fixture must carry the modelled basis').toBeGreaterThan(
      0,
    )
    for (const o of withBasis) {
      expect(selectGoalProbability(o as ProducerOption).goalFitIsModelledBasis).toBe(false)
    }
  })

  it('`basisWithholdsPossessive` maps exactly the withheld basis, and nothing else', () => {
    expect(basisWithholdsPossessive('joint_goal_withheld')).toBe(true)
    expect(basisWithholdsPossessive('goal_probability')).toBe(false)
    expect(basisWithholdsPossessive('joint_goal_constrained')).toBe(false)
    expect(basisWithholdsPossessive('none')).toBe(false)
    expect(basisWithholdsPossessive(null)).toBe(false)
    expect(basisWithholdsPossessive(undefined)).toBe(false)
  })

  it('the constrained basis is UNAFFECTED — this gate is not a blanket ban on joint figures', () => {
    // `joint_goal_constrained` is the user's own goal AND their own limits,
    // chosen because the option carries its own constraint analysis. It has
    // never been the substitution and must keep its number, or this change
    // would be suppressing a quantity it was never asked to touch.
    const constrained: GoalProbabilityInput = {
      ...(L60_PROBE_OPTIONS[0] as ProducerOption),
      constraint_analysis: { constraints: [{ node_id: 'goal_mrr' }] },
    }
    const d = selectGoalProbability(constrained)
    expect(d.basis).toBe('joint_goal_constrained')
    expect(d.goalProbability).toBe(
      (L60_PROBE_OPTIONS[0] as ProducerOption).probability_of_joint_goal,
    )
    expect(d.goalProbabilityIsJoint).toBe(true)
    expect(d.jointSubstitutionWithheld).toBe(false)
  })
})

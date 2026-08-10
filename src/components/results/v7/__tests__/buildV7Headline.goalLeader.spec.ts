/**
 * ROADMAP 2.233 — the goal headline must crown the GOAL leader, not the
 * comparative one.
 *
 * THE DEFECT (Codex audit A, finding 1, reproduced against the real function
 * at `900dbd6c`): `buildV7Headline` fixed `winner = recommendation.recommendedOption`
 * — the COMPARATIVE leader — then checked only whether THAT option carried a
 * finite `goalProbability`, and printed
 * `"{label} has the highest chance of hitting your goal: {v}"`. No rival was
 * ever consulted, so the superlative was unearned by construction:
 *
 *   A(win .70, goal .40, recommended)   B(win .30, goal .80)
 *   → "Option A has the highest chance of hitting your goal: 40%"
 *
 * while the goal block on the same screen ranked B first at 80%.
 *
 * THE RULE, and where it comes from. `buildHeroModel` (UI-SEM-072) already
 * holds the correct algorithm and states it: crowning is SELECTION over
 * producer values, withheld unless a USER target exists, EVERY option carries
 * its own finite goal value, the maximum is UNIQUELY held, and it clears the
 * shared sub-1% floor. That rule is now extracted to
 * `utils/selectGoalLeader.ts` and BOTH surfaces call it, so the hero and this
 * headline can no longer disagree about who leads on the goal view. These pins
 * are written against the shared selector's OBSERVABLE effect on the headline,
 * not against the selector's internals.
 *
 * SUBJECT COHERENCE IS PART OF THE FIX. `V7Hero` renders `winProbability`
 * inside a gauge captioned "wins" IMMEDIATELY BESIDE the headline. If the
 * headline names the goal leader while the gauge still carries the comparative
 * leader's number, the reader attaches one option's win probability to a
 * different option's name — the same two-questions-one-claim defect in a new
 * place. The model's winner fields therefore follow the crowned option.
 */
import { describe, it, expect } from 'vitest'
import { COMPARATIVE_COPY, GOAL_ANCHOR_COPY } from '../../utils/goalAnchorCopy'
import { hasAnyGoalValue, hasCompleteGoalField, selectGoalLeader } from '../../utils/selectGoalLeader'
import { buildV7Headline } from '../buildV7Headline'
import type { DecisionResultData, OptionResult } from '../../types'

function goalOpt(
  id: string,
  label: string,
  winProbability: number,
  goalProbability: number | null,
  isRecommended = false,
  goalFitIsSubstitutedJoint = false,
): OptionResult {
  return {
    id,
    label,
    winProbability,
    isRecommended,
    ...(goalProbability !== null ? { goalProbability } : {}),
    goalFitIsSubstitutedJoint,
  } as unknown as OptionResult
}

function rec(partial: Partial<DecisionResultData>): DecisionResultData {
  // Every fixture carries a USER target unless it is deliberately testing the
  // no-target gate — UI-SEM-071 nulls every goal claim without one.
  return { goalThreshold: 100, ...partial } as DecisionResultData
}

describe('buildV7Headline — the goal crown (ROADMAP 2.233)', () => {
  it("AUDIT PROBE: does NOT crown the comparative leader on the goal metric when a rival's goal probability is higher", () => {
    // The audit's exact inputs.
    const a = goalOpt('a', 'Option A', 0.7, 0.4, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.8)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    // The defect, stated as the thing that must never be produced again.
    expect(model.headline).not.toBe(
      GOAL_ANCHOR_COPY.headline('Option A', '40%', false),
    )
    expect(model.headline).not.toContain('Option A has the highest')
    // The crown goes to the goal argmax, with ITS OWN number.
    expect(model.headline).toBe(GOAL_ANCHOR_COPY.headline('Option B', '80%', false))
  })

  it('the gauge value follows the crowned option — a "wins" figure never sits beside a different option\'s name', () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.4, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.8)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    expect(model.winnerLabel).toBe('Option B')
    expect(model.winProbability).toBe(0.3)
  })

  it('the subline under a GOAL headline measures the GOAL gap, not the comparative one', () => {
    // Deliberately distinct gaps: comparative 0.70−0.30 = 40 points,
    // goal 0.90−0.40 = 50 points. The audit's own fixture had BOTH equal to
    // 40, which cannot tell the two metrics apart.
    const a = goalOpt('a', 'Option A', 0.7, 0.4, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.9)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    expect(model.headline).toBe(GOAL_ANCHOR_COPY.headline('Option B', '90%', false))
    expect(model.subline).toBe('Leads by 50 points')
    expect(model.subline).not.toBe('Leads by 40 points')
  })

  it('crowns on the goal metric even when the two leaders AGREE (no behaviour change for the agreeing case)', () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.8, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.4)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    expect(model.headline).toBe(GOAL_ANCHOR_COPY.headline('Option A', '80%', false))
    expect(model.subline).toBe('Leads by 40 points')
    expect(model.winProbability).toBe(0.7)
  })

  it("the crowned row's own basis flag drives the wording (substituted joint withholds the possessive)", () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.4, true, false)
    const b = goalOpt('b', 'Option B', 0.3, 0.8, false, true)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    // B is crowned, so B's flag — not the recommended option's — picks the voice.
    expect(model.headline).toBe(GOAL_ANCHOR_COPY.headline('Option B', '80%', true))
    expect(model.headline).toContain('meeting every target this run scored')
  })
})

describe('buildV7Headline — when no honest goal crown exists, it does not crown (ROADMAP 2.233)', () => {
  const COMPARATIVE_A = (pct: string) => `Option A ${COMPARATIVE_COPY.clause(pct)}`

  it('PARTIAL DATA: a rival with no goal value withholds the crown — a max over an unmeasured rival is not a maximum', () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.4, true)
    const b = goalOpt('b', 'Option B', 0.3, null)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    expect(model.headline).not.toContain('highest chance')
    expect(model.headline).toBe(COMPARATIVE_A('70%'))
    // Subject and metric agree again: the comparative headline gets the
    // comparative subline. ⭐ SUPERSEDED 2026-08-10 — that subline was the
    // win-frequency GAP ('Leads by 40 points') and is retired; it now names the
    // runner-up and states its OWN probability. The GOAL arm's gap subline,
    // pinned above, is a different quantity and is unchanged.
    expect(model.subline).toBe('Next: Option B, 30%')
  })

  it('TIE AT THE MAX: two options share the highest goal probability → no crown', () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.8, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.8)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    expect(model.headline).not.toContain('highest chance')
    expect(model.headline).toBe(COMPARATIVE_A('70%'))
  })

  it('NO USER TARGET (UI-SEM-071): a synthesized goal probability cannot buy a goal claim', () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.4, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.8)
    const model = buildV7Headline(
      { recommendedOption: a, allOptions: [a, b], goalThreshold: null } as unknown as DecisionResultData,
      'robust',
    )

    expect(model.headline).not.toContain('chance of hitting your goal')
    expect(model.headline).toBe(COMPARATIVE_A('70%'))
  })

  it('BELOW THE SHARED SUB-1% FLOOR: nothing is meaningfully on track, so nothing is crowned', () => {
    // SUPERSEDES the three #548 sub-1% pins in `buildV7Headline.spec.ts`,
    // which asserted the headline CROWNS an option on a "< 1%" goal number.
    // The sibling hero (`buildHeroModel`, UI-SEM-057) withholds the crown
    // entirely in this state and switches to its no-option-on-track headline;
    // the two surfaces render on the same screen, so a crown here was a fresh
    // contradiction. The floor's FORMATTING role is unchanged and is still
    // pinned by the control below.
    const a = goalOpt('a', 'Option A', 0.7, 0.004, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.001)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    expect(model.headline).not.toContain('highest chance')
    expect(model.headline).not.toContain('< 1%')
    expect(model.headline).toBe(COMPARATIVE_A('70%'))
  })

  it('CONTROL — the floor still FORMATS: a crowned value just above it is not mangled', () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.012, true)
    const b = goalOpt('b', 'Option B', 0.3, 0.001)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a, b] }), 'robust')

    expect(model.headline).toBe(GOAL_ANCHOR_COPY.headline('Option A', '1%', false))
  })

  it('SINGLE OPTION: the only-option form still wins, and carries no superlative', () => {
    const a = goalOpt('a', 'Option A', 0.7, 0.4, true)
    const model = buildV7Headline(rec({ recommendedOption: a, allOptions: [a] }), 'robust')

    expect(model.headline).toBe('Option A is your only option')
  })
})

/**
 * TWO QUESTIONS, TWO PREDICATES (ROADMAP 2.233).
 *
 * A revision of this lane merged them into a single `.every` "availability"
 * rule. That was wrong, and the error is instructive: it was reasoning about
 * protecting the CLAIM, but the claim was already protected by
 * `selectGoalLeader`'s own complete-field gate. Tightening what we DISPLAY
 * therefore bought no honesty and cost real data — on partial coverage the
 * whole goal view vanished, including the options the producer HAD measured,
 * on a surface that discloses the missing ones as `'—'`.
 *
 *   AVAILABILITY (display) → `hasAnyGoalValue`      `.some`
 *   ENTITLEMENT  (claim)   → `hasCompleteGoalField` `.every`, inside the selector
 *
 * ⭐ THE PARTIAL-COVERAGE CASE IS PINNED IN BOTH DIRECTIONS — available AND
 * uncrowned. That pair is the whole point: it is precisely the case the merged
 * rule removed silently, and any future re-conflation must break one of them.
 */
describe('availability vs entitlement — the two goal predicates (ROADMAP 2.233)', () => {
  const value = (v: number | null) => ({ goal: v })
  const read = (r: { goal: number | null }) => r.goal
  const TARGETED = { hasUserTarget: true }
  const PARTIAL = [value(0.4), value(null), value(0.8)]

  it('⭐ PARTIAL COVERAGE, BOTH DIRECTIONS: the lens is AVAILABLE and the crown is ABSENT', () => {
    // ① display — a measured value is shown; the gap is disclosed, not hidden.
    expect(hasAnyGoalValue(PARTIAL, read, TARGETED)).toBe(true)
    // ② claim — no superlative over an incomplete field.
    expect(hasCompleteGoalField(PARTIAL, read, TARGETED)).toBe(false)
    expect(
      selectGoalLeader(PARTIAL, read, { designationsWithheld: false, hasUserTarget: true }),
    ).toBeNull()
  })

  it('complete coverage: available AND crownable (over-suppression control)', () => {
    const complete = [value(0.4), value(0.8)]
    expect(hasAnyGoalValue(complete, read, TARGETED)).toBe(true)
    expect(hasCompleteGoalField(complete, read, TARGETED)).toBe(true)
    expect(
      selectGoalLeader(complete, read, { designationsWithheld: false, hasUserTarget: true }),
    ).toBe(complete[1])
  })

  it('no user target → BOTH answer false, however complete the values are (UI-SEM-071)', () => {
    const complete = [value(0.4), value(0.8)]
    const NO_TARGET = { hasUserTarget: false }
    expect(hasAnyGoalValue(complete, read, NO_TARGET)).toBe(false)
    expect(hasCompleteGoalField(complete, read, NO_TARGET)).toBe(false)
  })

  it('no measured value at all → not even available', () => {
    expect(hasAnyGoalValue([value(null), value(null)], read, TARGETED)).toBe(false)
    expect(hasAnyGoalValue([], read, TARGETED)).toBe(false)
  })

  it('an empty option set is not "vacuously complete"', () => {
    expect(hasCompleteGoalField([], read, TARGETED)).toBe(false)
  })

  it('R7: the WITHHELD gate inside the selector bites on its own', () => {
    // ⚠ ADDED BECAUSE DELETING THIS GATE LEFT ALL 153 TESTS GREEN. It is
    // currently REDUNDANT — both live readers compute `designationsWithheld`
    // themselves and the headline returns early on a withheld verdict. But the
    // docstring's stated purpose is that the entitlement lives in the SELECTOR
    // "so a new reader cannot be born un-gated", and an untested guarantee is
    // not a guarantee. This pins the selector's OWN behaviour, independent of
    // every caller — which is exactly the claim being made.
    const complete = [value(0.4), value(0.8)]
    expect(
      selectGoalLeader(complete, read, { designationsWithheld: true, hasUserTarget: true }),
    ).toBeNull()
    // CONTROL — identical input, designations permitted ⇒ a crown. Without this
    // the assertion above would pass on a selector that never crowns anything.
    expect(
      selectGoalLeader(complete, read, { designationsWithheld: false, hasUserTarget: true }),
    ).toBe(complete[1])
  })

  it('a NaN is not a measurement, to EITHER question — `!= null` would have accepted it', () => {
    const withNaN = [value(0.4), value(Number.NaN)]
    expect(hasCompleteGoalField(withNaN, read, TARGETED)).toBe(false)
    // The check the extracted hero loop used, shown failing to discriminate.
    expect(withNaN.every((r) => r.goal != null)).toBe(true)
    // A NaN alone is not an available value either.
    expect(hasAnyGoalValue([value(Number.NaN)], read, TARGETED)).toBe(false)
  })
})

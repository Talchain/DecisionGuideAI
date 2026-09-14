import { buildAddConstraintParameters, type ConstraintType } from '../../v5/chipParameters'
import { statedTargetNumber } from '../domain/goalTarget'

/**
 * ⭐⭐⭐ THE BOUND, IN THE GRAMMAR CEE ALREADY PARSES — and it is a RECORD over
 * `ConstraintType`, not a ternary, DELIBERATELY.
 *
 * A `direction === 'at_most' ? … : 'at least'` would silently read every future
 * constraint type as a floor. Keyed on the union instead, a third member fails
 * the TYPECHECK rather than shipping a sentence that quietly contradicts the
 * parameter beside it. The list cannot drift from `CONSTRAINT_TYPES` because it
 * is derived from it (CLAUDE.md trap 12: derive, never mirror).
 *
 * ⚠ THIS IS THE WIRE'S VOCABULARY, NOT THE SCREEN'S. The words a reader picks
 * from live in the surface's own copy. They coincide today and they answer
 * different questions — one is the grammar CEE reads, one is what a human is
 * shown — so they are named apart rather than shared (CLAUDE.md trap 21). What
 * binds them is the direction-pair test, which drives the real selector and
 * asserts the real dispatch.
 */
const GOAL_TARGET_BOUND_PHRASE: Record<ConstraintType, string> = {
  at_least: 'at least',
  at_most: 'at most',
}

/** The bound as CEE reads it, for any surface that must name the direction. */
export function goalTargetBoundPhrase(direction: ConstraintType): string {
  return GOAL_TARGET_BOUND_PHRASE[direction]
}

/**
 * The inline control explicitly asks for an absolute level, in stated units,
 * IN A DIRECTION THE READER STATES. No parsing of goal labels, delta-to-level
 * conversion or local graph write.
 *
 * ⚠⚠⚠ `direction` IS A REQUIRED PARAMETER, AND THAT IS THE WHOLE CORRECTION.
 * This function hardcoded `'at_least'`, under the comment above, which was and
 * remains RIGHT about what it refuses to do: recovering a direction from the
 * words of a goal label is the natural-language predicate CLAUDE.md trap 22f
 * records as unwinnable after four rounds that each fixed one direction and
 * reopened the other. Nothing here parses anything, and nothing here guesses.
 *
 * What was wrong is that the hardcoded direction was never STATED to the person
 * it was recorded for. Measured on served `475ee1c7` (10 Sep 2026): a goal
 * reading *"95% Next-Day Delivery Within 12 Months"* — a DEADLINE — had `9`
 * typed into it and the wire carried `constraint_type: "at_least"` with
 * *"This goal must be at least 9 months."* The reader meant sooner; the model
 * recorded a floor. Trap 22f's sanctioned exit is to make the ambiguity the
 * product and ASK, which is what the parameter is for.
 *
 * ⚠ NO DEFAULT VALUE, DELIBERATELY. A defaulted parameter would let a new call
 * site inherit a floor without saying so, which is the defect this change
 * exists to close, one layer down. Every caller states its direction in its own
 * source.
 *
 * ── WHAT CEE DOES WITH EACH DIRECTION, DERIVED BY EXECUTION ────────────────
 * Measured against the real `add_constraint` handler at CEE `staging`
 * `dcebc360` (10 Sep 2026), by routing a chip bag through it:
 *
 *   · BOTH are first-class. `AddConstraintTypeSchema` is
 *     `z.enum(['at_least','at_most'])` and the operator comes from a MAP
 *     (`at_least → '>='`, `at_most → '<='`), not a ternary with an else-branch,
 *     so an unknown value is `PARAMETER_INVALID` rather than silently coerced
 *     to a floor. `constraint_type: 'exactly'` was refused as a negative
 *     control; both real values routed.
 *   · The MESSAGE cannot override the parameter. CEE derives a constraint frame
 *     from the prose but filters it on `operator === operator`, so the sentence
 *     can only ATTEST the structured direction or abstain. It cannot flip it.
 *     Our `at_most` sentence was witnessed yielding `value_frame: 'level'`.
 *
 * ⚠⚠ AND THE ASYMMETRY THAT IS NOT A DEFECT AND MUST NOT BE "FIXED" HERE.
 * `at_most` on a goal DELIBERATELY does not stamp the goal's success threshold:
 * `isSuccessTargetTurn` is `kind === 'goal' && operator === '>='`, because ISL
 * computes `P(samples >= threshold)`. So `at_least` returns *"Success target
 * set"* and writes `goal_threshold`; `at_most` returns *"Added constraint"* and
 * lands a constraint row with no threshold. Both are recorded in the shared
 * model, which is exactly what this control's outcome sentence claims and no
 * more — it says the turn was SENT, never that a target was set. A reader
 * choosing a ceiling gets a real constraint, not a silent no-op. Whether a
 * time-horizon ceiling should ALSO become a success threshold is a question
 * about ISL's minimisation doctrine, not about this control.
 *
 * ⚠ `unit` IS MANDATORY, AND THIS FUNCTION ALREADY ENFORCES IT. CEE refuses a
 * unit-less value outside [0,1] on a probability-domain kind rather than
 * guessing. The empty-unit refusal below predates that finding and satisfies
 * it; it is symmetric across both directions.
 */
export function buildManualGoalTarget(
  targetId: string,
  draft: string,
  unit: string,
  direction: ConstraintType,
) {
  const value = statedTargetNumber(draft)
  if (value === null || value <= 0 || unit.trim() === '') return null
  const built = buildAddConstraintParameters({
    targetId, constraintType: direction, value, unit: unit.trim(),
  })
  return built.ok ? { ...built.parameters, unit: unit.trim() } : null
}

/**
 * Keep the explicit consent in CEE's existing bound grammar. The constraint row
 * needs this evidence separately from the goal's target frame.
 *
 * ⚠⚠ THE PROSE AND THE `constraint_type` ARE TWO EXPRESSIONS OF ONE FACT. CEE
 * reads this sentence; the graph reads the parameter. They are built from the
 * SAME `direction` argument so they cannot drift from each other, and a mutant
 * that moves one without the other REDs the direction pair.
 */
export function manualGoalTargetMessage(
  value: number,
  unit: string,
  direction: ConstraintType,
): string {
  const number = value.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 21 })
  const amount = /^[£$€]$/.test(unit) ? `${unit}${number}`
    : unit === '%' ? `${number}%` : `${number} ${unit}`
  return `This goal must be ${GOAL_TARGET_BOUND_PHRASE[direction]} ${amount}. This is an absolute level, not a change from the current level.`
}

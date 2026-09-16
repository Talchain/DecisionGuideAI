/**
 * Which of Focus Now's generic hygiene rows are TRUE of THIS model.
 *
 * ⛔⛔ WHY THIS EXISTS, AND WHY MOUNTING WITHOUT IT WOULD HAVE MADE THE PANEL
 * WORSE. `STATIC_HYGIENE_ROWS` is six unconditional nudges — "Define what
 * success looks like", "Add an outcome you care about", "Add a risk worth
 * watching". `buildFocusRows` emits all six whenever `suppressStatic` is unset,
 * and `useFocusNow` passes only `coachingSummary`, so no model fact reaches
 * them. On the Analysis tab that is survivable: the rows sit under a hero that
 * frames them as generic hygiene.
 *
 * On the Reasoning tab they would sit where the prototype puts FOCUS NOW — the
 * panel's one primary action — and would tell a person with a goal, three
 * options, six factors and two outcomes to "define what success looks like".
 * That is the surface asserting a gap it never measured, which is the exact
 * fabrication class every other guard on this tab exists to prevent.
 *
 * ⭐ THE PROTOTYPE'S ROW IS SPECIFIC, AND THAT IS THE WHOLE POINT. It reads
 * "Define success · Must fix · Your goal reads 'Reach £30k MRR Within 18
 * Months' but carries no target". The value is in the CONDITION, not the
 * advice. A nudge that cannot say why it applies to you is noise.
 *
 * ⚠ FAIL-CLOSED ON UNKNOWN, NOT FAIL-OPEN. Every fact is `boolean | number |
 * null`, and `null` means NOT ESTABLISHED — it yields no row. Only a MEASURED
 * absence earns one. The opposite default would show the nudge whenever the
 * panel could not tell, which is where the defect came from.
 *
 * ⚠ THREE ROWS, NOT SIX, AND THE OMISSION IS DELIBERATE. `set-time-horizon`,
 * `add-constraint` and `capture-insight` have no fact on this surface that
 * could prove them: `ModelStrip`'s `StripRow.kind` is
 * `'option' | 'factor' | 'risk' | 'outcome'` — there is no constraint kind, no
 * horizon field, and "an insight worth capturing" is not a structural property
 * at all. Guessing at them is the same defect one step down, so they are
 * withheld and this comment records the gap rather than leaving it silent.
 */

/** A structural fact about the model, or `null` where this surface cannot tell. */
export interface ModelFactsForFocus {
  /** Has the goal a stated target? `null` = not established. */
  readonly hasGoalTarget: boolean | null
  /** How many outcome nodes the model carries. `null` = not established. */
  readonly outcomeCount: number | null
  /** How many risk nodes the model carries. `null` = not established. */
  readonly riskCount: number | null
}

/** The static row ids this module is able to adjudicate at all. */
export const ADJUDICABLE_STATIC_IDS = [
  'static:define-success',
  'static:add-outcome',
  'static:add-risk',
] as const

/**
 * The subset of `STATIC_HYGIENE_ROWS` that is demonstrably true of this model.
 * Returns ids, never rows: the copy stays owned by `focusConstants.ts`, so this
 * module cannot drift into authoring coaching (trap 12).
 */
export function applicableStaticFocusIds(facts: ModelFactsForFocus): string[] {
  const ids: string[] = []
  if (facts.hasGoalTarget === false) ids.push('static:define-success')
  if (facts.outcomeCount === 0) ids.push('static:add-outcome')
  if (facts.riskCount === 0) ids.push('static:add-risk')
  return ids
}

/**
 * GoalConstraintProvenance — "You said: …" under a goal constraint.
 *
 * ⚠ LEDGER N-20, AND THE PART OF IT THAT WAS TRUE. `source_quote` rides the
 * wire, is copied onto the persisted `CEEGoalConstraint` by
 * `applyV5State.ts:421`, and is part of `constraintsDeepEqual` — so it is
 * AUTHORITATIVE PERSISTED STATE, not a transient echo, which is what entitles
 * this surface to make a claim about what the user said (P5). It had zero
 * render consumers, so the user could not see their own words anywhere. This is
 * that consumer.
 *
 * (The ledger row also names `label_authored`. That symbol returns zero hits
 * anywhere in `src/` at this tip — it is not a UI field here. Reported rather
 * than invented.)
 *
 * ─── WHAT THIS COMPONENT IS ALLOWED TO SAY ──────────────────────────────────
 *
 * It prints the stored quote VERBATIM and attributes it to the user. It does
 * not paraphrase, summarise, tidy or truncate: the value of "you said" is that
 * it is checkable against the user's memory, and a cleaned-up quote is no
 * longer evidence of anything.
 *
 * ⚠ AND WHAT IT MUST NOT. It renders NOTHING when no quote is stored. A
 * constraint Olumi inferred carries no `source_quote`, and putting "You said …"
 * over an inference would fabricate provenance — the most serious defect class
 * in this estate, and worse here than an ordinary wrong value because it
 * launders a machine guess as a human statement. The empty and whitespace-only
 * cases are treated as absent for the same reason: `You said: ""` asserts that
 * the user said something while showing that they said nothing.
 *
 * ─── WHY IT IS QUIET ────────────────────────────────────────────────────────
 *
 * "Provenance available without clutter": this is `panelMeta`, muted, one line,
 * below the constraint it belongs to. It is not a badge, not a pill and not a
 * disclosure the user has to open — a provenance you have to hunt for is a
 * provenance nobody checks, and a provenance that shouts competes with the
 * constraint itself.
 */

import { typography } from '../../../../styles/typography'

/**
 * The testid, DERIVED rather than retyped at each call site and each assertion.
 * Exported so a spec cannot drift from the component about what it is looking
 * for (trap 12).
 */
export const GOAL_CONSTRAINT_PROVENANCE_TESTID = (constraintId: string): string =>
  `goal-constraint-${constraintId}-source-quote`

export interface GoalConstraintProvenanceProps {
  /** Identity of the constraint this quote belongs to — ID-addressed. */
  constraintId: string
  /**
   * The persisted `source_quote`, passed through UNCHANGED from the store.
   * `undefined` on any constraint nobody stated in words, which is the common
   * case and must render nothing.
   */
  sourceQuote?: string
}

export function GoalConstraintProvenance({
  constraintId,
  sourceQuote,
}: GoalConstraintProvenanceProps) {
  if (typeof sourceQuote !== 'string' || sourceQuote.trim() === '') return null

  return (
    <p
      data-testid={GOAL_CONSTRAINT_PROVENANCE_TESTID(constraintId)}
      className={`${typography.panelMeta} text-text-light mt-1 italic`}
    >
      {/* The attribution and the quote are separate nodes so the quote itself
          stays byte-for-byte what was stored — no interpolation into a
          sentence that could later be reworded around it. */}
      <span className="not-italic">You said: </span>
      &ldquo;{sourceQuote}&rdquo;
    </p>
  )
}

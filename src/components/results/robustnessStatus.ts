/**
 * ⭐ THE SINGLE OWNER OF "DID THE ROBUSTNESS CHECK PRODUCE A VERDICT?"
 *
 * Extracted from `useResultsSectionData` because the predicate that lived there
 * answered a DIFFERENT question from the one all of its consumers ask, and one
 * word carried both (CLAUDE.md trap 21).
 *
 * ── WHAT IT USED TO ASK ───────────────────────────────────────────────────
 *
 *   const hasRobustnessData = robustness && (
 *     safeArray(robustness.fragile_edges).length > 0 ||
 *     safeArray(robustness.robust_edges).length > 0 ||
 *     robustness.recommendation_stability !== undefined ||
 *     robustness.ranking_stability !== undefined )
 *
 * — *"did ANY robustness data arrive?"*. Measured on Paul's run `f51850fc`
 * (16 Sep), whose `enrichment.robustness` carries exactly `near_tie`,
 * `robust_edges` (3) and `fragile_edges` (4) and NO verdict field at all: that
 * predicate said **computed**, and the tab printed "Robustness status: Computed"
 * beside four surfaces correctly saying the verdict did not come back.
 *
 * ── WHAT EVERY CONSUMER READS IT AS ───────────────────────────────────────
 *
 * The verdict question, and `StressTestSection.tsx:444` says so outright — it
 * maps this field to **"didn't-run vs clean"**. `OutputsDock:3573-3595` gates a
 * degraded banner and labels "Robustness: available" from it. Neither wants to
 * know whether an edge array is non-empty.
 *
 * ── WHY `display_verdict` ─────────────────────────────────────────────────
 *
 * Because the estate already ruled it, in two places
 * (`canvas/nodes/DecisionNode.tsx:523`, `canvas/hooks/useAnalysisMetadata.ts:16`):
 * *"`display_verdict` is the ONLY field licensed to make a robustness claim"*.
 * `level` is that hook's own documented fallback and is honoured here. A fifth
 * spelling of this question would be the drift this exists to stop — there are
 * already four (`display_verdict`, `level`, `recommendation_stability`, and the
 * edge-list predicate this replaces).
 *
 * ── WHAT THIS CANNOT HIDE, ENUMERATED BEFORE CHANGING IT ──────────────────
 *
 * Every consumer of `robustnessStatus` was listed. NONE gates content on it:
 * `StressTestSection` reads it only inside `fragileCount === 0 &&
 * sensitiveCount === 0`, so it cannot suppress a fragile-edge list, and
 * `OutputsDock` uses it for a banner and a label inside that banner. This
 * changes what the surfaces SAY about the verdict and removes no data — the
 * opposite harm, which cannot share this parameter (trap 22b).
 *
 * ⚠ ROWED, NOT SMUGGLED IN. "Some robustness data arrived but no verdict" is a
 * genuine THIRD state and two values cannot express it. On `f51850fc` the fully
 * honest reading is "the verdict did not come back, and here are the
 * relationships it did look at". That needs a third value and a pass over every
 * consumer's boolean, and it is not this change.
 */

/** Two values, because that is what every consumer of this field reads. */
export type RobustnessStatus = 'computed' | 'unavailable'

const nonEmptyString = (v: unknown): boolean =>
  typeof v === 'string' && v.trim().length > 0

/**
 * `'computed'` only when the producer stated a robustness verdict on this run.
 *
 * Fail-closed: an absent block, a non-string verdict, or a blank one cannot
 * support a positive claim that the check produced an answer.
 */
export function deriveRobustnessStatus(
  report: unknown,
): RobustnessStatus {
  const robustness = (report as { robustness?: unknown } | null | undefined)?.robustness
  if (robustness === null || typeof robustness !== 'object') return 'unavailable'
  const r = robustness as { display_verdict?: unknown; level?: unknown }
  return nonEmptyString(r.display_verdict) || nonEmptyString(r.level)
    ? 'computed'
    : 'unavailable'
}

/**
 * ROADMAP 2.580 member 1 — "option percentages displayed as 99% and 101%
 * totals because of rounding, with no explanation" (Codex simulated-user
 * review, 5 Aug 2026).
 *
 * WHAT THIS CLAIMS, AND WHY THE INPUT IS STRINGS
 * ----------------------------------------------
 * The note is an arithmetic statement about the figures ON SCREEN. So it is
 * derived from the READOUT STRINGS the surface is about to print — not from
 * the underlying probabilities, and not from a second evaluation of the
 * formatting rule.
 *
 * That distinction is the whole point. `formatProbabilityWithResolution` has
 * two arms (with/without `n_valid_samples`) and a resolution ladder that can
 * emit decimals; re-deriving "what will be shown" here would be a
 * hand-maintained mirror of that function (CLAUDE.md trap 12) and would drift
 * the first time the ladder changes. Passing the rendered strings in makes the
 * note and the numbers provably the same values — there is only one evaluation.
 *
 * FAIL-CLOSED, DELIBERATELY
 * -------------------------
 * A readout that is not an exact whole percentage carries no total we are
 * entitled to state:
 *   · `'< 1%'` / `'>99%'` are BOUNDS — the true share is unknown, so no sum of
 *     the visible set is derivable.
 *   · `'33.3%'` means the resolution ladder chose decimals, so "rounded to
 *     whole percentages" would be a false description of what is shown.
 * In both cases this returns `null`: no note beats a note that overstates.
 *
 * It also returns `null` when the displayed integers DO total 100 — the note
 * exists to explain a visible discrepancy, not to decorate a clean partition.
 *
 * ⚠ THE CALLER OWNS ONE PRECONDITION THIS FUNCTION CANNOT CHECK: the readouts
 * must be the COMPLETE partition. A collapsed option list ("Show all (2 more)")
 * is a subset, and a subset failing to total 100 is expected, not a rounding
 * artefact. See the `hiddenCount === 0` gate at the call site.
 */

/** Test id of the rendered note. Exported so specs bind by identity. */
export const ODDS_ROUNDING_NOTE_TESTID = 'option-odds-rounding-note'

/** Exact whole-percent readout, e.g. `'33%'`. Bounds and decimals do not match. */
const WHOLE_PERCENT = /^(\d+)%$/

/**
 * The note to render beneath a complete set of option odds, or `null`.
 *
 * @param readouts the percentage strings the surface is printing, in any order
 */
export function deriveOddsRoundingNote(readouts: readonly string[]): string | null {
  // One option is not a partition; nothing to reconcile.
  if (readouts.length < 2) return null

  let total = 0
  for (const readout of readouts) {
    const match = WHOLE_PERCENT.exec(readout.trim())
    if (match === null) return null
    total += Number(match[1])
  }

  if (total === 100) return null

  return `These are rounded to whole percentages, so they total ${total}%, not 100%.`
}

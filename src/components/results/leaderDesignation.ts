/**
 * MAY THIS PANEL DESIGNATE A LEADER? — the ONE reader every designation site uses.
 *
 * ⚠ WHY A FUNCTION AND NOT FIVE EXPRESSIONS. `resultsSectionData` feeds at least
 * five designation channels (the crown and card order, the win-probability
 * gauge, the hero, Analysis (New)'s model implication, the triage footer, the
 * strengthen engine). A reviewer found FOUR of them still reading
 * `verdict.hasLeadingOption` — one of the two conjuncts — while a comment 420
 * lines above them said the file read the composed answer. Five copies of a
 * predicate is five chances to drift; this is one.
 *
 * TWO QUESTIONS, ALREADY COMPOSED UPSTREAM:
 *   Q1 does the MODEL license a comparative claim?  `permitted_analysis_mode`
 *   Q2 did THIS RESULT separate the arms?           `verdict.hasLeadingOption`
 * `useResultsSectionData` conjoins them into `leaderDesignationPermitted`.
 *
 * ⭐ THE FALLBACK IS LOAD-BEARING AND IT FIXES A REAL REGRESSION.
 * A hand-built fixture carrying `verdict: { hasLeadingOption: false }` and no
 * `leaderDesignationPermitted` used to WITHHELD and, under a bare
 * `leaderDesignationPermitted === false`, would have stopped withholding —
 * because `undefined === false` is `false`. Not user-reachable (the hook always
 * supplies the field) but it silently weakened every fixture-driven test of the
 * withheld path, which is exactly where this behaviour is pinned. A reviewer
 * raised it as non-blocking; it is closed here rather than noted.
 *
 * So: the composed answer when the producer of it ran, else the historic Q2 —
 * never `undefined` coerced into a permission.
 *
 * @returns `true` permitted · `false` withheld · `undefined` no authority at all
 *          (a legacy caller with no verdict), which callers read strictly with
 *          `=== false` / `=== true` so absence keeps their existing behaviour.
 */
export function leaderDesignationPermitted(rec: {
  leaderDesignationPermitted?: boolean
  verdict?: { hasLeadingOption?: boolean }
} | null | undefined): boolean | undefined {
  if (rec == null) return undefined
  return rec.leaderDesignationPermitted ?? rec.verdict?.hasLeadingOption
}

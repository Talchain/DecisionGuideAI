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
 * ⭐⭐ WHEN THE COMPOSED ANSWER IS ABSENT, Q2 ALONE MAY WITHHOLD AND MAY NEVER
 * LICENSE. The rule is asymmetric on purpose, and BOTH halves are load-bearing.
 *
 *   WITHHOLD (returns `false`). A hand-built fixture carrying
 *   `verdict: { hasLeadingOption: false }` and no `leaderDesignationPermitted`
 *   must keep withholding: under a bare `leaderDesignationPermitted === false`
 *   it would STOP withholding, because `undefined === false` is `false`. Not
 *   user-reachable (the hook always supplies the field) but it silently weakened
 *   every fixture-driven test of the withheld path, which is exactly where this
 *   behaviour is pinned.
 *
 *   ⚠ LICENSE (returns `undefined`, NOT `true`). THIS DIRECTION WAS MISSING FROM
 *   THIS DOCSTRING AND FROM THE CODE, and it is the unsafe one. The reader used
 *   to answer `?? verdict?.hasLeadingOption`, so on `hasLeadingOption: true` with
 *   no composed field it handed back an unearned `true` — a LICENCE inferred
 *   from SEPARATION, on an object that never answered Q1 at all. That is the
 *   one-conjunct read this module exists to abolish, occurring inside it. The
 *   docstring justified the fallback solely by the safe direction, which is how
 *   it survived review: a corpus that tests one direction is a guard watching
 *   one door.
 *
 * ⚠ NOT USER-REACHABLE TODAY — AND THE INVARIANT THAT MAKES THAT TRUE IS NOW
 * PINNED, because nothing pinned it before. `useResultsSectionData` emits
 * `verdict` and `leaderDesignationPermitted` as SIBLING KEYS of one object
 * literal, and its only other exit carries neither, so no production payload
 * reaches this fallback while carrying a verdict
 * (`__tests__/useResultsSectionData.admissionGatesLeader.spec.ts`, the PRODUCER
 * INVARIANT arm). This function is nevertheless one call away from being live:
 * `deriveRunLeaderVerdict` (canvas/stores/analysisSnapshotFactory.ts) returns a
 * `DecisionVerdict` with no admission anywhere on that path, and the whole
 * `src/canvas/compare-tab/` directory reads zero licence symbols — so
 * `leaderDesignationPermitted({ verdict: snapshot.leaderVerdict })` typechecks,
 * and before this change it answered `true`. A lane wiring Compare through this
 * reader would have shipped a gate that changes nothing and reads as licensed.
 * ⚠ Passing a bare snapshot verdict here is STILL not a licence check — it is a
 * withhold-only check. Compare needs Q1 PLUMBED to that path, not this reader
 * pointed at it.
 *
 * ⚠ WHY `undefined` AND NOT `false` FOR THE UNLICENSED CASE. Returning `false`
 * would manufacture a WITHHOLDING where the old code manufactured a LICENCE —
 * the mirror defect, not a fix. It would also align the three consumer idioms
 * `ResultsBody.tsx` documents as deliberately different (`=== false` permissive,
 * `=== true` conservative, raw pass-through resolving to `=== false` one
 * component down); in that file's own words, "the remedy is naming, not
 * aligning". `undefined` is the documented third state, so every consumer's
 * absence arm keeps exactly the behaviour it had.
 *
 * @returns `true` permitted · `false` withheld · `undefined` no authority at all
 *          (no verdict, or a verdict with no composed answer beside it), which
 *          callers read strictly with `=== false` / `=== true` so absence keeps
 *          their existing behaviour.
 */
export function leaderDesignationPermitted(rec: {
  leaderDesignationPermitted?: boolean
  verdict?: { hasLeadingOption?: boolean }
} | null | undefined): boolean | undefined {
  if (rec == null) return undefined
  // The composed answer whenever its producer ran. `!= null` rather than a
  // truthiness check, so a composed `false` is returned as `false` instead of
  // falling through to the very Q2 the model refused to license.
  if (rec.leaderDesignationPermitted != null) return rec.leaderDesignationPermitted
  // ABSENCE OF THE COMPOSED ANSWER IS NOT PERMISSION. Q2 is one of two
  // conjuncts, so it may only ever WITHHOLD here — never license.
  return rec.verdict?.hasLeadingOption === false ? false : undefined
}

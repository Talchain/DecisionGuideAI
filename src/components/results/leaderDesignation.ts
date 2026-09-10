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

/**
 * ⭐⭐ WAS A RANKING WITHHELD? — which is NOT the same question as "may a leader
 * be named", and conflating them deleted a licensed sentence.
 *
 * ⚠ THIS EXISTS BECAUSE THE OBVIOUS PREDICATE IS TOO WIDE, and a reviewer caught
 * it. Gating a surface on `leaderDesignationPermitted(rec) !== true` withholds on
 * BOTH of these, which are different runs:
 *
 *   · a ranking existed and the producer refused to license it — WITHHELD, and
 *     nothing may explain a verdict by reference to it;
 *   · there was never a ranking at all (an open strategic challenge: no options,
 *     no arms to separate) — in which case the producer's sentence is about
 *     FACTOR SENSITIVITY, is fully licensed, and deleting it is a second harm.
 *
 * Measured: `openStrategicChallenge()` carries `allOptions: []`, no verdict, and
 * the sentence *"Small changes in supplier lead time change which direction looks
 * better."* A permission-only gate deletes it.
 *
 * ⚠⚠ TWO HARMS CANNOT SHARE ONE PARAMETER (CLAUDE.md trap 22b). A false positive
 * that DROPS a licensed sentence and one that INVENTS a leader claim point in
 * opposite directions; this predicate answers only the second, and asks about the
 * EXISTENCE of a ranking first.
 *
 * ⚠ "A ranking existed" is TWO independent signals, either sufficient, because a
 * payload may carry one without the other: two or more arms to separate, or an
 * identified leader. `decisionVerdict.ts` states at the field that identity and
 * entitlement are different questions — `leaderId` is the identity half, and it
 * is exactly what a withheld run still carries (measured on deployed `73825428`:
 * `leading_option_id` present beside `permitted: false`).
 *
 * Fail-closed is preserved where it matters: on a run that HAS a ranking, an
 * authority that cannot answer (`undefined`) still withholds.
 */
export function rankingWasWithheld(
  rec:
    | {
        leaderDesignationPermitted?: boolean
        verdict?: { hasLeadingOption?: boolean; leaderId?: string | null }
        allOptions?: unknown[]
        rankedComparisonPopulation?: number
      }
    | null
    | undefined,
): boolean {
  if (rec == null) return false
  /**
   * ⭐⭐ THE REPORT'S OWN POPULATION IS THE FIRST AND LOAD-BEARING SIGNAL, and it
   * was missing. Review's schedule, reproduced at the bytes:
   *
   *   1. A completed TWO-option report is retained, carrying its ranking
   *      explanation and an explicit `producer_leader_permission:{permitted:false}`.
   *   2. The user deletes one option. `deleteNodeById` updates nodes and edges and
   *      invalidates readiness — it does NOT erase the completed report.
   *   3. `useResultsSectionData` rebuilds `allOptions` from the CURRENT option
   *      nodes, and calls `deriveDecisionVerdict` with the visible ids.
   *   4. `decisionVerdict.ts` filters by those ids and returns the NO-CLAIM verdict
   *      at `comparable.length < 2` — BEFORE it ever reads the producer's
   *      permission. So `leaderId` is null and `hasLeadingOption` is false.
   *   5. Both original signals therefore say "no ranking existed", the function
   *      returns false, and the retained report's ranking explanation RENDERS.
   *
   * An explicitly withheld ranking became speakable because a node disappeared —
   * reachable after an ordinary graph edit, not an invented fixture.
   *
   * ⚠⚠ A PROJECTION CANNOT ANSWER A QUESTION ABOUT THE PAST. `allOptions` and
   * `verdict` are rebuilt every render from the live graph, which is correct for
   * "is there a leading option ON SCREEN?" and wrong for "did the RUN THAT WROTE
   * THIS SENTENCE rank anything?". The second is a fact about the report, settled
   * when the run completed, and no later edit may revise it.
   *
   * ⚠ THE TWO PROJECTION SIGNALS ARE KEPT, not replaced. They are additional
   * SUFFICIENT conditions, so adding the report term only ever widens "a ranking
   * existed" — i.e. only ever widens WITHHOLDING, the fail-closed direction. An
   * open strategic challenge has no report population, no arms and no leader, so
   * it still answers `false` and its licensed factor-sensitivity sentence still
   * renders. Blocker 1's repair is preserved, which was the explicit instruction.
   *
   * ⚠ ABSENCE IS NOT ZERO. `rankedComparisonPopulation` is optional; a legacy
   * fixture that omits it must fall through to the projection signals rather than
   * be read as "this run was unranked", so the test is `>= 2` on a number and
   * never `!== undefined`.
   */
  const reportRanked =
    typeof rec.rankedComparisonPopulation === 'number' && rec.rankedComparisonPopulation >= 2
  const arms = Array.isArray(rec.allOptions) ? rec.allOptions.length : 0
  const aRankingExisted = reportRanked || arms >= 2 || rec.verdict?.leaderId != null
  if (!aRankingExisted) return false
  return leaderDesignationPermitted(rec) !== true
}

/**
 * Why a displayed report may not match the current model.
 *
 * ⚠⚠ THIS EXISTS BECAUSE ONE BOOLEAN ANSWERED TWO QUESTIONS.
 *
 * `OutputsDock` computes `analysisNotConfirmedFresh` as
 * `freshness === 'stale' || freshness === 'unknown'` and hands the Reasoning
 * tab that single flag. The tab rendered "The model has changed since this
 * analysis ran." for BOTH — so on a run CEE could not VERIFY, the panel's first
 * line asserted a fact about the user's model from an absence of evidence.
 *
 * The dock's own comment forbids it, a few lines under that predicate: "so the
 * stale banner never claims 'you've updated the model' for a CEE-sourced
 * 'unknown'". The OLD Analysis tab honours it — `AnalysisFreshnessNotice`
 * computes `freshness === 'stale'` with STRICT equality and gives 'unknown' its
 * own sentence. This tab did not.
 *
 * 'changed' is a claim about the WORLD. 'unconfirmed' is a claim about our
 * EVIDENCE. They are different questions and they get different sentences
 * (CLAUDE.md trap 21).
 *
 * ⚠ IT LIVES HERE, NOT IN THE DOCK, so the mapping the Reasoning tab depends on
 * is owned and tested by the Reasoning tab. The defect being fixed was a
 * collapsed value nobody pinned; leaving its replacement inline and untested
 * would repeat that exactly one level up.
 */
export type StaleReason = 'changed' | 'unconfirmed'

/**
 * @param freshness The dock's displayed freshness verdict.
 *
 * ⚠ FAIL-CLOSED, AND DELIBERATELY ASYMMETRIC. Only the producer's own 'stale'
 * licenses the stronger claim. Everything else — 'unknown', 'fresh', 'none',
 * absent, or a token this build does not know — yields 'unconfirmed', because
 * not being able to establish a change is not evidence of one. The opposite
 * default is the defect.
 */
export function staleReasonFromFreshness(freshness: string | null | undefined): StaleReason {
  return freshness === 'stale' ? 'changed' : 'unconfirmed'
}

/**
 * ⭐⭐ THE SAME QUESTION THE FOOTER ANSWERS, READ FROM THE SAME AUTHORITY.
 *
 * `staleReasonFromFreshness` above maps the dock's displayed freshness, and it
 * is correct about what it can see — but it CANNOT SEE A LOCAL EDIT. CEE's
 * `freshness` only turns `'stale'` once the server knows; a user who has just
 * changed a value on the canvas has produced a change this build knows about
 * with certainty and CEE has not been told about yet.
 *
 * The footer already reads the wider authority: `classifyFreshnessForDisplay`,
 * which also sees the local dirty overlay.
 *
 * ⚠⚠ WHAT THAT FUNCTION DOES — ENUMERATED, NOT SUMMARISED, AND THE COUNT IS
 * THE REASON. Two one-line summaries of it have shipped in this comment and
 * BOTH were false, in OPPOSITE directions: the first was unqualified, and the
 * paraphrase that replaced it in review — "a retained `'unknown'` dirtied
 * locally yields `'cannot_confirm'` instead" — is false on limb 2b below. A
 * third summary would be the third wrong sentence (CLAUDE.md trap 22f: two
 * reversals on one predicate is a signal, and "one more rule" is sunk cost),
 * so this states the branches instead of compressing them.
 *
 * Derived by EXECUTING the function over its whole input space at `06979dad`
 * — 4 freshness values × 6 reason codes × 3 at-run/current hash pairs × dirty
 * × importHold, plus the null state = 292 rows — never read off either
 * previous comment. Pinned by name in `__tests__/staleReason.spec.ts`.
 *
 * It returns `'changed'` in exactly two limbs:
 *
 *   1. the DISPLAYED value is `'stale'`. CEE stated it first-hand, and the
 *      verdict is not self-contradictory — `isSelfContradictoryStale`
 *      downgrades a `'stale'` whose own payload carries IDENTICAL non-empty
 *      at-run/current hashes to `'unknown'` before this branch sees it. A
 *      STATED `'stale'` reaches `'changed'` even under an import hold; that is
 *      deliberate, and ROADMAP 2.129 (a) is what happened when it did not.
 *
 *   2. there is NO import hold, the local dirty overlay is set, AND the stored
 *      verdict either
 *        a. has `freshness: 'fresh'` — the overlay downgraded a retained fresh
 *           verdict for display, and the `'changed'` inference is drawn from
 *           the stored value rather than the displayed one; or
 *        b. carries `freshnessReason === VERDICT_ABSENT_FROM_PAYLOAD` — the
 *           payload carried no `freshness` field at all, so the UI degraded it
 *           to `'unknown'` ITSELF.
 *
 * ⚠ LIMB 2b IS WHAT THE PARAPHRASE DENIED, and it is not a corner case: it is
 * the `graph_patch: applied` reply — readiness only, newer `computed_at`,
 * total silence on freshness — captured verbatim on staging and already
 * asserted to read `'changed'` by
 * `canvas/store/__tests__/freshnessOnAppliedEdit.spec.ts`. So the sentence
 * this replaces described the product's own accepted-edit path as saying the
 * opposite of what it says.
 *
 * Everything else is `'cannot_confirm'` — a CEE-STATED `'unknown'` whatever
 * the overlay says, the orphan synthesis, the run-completion write, and every
 * import-held state limb 1 did not already answer — or `'current'` (an
 * undirtied `'fresh'` with no hold) or `'none'` (no verdict to show).
 *
 * The disagreement this fix closes is limb 2a. On exactly the
 * fresh-then-dirtied state the two surfaces disagreed ON SCREEN, witnessed on
 * the deployed build:
 *
 *   footer  "Model changed. Results may be out of date."     (definite)
 *   panel   "We cannot confirm whether this analysis
 *            reflects the current model."                     (uncertain)
 *
 * The panel was not being careful, it was being blind — and a surface that says
 * it cannot tell, beside one that just told you, reads as the product not
 * knowing its own state. This estate's remedy for one question under two gates
 * is ONE shared admission every consumer reads, never aligned defaults.
 *
 * ⚠ THE FAIL-CLOSED RULE IS UNCHANGED AND STILL ASYMMETRIC. Only `'changed'`
 * — the authority's own affirmative — licenses the stronger claim. `'current'`,
 * `'cannot_confirm'`, `'none'` and any token this build does not know all yield
 * `'unconfirmed'`. A local dirty edit is EVIDENCE OF A CHANGE, so admitting it
 * honours that rule rather than relaxing it: what is banned is asserting a
 * change from an ABSENCE of evidence, not from its presence.
 */
export function staleReasonFromTrustSemantic(
  semantic: string | null | undefined,
): StaleReason {
  return semantic === 'changed' ? 'changed' : 'unconfirmed'
}

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

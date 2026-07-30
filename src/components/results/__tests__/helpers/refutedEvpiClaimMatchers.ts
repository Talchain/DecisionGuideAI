/**
 * refutedEvpiClaimMatchers — the ONE definition of the banned
 * value-of-information vocabulary.
 *
 * `evpi_percentage_points` is refuted, not merely uncalibrated (replayed live on
 * 2026-07-25 against PLoT `1dd45b6a` → ISL `3aea011c`; the formula
 * `voi × winProbSpread × 100` multiplies BY the top-two win-probability gap,
 * which inverts decision theory). The sentences it wore — "Worth 12.3pp if
 * resolved", "Resolving could improve confidence by …" — must not come back on
 * any surface, including a surface that answers the same user question from a
 * DIFFERENT and real estimator.
 *
 * WHY THESE LIVE HERE RATHER THAN IN EACH SPEC. Two suites assert the same
 * absence: `evpiSurfacesRemoved.honesty.spec.tsx` (the removed results
 * surfaces) and `evpiSurfacesRemoved.resolveNext.honesty.spec.tsx` (the new
 * "Resolve next" view). While each carried its own copy, one of them could be
 * narrowed — or a pattern added to only one — and the other would keep passing.
 * That is trap 13 with a delay fuse: an absence assertion whose definition of
 * the thing being absent can drift silently. One definition, two importers.
 *
 * ⚠ These are DEFINITIONS, not assertions. A regex that never fires proves
 * nothing, so every importing spec pairs them with a POSITIVE CONTROL that
 * shows each pattern still matches the string it was written to catch — by
 * iterating `REFUTED_CLAIM_CONTROLS` below, never by hand-listing patterns.
 *
 * ⚠⚠ THAT SENTENCE WAS FALSE WHEN IT WAS FIRST WRITTEN, AND THE FALSEHOOD IS THE
 * REASON THE RULE IS NOW "ITERATE THE TABLE". At the first commit of this
 * extraction (PR #533), `evpiSurfacesRemoved.honesty.spec.tsx` imported the three
 * regexes but HAND-LISTED controls for only two of them — `WORTH_CLAIM` and
 * `RESOLVING_CLAIM`. `PP_TOKEN` had none, in a file that uses it in three
 * absence assertions. Adversarial review proved the consequence by mutation:
 * neutering the shared `PP_TOKEN` left that spec **6/6 GREEN**, while neutering
 * either other pattern RED-ed it. So moving the definitions here had removed
 * duplicate-drift and introduced a SINGLE POINT OF VACUITY about a refuted
 * quantity — the same trap-13 class the extraction existed to close, arriving
 * from the other direction.
 *
 * Both sentences flagged in that review (this one, and "the table both honesty
 * specs drive" below) are now TRUE, and are kept rather than softened: the fix
 * was to make the code match the claim. The history stays because a header that
 * silently becomes true reads exactly like one that was never wrong — and
 * "hand-listed two of three" is the mistake this file will invite again.
 *
 * ⚠ WHY THIS LIVES IN `__tests__/helpers/` AND NOT IN `src/test/helpers/`.
 * `tests/contracts/no-evpi-display.contract.test.ts` scans every tracked
 * `src/**` file for the removed SENTENCES, and derives its non-display exemption
 * as `__tests__/` or `/tests/` — which `src/test/helpers/` (singular "test")
 * matches NEITHER. Putting the banned vocabulary there turns that guard RED, and
 * correctly so from its point of view: a non-exempt `src/` module would have
 * just reintroduced the removed copy. Both importing specs live in
 * `src/components/results/__tests__/`, so this sits beside them, exempt by the
 * guard's existing derived category — the same category the two specs holding
 * these strings today already sit in — and it follows the repo's
 * `__tests__/helpers/` precedent (`src/lib/`, `src/v5/`).
 *
 * The alternative the guard's own failure message suggests — adding `src/test/`
 * to its `NON_DISPLAY_PREFIXES` — would also work, and would close a real gap in
 * its category derivation (as it stands, no shared test helper can mention this
 * vocabulary from the repo's declared helpers home). That is a change to a
 * trust-surface guard, so it is left to a reviewer rather than taken here.
 */

/** Any "<n>pp" token — the shape the refuted quantity wore on every surface. */
export const PP_TOKEN = /\d+(\.\d+)?\s*pp\b/i

/** The confidence-improvement sentence removed from the results surfaces. */
export const RESOLVING_CLAIM = /resolving could improve confidence/i

/** The per-factor "worth Npp if resolved" claim. */
export const WORTH_CLAIM = /worth\s+\d+(\.\d+)?pp if resolved/i

/**
 * Each matcher paired with a string it MUST match — the positive-control table
 * both honesty specs drive, so the controls cannot drift apart from the patterns
 * they guard.
 *
 * ⚠ EVERY PATTERN EXPORTED ABOVE MUST HAVE A ROW HERE. That is what makes the
 * controls derived rather than remembered: a fourth banned pattern added above
 * without a row here is a pattern with no control in either spec, which is how
 * `PP_TOKEN` went uncontrolled in one of them (see the header). Both specs assert
 * this table's LENGTH, so shrinking it reds instead of quietly checking less.
 */
export const REFUTED_CLAIM_CONTROLS: ReadonlyArray<readonly [RegExp, string]> = [
  [PP_TOKEN, 'Worth 12.3pp if resolved'],
  [RESOLVING_CLAIM, 'Resolving could improve confidence by up to 10pp'],
  [WORTH_CLAIM, 'Worth 6.6pp if resolved'],
] as const

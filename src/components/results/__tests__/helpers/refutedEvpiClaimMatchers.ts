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

/**
 * ⭐ R-1 — THERE WERE TWO TABLES OF THIS VOCABULARY AND THEY HAD ALREADY
 * DIVERGED. THIS IS NOW THE ONE.
 *
 * `tests/contracts/no-evpi-display.contract.test.ts` held a second table,
 * `FORBIDDEN_COPY`, with its own hand-written positive-control loop of the same
 * construct. It was not a copy of this one — it had drifted in BOTH directions
 * before anyone noticed:
 *
 *   · the contract table carried `/would improve confidence by/i`,
 *     `/pp via EVPI/i` and `/ranked by EVPI/i`, which THIS file lacked;
 *   · this file carried `PP_TOKEN` and `WORTH_CLAIM`, which IT lacked;
 *   · `RESOLVING_CLAIM` was byte-identical in both.
 *
 * So the sentence the StatusBar chip actually wore (`Npp via EVPI`) was outside
 * the render-time vocabulary, and the token the refuted quantity wore everywhere
 * (`Npp`) was outside the source-scan vocabulary. Two guards, each blind to the
 * other's patterns, both green, each file's header claiming to hold "the ONE
 * definition". The header above was written against exactly this hazard and was
 * itself an instance of it.
 *
 * One table, two consumer projections, each derived by SCOPE (below) rather than
 * by hand.
 */

/**
 * Where a pattern is safe to apply. Not decoration — the two consumers ask
 * genuinely different questions and one pattern is legitimately not for both:
 *
 *   · `'dom'` — matched against RENDERED TEXT by the two honesty specs. Anything
 *     the user could read is in scope, including bare tokens.
 *   · `'source'` — matched against SOURCE LINES by the no-EVPI-display contract,
 *     after comment stripping. A pattern here must be specific enough that a hit
 *     IS a re-introduction: `PP_TOKEN` is deliberately absent, because "5pp" is
 *     legitimate in a comparison threshold's code (`within 5pp of the leader`)
 *     and reddening on it would teach the next lane to widen the exemption list,
 *     which is how a real violation gets an exception written for it.
 */
export type RefutedClaimScope = 'dom' | 'source'

export interface RefutedClaimPattern {
  /** The matcher. */
  readonly pattern: RegExp
  /** A string it MUST match — its positive control. */
  readonly control: string
  /** The surface or claim it names, quoted in failure messages. */
  readonly what: string
  /** Which consumers may apply it. See `RefutedClaimScope`. */
  readonly scopes: ReadonlyArray<RefutedClaimScope>
}

/** Any "<n>pp" token — the shape the refuted quantity wore on every surface. */
export const PP_TOKEN = /\d+(\.\d+)?\s*pp\b/i

/** The confidence-improvement sentence removed from the results surfaces. */
export const RESOLVING_CLAIM = /resolving could improve confidence/i

/** The per-factor "worth Npp if resolved" claim. */
export const WORTH_CLAIM = /worth\s+\d+(\.\d+)?pp if resolved/i

/** The factor chip's improvement clause — was contract-table-only. */
export const IMPROVE_CONFIDENCE_CLAIM = /would improve confidence by/i

/** The StatusBar chip that SUMMED three refuted figures — was contract-only. */
export const PP_VIA_EVPI = /pp via EVPI/i

/** The visible factor-list sort label — was contract-only. */
export const RANKED_BY_EVPI = /ranked by EVPI/i

/**
 * ⭐ THE VOCABULARY. Every pattern, its positive control, and its scopes.
 *
 * ⚠ EVERY PATTERN EXPORTED ABOVE MUST HAVE A ROW HERE, and every row must carry a
 * control. That is what makes the controls derived rather than remembered: a
 * pattern added above without a row here is a pattern with no control in any
 * consumer, which is how `PP_TOKEN` went uncontrolled in one spec (see the
 * header). Every consumer asserts the LENGTH of the projection it drives, so a
 * SHRUNK table reds instead of quietly checking less.
 */
export const REFUTED_CLAIM_VOCABULARY: ReadonlyArray<RefutedClaimPattern> = [
  {
    pattern: PP_TOKEN,
    control: 'Worth 12.3pp if resolved',
    what: 'any percentage-point token for the refuted quantity',
    scopes: ['dom'],
  },
  {
    pattern: RESOLVING_CLAIM,
    control: 'Resolving could improve confidence by up to 10pp',
    what: 'the "Resolving could improve confidence by up to Xpp" line',
    scopes: ['dom', 'source'],
  },
  {
    pattern: WORTH_CLAIM,
    control: 'Worth 6.6pp if resolved',
    what: 'the per-factor "Worth Npp if resolved" claim',
    scopes: ['dom', 'source'],
  },
  {
    pattern: IMPROVE_CONFIDENCE_CLAIM,
    control:
      'Worth {evpiPp}pp if resolved: your knowledge of {label} would improve confidence by {evpiPp} percentage points',
    what: 'the "Worth Xpp if resolved" factor chip',
    scopes: ['dom', 'source'],
  },
  {
    pattern: PP_VIA_EVPI,
    control: 'label: `${Math.round(top3Sum)}pp via EVPI`,',
    what: 'the StatusBar chip that SUMMED three refuted figures',
    scopes: ['dom', 'source'],
  },
  {
    pattern: RANKED_BY_EVPI,
    control: "sortNote={hasRobustnessData && evpiMap.size > 0 ? 'ranked by EVPI' : undefined}",
    what: 'the visible factor-list sort label',
    scopes: ['dom', 'source'],
  },
] as const

/** The rows a given consumer may apply. Derived — never hand-listed. */
export function refutedClaimsForScope(
  scope: RefutedClaimScope,
): ReadonlyArray<RefutedClaimPattern> {
  return REFUTED_CLAIM_VOCABULARY.filter((r) => r.scopes.includes(scope))
}

/**
 * The DOM projection, in the `[pattern, control]` shape the two honesty specs
 * already drive. Kept as a named export so those specs' loops are unchanged.
 */
export const REFUTED_CLAIM_CONTROLS: ReadonlyArray<readonly [RegExp, string]> =
  refutedClaimsForScope('dom').map((r) => [r.pattern, r.control] as const)

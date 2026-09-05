export function truncateToSize(text: string, maxSize: number, suffix: string): string {
  if (text.length <= maxSize) return text
  const keep = Math.max(0, maxSize - suffix.length)
  return text.slice(0, keep) + suffix
}

/**
 * Truncate without cutting a word in half, and SAY that it was cut.
 *
 * `truncateToSize` above slices at an exact index, which lands mid-word. That is
 * fine for an id or a log line and wrong for anything a person reads: a headline
 * ending "…changes significantl" reads as a rendering fault, and a reader cannot
 * tell a cut string from a string that simply ended.
 *
 * ⚠ FIVE TRUNCATION HELPERS EXIST IN THIS REPO, THREE OF THEM SHARING THE NAME
 * `truncateAtWord`. Derived at `11f8f594` from
 * `grep -rn 'function truncateAtWord' src/` plus the two in this file:
 * `truncateToSize` (here, exact-index), `truncateAtWordBoundary` (here), and a
 * PRIVATE `truncateAtWord` in `canvas/nodes/DecisionNode.tsx`,
 * `canvas/nodes/OptionNode.tsx` and
 * `components/results/analysisNew/nameOrClaim.ts`. This one is placed beside
 * `truncateToSize` rather than minting a sixth copy at the call site.
 *
 * ⚠⚠ AND THE TWO NODE TWINS HAVE DIVERGED — THIS PARAGRAPH USED TO SAY THEY
 * WERE "DUPLICATED VERBATIM", AND PR #1219 FALSIFIED IT. At the merge-base
 * `5b764fa6` the two bodies differed on exactly ONE line, the suffix (`…` vs
 * `...`). At `11f8f594` they differ on FIVE lines against THREE — a different
 * algorithm, not a different suffix. `DecisionNode`'s now searches the FULL
 * string for the last space at or before the measure and returns a single
 * unbroken token WHOLE; `OptionNode`'s still slices to the measure first and
 * falls back to a mid-word cut under a 0.6 heuristic. Same name, same
 * signature, DIFFERENT OUTPUT for the same input — which is worse than the
 * duplication this paragraph was written to record, and it is why the next
 * session must not read convergence here as a copy-paste job.
 *
 * Reconciling them is rowed as follow-up 1 on PR #1219 rather than done there:
 * #1226 is already open against `OptionNode.tsx`, and the original author's
 * reason still holds — quietly changing what a canvas node displays is not a
 * truncation change's business.
 */
export function truncateAtWordBoundary(text: string, maxLength: number, suffix = '…'): string {
  if (text.length <= maxLength) return text
  const keep = Math.max(0, maxLength - suffix.length)
  const cut = text.slice(0, keep)
  const lastSpace = cut.lastIndexOf(' ')
  // Fall back to the hard cut only when there is no word boundary worth using —
  // otherwise a single very long token would collapse the string to the suffix.
  const body = lastSpace > keep * 0.6 ? cut.slice(0, lastSpace) : cut
  return body.trimEnd() + suffix
}

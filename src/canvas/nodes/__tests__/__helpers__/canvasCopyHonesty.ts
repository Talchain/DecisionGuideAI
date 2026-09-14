/**
 * ⛔ THE CANVAS COPY-HONESTY PREDICATE — ONE DEFINITION, IMPORTED EVERYWHERE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS (7 Sep 2026, review finding B2)
 * ═══════════════════════════════════════════════════════════════════════════
 * `DecisionNode.restingState.spec.tsx` owned this regex and carried a comment
 * promising the readiness words were enumerated "through the SAME
 * `canvasCopyIsHonest` predicate rather than a second copy of the regex living
 * in the new spec (CLAUDE.md trap 12 — one predicate, one place)".
 *
 * The comment was FALSE the moment it was written: `DecisionNode.
 * readinessSummary.spec.tsx` shipped a BYTE-IDENTICAL copy of the regex in the
 * same PR (125 bytes, diffed — identical apart from indentation) and used it to
 * enumerate the same record. Two copies, one promise that there was one.
 *
 * ⚠ A false comment about the estate's DOMINANT defect class is worse than the
 * duplication it mislabels: the next author widening `FORBIDDEN` reads the
 * comment, believes there is one place, edits one, and the other silently stops
 * agreeing. The guard would go on reading green while the two halves drifted.
 *
 * The repair is the one the comment already claimed: extract, import in both.
 * Now the comment is true by CONSTRUCTION rather than by anyone remembering —
 * which is the whole of trap 12. A third spec that needs this predicate imports
 * it; it does not retype it.
 *
 * ⚠ THIS FILE IS DELIBERATELY NOT A `.spec.` FILE. `vitest.config.ts`'s include
 * glob is `src/**\/__tests__/**\/*.{test,spec}.?(c|m)[jt]s?(x)`, so a helper
 * named like a spec would be COLLECTED as one and fail the run with "no test
 * suite found". It sits beside the existing `__helpers__` convention
 * (`src/canvas/__tests__/__helpers__/renderCanvas.tsx`).
 */

/**
 * Left half: any word that would make a canvas node describe THE ANALYSIS —
 * a verdict, a leader, a probability, a robustness claim. Right half: the
 * node-type vocabulary another lane owns (`decision`, `question`), word-bounded
 * so "decisions" is caught but a longer word containing it is not.
 *
 * ⛔ EXTENDED, NEVER WEAKENED. Adding an alternative here is a tightening and is
 * always safe. REMOVING one retires a constraint two specs depend on — do that
 * only with the reason written down, because both callers go quiet together.
 */
export const FORBIDDEN =
  /lead|winner|win |robust|stabil|scenario|too close|tie|result|analysis|confiden|likel|probab|\bdecisions?\b|\bquestions?\b/i

/**
 * True when `text` makes no claim about the analysis and names no node type.
 *
 * ⚠ Callers must pass ONE RENDERED LINE, not a whole `textContent`.
 * `Element.textContent` concatenates descendants with NO separator, which once
 * glued a banned word to the next element's first letter and destroyed the
 * `\b` word boundary — the rendered corpus passed while the copy was dishonest.
 * `DecisionNode.restingState.spec.tsx`'s `visibleText` helper does that split,
 * and pins it with its own extraction control.
 */
export const canvasCopyIsHonest = (text: string): boolean => !FORBIDDEN.test(text)

/**
 * flipThresholdStatusNote — the "What could change the result" explanatory
 * line, as ONE pure function of the producer status and the shared verdict.
 *
 * ## Why it moved out of ResultsBody
 *
 * The three strings lived inline in `ResultsBody.tsx` (three JSX literals in
 * two sibling blocks), gated only on `flipThresholdsStatus`. All three said
 * "the leading option" — so on a withheld run, where CEE has declined to put
 * an option forward, the panel still asserted that a leading option exists,
 * in a section whose entire job is honesty about what the analysis could not
 * establish (ROADMAP 1.267).
 *
 * Inline JSX literals cannot be unit-tested without mounting the whole
 * results panel, which is exactly why this leak survived #501. As a pure
 * function the copy is directly addressable by the withheld/permitted fixture
 * pair, and ResultsBody keeps a single call site instead of three literals
 * that a future edit could update unevenly.
 *
 * ## What changes on a withheld run, and what does not
 *
 * The FACT is preserved in full: which factors moved the result, which did
 * not, and which could not be resolved. Only the framing changes — "changed
 * the leading option" presupposes a leading option; "changed the comparison"
 * does not. The tornado chart, its rows and every number beneath this line
 * are untouched: the data is not withheld, only the claim.
 */

/** PLoT's post-denormalisation classification of `flip_thresholds[]`. */
export type FlipThresholdsStatus =
  | 'all_no_effect'
  | 'partial_no_effect'
  | string

export interface FlipThresholdStatusNoteInput {
  status: FlipThresholdsStatus | null | undefined
  /** True when `flip_thresholds[]` also carries entries PLoT could not resolve. */
  hasUnresolved: boolean
  /**
   * `!DecisionVerdict.hasLeadingOption` — the single shared answer to "is
   * there a leading option?" (`src/lib/decisionVerdict.ts`). This function
   * never re-derives one; it quotes the caller's.
   */
  designationsWithheld: boolean
}

/**
 * The line to render, or `null` when the producer status warrants none.
 *
 * Returning `null` (rather than an empty string) keeps the caller's existing
 * "render nothing" branch shape: a status outside the two classified ones has
 * no honest line to show and must not produce an empty paragraph element.
 */
export function flipThresholdStatusNote({
  status,
  hasUnresolved,
  designationsWithheld,
}: FlipThresholdStatusNoteInput): string | null {
  // The object of the sentence. Both branches name the same fact; only the
  // withheld one avoids presupposing a leader. Resolved ONCE so the three
  // sentences below cannot drift apart the way three JSX literals did.
  const object = designationsWithheld ? 'the comparison' : 'the leading option'

  if (status === 'all_no_effect') {
    return `No single tested factor changed ${object} within the current range.`
  }

  if (status === 'partial_no_effect') {
    return hasUnresolved
      ? `Some factors did not change ${object} within the current range, and others could not be resolved.`
      : `Some factors did not change ${object} within the current range.`
  }

  return null
}

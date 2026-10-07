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

import { KNOWN_PROBE_FAILURE_REASONS } from './flipReasonVocabulary'

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
  /** Producer token used only to select ruled copy; never displayed verbatim. */
  reason?: string | null
}

const REASON_CLAUSES: Record<(typeof KNOWN_PROBE_FAILURE_REASONS)[number], string> = {
  timeout: ' (at least one check ran out of time)',
  insufficient_precision: ' (at least one result was not precise enough to place)',
  non_monotonic_grid: ' (at least one result was not precise enough to place)',
  candidate_cap_exceeded: ' (not every factor was checked)',
  error: '', heuristic: '', zero_elasticity_fallback: '', single_option: '',
  found_without_value: '', value_without_direction: '', unattested: '',
  non_finite_denormalisation: '',
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
  reason,
}: FlipThresholdStatusNoteInput): string | null {
  void designationsWithheld

  if (status === 'all_no_effect') {
    return 'No turning point in this run: within its current range, no single factor Olumi checked changes which option has the highest average result in this model.'
  }

  if (status === 'partial_no_effect') {
    const base = 'Some factors Olumi checked do not change which option has the highest average result within their current range, in this model.'
    return hasUnresolved || reason ? `${base} Others could not be checked.` : base
  }

  if (status === 'computed' && reason) {
    return 'Some factors could not be checked, so this model may have other turning points.'
  }

  if (status === 'unresolved') {
    if (reason === 'single_option') {
      return 'Turning points not shown for this run: there is only one option, so there is nothing to compare.'
    }
    const clause = typeof reason === 'string' && (KNOWN_PROBE_FAILURE_REASONS as readonly string[]).includes(reason)
      ? REASON_CLAUSES[reason as (typeof KNOWN_PROBE_FAILURE_REASONS)[number]]
      : ''
    return `Turning points not shown for this run: Olumi could not finish checking the factors${clause}.`
  }

  return null
}

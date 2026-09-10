/**
 * `resolveEffectiveDraftCoaching` — WHICH ABSENCE OF COACHING IS THIS?
 *
 * The same two-absences-under-one-name problem `resolveEffectiveAdmission`
 * (`canvas/hooks/useAnalysisReady.ts`) exists to separate, reached through a
 * different field, and this is deliberately the SAME mechanism rather than a
 * second one.
 *
 * `draftCoaching` is a member of `READINESS_CLEAR_FIELDS`, so:
 *
 *   CEE never coached (no draft yet, or a draft with no coaching)
 *       -> absence is the producer's own silence                    (unchanged)
 *   CEE coached and an analytical edit nulled it
 *       -> the last thing it said still stands                      (the fix)
 *
 * The second absence is OUR doing, and it produces the inverse of a stale claim:
 * the user reads "you have framed this narrowly", acts on it by editing the
 * model, and the act itself deletes the sentence that asked for it. Nothing
 * returns it until the next server turn.
 *
 * ⚠⚠ IT MAY ONLY EVER RE-WORD, NEVER SUMMON — AND THAT IS STRUCTURAL, NOT A RULE
 * SOMEONE MUST REMEMBER. Two independent reasons, and both must hold for a
 * consumer to be wired to this resolver:
 *
 *   1. The retained value is a value THE PRODUCER SENT. It can assert nothing CEE
 *      did not assert, exactly as with the retained admission.
 *   2. Its wired consumer is LIVE-GATED. `narrowFramingDetail` feeds
 *      `sig_option_breadth`'s `ceeOverride` (`pre-analysis-v3/signals/registry.ts`)
 *      and that signal's firing condition is re-derived from the live graph
 *      (`input.optionCount >= 3` returns null). So retained text can only change
 *      the WORDING of a row the live graph has already decided to show — widen the
 *      options and the row goes, whatever is retained.
 *
 * ⚠ THE TWO REASONS ARE NOT EQUAL, AND THE NEXT LANE WILL INHERIT THE ANALOGY
 * RATHER THAN THE MEASUREMENT (review note). `retainedAnalysisAdmission` is safe
 * because a retained RESTRICTION is monotone: it can only ever withhold. Retained
 * PROSE asserts. So reason 1 carries almost no weight here and reason 2 carries
 * all of it. Do not reason from "the admission does it, so this is fine"; the
 * live gate is the whole of the argument, and a consumer without one is a
 * different question with a different answer.
 *
 * ⚠ A CONSUMER THAT IS NOT LIVE-GATED MUST NOT BE WIRED TO THIS. The hero coaching
 * slot (`usePreAnalysisModel`'s `coaching`, rendered by `hero/CoachingSlot.tsx`)
 * renders whenever text exists, beside bars and a ladder that DO update live. A
 * retained summary there could assert, unmarked, a framing problem the user's edit
 * has just fixed — a freshness lie in the inverse direction. Retaining it needs a
 * visible pre-edit mark on the slot first. It is intentionally still reading the
 * live field only.
 *
 * ⚠ AND THE DIRECTION OF THE FALLBACK IS THE WHOLE GUARANTEE. `live ?? retained`
 * is downgrade-only: a fresh payload — in either direction, including one that
 * coaches about something else entirely — replaces the retained copy immediately.
 * `retained ?? live` would pin the panel to the FIRST thing CEE ever said and let
 * stale prose outrank a current turn. That inversion is a separate mutant in
 * `__tests__/effectiveDraftCoaching.spec.ts`, and it must fail on its own
 * signature.
 *
 * ⚠⚠ THE LIVE GATE BOUNDS ONE DIRECTION ONLY, AND THE OTHER DIRECTION IS A
 * SEPARATE PARAMETER (review ground, 2026-09-10). `input.optionCount >= 3`
 * removes the row when the user WIDENS. It does nothing when the user NARROWS,
 * and the retained sentence describes exactly the quantity the row re-derives:
 * coached at two options, delete one, and the row still fires while the frozen
 * prose asserts a two-option frame over a one-option graph — and, because
 * `ceeOverride` REPLACES `copy.lead`/`copy.emphasis` rather than annotating them
 * (`SignalRow.tsx`), it also suppresses `optionBreadthOne`, which is the accurate
 * line. One `>= 3` threshold cannot guard both harms (dropping guidance and
 * keeping stale guidance), so the retained value now carries the option count it
 * was authored against and answers ONLY while that count still holds.
 *
 * ⚠ EXACT MATCH, NOT A RANGE, AND NOT ONLY THE NARROWING CASE. A count that has
 * moved in either direction is a graph the prose was not written about; refusing
 * both is the fail-closed reading and needs no second threshold to keep in sync.
 * An unknown count (`null`) is refused for the same reason: it is the absence of
 * evidence that the prose still applies, not evidence that it does.
 */
import type { CEEDraftCoaching } from '../../adapters/cee/types'

export function resolveEffectiveDraftCoaching(
  liveCoaching: CEEDraftCoaching | undefined | null,
  retained: CEEDraftCoaching | undefined | null,
  retainedOptionCount: number | null | undefined,
  liveOptionCount: number | null | undefined,
): CEEDraftCoaching | null {
  // A live payload is never gated: it was authored about the graph as it is.
  if (liveCoaching) return liveCoaching
  if (!retained) return null
  if (typeof retainedOptionCount !== 'number' || typeof liveOptionCount !== 'number') return null
  if (retainedOptionCount !== liveOptionCount) return null
  return retained
}

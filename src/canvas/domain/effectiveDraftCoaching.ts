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
 */
import type { CEEDraftCoaching } from '../../adapters/cee/types'

export function resolveEffectiveDraftCoaching(
  liveCoaching: CEEDraftCoaching | undefined | null,
  retained: CEEDraftCoaching | undefined | null,
): CEEDraftCoaching | null {
  return liveCoaching ?? retained ?? null
}

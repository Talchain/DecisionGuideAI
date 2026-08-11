/**
 * certaintyCopy — single source of truth for the "how confident is the
 * recommendation" headline + caveat displayed on the post-analysis panel.
 *
 * Brief 5.1 Task 4. Consumes post-analysis tier fields that are already
 * threaded into the UI today — no new numeric thresholds, no local
 * derivation. Footer stability labels continue to flow through
 * src/lib/stability.ts; this file deliberately does not duplicate that
 * mapping.
 *
 * Decision table (top-down, first match wins):
 *
 *   1. verdict.separation === 'tied'   (SINGLE VERDICT, 2026-07-25)
 *      → "no clear leading option, the result is sensitive to your estimates"
 *      (sub: "{winner} leads slightly more often", caveat: null)
 *      The tie call belongs to `deriveDecisionVerdict`, which reads PLoT's
 *      own `robustness.near_tie`. This rule used to fire on
 *      `recommendationStability < 0.70`, denying a 52-point lead because it
 *      was fragile — see the block comment at the rule itself.
 *
 *   2. analysisStatus === 'partial'
 *      → "Some analysis steps did not complete"
 *      (sub: "Results are partial", caveat: null)
 *
 *   3. optionCount === 1
 *      → "{winner} is your only option"
 *
 *   4. (confidenceTier === 'needs_work' OR confidenceTier === 'fair')
 *      AND recommendationStability < 0.85 (or absent)
 *      → "{winner} currently leads[ by N points]"
 *      + caveat (needs_work only): "Result depends on factors with
 *                 limited evidence."
 *      Brief 5.5 §2.7 lock: soft phrasing gates on tier + stability
 *      only. coachingReadiness is NOT a softening trigger (a strong
 *      tier with weak readiness must never soften). The evidence
 *      caveat remains scoped to needs_work — fair is not an
 *      evidence-weak signal, so fair + low stability softens the
 *      headline but does not attach the evidence caveat.
 *
 *   5. coachingReadiness === 'close_call' (and no earlier rule fired)
 *      → "{winner} is the leading option"   (conservative: true)
 *      close_call is orthogonal to the tier × stability gate; it
 *      neither softens nor strengthens the headline. Preserves the
 *      Brief 5.2 coaching-override block.
 *
 *   6. confidenceTier === 'strong' AND coachingReadiness === 'ready'
 *      → "{winner} is the leading option"   (conservative: false)
 *
 *   7. fallback (strong without ready, fair + high stab, needs_work +
 *      high stab, unknown tier, absent readiness)
 *      → "{winner} came out ahead most often across simulated scenarios"
 *
 *   ⭐ THE "[ by N points]" SUFFIX IS RETIRED (2026-08-10). Brief 5.2 Task 1
 *   appended it whenever the caller supplied a positive finite win-probability
 *   gap, to preserve the numeric lead without PLoT's over-confident "clear
 *   leader / X-point advantage" framing. The number it preserved was the
 *   percentage-point gap between two win frequencies, which no user-facing
 *   surface may state. The input that carried it is GONE from this module's
 *   type as of 2026-08-11 — there is no longer a gap to render. The DEFENCE
 *   against that PLoT framing is unchanged and lives where it always did — the
 *   `conservative` flag, which keeps `coachingHeadline` from winning the
 *   precedence chain.
 *
 * British English. No em dashes in UI strings (use a period to separate
 * clauses instead). See DESIGN_SYSTEM.md and Brief 5.1 §Operating
 * principles.
 */

import type { M1CoachingReadiness } from '../../../types/cee'
import type { DecisionVerdict } from '../../../lib/decisionVerdict'
import type { ConfidenceTier } from '../types'
import { COMPARATIVE_COPY } from './goalAnchorCopy'

export interface CertaintyCopyInput {
  winnerLabel: string
  confidenceTier?: ConfidenceTier
  coachingReadiness?: M1CoachingReadiness
  recommendationStability?: number
  analysisStatus?: 'computed' | 'partial' | 'failed' | 'blocked'
  optionCount?: number
  /**
   * SINGLE VERDICT: the shared answer to "is there a leading option?"
   * (`src/lib/decisionVerdict.ts`), derived from the same PLoT report the
   * canvas reads. This is the ONLY input entitled to make Rule 1 deny a
   * leading option — and the only one entitled to let Rules 4-7 assert one.
   *
   * REQUIRED (ROADMAP 1.267). It used to be optional, and the withheld branch
   * below guarded on `verdict != null`: so a caller passing `undefined` did
   * not get silence, it got the four leader-asserting rules underneath. The
   * live callers always passed a verdict, which is exactly what made the hole
   * invisible — it was reachable only from fixtures and future call sites,
   * i.e. from the code nobody had written yet.
   *
   * A caller that genuinely has no verdict passes `NO_CLAIM_VERDICT`
   * (exported from `src/lib/decisionVerdict.ts`) and gets the withheld
   * headline. Fail-closed is the ratified direction: a report indistinguishable
   * from a withheld one must be treated as withheld (decisionVerdict.ts).
   */
  verdict: DecisionVerdict
}

export interface CertaintyCopy {
  /** Main headline string — safe to render as a sentence. */
  headline: string
  /** Secondary one-line sub-head where a row emits one; otherwise null. */
  sub: string | null
  /** Dismissible honesty caveat rendered when evidence is weak; otherwise null. */
  caveat: string | null
  /**
   * Brief 5.2 follow-up: true whenever this copy is a conservative lede.
   * DecisionConfidencePanel must NOT let PLoT coaching copy override a
   * conservative headline (the "clear leader / N-point advantage" string
   * would contradict the softened lede even without a caveat attaching).
   * Brief 5.4 QA: Rules 1–5 and the fallback (Rule 7) are conservative.
   * Only Rule 6 (strong + ready) sets this to false, opting in to coaching
   * overrides. fair + close_call (Rule 5) use definitive headline copy but
   * remain conservative to preserve the Brief 5.2 coaching suppression invariant.
   */
  conservative: boolean
}

/**
 * Brief 5.4 QA Item 3: stability gate for the caveat (needs_work branch only).
 * When stability is at or above this threshold the result is numerically robust
 * despite limited evidence quality — the caveat is suppressed and the copy falls
 * through to the fallback "currently leads" path without the evidence warning.
 *
 * Exported so winnerChipCopy.ts can import it directly rather than duplicating
 * the value. Any future threshold change must be made here only.
 */
export const STABILITY_STRONG_THRESHOLD = 0.85

/**
 * Brief 5.5 §2.7 locked softening gate: tier × stability, no readiness input.
 * Exported so winnerChipCopy.ts can import and reuse the identical predicate
 * rather than duplicating the conditions.
 */
export function shouldSoftenPhrasing(
  tier: ConfidenceTier | undefined,
  stability: number | undefined,
): boolean {
  const tierSoftens = tier === 'needs_work' || tier === 'fair'
  const stabilityIsWeak = stability == null || stability < STABILITY_STRONG_THRESHOLD
  return tierSoftens && stabilityIsWeak
}

export function buildCertaintyCopy(input: CertaintyCopyInput): CertaintyCopy {
  const {
    winnerLabel,
    confidenceTier,
    coachingReadiness,
    recommendationStability,
    analysisStatus,
    optionCount,
    verdict,
  } = input

  // ⭐⭐ THE " by N point(s)" SUFFIX IS RETIRED (2026-08-10). Brief 5.2 Task 1
  // introduced it to "preserve the numeric lead" in the softened lede; the
  // number it preserved was the percentage-point gap between two Monte-Carlo
  // win frequencies (`DecisionConfidencePanel` computes it as
  // `(winner.winProbability - runnerUp.winProbability) * 100`). That is the
  // banned statistic: less reliable than either estimate it is built from, yet
  // rendered as a bare integer with no interval.
  //
  // DELETED rather than replaced with the winner's own probability.
  //
  // ⚠ CORRECTED 2026-08-10 (review F2). The first version of this note gave
  // TWO grounds, and the first one was FALSE: it claimed "the panel already
  // shows the winner's own probability where this lede renders". It does not.
  // `DecisionConfidencePanel`'s `ringClaim` PREFERS `goalProbability` and
  // captions the arc with the GOAL register, falling back to `winProbability`
  // only when no goal figure exists — so on any run where a target was set,
  // the winner's own WIN probability is nowhere on that panel. A false
  // rationale left in a comment is how the next lane inherits a wrong premise,
  // so it is corrected here rather than quietly dropped.
  //
  // THE DELETION STANDS ON THE REMAINING GROUND, WHICH IS SUFFICIENT:
  // `aheadHeadline`'s F4 note below already adjudicated this exact question
  // and concluded that a magnitude-free comparative sentence is the CORRECT
  // behaviour on this surface, because Paul's ruling DEMOTES the comparative
  // number here. Threading a magnitude in "would have added a live claim the
  // ruling does not want" — its words. Replacing the gap with the winner's own
  // probability would contradict a ruling recorded in this very file.
  //
  // The SOFTENING survives untouched — the "currently" hedge, the evidence
  // caveat and the `conservative` flag are the lede's actual job. Only the
  // quantity goes.
  //
  // ⭐ AND THE FOLLOW-UP LANDED (2026-08-11). `winProbabilityGap` is no longer
  // on this input type, and `DecisionConfidencePanel` no longer computes it —
  // so the retirement is now STRUCTURAL rather than a copy decision a later
  // branch could quietly undo. `DecisionVerdict.gapPp` is deliberately still
  // there: it is typed contract surface with its own rowed disposition.

  /**
   * The re-anchored leader sentence — the comparative quantity, named, with
   * NO magnitude. Replaces `"{winner} is the leading option"` at all three
   * sites (an endorsement noun with no basis and no number).
   *
   * ⚠ F4 — WHY THERE IS NO MAGNITUDE-BEARING ARM HERE, adjudicated.
   * The first draft added `winProbability` to this input and branched on it.
   * That arm was DEAD: the sole caller (`DecisionConfidencePanel`) passed
   * only the win-probability GAP, never the absolute probability, so the branch
   * could not execute on any live path — and it carried the mid-sentence
   * casing defect (§10.2) precisely because nothing exercised it. Its spec
   * even advertised coverage that did not exist. (The gap input itself was
   * deleted on 2026-08-11; no comparative magnitude reaches this module now.)
   *
   * Deleted rather than wired: Paul's ruling DEMOTES the comparative number
   * below the goal number, so a magnitude-free comparative sentence on this
   * surface is the CORRECT behaviour, not a gap. Threading the probability
   * here would have added a live claim the ruling does not want. Where the
   * magnitude IS wanted (`OptionCards`, the hero headline) the register's
   * `phrase`/`clause` forms supply it.
   */
  const aheadHeadline = `${winnerLabel} ${COMPARATIVE_COPY.phraseNoMagnitude}`

  if (analysisStatus === 'partial') {
    return {
      headline: 'Some analysis steps did not complete',
      sub: 'Results are partial',
      caveat: null,
      conservative: true,
    }
  }

  // SINGLE VERDICT (2026-07-25) — Rule 1 rewritten.
  //
  // It used to read `recommendationStability < 0.70` → "no clear leading
  // option ... {winner} leads slightly more often". That is a CATEGORY ERROR
  // and it produced the worst defect the end-to-end journey lane found: on a
  // run where the winner held 72% against 20%, this printed "no clear leading
  // option" and "leads slightly more often" about a **52-point lead**, while
  // the canvas four inches away badged the same option "Leading option".
  //
  // Low stability means the ranking is FRAGILE, not that the options are
  // TIED. Those are two different facts and the product must not trade one
  // for the other. Whether a leading option exists is now answered in exactly
  // one place — `deriveDecisionVerdict`, from PLoT's own `robustness.near_tie`
  // — and every surface quotes it. Fragility keeps its own separate voice
  // (the stability label, the footer, and the uncertainty calibration line
  // this panel already renders beneath the headline).
  //
  // 'unknown' separation licenses SILENCE, never a denial: with fewer than
  // two comparable options there is nothing to be close about.
  if (verdict.separation === 'tied') {
    return {
      headline: 'no clear leading option, the result is sensitive to your estimates',
      // ROADMAP 1.223: this used to carry `${winnerLabel} leads slightly more
      // often` — a leader claim printed directly beneath a denial of one, and
      // the exact contradictory pair this module's own header cites as the
      // original defect. `buildV7Headline` dropped its copy of this sentence;
      // dropping it here too is what makes that fix consistent rather than
      // partial. A denial does not get a leader for a companion.
      sub: null,
      caveat: null,
      conservative: true,
    }
  }

  // ORDER IS LOAD-BEARING: the single-option branch MUST come before the
  // 'unknown' branch below.
  //
  // `deriveDecisionVerdict` returns the `unknown` verdict for TWO different
  // reasons (decisionVerdict.ts): the producer withheld the leader claim, AND
  // "fewer than two comparable options" — which every healthy single-option
  // run satisfies by construction. They need different copy, and the first cut
  // of ROADMAP 1.223 conflated them: with the 'unknown' branch placed above
  // this one, a perfectly good one-option run rendered "the analysis did not
  // put an option forward", which is simply untrue there — nothing was
  // withheld, there was only ever one option to put forward.
  //
  // Ordering, rather than `&& optionCount > 1` on the branch below, is
  // deliberate: `optionCount` is OPTIONAL on this input, so a caller that
  // omits it would make that guard false and drop a genuinely withheld turn
  // through to the leader-asserting rules at the bottom of this function —
  // the original defect, silently restored. Ordering has no such failure mode.
  if (optionCount === 1) {
    return {
      headline: `${winnerLabel} is your only option`,
      sub: null,
      caveat: null,
      conservative: true,
    }
  }

  // ROADMAP 1.223 — the 'unknown' case, which the comment above always said
  // licenses silence but which no branch actually handled: every rule below
  // asserts a leading option ("is the leading option", "currently leads",
  // "leads by N points"), and 'unknown' fell straight through to them.
  //
  // Reached only for a MULTI-option run (the branch above claimed the
  // single-option case), so 'unknown' here means the producer WITHHELD the
  // leader claim (CEE #711 drops `headline_banded` and nulls
  // `leading_option_id` on a withheld constraint verdict) or sent none at all.
  // Either way the panel has no authority to name a leader — and equally none
  // to deny one, so this is not routed into the tied copy above. The
  // uncertainty, stability and driver surfaces beneath it are untouched and
  // keep their own voices.
  // ROADMAP 1.267: the `verdict != null` guard is GONE with the optional
  // parameter. It was not defensive — it was the fall-through: `undefined`
  // made this condition false and delivered the caller to "{winner} is the
  // leading option" four rules below.
  if (!verdict.hasLeadingOption && verdict.separation === 'unknown') {
    return {
      headline: 'the analysis did not put an option forward',
      sub: null,
      caveat: null,
      conservative: true,
    }
  }

  // Brief 5.5 §2.7 lock: soft phrasing gates on (tier ∈ {needs_work, fair})
  // AND stability < 0.85. coachingReadiness does NOT soften. Evidence caveat
  // remains narrower — needs_work only, since fair is not an evidence-weak
  // signal.
  if (shouldSoftenPhrasing(confidenceTier, recommendationStability)) {
    return {
      headline: `${winnerLabel} currently leads`,
      sub: null,
      caveat:
        confidenceTier === 'needs_work'
          // Brief 5.8B D2b unified the queue and removed the legacy
          // evidence-gaps sub-header. Caveat copy updated to drop the
          // dead cross-reference; meaning preserved.
          ? 'Result depends on factors with limited evidence.'
          : null,
      conservative: true,
    }
  }

  // close_call is orthogonal to the tier × stability gate — definitive
  // headline, but conservative (coaching overrides still blocked).
  if (coachingReadiness === 'close_call') {
    return {
      headline: aheadHeadline,
      sub: null,
      caveat: null,
      conservative: true,
    }
  }

  if (confidenceTier === 'strong' && coachingReadiness === 'ready') {
    return {
      headline: aheadHeadline,
      sub: null,
      caveat: null,
      conservative: false,
    }
  }

  // ⭐ Was `gapSuffix ? \`${winnerLabel} leads${gapSuffix}\` : aheadHeadline`.
  // BOTH gap-bearing sites are changed together — leaving this one would keep
  // the banned quantity on the confident branch while the softened branch was
  // clean, i.e. the same partial fix the OptionCards two-arm case avoided.
  // `aheadHeadline` was always this rule's no-gap form, so the retirement
  // returns it to the module's own documented-correct sentence.
  return {
    headline: aheadHeadline,
    sub: null,
    caveat: null,
    conservative: true,
  }
}

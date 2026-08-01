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
 *      → "{winner} leads[ by N points]"    (confident)
 *
 *   The "[ by N points]" suffix is appended when the caller supplies a
 *   positive finite winProbabilityGap (percentage-point lead vs. the next
 *   option). Brief 5.2 Task 1: preserves the numeric lead without the
 *   over-confident "clear leader / X-point advantage" framing that PLoT can
 *   produce for needs_work bundles with high numeric stability.
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
   * Brief 5.2 Task 1: win-probability gap (percentage points) between the
   * winner and the next option. When provided and > 0, Rules 4 and 5 append
   * " by N points" to the softened lede so the numeric lead is preserved
   * without over-confident language.
   */
  winProbabilityGap?: number
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
    winProbabilityGap,
    verdict,
  } = input

  // Brief 5.2 Task 1: "by N points" suffix preserves the numeric lead in the
  // softened lede. Rounded to the nearest whole point; only appended when the
  // gap is a positive finite number so callers can pass null/NaN safely.
  const gapSuffix =
    typeof winProbabilityGap === 'number'
    && Number.isFinite(winProbabilityGap)
    && winProbabilityGap > 0
      ? ` by ${Math.round(winProbabilityGap)} point${Math.round(winProbabilityGap) === 1 ? '' : 's'}`
      : ''

  /**
   * The re-anchored leader sentence — the comparative quantity, named, with
   * NO magnitude. Replaces `"{winner} is the leading option"` at all three
   * sites (an endorsement noun with no basis and no number).
   *
   * ⚠ F4 — WHY THERE IS NO MAGNITUDE-BEARING ARM HERE, adjudicated.
   * The first draft added `winProbability` to this input and branched on it.
   * That arm was DEAD: the sole caller (`DecisionConfidencePanel`) passes
   * only `winProbabilityGap`, never the absolute probability, so the branch
   * could not execute on any live path — and it carried the mid-sentence
   * casing defect (§10.2) precisely because nothing exercised it. Its spec
   * even advertised coverage that did not exist.
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
      headline: `${winnerLabel} currently leads${gapSuffix}`,
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

  // When a gap is available, "leads by N points" gives the numeric lead.
  // When no gap, fall back to the definitive form to avoid the bare "leads".
  return {
    headline: gapSuffix ? `${winnerLabel} leads${gapSuffix}` : aheadHeadline,
    sub: null,
    caveat: null,
    conservative: true,
  }
}

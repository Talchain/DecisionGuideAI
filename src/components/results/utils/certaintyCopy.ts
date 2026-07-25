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
   * leading option. Absent (older fixtures / callers) ⇒ no denial is made.
   */
  verdict?: DecisionVerdict
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
  if (verdict?.separation === 'tied') {
    return {
      headline: 'no clear leading option, the result is sensitive to your estimates',
      sub: `${winnerLabel} leads slightly more often`,
      caveat: null,
      conservative: true,
    }
  }

  if (optionCount === 1) {
    return {
      headline: `${winnerLabel} is your only option`,
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
      headline: `${winnerLabel} is the leading option`,
      sub: null,
      caveat: null,
      conservative: true,
    }
  }

  if (confidenceTier === 'strong' && coachingReadiness === 'ready') {
    return {
      headline: `${winnerLabel} is the leading option`,
      sub: null,
      caveat: null,
      conservative: false,
    }
  }

  // When a gap is available, "leads by N points" gives the numeric lead.
  // When no gap, fall back to the definitive form to avoid the bare "leads".
  return {
    headline: gapSuffix ? `${winnerLabel} leads${gapSuffix}` : `${winnerLabel} is the leading option`,
    sub: null,
    caveat: null,
    conservative: true,
  }
}

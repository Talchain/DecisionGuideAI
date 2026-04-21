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
 *   1. recommendationStability < 0.70
 *      → "no clear leading option, the result is sensitive to your estimates"
 *      (sub: "{winner} leads slightly more often", caveat: null)
 *
 *   2. analysisStatus === 'partial'
 *      → "Some analysis steps did not complete"
 *      (sub: "Results are partial", caveat: null)
 *
 *   3. optionCount === 1
 *      → "{winner} is your only option"
 *
 *   4. (confidenceTier === 'needs_work' OR coachingReadiness in the
 *      known-weak enum: needs_evidence, needs_framing, low, not_ready)
 *      AND recommendationStability < 0.85 (or absent)
 *      → "{winner} currently leads[ by N points]"
 *      + caveat: "Result depends on factors with limited evidence.
 *                 See Highest-value evidence gaps."
 *      Brief 5.4 QA: the stability gate (0.85) means a needs_work result
 *      with high numeric stability no longer attaches a caveat — it falls
 *      through to the fallback "currently leads" path without the warning.
 *
 *   5. confidenceTier === 'fair' OR coachingReadiness === 'close_call'
 *      → "{winner} is the leading option"   (conservative: true)
 *      Brief 5.4 QA: fair tier now uses definitive copy; it is not an
 *      evidence-weak signal and hedging it over-softens confident outcomes.
 *      conservative: true — coaching overrides are still blocked; the
 *      certaintyCopy headline is authoritative (Brief 5.2 invariant).
 *
 *   6. confidenceTier === 'strong' AND coachingReadiness === 'ready'
 *      → "{winner} is the leading option"   (conservative: false)
 *
 *   7. fallback (needs_work + high stability, unknown tier, absent readiness)
 *      → "{winner} currently leads[ by N points]"
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

const WEAK_READINESS: readonly M1CoachingReadiness[] = [
  'needs_evidence',
  'needs_framing',
  'low',
  'not_ready',
]

function isWeakReadiness(value: M1CoachingReadiness | undefined): boolean {
  if (value == null) return false
  return (WEAK_READINESS as readonly M1CoachingReadiness[]).includes(value)
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

  if (recommendationStability != null && recommendationStability < 0.70) {
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

  // Brief 5.4 QA Item 3: caveat fires only when evidence quality is weak AND
  // the numeric result is also unstable (< 0.85). When stability is high the
  // result is trustworthy despite limited evidence — no caveat is needed.
  const evidenceIsWeak =
    confidenceTier === 'needs_work' || isWeakReadiness(coachingReadiness)
  const stabilityIsWeak =
    recommendationStability == null || recommendationStability < STABILITY_STRONG_THRESHOLD

  if (evidenceIsWeak && stabilityIsWeak) {
    return {
      headline: `${winnerLabel} currently leads${gapSuffix}`,
      sub: null,
      caveat:
        'Result depends on factors with limited evidence. See Highest-value evidence gaps.',
      conservative: true,
    }
  }

  // Brief 5.4 QA Item 3: fair tier (and close_call readiness) show the
  // definitive "is the leading option" copy — they are not evidence-weak
  // signals and hedging them over-softens confident outcomes.
  // conservative: true — fair/close_call are NOT trusted enough to allow
  // coaching overrides; the certaintyCopy headline is authoritative here.
  // Brief 5.2 established this invariant: coaching overrides require strong+ready.
  if (confidenceTier === 'fair' || coachingReadiness === 'close_call') {
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

  return {
    headline: `${winnerLabel} currently leads${gapSuffix}`,
    sub: null,
    caveat: null,
    conservative: true,
  }
}

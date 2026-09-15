/**
 * D.2 / D.3: Coaching text for edge inspector sliders and influence context.
 * Pure functions — no React imports.
 *
 * ⭐⭐ THESE LABEL THE VALUE YOU ARE SETTING. THEY DO NOT DESCRIBE THE MODEL.
 *
 * Founder's rule, 15 Sep 2026: the UI renders the data; it does not decide what
 * the data means. The band NAMES survive — "Strong effect" is a scale label for
 * the number under your own hand, and that is legitimate calibration.
 *
 * ⛔ WHAT WAS CUT, AND WHY, because it was the same defect in nine places:
 *   · claims about the WORLD  — "few real-world factors have this much influence"
 *   · claims about the ENGINE — "analysis will rely heavily on this link"
 *   · judgements              — "a reasonable starting point"
 * None was producer-backed. Each was authored by a threshold this file chose,
 * and each read to the user as a finding rather than a ruler marking.
 *
 * ⚠ Advice about YOUR OWN ACTION stays ("consider lowering slightly") — that is
 * about the gesture, not a claim about the model.
 */

export interface CoachingNudge {
  text: string
  /** Tailwind text colour class */
  colorClass: string
}

/**
 * Confidence coaching nudge based on belief value (0–1).
 */
export function getConfidenceCoaching(belief: number): CoachingNudge {
  if (belief <= 0.15) {
    return {
      text: 'Very low.',
      colorClass: 'text-danger',
    }
  }
  if (belief <= 0.39) {
    return {
      text: 'Low confidence.',
      colorClass: 'text-warning',
    }
  }
  if (belief <= 0.69) {
    return {
      text: 'Moderate confidence.',
      colorClass: 'text-text-light',
    }
  }
  if (belief <= 0.89) {
    return {
      text: 'High confidence.',
      colorClass: 'text-text-light',
    }
  }
  return {
    text: "Very high — if you're not fully sure, consider lowering slightly.",
    colorClass: 'text-warning',
  }
}

/**
 * Effect size coaching nudge based on absolute signed value (0–1).
 */
export function getEffectSizeCoaching(absValue: number): CoachingNudge {
  if (absValue <= 0.1) {
    return {
      text: 'Negligible effect.',
      colorClass: 'text-text-light',
    }
  }
  if (absValue <= 0.4) {
    return {
      text: 'Moderate effect.',
      colorClass: 'text-text-light',
    }
  }
  if (absValue <= 0.7) {
    return {
      text: 'Strong effect.',
      colorClass: 'text-text-light',
    }
  }
  if (absValue <= 0.9) {
    return {
      text: 'Very strong.',
      colorClass: 'text-warning',
    }
  }
  return {
    text: 'Near-total effect.',
    colorClass: 'text-warning',
  }
}

/**
 * D.3: Whether to show the influence coaching card on an edge.
 * All three conditions must be met: rank #1, fragile, confidence < 70%.
 */
export function shouldShowInfluenceCoaching(
  sensitivityRank: number | null,
  isFragile: boolean,
  confidence: number | null,
): boolean {
  return sensitivityRank === 1 && isFragile && confidence !== null && confidence < 0.7
}

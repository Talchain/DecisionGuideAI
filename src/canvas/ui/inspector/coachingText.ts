/**
 * D.2 / D.3: Coaching text for edge inspector sliders and influence context.
 * Pure functions — no React imports.
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
      text: 'Very low — this link will be mostly ignored in analysis.',
      colorClass: 'text-danger',
    }
  }
  if (belief <= 0.39) {
    return {
      text: 'Low confidence — analysis will treat this link as uncertain.',
      colorClass: 'text-warning',
    }
  }
  if (belief <= 0.69) {
    return {
      text: 'Moderate confidence — a reasonable starting point.',
      colorClass: 'text-text-light',
    }
  }
  if (belief <= 0.89) {
    return {
      text: 'High confidence — analysis will rely heavily on this link.',
      colorClass: 'text-text-light',
    }
  }
  return {
    text: "Very high — if you're not fully sure, consider lowering slightly. Most real-world links carry some uncertainty.",
    colorClass: 'text-warning',
  }
}

/**
 * Effect size coaching nudge based on absolute signed value (0–1).
 */
export function getEffectSizeCoaching(absValue: number): CoachingNudge {
  if (absValue <= 0.1) {
    return {
      text: 'Negligible effect — this link barely influences the target.',
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
      text: 'Strong effect — changes here will significantly shift results.',
      colorClass: 'text-text-light',
    }
  }
  if (absValue <= 0.9) {
    return {
      text: 'Very strong — few real-world factors have this much influence.',
      colorClass: 'text-warning',
    }
  }
  return {
    text: 'Near-total effect. This implies the target is almost entirely determined by this factor.',
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

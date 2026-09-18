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

import { getStrengthBand, type StrengthBandId } from '../../domain/vocabulary'

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
 *
 * ⭐⭐⭐ THIS WAS A SECOND STRENGTH VOCABULARY, IN THE SAME PANEL AS THE FIRST
 * (fixed 18 Sep 2026). `EdgePanel` renders `StrengthBandButtons` and
 * `SignedStrengthSlider` together, so the band pills and this sentence describe
 * ONE number, side by side, and they disagreed:
 *
 *   |v|       pill (canonical)   this sentence (before)
 *   0.05      Slight             "Negligible effect."
 *   0.15      Slight             "Moderate effect."      ← two words, one value
 *   0.40      Strong             "Moderate effect."      ← boundary INVERTED
 *   0.70      Very strong        "Strong effect."        ← boundary INVERTED
 *   0.95      Very strong        "Near-total effect."
 *
 * The two boundary rows are the sharpest: this table's cuts were INCLUSIVE
 * UPWARDS (`<= 0.4`, `<= 0.7`) against the contract's inclusive-downwards
 * (`>= 0.40`, `>= 0.70`), so at exactly the two numbers a user is most likely
 * to type, the lit pill and the sentence beneath it named different bands.
 *
 * ⚠ AND IT IS GENUINELY THE SAME QUESTION, WHICH IS WHY IT IS RECONCILED AND
 * NOT NAMED APART (trap 21). This file's own header settles it: *"THESE LABEL
 * THE VALUE YOU ARE SETTING… 'Strong effect' is a scale label for the number
 * under your own hand."* A scale label for `|value|` is precisely what
 * `getStrengthLabel` returns. Two answers to one question is a defect; the
 * nearby `getConfidenceCoaching` below is left alone because `belief` is a
 * different quantity and its words are a different scale.
 *
 * ⛔ TWO RUNGS WERE RETIRED, DELIBERATELY. "Negligible" and "Near-total" have
 * no counterpart in the ruled vocabulary, and a five-rung ladder cannot be a
 * scale label for a four-band contract without re-opening the disagreement at
 * two more cuts. The colour rule survives unchanged in substance — the top band
 * warns — and is now keyed by band id rather than by a fifth set of numbers.
 */
const EFFECT_COACHING_COLOUR: Record<StrengthBandId, string> = {
  slight: 'text-text-light',
  moderate: 'text-text-light',
  strong: 'text-text-light',
  veryStrong: 'text-warning',
}

export function getEffectSizeCoaching(absValue: number): CoachingNudge {
  const band = getStrengthBand(absValue)
  return {
    text: `${band.label} effect.`,
    colorClass: EFFECT_COACHING_COLOUR[band.id],
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

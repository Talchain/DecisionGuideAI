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

import { getCanvasStrengthBand, type CanvasStrengthBandId } from '../../domain/vocabulary'

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
 * ⭐⭐⭐ THIS WAS A SECOND STRENGTH VOCABULARY OVER THE SAME NUMBER AS THE FIRST
 * (reconciled 18 Sep 2026).
 *
 * ⛔⛔ AND THE RUNG THIS CLAIM SITS ON IS **CODE, NOT USER-WITNESSED** — say so
 * before reading the table below, because an earlier draft of this very block
 * said *"`EdgePanel` renders `StrengthBandButtons` and `SignedStrengthSlider`
 * together, so the band pills and this sentence describe ONE number, side by
 * side"*, which asserts that a user SAW the disagreement. **They did not, and
 * the measurement is three lines away.** `getEffectSizeCoaching` has exactly ONE
 * non-test call site in the repo — `SignedStrengthSlider.tsx:84` — and that
 * component **does not render the result**: its JSX ends on the comment *"Value
 * display and coaching nudge removed — EdgePanel renders the strength pill
 * instead"*, and the repo's own CI artefact records the dead local by name
 * (`scripts/ci/typecheck-baseline-identities.txt`: `SignedStrengthSlider.tsx
 * TS6133 'effectCoaching' is declared but its value is never read`). Two
 * independent instruments, and a contrast control on the same sweep so the
 * absence is not the probe's blindness: the sibling `getConfidenceCoaching` IS
 * rendered, at `EdgeInspector.tsx:447`.
 *
 * ⚠ SO WHAT IS THIS CHANGE WORTH? The divergence was real IN THE CODE and is
 * removed; the sentence is DARK, so removing it changed no pixel. That is still
 * worth doing — this function is one import away from a panel at any time, and a
 * vocabulary reconciled while dark cannot re-open the disagreement when it is
 * lit — but it must not be counted as a user-visible fix. The user-visible half
 * of this change is elsewhere and is not in doubt: the legend's invented "Weak
 * effect" row, the width ladder, the edge chip (`describeEdge`), the band pills
 * and `ConnectionRow` all render. (`InfluenceIndicator` does NOT: 0 importers,
 * 0 JSX sites, contrast `DataBar` 12/61 — it is orphaned.) **CLAUDE.md status
 * ladder: this paragraph is CODE EXISTS + TESTED. It is not WIRE-WITNESSED and
 * it is certainly not JOURNEY-WITNESSED. Do not restate it as either.**
 *
 * The table below therefore reads *what the two functions returned*, NOT what a
 * user was shown:
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
 * to type, the two functions returned different bands for one value — the
 * inversion a restatement can produce and no amount of care in either file can
 * see, because neither file could see the other.
 *
 * ⛔⛔ THE SECOND CONSUMER, AND WHY IT IS A LATENT COLLISION RATHER THAN A LIVE
 * ONE — measured 18 Sep 2026, and recorded because the next lane to LIGHT this
 * sentence inherits it. `SignedStrengthSlider` is SHARED: besides `EdgePanel` it
 * is rendered by `components/model-tab/ContestedEdgeCard.tsx:396`, seeded from
 * `validation.pass1.strength_mean` — the very number that card labels with
 * `model-tab/strengthBands.getDirectionalStrengthLabel`, on its own DIRECTIONAL
 * cuts of 0.6 / 0.25 / 0.05. So the moment this sentence is rendered again, one
 * card shows ONE number under TWO strength words: at `|0.5|` the card says
 * *"Moderate positive effect"* while the slider would say *"Strong effect."*
 *
 * ⚠ TWO THINGS THAT ARE **NOT** TRUE OF IT, both checked rather than assumed:
 *   · It is not user-visible today. The slider prints no word for the value —
 *     see the dark-surface measurement at the top of this block.
 *   · This consolidation did not CREATE it. The two vocabularies already
 *     disagreed over that card's number before this change: at `|0.5|` the old
 *     ladder said *"Strong effect."* against the same *"Moderate positive
 *     effect"*, and at `|0.15|` *"Moderate effect."* against *"Weak positive
 *     effect"*. The cuts that collide moved; the collision did not arrive.
 *
 * ⛔ AND IT IS NOT FIXED HERE, ON PURPOSE. `model-tab/strengthBands` answers the
 * DIRECTIONAL question, is named apart for that reason (trap 21), and the Model
 * tab is out of this lane's scope by ruling. The fix belongs with whoever lights
 * the sentence: either pass the word in, or have the slider stay silent for a
 * host that names the value itself. ⚠ Whoever does it: do not "reconcile" the
 * two tables — that is the wrong move on two authorities answering different
 * questions.
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
const EFFECT_COACHING_COLOUR: Record<CanvasStrengthBandId, string> = {
  slight: 'text-text-light',
  moderate: 'text-text-light',
  strong: 'text-text-light',
  veryStrong: 'text-warning',
}

export function getEffectSizeCoaching(absValue: number): CoachingNudge {
  const band = getCanvasStrengthBand(absValue)
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

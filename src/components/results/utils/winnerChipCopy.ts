/**
 * winnerChipCopy — Tier-driven copy for option card conversation chips.
 *
 * Brief 5.4 Phase 7: Replaces hardcoded chip strings at render sites.
 * Copy adapts to the confidence_tier signal so the winner label reflects
 * decision certainty without inventing new phrases.
 *
 * Brief 5.5 §2.7 lock: stability gate now mirrors certaintyCopy exactly
 * via the shared shouldSoftenPhrasing helper. Soft chip fires for
 * tier ∈ {needs_work, fair} AND stability < 0.85. coachingReadiness is
 * NOT consulted (spec correction — prior logic could have softened a
 * strong tier via weak readiness, which the corrected spec forbids).
 */

import type { ConfidenceTier } from '../types'
import { shouldSoftenPhrasing } from './certaintyCopy'

/**
 * Chip button label for the option card chat trigger.
 *
 * Winner copy is gated by shouldSoftenPhrasing(tier, stability):
 *   - tier ∈ {needs_work, fair} AND stability < 0.85
 *       → "What makes this the current leader?"
 *   - all other combinations (strong / fair≥0.85 / needs_work≥0.85 /
 *     unknown / undefined) → "What makes this lead?"
 *
 * Non-winner copy is always forward-looking and tier-invariant:
 *   → "What would make this lead?"
 */
export function winnerChipLabel(
  isWinner: boolean,
  confidenceTier: ConfidenceTier | undefined,
  recommendationStability?: number,
  hasLeadingOption?: boolean,
): string {
  // ROADMAP 1.223: "the current leader" asserts, via the definite article,
  // that a unique leader exists — so it is withheld when the producer made no
  // such claim. Note the pre-existing inversion this exposes: the softened
  // form fires when the run is WEAK (tier ∈ {needs_work, fair} AND stability
  // < 0.85), so the shakier the analysis, the MORE committal the chip became.
  // The forward-looking phrasing is the honest form on a withheld turn — it
  // asks what would establish a lead rather than presupposing one, and it is
  // already this module's copy for exactly that situation (the non-winner
  // branch below), so nothing is invented.
  if (hasLeadingOption === false) {
    return 'What would make this lead?'
  }
  if (!isWinner) {
    return 'What would make this lead?'
  }
  return shouldSoftenPhrasing(confidenceTier, recommendationStability)
    ? 'What makes this the current leader?'
    : 'What makes this lead?'
}

/**
 * Full conversation prompt sent when the chip is clicked.
 *
 * The prompt is label-contextual but tier-invariant — the AI can interpret
 * confidence from the analysis payload rather than from the chip copy.
 */
export function winnerChipPrompt(
  isWinner: boolean,
  label: string,
  hasLeadingOption?: boolean,
): string {
  // ROADMAP 1.223: the winner prompt asks the model "what makes X THE leading
  // option?" — a presupposition the assistant would then answer as fact. On a
  // withheld turn it takes the same forward-looking form as the chip label, so
  // the question the user sends matches the question the chip offered.
  if (isWinner && hasLeadingOption !== false) {
    return `What makes "${label}" the leading option? What are its key advantages?`
  }
  return `What would make "${label}" lead instead? What changes would be needed?`
}

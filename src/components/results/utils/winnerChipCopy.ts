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
 *       → "What makes this best supported?"
 *   - all other combinations (strong / fair≥0.85 / needs_work≥0.85 /
 *     unknown / undefined) → "What makes this the best-supported option?"
 *
 * Non-winner copy is always forward-looking and tier-invariant:
 *   → "What would make this better supported?"
 *
 * ⭐⭐ THE DEFINITIVE ARM STOPPED SAYING "lead" ON 8 Sep 2026, AND IT IS THE
 * ARM MOST USERS MEET. #1281 retired the contest frame across 72 files and
 * moved four of this module's six strings; the two it missed were the
 * definitive label and the non-winner PROMPT. The definitive arm is the
 * DEFAULT — `strong`, `unknown` and `undefined` tiers all land on it — so the
 * surviving race word fired on confident runs and on every run whose tier the
 * producer did not state, which is the opposite of a rare path.
 *
 * ⚠⚠ AND THE MISS THAT MATTERS MORE THAN THE WORD: THE LABEL AND THE MESSAGE
 * HAD COME APART. `winnerChipLabel(isWinner=false, …)` already read "What would
 * make this better supported?" while `winnerChipPrompt(isWinner=false, …)` —
 * the SAME branch, the text that lands in the user's own transcript — still
 * said `lead instead`. A user clicked a chip offering one question and sent a
 * different one. Fixing a visible label over a message that still carries the
 * retired frame ships the defect one layer down, where nobody reads it.
 *
 * ⛔ THE TWO WINNER ARMS MUST STAY DISTINCT STRINGS. Collapsing them onto the
 * hedged wording would have been the smaller diff and would have destroyed the
 * only thing this module does: every "definitive path" assertion in
 * `winnerChipCopy.spec.ts` would then pass against a function that ignored
 * `shouldSoftenPhrasing` entirely, and the softening gate — the 0.85 boundary,
 * the stability override — would be untested while reading green. The two arms
 * differ in COMMITTAL FORCE, which is the axis the gate exists on:
 *
 *     weak run   "What makes this best supported?"              adjectival
 *     strong run "What makes this the best-supported option?"   definite article
 *
 * ⭐ THAT ALSO REPAIRS AN INVERSION THIS FILE ALREADY COMPLAINED ABOUT, and the
 * repair is a SIDE EFFECT of picking a distinct string, not the purpose of this
 * change — recorded that way round so the next reader does not credit it with a
 * design it did not have. The note below observes that "the shakier the
 * analysis, the MORE committal the chip became". Under the retired pair that
 * was true; "the current leader" and then "lead" were at least as committal as
 * the hedge they were supposed to be firmer than. Now the definite article sits
 * on the strong arm and the bare adjectival on the weak one.
 *
 * ⚠ The definitive label is deliberately BYTE-IDENTICAL in its noun phrase to
 * `winnerChipPrompt`'s winner arm ("the best-supported option"), so the chip a
 * user reads and the question it sends are one voice. They are still two
 * literals in two functions — NOT derived from one another — because the arms
 * are independently gated and a shared constant would invite a future edit to
 * move both when only one was meant. The coupling is asserted in the spec
 * instead, which is where a divergence should RED.
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
    return 'What would make this better supported?'
  }
  if (!isWinner) {
    return 'What would make this better supported?'
  }
  return shouldSoftenPhrasing(confidenceTier, recommendationStability)
    ? 'What makes this best supported?'
    : 'What makes this the best-supported option?'
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
    return `What makes "${label}" the best-supported option? What are its key advantages?`
  }
  return `What would make "${label}" better supported instead? What changes would be needed?`
}

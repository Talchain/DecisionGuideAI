/**
 * winnerChipCopy — Tier-driven copy for option card conversation chips.
 *
 * Brief 5.4 Phase 7: Replaces hardcoded chip strings at render sites.
 * Copy adapts to the confidence_tier signal so the winner label reflects
 * decision certainty without inventing new phrases.
 */

import type { ConfidenceTier } from '../types'

/**
 * Chip button label for the option card chat trigger.
 *
 * Winner copy is tier-aware:
 *   - strong → "What makes this lead?"       (confident, definitive)
 *   - fair/needs_work/unknown → "What makes this the current leader?"  (hedged)
 *
 * Non-winner copy is always forward-looking and tier-invariant:
 *   → "What would make this lead?"
 */
export function winnerChipLabel(
  isWinner: boolean,
  confidenceTier: ConfidenceTier | undefined,
): string {
  if (!isWinner) {
    return 'What would make this lead?'
  }
  return confidenceTier === 'strong'
    ? 'What makes this lead?'
    : 'What makes this the current leader?'
}

/**
 * Full conversation prompt sent when the chip is clicked.
 *
 * The prompt is label-contextual but tier-invariant — the AI can interpret
 * confidence from the analysis payload rather than from the chip copy.
 */
export function winnerChipPrompt(isWinner: boolean, label: string): string {
  if (isWinner) {
    return `What makes "${label}" the leading option? What are its key advantages?`
  }
  return `What would make "${label}" lead instead? What changes would be needed?`
}

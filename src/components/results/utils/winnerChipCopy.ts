/**
 * winnerChipCopy — Tier-driven copy for option card conversation chips.
 *
 * Brief 5.4 Phase 7: Replaces hardcoded chip strings at render sites.
 * Copy adapts to the confidence_tier signal so the winner label reflects
 * decision certainty without inventing new phrases.
 *
 * Brief 5.4 QA Item 4: stability gate mirrors certaintyCopy.ts.
 * Hedged copy ("What makes this the current leader?") fires only when
 * BOTH conditions hold: tier === 'needs_work' AND stability < STABILITY_STRONG_THRESHOLD
 * (imported from certaintyCopy.ts — single source of truth).
 * fair / unknown / undefined tiers are always definitive regardless
 * of stability — they are not evidence-weak signals.
 */

import type { ConfidenceTier } from '../types'
import { STABILITY_STRONG_THRESHOLD } from './certaintyCopy'

/**
 * Chip button label for the option card chat trigger.
 *
 * Winner copy is stability-gated for the needs_work tier only:
 *   - needs_work AND stability < STABILITY_STRONG_THRESHOLD → "What makes this the current leader?"
 *   - all other tiers (strong / fair / unknown / undefined) → "What makes this lead?"
 *
 * Non-winner copy is always forward-looking and tier-invariant:
 *   → "What would make this lead?"
 */
export function winnerChipLabel(
  isWinner: boolean,
  confidenceTier: ConfidenceTier | undefined,
  recommendationStability?: number,
): string {
  if (!isWinner) {
    return 'What would make this lead?'
  }
  const evidenceIsWeak = confidenceTier === 'needs_work'
  const stabilityIsWeak =
    recommendationStability == null || recommendationStability < STABILITY_STRONG_THRESHOLD
  return evidenceIsWeak && stabilityIsWeak
    ? 'What makes this the current leader?'
    : 'What makes this lead?'
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

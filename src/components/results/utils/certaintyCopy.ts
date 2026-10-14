/**
 * certaintyCopy — the tier × stability softening gate.
 *
 * ⭐ RUN-4 JUDGE, DL RULING (12 Oct, the class): `buildCertaintyCopy` is DELETED. Its headlines ("{winner} supported in
 * more simulated scenarios than any other option", "{winner} currently leads") were leader claims from a win share; ruling
 * A and the guiding principle allow none, and CEE sends none. It had no production caller (only specs), so it is removed
 * whole rather than reworded, and no words replace it. `shouldSoftenPhrasing` stays: `getStabilityDisplayLabel` reads it.
 */

import type { ConfidenceTier } from '../types'

/**
 * Brief 5.4 QA Item 3: at or above this stability the result is treated as numerically robust despite limited
 * evidence quality, so `shouldSoftenPhrasing` does not soften. Any future threshold change must be made here only.
 */
export const STABILITY_STRONG_THRESHOLD = 0.85

/**
 * Brief 5.5 §2.7 locked softening gate: tier × stability, no readiness input.
 * Read by `getStabilityDisplayLabel`.
 */
export function shouldSoftenPhrasing(
  tier: ConfidenceTier | undefined,
  stability: number | undefined,
): boolean {
  const tierSoftens = tier === 'needs_work' || tier === 'fair'
  const stabilityIsWeak = stability == null || stability < STABILITY_STRONG_THRESHOLD
  return tierSoftens && stabilityIsWeak
}

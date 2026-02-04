/**
 * Task 1.8: Format simulation ratio with proper edge case guards.
 *
 * Display format:
 * - If probability >= 0.5: show "~{Math.round(probability * 100)}% of simulations"
 * - If probability < 0.5 and probability > 0: show "~1 in {Math.round(1/probability)} simulations"
 *
 * Edge case guards (critical):
 * - If probability <= 0: return null (omit ratio entirely)
 * - If probability > 1: clamp to 1, show "~100% of simulations"
 * - If probability is NaN or undefined or null: return null (omit ratio entirely)
 *
 * @param probability - Switch probability (0-1 range)
 * @returns Formatted string or null if ratio should be omitted
 */
export function formatScenarioRatio(probability: number | undefined | null): string | null {
  // Guard: null, undefined, or NaN - omit entirely
  if (probability == null || Number.isNaN(probability)) {
    return null
  }

  // Guard: probability <= 0 - omit entirely
  if (probability <= 0) {
    return null
  }

  // Guard: probability > 1 - clamp to 1
  const clampedProbability = Math.min(probability, 1)

  // If probability >= 0.5, show percentage format
  if (clampedProbability >= 0.5) {
    const percent = Math.round(clampedProbability * 100)
    return `~${percent}% of simulations`
  }

  // If probability < 0.5 and > 0, show "1 in N" format
  const ratio = Math.round(1 / clampedProbability)
  return `~1 in ${ratio} simulations`
}

/**
 * Task 1.2: Format flip risk message with simulations language.
 * Avoids forbidden "chance", "flip", and "scenarios" terminology.
 *
 * @param probability - Switch probability (0-1 range)
 * @param alternativeLabel - Label for the alternative winner
 * @returns Formatted message or null if should be omitted
 */
export function formatFlipRiskMessage(
  probability: number | undefined | null,
  alternativeLabel: string | undefined
): string | null {
  // Guard: invalid probability (null, undefined, NaN, or <= 0)
  if (probability == null || Number.isNaN(probability) || probability <= 0) {
    return null
  }

  // Guard: no valid alternative label
  const hasValidAlternative =
    typeof alternativeLabel === 'string' &&
    alternativeLabel.trim().length > 0 &&
    alternativeLabel !== 'another option'

  if (!hasValidAlternative) {
    return null
  }

  // Clamp probability > 1 to 1 (<=0 already guarded above)
  const clampedProbability = Math.min(probability, 1)

  // Task 1.2: Use simulations language
  // - If p ≥ 0.5: show percentage format
  // - If p < 0.5: show ratio format
  if (clampedProbability >= 0.5) {
    const percent = Math.round(clampedProbability * 100)
    return `In ~${percent}% of simulations, "${alternativeLabel}" becomes the better choice`
  } else {
    const ratio = Math.round(1 / clampedProbability)
    return `In ~1 in ${ratio} simulations, "${alternativeLabel}" becomes the better choice`
  }
}

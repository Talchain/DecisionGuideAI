/**
 * Normalised value rendering rule.
 * Show normalised value ONLY when tech toggle is on AND raw units exist.
 */

export function shouldShowNormalised(
  techMode: boolean,
  rawValue?: number,
): boolean {
  return techMode && rawValue !== undefined
}

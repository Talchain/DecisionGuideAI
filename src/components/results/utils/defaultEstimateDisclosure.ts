/**
 * The default-estimate disclosure counts (F10).
 *
 * `AdvancedSection` has rendered *"{N} of {M} factors use default confidence
 * values."* since it was written, behind props NO CALL SITE PASSED. The one
 * honest sentence the product had about its own defaults was dead in the tree
 * while five other surfaces printed the defaults themselves.
 *
 * Derived from the SAME `isDefaultedConfidence` flag as the Drivers panel's
 * "Default estimate" pill (`isDefaultedConfidenceFromRaw`), so the count can
 * never disagree with the pills it is counting. Lives in its own module so the
 * rule is assertable without mounting the whole results body.
 */

/** Returns `{}` when there is nothing honest to say — never a fabricated zero. */
export function deriveDefaultEstimateDisclosure(
  drivers: ReadonlyArray<{ isDefaultedConfidence?: boolean }> | null | undefined,
): { defaultEstimateCount?: number; totalFactorCount?: number } {
  if (!drivers || drivers.length === 0) return {}
  return {
    // Strict read: only an explicit `true` counts. An absent flag is not a
    // claim that the factor uses a default — it is silence.
    defaultEstimateCount: drivers.filter(d => d.isDefaultedConfidence === true).length,
    totalFactorCount: drivers.length,
  }
}

/**
 * The dock's "which analyses are available" ticks (DegradedStateBanner).
 *
 * ⛔ A ✓ IS EARNED ONLY BY DATA THAT WAS READ AND PASSED (AIQ 5909634999, P0 5909616965). The results hook answers
 * `recommendation.analysisStatus: 'computed'` as a DEFAULT when no report is held (its no-report branch), and the banner
 * renders whenever a first run has ever completed — so a reload with the report absent read "Comparison ✓" over
 * nothing. The Comparison tick now also needs options actually read from a report; absent → ×, the same honest
 * absence as Robustness without a `display_verdict`.
 */
interface DegradedAnalysisInputs {
  recommendation?: { analysisStatus?: string; allOptions?: readonly unknown[] } | null
  drivers?: { driversStatus?: string } | null
  confidence?: { robustnessStatus?: string } | null
}

export function degradedAnalysisTypes(data: DegradedAnalysisInputs | null | undefined): { name: string; available: boolean }[] {
  if (data == null) return []
  return [
    {
      name: 'Comparison',
      available: data.recommendation?.analysisStatus === 'computed' && (data.recommendation?.allOptions?.length ?? 0) > 0,
    },
    { name: 'Drivers', available: data.drivers?.driversStatus === 'computed' },
    { name: 'Robustness', available: data.confidence?.robustnessStatus === 'computed' },
  ]
}

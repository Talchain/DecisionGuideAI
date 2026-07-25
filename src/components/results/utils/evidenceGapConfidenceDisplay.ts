/**
 * Evidence-gap confidence display (F6).
 *
 * WHAT WENT WRONG
 * ---------------
 * `useResultsSectionData` mapped `confidence: gap.confidence ?? 0`. `0` is a
 * VALUE, not an absence, and two live surfaces then asserted it:
 *   · *"This factor has 0% confidence. Improving it could change the result."*
 *   · a source pill computed from `confidence <= 0` → **"No data"**.
 * The pill happened to land near the truth; the sentence did not, and both
 * arrived there by claiming a measurement of zero rather than by knowing
 * nothing. A producer that genuinely reports `0` and a producer that reports
 * nothing are different facts, and the user could not tell them apart.
 *
 * This is a DIFFERENT producer from `factor_sensitivity[].confidence` — these
 * are CEE's `evidence_gaps[]` rows on a 0-100 scale, so the ruled
 * `DISPLAY_SAFE_DRIVER_CONFIDENCE` policy does not apply and a real value here
 * IS speakable. The only defect is the fabricated absence.
 *
 * Same discriminated-union shape as `EdgeValueDisplay` /
 * `FactorConfidenceDisplay`: there is no member carrying a number without
 * having decided it is real, so "print the fallback as a measurement" is not
 * expressible.
 */

export type EvidenceGapConfidenceDisplay =
  | { show: false }
  | { show: true; pct: number }

/**
 * Resolve one evidence gap's confidence for display.
 *
 * `null` / non-finite ⇒ `show: false`. Callers must SUPPRESS the figure and
 * anything derived from it — never substitute a zero.
 */
export function resolveEvidenceGapConfidenceDisplay(
  confidence: number | null | undefined,
): EvidenceGapConfidenceDisplay {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return { show: false }
  return { show: true, pct: confidence }
}

/**
 * The card's body sentence.
 *
 * The confidence clause needs a confidence; the improvement clause is true
 * either way, so absence SHORTENS the sentence rather than blanking the card —
 * the gap itself is a real producer finding and still deserves a row.
 */
export function evidenceGapGenericText(display: EvidenceGapConfidenceDisplay): string {
  return display.show
    ? `This factor has ${display.pct}% confidence. Improving it could change the result.`
    : 'Improving this factor could change the result.'
}

/**
 * The provenance pill.
 *
 * `null` ⇒ NO PILL AT ALL. The pill is a claim about where a number came from,
 * and there is no number.
 */
export function evidenceGapSourcePill(
  display: EvidenceGapConfidenceDisplay,
): { label: string; borderClass: string } | null {
  if (!display.show) return null
  if (display.pct <= 0) return { label: 'No data', borderClass: 'border-danger/30' }
  if (display.pct < 40) return { label: 'AI estimate', borderClass: 'border-info/30' }
  return { label: 'Estimated', borderClass: 'border-warning/30' }
}

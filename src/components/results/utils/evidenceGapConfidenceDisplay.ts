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

// ---------------------------------------------------------------------------
// "Is this gap ADDRESSED?" — the third state, for the surfaces that summarise
// a whole LIST of gaps rather than rendering one.
// ---------------------------------------------------------------------------

/**
 * The threshold at or above which a STATED confidence counts as addressed.
 * Named once, here, because two surfaces summarise the same list and a second
 * copy of `50` is the hand-maintained mirror this estate keeps paying for.
 */
export const EVIDENCE_GAP_ADDRESSED_MIN_PCT = 50

/**
 * ⭐ NO ALL-CLEAR WITHOUT AUTHORITY, APPLIED TO THE SUMMARY ROWS.
 *
 * Two surfaces summarised the gap list with the SAME defective predicate:
 *
 *   `gaps.some(g => typeof g.confidence === 'number' && g.confidence < 50)`
 *
 * — `TriageActionCardsBody`'s "What we checked" row (`ok` ⇒ a green tick and
 * "Evidence covered") and `derivePostFooterMeta`'s `results-analysis-footer`
 * (⇒ "Evidence strong"). Both are two-valued over a THREE-valued input, and
 * the third value is the one this module exists to protect: a gap whose
 * confidence the producer NEVER STATED resolves to `null` deliberately
 * (`useResultsSectionData`, "No absence-fabrication"), and this module's own
 * contract says *"Callers must SUPPRESS the figure and anything derived from
 * it"*. `evidenceWeak` was derived from it — so unstated read as "not weak",
 * which read as "fine".
 *
 * Measured consequence, one payload, two rows apart: a single gap
 * `{ factor_id: 'f1', factor_label: 'Supplier lead time', voi_score: 0.9 }`
 * with no `confidence` rendered a green ✓ "Evidence covered" beside
 * "0 of 1 evidence gaps addressed".
 *
 * So `addressed` is a POSITIVE claim requiring a stated figure, and the two
 * summary rows are derived from THE SAME count the "N of M addressed" span
 * renders — they can no longer disagree by construction, which is a stronger
 * guarantee than two predicates that happen to be written identically today.
 *
 * NOT weakness. An unstated confidence is not evidence of a weak gap either;
 * it simply cannot license the all-clear.
 */
export function isEvidenceGapAddressed(confidence: number | null | undefined): boolean {
  const display = resolveEvidenceGapConfidenceDisplay(confidence)
  return display.show && display.pct >= EVIDENCE_GAP_ADDRESSED_MIN_PCT
}

/**
 * True iff the producer flagged at least one gap AND every one of them is
 * addressed by a STATED confidence. This is the only state that licenses
 * "Evidence covered" / "Evidence strong".
 *
 * An empty list returns `false` on purpose: "no gaps" is a different question
 * (was anything assessed at all?) and its callers answer it separately —
 * folding it in here would be reconciling two questions under one name
 * (CLAUDE.md trap 21).
 */
export function everyEvidenceGapAddressed(
  gaps: ReadonlyArray<{ confidence?: number | null }>,
): boolean {
  return gaps.length > 0 && gaps.every(g => isEvidenceGapAddressed(g.confidence))
}

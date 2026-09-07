/**
 * MetricPills — the compact Confidence pill at the bottom of Standard view nodes.
 *
 * Plain words, not "C:" — the first-five-minutes review found the abbreviations
 * unreadable at first contact; the tooltip/aria still carry the full
 * disclosure. Bias coaching is NOT a pill here: it lives on the header
 * ScienceIcon (one bias-coaching surface per node — bias-coaching slice,
 * proposal 2026-07-16 §1.5(2)).
 * Font 10px via the `edgeLabel` TOKEN. It was a raw utility until 18 Aug 2026,
 * and a raw utility cannot see `--canvas-label-scale`: measured in Chromium,
 * these pills rendered at 5.0px at the 0.50 auto-fit floor while their sibling
 * node title rendered at its declared 13px. DS v5 §2.4 forbids the raw form for
 * exactly this reason. Pill padding 1px 5px. Border-radius 10px. Gap 3px.
 *
 * ⚠ THE INFLUENCE PILL IS GONE, AND IT WAS ALREADY UNREACHABLE WHEN IT WENT.
 * Influence became the shared `NodeMetricRow` on 1 Sep 2026 (see FactorNode's
 * "INFLUENCE IS THE SHARED ROW NOW" note) — the same row shape an option's
 * "Ahead", a risk's and an outcome's "strength" use. The pill's branch survived
 * that migration, but the sole `<MetricPills>` mount stopped passing
 * `influencePct`, and `hasInfluence` required it, so the branch could not
 * render on any node under any flag posture. It is deleted here rather than
 * left as a second influence surface waiting to be re-wired: two presentations
 * of one number on one card is the inconsistency the migration existed to end.
 */
import { typography } from '../../../styles/typography'

interface MetricPillsProps {
  /**
   * Already gated by the shared display policy
   * (`components/results/driverConfidenceDisplayPolicy`) — this component must
   * never resolve the raw field itself. Null ⇒ render nothing.
   */
  confidencePct?: number | null
  /** True ⇒ the figure is a producer placeholder; disclosed, never bare. */
  confidenceIsDefaulted?: boolean
  /** True ⇒ PLoT marked the calibration provisional; disclosed, never bare. */
  confidenceIsProvisional?: boolean
}

export function MetricPills({
  confidencePct,
  confidenceIsDefaulted = false,
  confidenceIsProvisional = false,
}: MetricPillsProps) {
  const hasConfidence = confidencePct != null && confidencePct > 0

  if (!hasConfidence) return null

  // Confidence disclosure — composed from the two flags the shared policy
  // returns, so the pill states exactly what it was told and never claims a
  // quality it was not given.
  const confidenceQualifiers = [
    confidenceIsDefaulted ? 'Default estimate — not yet validated with evidence' : null,
    confidenceIsProvisional ? 'Calibration is provisional' : null,
  ].filter((q): q is string => q !== null)
  const confidenceTitle = confidenceQualifiers.length > 0
    ? confidenceQualifiers.join('. ')
    : 'Confidence in this factor’s influence'
  const confidenceAria = `Confidence ${confidencePct ?? 0}%. ${confidenceTitle}`

  return (
    <div className="flex gap-[3px] mt-1.5 items-center flex-wrap">
      <span
        className={`${typography.edgeLabel} px-[5px] py-[1px] rounded-[10px] border border-factor/60 text-text-body inline-flex items-center gap-0.5`}
        // Disclosure travels WITH the number, in the same element, so the
        // figure cannot be rendered bare. Same vocabulary the Drivers panel
        // ships ("Default estimate — not yet validated with evidence" /
        // provisional calibration), not a second pattern.
        role="img"
        title={confidenceTitle}
        aria-label={confidenceAria}
        data-testid="metric-pill-confidence"
      >
        Confidence {confidencePct}%
        {confidenceIsDefaulted && (
          <span aria-hidden="true" data-testid="metric-pill-confidence-default-estimate">
            *
          </span>
        )}
      </span>
    </div>
  )
}

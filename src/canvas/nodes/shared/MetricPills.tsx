/**
 * MetricPills — compact row of small outlined pills at the bottom of Standard view nodes.
 * Two pill types: Influence and Confidence (plain words, not I:/C: — the
 * first-five-minutes review found the abbreviations unreadable at first
 * contact; the tooltip/aria still carry the full provenance). Bias coaching is
 * NOT a pill here: it lives on the header ScienceIcon (one bias-coaching
 * surface per node — bias-coaching slice, proposal 2026-07-16 §1.5(2)).
 * Font 10px (edgeLabel). Pill padding 1px 5px. Border-radius 10px. Gap 3px.
 *
 * Lane C4 (influence-scale disclosure): the influence number comes from the
 * shared display model (useNodeDisplayMetadata → driverDisplayModel), which on
 * the fallback basis ('normalised_elasticity') is per-set normalised
 * |elasticity| — the top driver shows 100% BY CONSTRUCTION. The pill therefore
 * discloses the basis via native `title` + `aria-label` (the canvas-node
 * tooltip idiom — same as the sibling EdgePills strength pill; the floating
 * DS Tooltip is not used inside React Flow node chrome). Fail-closed: with no
 * provenance passed, the pill keeps a generic honest label and never claims a
 * basis it was not given. Copy comes from the ONE shared module
 * (influenceScaleCopy) DriversSection consumes too, so the surfaces cannot
 * drift (review fix 3).
 */
import type { DriverDisplayProvenance } from '../../../components/results/driverDisplayModel'
import { influenceExplanation, influencePillAriaLabel } from '../../../components/results/influenceScaleCopy'

interface MetricPillsProps {
  influencePct?: number | null
  /** Which basis produced influencePct (see driverDisplayModel). Absent → generic copy. */
  influenceProvenance?: DriverDisplayProvenance | null
  /**
   * Already gated by the shared display policy
   * (`components/results/driverConfidenceDisplayPolicy`) — this component must
   * never resolve the raw field itself. Null ⇒ render no confidence pill.
   */
  confidencePct?: number | null
  /** True ⇒ the figure is a producer placeholder; disclosed, never bare. */
  confidenceIsDefaulted?: boolean
  /** True ⇒ PLoT marked the calibration provisional; disclosed, never bare. */
  confidenceIsProvisional?: boolean
}

export function MetricPills({
  influencePct,
  influenceProvenance,
  confidencePct,
  confidenceIsDefaulted = false,
  confidenceIsProvisional = false,
}: MetricPillsProps) {
  const hasInfluence = influencePct != null && influencePct > 0
  const hasConfidence = confidencePct != null && confidencePct > 0

  if (!hasInfluence && !hasConfidence) return null

  const influenceTitle = influenceExplanation(influenceProvenance)
  const influenceAria = influencePillAriaLabel(influencePct ?? 0, influenceProvenance)

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
      {hasInfluence && (
        <span
          className="text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border border-info/40 text-text-body"
          title={influenceTitle}
          // Review fix 5: aria-label on a role-less <span> is unreliably
          // announced (generic role), and `title` alone is keyboard/touch
          // unreachable. role="img" gives the label a semantic anchor that
          // AT consistently announces — the codebase's ratified idiom for
          // meaningful static markers (see ReadinessColourStrip.tsx for the
          // rationale).
          role="img"
          aria-label={influenceAria}
        >
          Influence {influencePct}%
        </span>
      )}
      {hasConfidence && (
        <span
          className="text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border border-factor/60 text-text-body inline-flex items-center gap-0.5"
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
      )}
    </div>
  )
}

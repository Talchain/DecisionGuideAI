/**
 * MetricPills — compact row of small outlined pills at the bottom of Standard view nodes.
 * Three pill types: Influence, Confidence (plain words, not I:/C: — the
 * first-five-minutes review found the abbreviations unreadable at first
 * contact; the tooltip/aria still carry the full provenance), and bias icon.
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
import { BiasIcon } from './BiasIcon'
import type { ComponentProps } from 'react'
import type { DriverDisplayProvenance } from '../../../components/results/driverDisplayModel'
import { influenceExplanation, influencePillAriaLabel } from '../../../components/results/influenceScaleCopy'

type BiasIconProps = ComponentProps<typeof BiasIcon>

interface MetricPillsProps {
  influencePct?: number | null
  /** Which basis produced influencePct (see driverDisplayModel). Absent → generic copy. */
  influenceProvenance?: DriverDisplayProvenance | null
  confidencePct?: number | null
  biasType?: BiasIconProps['bias']
  biasTip?: string
  biasLinkLabel?: string
  biasLinkMessage?: string
}

export function MetricPills({ influencePct, influenceProvenance, confidencePct, biasType, biasTip, biasLinkLabel, biasLinkMessage }: MetricPillsProps) {
  const hasInfluence = influencePct != null && influencePct > 0
  const hasConfidence = confidencePct != null && confidencePct > 0
  const hasBias = biasType && biasTip

  if (!hasInfluence && !hasConfidence && !hasBias) return null

  const influenceTitle = influenceExplanation(influenceProvenance)
  const influenceAria = influencePillAriaLabel(influencePct ?? 0, influenceProvenance)

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
        <span className="text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border border-factor/60 text-text-body">
          Confidence {confidencePct}%
        </span>
      )}
      {hasBias && (
        <span className="inline-flex px-1 py-[1px] rounded-[10px] border border-warning/40">
          <BiasIcon bias={biasType} tip={biasTip} linkLabel={biasLinkLabel} linkMessage={biasLinkMessage} />
        </span>
      )}
    </div>
  )
}

/**
 * MetricPills — compact row of small outlined pills at the bottom of Standard view nodes.
 * Three pill types: Influence (I:%), Confidence (C:%), and optional bias icon.
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
 * basis it was not given. Copy mirrors DriversSection.tsx — keep in step.
 */
import { BiasIcon } from './BiasIcon'
import type { ComponentProps } from 'react'
import type { DriverDisplayProvenance } from '../../../components/results/driverDisplayModel'

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

  const influenceTitle =
    influenceProvenance === 'normalised_elasticity'
      ? 'Influence: how much this factor affects the outcome, relative to the strongest — the top driver always shows 100%.'
      : influenceProvenance === 'influence_score'
        ? 'Influence: how much this factor affects the outcome — an absolute causal influence score from the analysis.'
        : 'Influence: how much this factor affects the outcome'
  const influenceAria =
    influenceProvenance === 'normalised_elasticity'
      ? `Influence ${influencePct}%, relative to the strongest factor — the top driver always shows 100%`
      : influenceProvenance === 'influence_score'
        ? `Influence ${influencePct}% — an absolute causal influence score from the analysis`
        : `Influence ${influencePct}%`

  return (
    <div className="flex gap-[3px] mt-1.5 items-center flex-wrap">
      {hasInfluence && (
        <span
          className="text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border border-info/40 text-text-body"
          title={influenceTitle}
          aria-label={influenceAria}
        >
          I: {influencePct}%
        </span>
      )}
      {hasConfidence && (
        <span className="text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border border-factor/60 text-text-body">
          C: {confidencePct}%
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

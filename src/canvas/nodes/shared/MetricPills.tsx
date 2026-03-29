/**
 * MetricPills — compact row of small outlined pills at the bottom of Standard view nodes.
 * Three pill types: Influence (I:%), Confidence (C:%), and optional bias icon.
 * Font 10px (edgeLabel). Pill padding 1px 5px. Border-radius 10px. Gap 3px.
 */
import { BiasIcon } from './BiasIcon'
import type { ComponentProps } from 'react'

type BiasIconProps = ComponentProps<typeof BiasIcon>

interface MetricPillsProps {
  influencePct?: number | null
  confidencePct?: number | null
  biasType?: BiasIconProps['bias']
  biasTip?: string
  biasLinkLabel?: string
  biasLinkMessage?: string
}

export function MetricPills({ influencePct, confidencePct, biasType, biasTip, biasLinkLabel, biasLinkMessage }: MetricPillsProps) {
  const hasInfluence = influencePct != null && influencePct > 0
  const hasConfidence = confidencePct != null && confidencePct > 0
  const hasBias = biasType && biasTip

  if (!hasInfluence && !hasConfidence && !hasBias) return null

  return (
    <div className="flex gap-[3px] mt-1.5 items-center flex-wrap">
      {hasInfluence && (
        <span className="text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border border-info/40 text-info">
          I: {influencePct}%
        </span>
      )}
      {hasConfidence && (
        <span className="text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border border-factor/60 text-factor">
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

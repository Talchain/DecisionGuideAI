/**
 * ConfidenceSpectrum — Gradient bar with positioned dots per factor.
 * Hollow ring = factor uses default range (no explicit cap).
 * Filled dot = factor has explicit range.
 *
 * Labels: "Estimated | Brief | Verified" (v6 wireframe copy).
 */

import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'

const ZONES: Record<string, { start: number; end: number; color: string; borderColor: string }> = {
  contested: { start: 5, end: 20, color: 'bg-warning', borderColor: 'border-warning' },
  cee_inference: { start: 10, end: 30, color: 'bg-warning', borderColor: 'border-warning' },
  brief_extraction: { start: 45, end: 70, color: 'bg-info', borderColor: 'border-info' },
  user_reviewed: { start: 78, end: 95, color: 'bg-success', borderColor: 'border-success' },
}

export function ConfidenceSpectrum({ items }: { items: ImprovementItem[] }) {
  const factorItems = items.filter(i => i.focus?.type === 'node')
  if (factorItems.length === 0) return null

  const dots = factorItems.map((item) => {
    const zone = ZONES[item.subgroup ?? ''] ?? ZONES.cee_inference
    const groupItems = factorItems.filter(i => (i.subgroup ?? '') === (item.subgroup ?? ''))
    const groupIdx = groupItems.indexOf(item)
    const spread = zone.end - zone.start
    const position = groupItems.length === 1
      ? (zone.start + zone.end) / 2
      : zone.start + (spread * groupIdx) / (groupItems.length - 1)

    const hasExplicitRange = item.cap != null

    return (
      <Tooltip key={item.key} delay={200} content={`${item.label}${hasExplicitRange ? '' : ' · default range'}`}>
        <span
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full cursor-pointer transition-transform hover:scale-[1.4] ${
            hasExplicitRange
              ? `${zone.color}`
              : `bg-transparent border-2 ${zone.borderColor}`
          }`}
          style={{ left: `${position}%` }}
        />
      </Tooltip>
    )
  })

  return (
    <div className="px-3 pb-1">
      <div className="flex justify-between mb-1.5">
        <span className={`${typography.panelMeta} text-text-light`}>Estimated</span>
        <span className={`${typography.panelMeta} text-text-light`}>Brief</span>
        <span className={`${typography.panelMeta} text-text-light`}>Verified</span>
      </div>
      <div
        className="relative h-4 rounded-lg border border-panel-border"
        style={{ background: 'linear-gradient(to right, rgba(255,166,86,0.12), rgba(99,173,207,0.12), rgba(103,200,158,0.12))' }}
      >
        {dots}
      </div>
    </div>
  )
}

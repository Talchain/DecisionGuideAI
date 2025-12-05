/**
 * Evidence Quality Badge
 *
 * Visual indicator for data freshness/quality levels.
 * Shows FRESH, AGING, STALE, or UNKNOWN status with appropriate colors.
 */

import type { FreshnessQuality } from '../../../../types/plot'

export interface EvidenceQualityBadgeProps {
  quality: FreshnessQuality
  ageDays?: number
  className?: string
  showLabel?: boolean
}

interface QualityConfig {
  label: string
  icon: string
  bgColor: string
  textColor: string
  borderColor: string
}

const qualityConfigs: Record<FreshnessQuality, QualityConfig> = {
  FRESH: {
    label: 'Fresh',
    icon: '✓',
    bgColor: 'bg-practical-50',
    textColor: 'text-practical-700',
    borderColor: 'border-practical-300',
  },
  AGING: {
    label: 'Aging',
    icon: '⏱',
    bgColor: 'bg-creative-50',
    textColor: 'text-creative-700',
    borderColor: 'border-creative-300',
  },
  STALE: {
    label: 'Stale',
    icon: '⚠',
    bgColor: 'bg-critical-50',
    textColor: 'text-critical-700',
    borderColor: 'border-critical-300',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: '?',
    bgColor: 'bg-storm-50',
    textColor: 'text-storm-700',
    borderColor: 'border-storm-300',
  },
}

export function EvidenceQualityBadge({
  quality,
  ageDays,
  className = '',
  showLabel = true,
}: EvidenceQualityBadgeProps): JSX.Element {
  const config = qualityConfigs[quality]

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${className}
      `}
      title={
        ageDays !== undefined
          ? `Data is ${ageDays} days old`
          : `Data quality: ${config.label}`
      }
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
      {ageDays !== undefined && showLabel && <span className="text-xs">({ageDays}d)</span>}
    </span>
  )
}

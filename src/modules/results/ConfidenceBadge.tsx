// src/modules/results/ConfidenceBadge.tsx
import type { ReportV1 } from './types'

interface ConfidenceBadgeProps {
  confidence?: ReportV1['confidence']
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const label = confidence ? confidence.charAt(0).toUpperCase() + confidence.slice(1) : 'Unknown'
  
  const colorClass = 
    confidence === 'high' ? 'bg-panel text-success border-success/30' :
    confidence === 'medium' ? 'bg-panel text-info border-info/30' :
    confidence === 'low' ? 'bg-panel text-warning border-warning/30' :
    'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
      role="status"
      aria-label={`Confidence level: ${label}`}
    >
      {label}
    </span>
  )
}

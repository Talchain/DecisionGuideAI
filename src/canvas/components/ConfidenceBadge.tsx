/**
 * Confidence Badge Component (v1.2)
 *
 * Displays confidence level (Low/Medium/High) with brand token colors
 * and optional reason tooltip. Gracefully degrades when confidence data is missing.
 */

import { HelpCircle } from 'lucide-react'
import { typography } from '../../styles/typography'

interface ConfidenceBadgeProps {
  level?: 'low' | 'medium' | 'high'
  reason?: string
  score?: number // Optional numeric confidence score (0-1)
}

export function ConfidenceBadge({ level, reason, score }: ConfidenceBadgeProps) {
  // Graceful degradation: if no level provided, show neutral state
  if (!level) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border bg-gray-50 border-gray-200 text-gray-600 cursor-default"
        title="Confidence data not available"
      >
        <HelpCircle className="w-4 h-4" />
        <span className={`${typography.body} font-medium`}>Confidence N/A</span>
      </div>
    )
  }

  const config = {
    low: {
      label: 'Low Confidence',
      classes: 'bg-danger-50 border-danger-200 text-danger-700',
      iconColor: 'text-danger-600'
    },
    medium: {
      label: 'Medium Confidence',
      classes: 'bg-warning-50 border-warning-200 text-warning-700',
      iconColor: 'text-warning-600'
    },
    high: {
      label: 'High Confidence',
      classes: 'bg-success-50 border-success-200 text-success-700',
      iconColor: 'text-success-600'
    }
  }

  const { label, classes, iconColor } = config[level]

  // Build tooltip content
  const tooltipText = reason
    ? score !== undefined
      ? `${reason} (Score: ${Math.round(score * 100)}%)`
      : reason
    : score !== undefined
      ? `Confidence score: ${Math.round(score * 100)}%`
      : label

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border cursor-default ${classes}`}
      title={tooltipText}
      role="status"
      aria-label={`${label}${reason ? `: ${reason}` : ''}`}
    >
      <HelpCircle className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <div className={`${typography.body} font-semibold`}>
          {label}
          {score !== undefined && (
            <span className="ml-1.5 font-normal opacity-75">
              ({Math.round(score * 100)}%)
            </span>
          )}
        </div>
        {reason && (
          <div className={`${typography.caption} opacity-75 leading-tight max-w-xs truncate`}>
            {reason}
          </div>
        )}
      </div>
    </div>
  )
}

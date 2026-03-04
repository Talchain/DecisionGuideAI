/**
 * ImprovementsSection Component
 *
 * Displays actionable improvements to strengthen the analysis.
 * Part of the Results Panel redesign - "coaching over gates" approach.
 *
 * Features:
 * - Title: "Strengthen your analysis"
 * - Collapsed by default with count badge: "X ways to improve"
 * - Priority-based ordering (lower = more important)
 * - Source indicator (bias, quality_factor, improvement_guidance)
 * - Effort estimate when available
 * - Empty state: "Your model looks good. You're ready to decide."
 */

import { useState } from 'react'
import { typography } from '../../styles/typography'
import type { ImprovementsSectionData, ImprovementItem } from './types'
import { EMPTY_STATES } from './emptyStates'

interface ImprovementsSectionProps {
  data: ImprovementsSectionData
  defaultExpanded?: boolean
}

const SOURCE_CONFIG: Record<
  ImprovementItem['source'],
  {
    bgColor: string
    borderColor: string
    textColor: string
    icon: string
    label: string
  }
> = {
  bias: {
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    icon: '🎯',
    label: 'Bias finding',
  },
  quality_factor: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    icon: '📊',
    label: 'Quality factor',
  },
  improvement_guidance: {
    bgColor: 'bg-panel',
    borderColor: 'border-panel-border',
    textColor: 'text-text-body',
    icon: '💡',
    label: 'Suggestion',
  },
}

function ImprovementRow({ item }: { item: ImprovementItem }) {
  const config = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.improvement_guidance

  return (
    <div className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-2">
        <span className={`${typography.panelBody} flex-shrink-0 mt-0.5`}>{config.icon}</span>
        <div className="flex-1 min-w-0">
          {/* Source badge for bias findings */}
          {item.source === 'bias' && (
            <span className={`inline-block ${typography.panelBody} px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded mb-1`}>
              {config.label}
            </span>
          )}

          {/* Action text */}
          <p className={`${typography.panelHeader} ${config.textColor}`}>{item.action}</p>

          {/* Reason (if different from action) */}
          {item.reason && item.reason !== item.action && (
            <p className={`${typography.panelBody} text-slate-600 mt-1`}>{item.reason}</p>
          )}

          {/* Effort estimate and potential improvement */}
          <div className="flex items-center gap-3 mt-2">
            {item.effortMinutes && (
              <span className={`${typography.panelBody} text-slate-500`}>~{item.effortMinutes} min</span>
            )}
            {item.potentialImprovement && (
              <span className={`${typography.panelBody} text-emerald-600`}>{item.potentialImprovement}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ImprovementsSection({
  data,
  defaultExpanded = false,
}: ImprovementsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const { improvements, count, hasHighPriority } = data

  // Empty state
  if (count === 0) {
    return (
      <div className="p-4 bg-panel border border-panel-border rounded-lg">
        <p className={`${typography.panelBody} text-text-body flex items-start gap-2`}>
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.improvements}
        </p>
      </div>
    )
  }

  // Sort by priority (already sorted in useResultsSectionData, but ensure it here)
  const sortedImprovements = [...improvements].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-3">
      {/* Header with expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className={`${typography.panelHeader} text-slate-700`}>Strengthen your analysis</h3>
          <span
            className={`${typography.panelBody} px-2 py-0.5 rounded-full ${
              hasHighPriority ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {count} {count === 1 ? 'way' : 'ways'} to improve
          </span>
        </div>
        <span className={`text-slate-400 ${typography.panelBody}`}>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* Improvements list */}
      {isExpanded && (
        <div className="space-y-2">
          {sortedImprovements.map((item, index) => (
            <ImprovementRow key={`${item.action.slice(0, 20)}-${index}`} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ImprovementsSection

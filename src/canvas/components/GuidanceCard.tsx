/**
 * GuidanceCard - Individual guidance item display
 *
 * Part of the Unified Guidance System.
 * Displays coaching, validation, weight suggestion, or bias items
 * with consistent styling and interaction patterns.
 *
 * Features:
 * - Type badge (Coaching, Validation, Weight, Bias)
 * - Severity-coded left border
 * - Affected elements display
 * - Expandable micro-interventions
 * - Click to focus on canvas
 */

import { useState } from 'react'
import { Lightbulb, AlertTriangle, TrendingUp, Brain, ChevronDown, ChevronRight, MapPin, Wrench, Loader2, CheckCircle } from 'lucide-react'
import { typography } from '../../styles/typography'

export type GuidanceSeverity = 'blocker' | 'warning' | 'info'
export type GuidanceType = 'coaching' | 'validation' | 'weight' | 'bias' | 'readiness'

export interface MicroIntervention {
  estimated_minutes: number
  steps: string[]
}

export interface GuidanceAction {
  label: string
  onClick: () => void
}

export interface GuidanceItem {
  id: string
  type: GuidanceType
  severity: GuidanceSeverity
  title: string
  message: string
  action?: GuidanceAction
  affectedNodes?: string[]
  affectedEdges?: string[]
  microIntervention?: MicroIntervention
  // Weight suggestion fields
  currentValue?: number
  suggestedValue?: number
  reason?: string
  // Auto-fix support
  code?: string
  auto_fixable?: boolean
  suggested_fix?: string
  // Readiness improvement fields
  effortMinutes?: number
  suggestedNodeType?: string
}

export type AutoFixStatus = 'idle' | 'fixing' | 'success' | 'error'

interface GuidanceCardProps {
  item: GuidanceItem
  onClick?: () => void
  onAutoFix?: (item: GuidanceItem) => Promise<boolean>
  autoFixStatus?: AutoFixStatus
}

// Severity styles with left border for visual hierarchy
const severityStyles: Record<GuidanceSeverity, string> = {
  blocker: 'border-l-4 border-l-carrot-500 border border-carrot-200 bg-paper-50',
  warning: 'border-l-4 border-l-banana-500 border border-banana-200 bg-paper-50',
  info: 'border-l-4 border-l-sky-500 border border-sky-200 bg-sky-50',
}

const typeIcons: Record<GuidanceType, typeof Lightbulb> = {
  coaching: Lightbulb,
  validation: AlertTriangle,
  weight: TrendingUp,
  bias: Brain,
  readiness: TrendingUp,
}

const typeIconColors: Record<GuidanceType, string> = {
  coaching: 'text-sun-600',
  validation: 'text-carrot-600',
  weight: 'text-sky-600',
  bias: 'text-purple-600',
  readiness: 'text-mint-600',
}

// Type badge styles
const typeBadgeStyles: Record<GuidanceType, string> = {
  coaching: 'bg-sun-100 text-sun-800',
  validation: 'bg-carrot-100 text-carrot-800',
  weight: 'bg-sky-100 text-sky-800',
  bias: 'bg-purple-100 text-purple-800',
  readiness: 'bg-mint-100 text-mint-800',
}

// Human-readable type labels
const typeLabels: Record<GuidanceType, string> = {
  coaching: 'Coaching',
  validation: 'Validation',
  weight: 'Weight',
  bias: 'Bias',
  readiness: 'Improve',
}

export function GuidanceCard({ item, onClick, onAutoFix, autoFixStatus = 'idle' }: GuidanceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = typeIcons[item.type]
  const hasAffectedElements = (item.affectedNodes?.length ?? 0) + (item.affectedEdges?.length ?? 0) > 0
  const canAutoFix = item.auto_fixable && onAutoFix && autoFixStatus !== 'success'

  return (
    <div
      className={`p-4 rounded-xl cursor-pointer hover:shadow-md transition-all ${severityStyles[item.severity]}`}
      onClick={onClick}
      role="article"
      aria-label={`${item.type} guidance: ${item.title}`}
    >
      <div className="flex items-start gap-4">
        <Icon
          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${typeIconColors[item.type]}`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          {/* Type badge + title row */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadgeStyles[item.type]}`}
            >
              {typeLabels[item.type]}
            </span>
          </div>

          {/* Title - bolder for hierarchy */}
          <h4 className={`${typography.body} font-bold mb-1 text-ink-900`}>
            {item.title}
          </h4>

          {/* Message */}
          <p className={`${typography.bodySmall} text-ink-700 mb-3`}>
            {item.message}
          </p>

          {/* Weight suggestion details (current vs suggested) */}
          {item.type === 'weight' && (item.currentValue !== undefined || item.suggestedValue !== undefined) && (
            <div className="mb-3 p-3 bg-paper-50 border border-sand-200 rounded-lg">
              <div className="flex items-center justify-between gap-4 mb-1">
                {item.currentValue !== undefined && (
                  <div className={typography.caption}>
                    <span className="text-ink-500">Current:</span>{' '}
                    <span className="font-semibold text-ink-800">{item.currentValue.toFixed(2)}</span>
                  </div>
                )}
                {item.suggestedValue !== undefined && (
                  <div className={typography.caption}>
                    <span className="text-ink-500">Suggested:</span>{' '}
                    <span className="font-semibold text-sky-700">{item.suggestedValue.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {item.reason && (
                <p className={`${typography.caption} text-ink-600 mt-1`}>
                  {item.reason}
                </p>
              )}
            </div>
          )}

          {/* Affected elements indicator */}
          {hasAffectedElements && (
            <div className="flex items-center gap-1 mb-3 text-ink-500">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span className={`${typography.caption}`}>
                {item.affectedNodes?.length ?? 0} node{(item.affectedNodes?.length ?? 0) !== 1 ? 's' : ''}
                {(item.affectedEdges?.length ?? 0) > 0 && (
                  <>, {item.affectedEdges?.length} edge{(item.affectedEdges?.length ?? 0) !== 1 ? 's' : ''}</>
                )}
                {' '}affected
                <span className="text-sky-600 ml-1">• Click to focus</span>
              </span>
            </div>
          )}

          {/* Micro-intervention expandable section */}
          {item.microIntervention && (
            <div className="mb-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                className={`${typography.bodySmall} flex items-center gap-1 font-medium text-ink-600 hover:text-ink-900`}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Fix in {item.microIntervention.estimated_minutes} minute
                {item.microIntervention.estimated_minutes !== 1 ? 's' : ''}
              </button>
              {isExpanded && (
                <ol className="mt-2 ml-6 text-ink-600 list-decimal space-y-2">
                  {item.microIntervention.steps.map((step, i) => (
                    <li key={i} className={typography.bodySmall}>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Custom action button */}
            {item.action && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  item.action?.onClick()
                }}
                className={`${typography.bodySmall} px-3 py-1.5 rounded-lg font-medium bg-sky-500 text-white hover:bg-sky-600 transition-colors`}
              >
                {item.action.label}
              </button>
            )}

            {/* Auto-fix button for validation issues */}
            {canAutoFix && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAutoFix?.(item)
                }}
                disabled={autoFixStatus === 'fixing'}
                className={`${typography.bodySmall} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  autoFixStatus === 'fixing'
                    ? 'bg-sand-200 text-ink-500 cursor-not-allowed'
                    : 'bg-mint-500 text-white hover:bg-mint-600'
                }`}
                aria-label="Auto-fix this issue"
              >
                {autoFixStatus === 'fixing' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                    Auto-fix
                  </>
                )}
              </button>
            )}

            {/* Success indicator */}
            {autoFixStatus === 'success' && (
              <span className={`${typography.caption} inline-flex items-center gap-1 text-mint-700`}>
                <CheckCircle className="w-4 h-4" aria-hidden="true" />
                Fixed
              </span>
            )}
          </div>

          {/* Suggested fix hint */}
          {item.suggested_fix && (
            <p className={`${typography.caption} text-ink-500 mt-2 italic`}>
              Suggested: {item.suggested_fix}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

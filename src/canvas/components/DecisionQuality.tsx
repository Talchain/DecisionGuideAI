/**
 * DecisionQuality - Decision quality indicator based on CEE readiness
 *
 * Shows the decision quality status using CEE readiness data:
 * - Ready: High confidence in recommendation
 * - Caution: Some concerns to address
 * - Not Ready: Significant issues blocking reliable analysis
 *
 * Falls back to graph_quality-based assessment when CEE unavailable.
 */

import { useState } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import { getReadiness, type ReadinessData } from '../utils/ceeDataAdapter'
import type { CeeDecisionReviewPayloadV1 } from '../../types/cee'
import type { ReportV1 } from '../../adapters/plot/types'

interface DecisionQualityProps {
  /** CEE V1 review data */
  ceeReviewV1?: CeeDecisionReviewPayloadV1 | null
  /** PLoT report for fallback */
  report?: ReportV1 | null
  /** Start expanded */
  defaultExpanded?: boolean
}

// Visual config for each readiness level
const readinessConfig = {
  ready: {
    icon: CheckCircle,
    bgColor: 'bg-mint-50',
    textColor: 'text-mint-700',
    iconColor: 'text-mint-600',
    borderColor: 'border-mint-200',
    label: 'Ready',
    badgeColor: 'bg-mint-100 text-mint-700',
  },
  caution: {
    icon: AlertTriangle,
    bgColor: 'bg-banana-50',
    textColor: 'text-banana-700',
    iconColor: 'text-banana-600',
    borderColor: 'border-banana-200',
    label: 'Caution',
    badgeColor: 'bg-banana-100 text-banana-700',
  },
  not_ready: {
    icon: XCircle,
    bgColor: 'bg-carrot-50',
    textColor: 'text-carrot-700',
    iconColor: 'text-carrot-600',
    borderColor: 'border-carrot-200',
    label: 'Not Ready',
    badgeColor: 'bg-carrot-100 text-carrot-700',
  },
} as const

// Visual config for factor status
const factorStatusConfig = {
  ok: {
    icon: CheckCircle,
    color: 'text-mint-600',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-banana-600',
  },
  blocking: {
    icon: XCircle,
    color: 'text-carrot-600',
  },
} as const

export function DecisionQuality({
  ceeReviewV1,
  report,
  defaultExpanded = false,
}: DecisionQualityProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Get readiness data (with fallback to graph_quality)
  const readiness: ReadinessData = getReadiness(ceeReviewV1, report)

  const config = readinessConfig[readiness.level]
  const LevelIcon = config.icon

  // Count factors by status
  const statusCounts = readiness.factors.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const hasIssues = (statusCounts.warning || 0) + (statusCounts.blocking || 0) > 0

  return (
    <div
      className={`rounded-xl border ${config.borderColor} overflow-hidden`}
      data-testid="decision-quality"
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center justify-between ${config.bgColor} hover:opacity-90 transition-opacity`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <Shield className="h-4 w-4 text-ink-600" aria-hidden="true" />
          <span className={`${typography.body} font-medium text-ink-800`}>
            Decision Quality
          </span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <LevelIcon className={`h-4 w-4 ${config.iconColor}`} aria-hidden="true" />
          <span
            className={`${typography.caption} px-2 py-0.5 rounded-full font-medium ${config.badgeColor}`}
          >
            {config.label}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="bg-paper-50 border-t border-sand-200 px-4 py-4 space-y-4">
          {/* Headline */}
          <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
            <div className="flex items-start gap-3">
              <LevelIcon
                className={`h-5 w-5 ${config.iconColor} flex-shrink-0 mt-0.5`}
                aria-hidden="true"
              />
              <p className={`${typography.body} ${config.textColor}`}>
                {readiness.headline}
              </p>
            </div>
          </div>

          {/* Factors list */}
          {readiness.factors.length > 0 && (
            <div className="space-y-2">
              <p
                className={`${typography.caption} font-medium text-ink-600 uppercase tracking-wide`}
              >
                Quality Factors
              </p>
              <div className="space-y-1.5">
                {readiness.factors.map((factor, idx) => {
                  const statusConf = factorStatusConfig[factor.status]
                  const StatusIcon = statusConf.icon
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 py-1"
                    >
                      <StatusIcon
                        className={`h-4 w-4 ${statusConf.color} flex-shrink-0`}
                        aria-hidden="true"
                      />
                      <span className={`${typography.bodySmall} text-ink-700`}>
                        {factor.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Source attribution */}
          <p className={`${typography.caption} text-ink-400`}>
            {readiness.source === 'cee'
              ? 'Based on AI analysis'
              : 'Based on model structure'}
          </p>
        </div>
      )}
    </div>
  )
}

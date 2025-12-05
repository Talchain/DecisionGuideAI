/**
 * UnifiedStatusBadge Component (Quick Win #1)
 *
 * Single clear status message combining quality score and confidence.
 * Replaces contradictory dual status display.
 *
 * Shows:
 * - Ready to Review (quality >= 0.7 AND confidence >= 0.7)
 * - Ready with Caveats (quality >= 0.5 OR confidence >= 0.4)
 * - Needs Improvement (below thresholds)
 */

import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'
import type { DecisionReadiness } from '../../types/plot'
import type { GraphQuality } from '../../types/plot'

interface UnifiedStatusBadgeProps {
  /** Decision readiness data */
  readiness?: DecisionReadiness | null
  /** Graph quality data */
  quality?: GraphQuality | null
  /** Confidence score (0-1) */
  confidenceScore?: number
  /** Start expanded */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
}

type StatusVariant = 'success' | 'warning' | 'error'

interface UnifiedStatus {
  icon: typeof CheckCircle2
  label: string
  variant: StatusVariant
  confidence: string
  confidenceScore: number
  details: string[]
}

function getUnifiedStatus(
  readiness?: DecisionReadiness | null,
  quality?: GraphQuality | null,
  confidenceScore?: number
): UnifiedStatus {
  // Calculate effective scores
  const qualityScore = quality?.score ?? 0
  const confScore = confidenceScore ?? (readiness?.confidence === 'high' ? 0.8 : readiness?.confidence === 'medium' ? 0.5 : 0.3)

  // Collect details for expanded view
  const details: string[] = []

  if (quality) {
    details.push(`Model quality: ${Math.round(qualityScore * 100)}%`)
    if (quality.issues_count > 0) {
      details.push(`${quality.issues_count} issue${quality.issues_count !== 1 ? 's' : ''} detected`)
    }
    if (quality.recommendation) {
      details.push(quality.recommendation)
    }
  }

  if (readiness) {
    readiness.blockers.forEach(b => details.push(`⛔ ${b}`))
    readiness.warnings.forEach(w => details.push(`⚠️ ${w}`))
  }

  // Ready to Review: high quality AND high confidence
  if (qualityScore >= 0.7 && confScore >= 0.7) {
    return {
      icon: CheckCircle2,
      label: 'Ready to Review',
      variant: 'success',
      confidence: 'High Confidence',
      confidenceScore: Math.round(confScore * 100),
      details: details.length > 0 ? details : ['Model is ready for decision-making'],
    }
  }

  // Ready with Caveats: moderate quality OR moderate confidence
  if (qualityScore >= 0.5 || confScore >= 0.4) {
    return {
      icon: AlertTriangle,
      label: 'Ready with Caveats',
      variant: 'warning',
      confidence: confScore >= 0.6 ? 'Medium-High Confidence' : 'Medium Confidence',
      confidenceScore: Math.round(confScore * 100),
      details: details.length > 0 ? details : ['Review key assumptions before proceeding'],
    }
  }

  // Needs Improvement: below thresholds
  return {
    icon: XCircle,
    label: 'Needs Improvement',
    variant: 'error',
    confidence: 'Low Confidence',
    confidenceScore: Math.round(confScore * 100),
    details: details.length > 0 ? details : ['Add more factors or evidence to improve analysis'],
  }
}

const VARIANT_STYLES: Record<StatusVariant, { container: string; text: string; icon: string }> = {
  success: {
    container: 'border-sand-200 bg-paper-50',
    text: 'text-green-700',
    icon: 'text-green-600',
  },
  warning: {
    container: 'border-sand-200 bg-paper-50',
    text: 'text-amber-700',
    icon: 'text-amber-600',
  },
  error: {
    container: 'border-sand-200 bg-paper-50',
    text: 'text-red-700',
    icon: 'text-red-600',
  },
}

export function UnifiedStatusBadge({
  readiness,
  quality,
  confidenceScore,
  defaultExpanded = false,
  className = '',
}: UnifiedStatusBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const status = getUnifiedStatus(readiness, quality, confidenceScore)
  const styles = VARIANT_STYLES[status.variant]
  const Icon = status.icon

  const hasDetails = status.details.length > 0

  return (
    <div
      className={`rounded-lg border ${styles.container} ${className}`}
      data-testid="unified-status-badge"
    >
      {/* Main status header */}
      <Tooltip
        content={`${status.label}: ${status.confidence} (${status.confidenceScore}%)`}
        position="bottom"
      >
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5"
          onClick={() => hasDetails && setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          disabled={!hasDetails}
        >
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${styles.icon}`} aria-hidden="true" />

            {/* Single unified status message */}
            <div className="flex items-center gap-2">
              <span
                className={`${typography.label} ${styles.text} font-semibold`}
                role="status"
              >
                {status.label}
              </span>
              <span className={`${typography.caption} ${styles.text} opacity-80`}>
                |
              </span>
              <span className={`${typography.caption} ${styles.text}`}>
                {status.confidence} ({status.confidenceScore}%)
              </span>
            </div>
          </div>

          {/* Expand/collapse chevron */}
          {hasDetails && (
            <span className="text-ink-900/40">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </span>
          )}
        </button>
      </Tooltip>

      {/* Expandable details */}
      {hasDetails && isExpanded && (
        <div
          className="px-3 pb-3 border-t border-current/10"
          data-testid="unified-status-details"
        >
          <ul className="pt-2 space-y-1 list-none">
            {status.details.map((detail, index) => (
              <li
                key={index}
                className={`${typography.bodySmall} ${styles.text} opacity-80`}
              >
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Compact variant for inline use
 */
export function UnifiedStatusBadgeCompact({
  readiness,
  quality,
  confidenceScore,
  className = '',
}: Omit<UnifiedStatusBadgeProps, 'defaultExpanded'>) {
  const status = getUnifiedStatus(readiness, quality, confidenceScore)
  const styles = VARIANT_STYLES[status.variant]
  const Icon = status.icon

  return (
    <Tooltip
      content={`${status.label}: ${status.confidence} (${status.confidenceScore}%)`}
      position="bottom"
    >
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${styles.container} ${className}`}
        role="status"
        data-testid="unified-status-compact"
      >
        <Icon className={`w-4 h-4 ${styles.icon}`} aria-hidden="true" />
        <span className={`${typography.labelSmall} ${styles.text} font-medium`}>
          {status.label}
        </span>
        <span className={`${typography.caption} ${styles.text} opacity-70`}>
          ({status.confidenceScore}%)
        </span>
      </div>
    </Tooltip>
  )
}

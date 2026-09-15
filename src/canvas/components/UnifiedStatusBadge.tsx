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

/** ⭐ `neutral` added 15 Sep: "we have not been told" is a real state and needs
 *  a look that is neither a pass nor a failure. */
type StatusVariant = 'success' | 'warning' | 'error' | 'neutral'

interface UnifiedStatus {
  icon: typeof CheckCircle2
  label: string
  variant: StatusVariant
  confidence: string
  details: string[]
}

// Audit F-57: Removed UI-SEM-018 numeric confidence score fabrication (F.6 violation).
// Status is now derived from quality score (numeric, from PLoT) and categorical confidence
// level (from readiness). No numeric scores are fabricated from categorical labels.

/** Map categorical confidence to a status tier without fabricating a number. */
type ConfidenceTier = 'high' | 'medium' | 'low'

function resolveConfidenceTier(
  readiness?: DecisionReadiness | null,
  confidenceScore?: number,
): ConfidenceTier {
  // If a real numeric score was provided, derive tier from it
  if (confidenceScore !== undefined) {
    if (confidenceScore >= 0.7) return 'high'
    if (confidenceScore >= 0.4) return 'medium'
    return 'low'
  }
  // Otherwise use the categorical label directly
  const level = readiness?.confidence
  if (level === 'high') return 'high'
  if (level === 'medium') return 'medium'
  return 'low'
}

function getUnifiedStatus(
  readiness?: DecisionReadiness | null,
  quality?: GraphQuality | null,
  confidenceScore?: number
): UnifiedStatus {
  const qualityScore = quality?.score ?? 0
  const confTier = resolveConfidenceTier(readiness, confidenceScore)

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
  /**
   * ⭐⭐ THE VERDICT IS THE PRODUCER'S, NOT A THRESHOLD THIS FILE CHOSE.
   *
   * It read `qualityScore >= 0.7` / `>= 0.5` — two numbers invented here — and
   * told the user whether their model was "Ready to Review". Founder's rule,
   * 15 Sep: the UI renders the data; it does not decide what it means. A
   * readiness verdict is exactly the kind of claim the producer already makes.
   *
   * `readiness.blockers` and `readiness.warnings` ARE that statement, and they
   * were already being read two lines above to fill `details` — the label just
   * wasn't using them. Identity on a producer field, not arithmetic on a score.
   *
   * ⚠ `confTier` STAYS, and my first cut wrongly removed it. It is a PRODUCER
   * field compared by IDENTITY (`=== 'high'`), which is the permitted form —
   * the rule forbids computing words from numbers, not reading a producer's own
   * verdict. Dropping it made a low-confidence model read "Ready to Review",
   * and the existing spec caught it.
   */
  const hasBlockers = (readiness?.blockers?.length ?? 0) > 0
  const hasWarnings = (readiness?.warnings?.length ?? 0) > 0

  if (readiness && !hasBlockers && !hasWarnings && confTier === 'high') {
    return {
      icon: CheckCircle2,
      label: 'Ready to Review',
      variant: 'success',
      confidence: 'High Confidence',
      details: details.length > 0 ? details : ['Model is ready for decision-making'],
    }
  }

  // Ready with Caveats: moderate quality OR medium+ confidence
  if (readiness && !hasBlockers && confTier !== 'low') {
    return {
      icon: AlertTriangle,
      label: 'Ready with Caveats',
      variant: 'warning',
      confidence: confTier === 'high' ? 'Medium-High Confidence' : 'Medium Confidence',
      details: details.length > 0 ? details : ['Review key assumptions before proceeding'],
    }
  }

  // Needs Improvement: below thresholds
  /**
   * ⛔ ABSENCE IS A STATE, NOT A VERDICT. With no `readiness` from the producer
   * this used to fall through to "Needs Improvement" — a negative judgement
   * about the user's model, issued because we had been told NOTHING. That is
   * the same defect as the thresholds above, one step further along: an
   * unanswered question rendered as an answer.
   */
  if (!readiness) {
    return {
      icon: AlertTriangle,
      label: 'Not yet checked',
      variant: 'neutral',
      confidence: 'Not assessed',
      details: details.length > 0 ? details : ['Run the analysis to see how this model holds up'],
    }
  }

  return {
    icon: XCircle,
    label: 'Needs Improvement',
    variant: 'error',
    confidence: 'Low Confidence',
    details: details.length > 0 ? details : ['Add more factors or evidence to improve analysis'],
  }
}

const VARIANT_STYLES: Record<StatusVariant, { container: string; text: string; icon: string }> = {
  neutral: {
    container: 'bg-panel-hover border-panel-border',
    text: 'text-text-light',
    icon: 'text-text-light',
  },
  success: {
    container: 'border-sand-200 bg-paper-50',
    text: 'text-success',
    icon: 'text-success',
  },
  warning: {
    container: 'border-sand-200 bg-paper-50',
    text: 'text-warning',
    icon: 'text-warning',
  },
  error: {
    container: 'border-sand-200 bg-paper-50',
    text: 'text-danger',
    icon: 'text-danger',
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
        content={`${status.label}: ${status.confidence}`}
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
                {status.confidence}
              </span>
            </div>
          </div>

          {/* Expand/collapse chevron */}
          {hasDetails && (
            <span className="text-ink-900">
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
      content={`${status.label}: ${status.confidence}`}
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
          {status.confidence}
        </span>
      </div>
    </Tooltip>
  )
}

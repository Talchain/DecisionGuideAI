/**
 * DecisionReadinessBadge Component (Sprint N - P0)
 *
 * Primary go/no-go signal for decision readiness.
 * Composes IdentifiabilityBadge and EvidenceCoverageCompact for consistency.
 *
 * Shows:
 * - Ready/Not Ready main status
 * - Confidence level (high/medium/low)
 * - Blockers: Hard gates that must be fixed
 * - Warnings: Advisory items to review
 * - Passed: Checks that succeeded
 */

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'
import { IdentifiabilityBadge, type IdentifiabilityStatus } from './IdentifiabilityBadge'
import { EvidenceCoverageCompact } from './EvidenceCoverage'
import type { DecisionReadiness } from '../../types/plot'
import type { ConfidenceLevel } from '../../adapters/plot/types'

/**
 * Sprint N P1: Map confidence.level from backend to DecisionReadiness
 * Backend does NOT return decision_readiness - we derive it from confidence.level
 *
 * @param confidence - Backend confidence object with level and optional score
 * @returns DecisionReadiness object or null if no confidence data
 */
export function mapConfidenceToReadiness(
  confidence?: { level?: string; score?: number; why?: string }
): DecisionReadiness | null {
  if (!confidence?.level) return null

  const level = confidence.level.toUpperCase()
  const normalizedConfidence = (confidence.level.toLowerCase() || 'medium') as 'high' | 'medium' | 'low'

  return {
    ready: level === 'HIGH',
    confidence: normalizedConfidence,
    blockers: level === 'LOW'
      ? ['Low confidence analysis - add more factors or evidence']
      : [],
    warnings: level === 'MEDIUM'
      ? ['Medium confidence - consider reviewing key factors and assumptions']
      : [],
    passed: level === 'HIGH'
      ? ['High confidence analysis - model is ready for decision-making']
      : level === 'MEDIUM'
        ? ['Model structure is valid']
        : [],
  }
}

interface DecisionReadinessBadgeProps {
  /** Decision readiness data from engine response */
  readiness: DecisionReadiness
  /** Identifiability status to compose (optional) */
  identifiability?: IdentifiabilityStatus
  /** Evidence coverage to compose (optional) */
  evidenceCoverage?: {
    evidencedCount: number
    totalCount: number
  }
  /** Start expanded */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
}

const CONFIDENCE_CONFIG: Record<
  DecisionReadiness['confidence'],
  {
    label: string
    className: string
  }
> = {
  high: {
    label: 'High Confidence',
    className: 'text-green-700 bg-green-50',
  },
  medium: {
    label: 'Medium Confidence',
    className: 'text-amber-700 bg-amber-50',
  },
  low: {
    label: 'Low Confidence',
    className: 'text-red-700 bg-red-50',
  },
}

export function DecisionReadinessBadge({
  readiness,
  identifiability,
  evidenceCoverage,
  defaultExpanded = false,
  className = '',
}: DecisionReadinessBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const { ready, confidence, blockers, warnings, passed } = readiness
  // P2.2: Defensive fallback for invalid confidence values
  const confidenceConfig = CONFIDENCE_CONFIG[confidence] ?? CONFIDENCE_CONFIG.medium

  const hasDetails = blockers.length > 0 || warnings.length > 0 || passed.length > 0

  const mainTooltip = ready
    ? 'Model is ready for decision-making'
    : `Model not ready: ${blockers.length} blocker(s) must be addressed`

  return (
    <div
      className={`rounded-lg border ${
        ready
          ? 'border-green-200 bg-green-50/50'
          : 'border-red-200 bg-red-50/50'
      } ${className}`}
      data-testid="decision-readiness-badge"
    >
      {/* Header - Always visible */}
      <Tooltip content={mainTooltip} position="bottom">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-3 py-2"
          onClick={() => hasDetails && setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="readiness-details"
          disabled={!hasDetails}
        >
          <div className="flex items-center gap-2">
            {/* Ready/Not Ready indicator */}
            {ready ? (
              <CheckCircle2
                className="w-5 h-5 text-green-600"
                aria-hidden="true"
              />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
            )}
            <span
              className={`${typography.label} ${
                ready ? 'text-green-700' : 'text-red-700'
              }`}
              role="status"
              aria-label={`Decision readiness: ${ready ? 'Ready' : 'Not Ready'}`}
            >
              {ready ? 'Ready' : 'Not Ready'}
            </span>

            {/* Confidence pill */}
            <span
              className={`${typography.caption} px-2 py-0.5 rounded-full ${confidenceConfig.className}`}
              data-testid="confidence-indicator"
            >
              {confidenceConfig.label}
            </span>
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

      {/* Composed badges row */}
      {(identifiability || evidenceCoverage) && (
        <div className="flex items-center gap-2 px-3 pb-2 border-t border-current/10">
          <span className={`${typography.caption} text-ink-900/50 pt-2`}>
            Model checks:
          </span>
          <div className="flex items-center gap-2 pt-2">
            {identifiability && (
              <IdentifiabilityBadge status={identifiability} />
            )}
            {evidenceCoverage && (
              <EvidenceCoverageCompact
                evidencedCount={evidenceCoverage.evidencedCount}
                totalCount={evidenceCoverage.totalCount}
              />
            )}
          </div>
        </div>
      )}

      {/* Expandable details */}
      {hasDetails && isExpanded && (
        <div
          id="readiness-details"
          className="px-3 pb-3 space-y-2 border-t border-current/10"
          data-testid="readiness-details"
        >
          {/* Blockers */}
          {blockers.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <XCircle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span className={`${typography.labelSmall} text-red-700`}>
                  Blockers ({blockers.length})
                </span>
              </div>
              <ul
                className="space-y-1 pl-5"
                role="list"
                aria-label="Blockers that must be fixed"
                data-testid="blockers-list"
              >
                {blockers.map((blocker, index) => (
                  <li
                    key={index}
                    className={`${typography.bodySmall} text-red-700 list-disc`}
                  >
                    {blocker}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle
                  className="w-3.5 h-3.5 text-amber-600"
                  aria-hidden="true"
                />
                <span className={`${typography.labelSmall} text-amber-700`}>
                  Warnings ({warnings.length})
                </span>
              </div>
              <ul
                className="space-y-1 pl-5"
                role="list"
                aria-label="Warnings to review"
                data-testid="warnings-list"
              >
                {warnings.map((warning, index) => (
                  <li
                    key={index}
                    className={`${typography.bodySmall} text-amber-700 list-disc`}
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Passed checks */}
          {passed.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-green-600"
                  aria-hidden="true"
                />
                <span className={`${typography.labelSmall} text-green-700`}>
                  Passed ({passed.length})
                </span>
              </div>
              <ul
                className="space-y-1 pl-5"
                role="list"
                aria-label="Checks that passed"
                data-testid="passed-list"
              >
                {passed.map((check, index) => (
                  <li
                    key={index}
                    className={`${typography.bodySmall} text-green-700 list-disc`}
                  >
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Compact variant for inline use (header bar, summary views)
 */
export function DecisionReadinessBadgeCompact({
  readiness,
  className = '',
}: Pick<DecisionReadinessBadgeProps, 'readiness' | 'className'>) {
  const { ready, confidence, blockers } = readiness

  const tooltipContent = ready
    ? `Ready for decision (${confidence} confidence)`
    : `Not ready: ${blockers.length} blocker(s)`

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
          ready
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        } ${className}`}
        role="status"
        aria-label={`Decision readiness: ${ready ? 'Ready' : 'Not Ready'}`}
        data-testid="decision-readiness-compact"
      >
        {ready ? (
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span className={`${typography.labelSmall} font-medium`}>
          {ready ? 'Ready' : 'Not Ready'}
        </span>
        {!ready && blockers.length > 0 && (
          <span className={`${typography.code} tabular-nums`}>
            ({blockers.length})
          </span>
        )}
      </div>
    </Tooltip>
  )
}

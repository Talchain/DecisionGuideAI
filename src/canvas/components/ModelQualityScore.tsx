/**
 * ModelQualityScore Component (Sprint N - P0)
 *
 * Displays the engine's assessment of model quality.
 * This is different from graphHealth (structural health) - this is the
 * engine's holistic assessment of completeness, evidence coverage, and balance.
 *
 * Shows:
 * - Overall score (0.00-1.00 as percentage)
 * - Sub-metrics: completeness, evidence_coverage, balance
 * - Issues count
 * - Optional recommendation
 */

import { useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
} from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'
import type { GraphQuality } from '../../types/plot'

interface ModelQualityScoreProps {
  /** Graph quality data from engine response (nullable for no-data state) */
  quality: GraphQuality | null | undefined
  /** Start expanded to show sub-metrics */
  defaultExpanded?: boolean
  /** Local edge provenance counts (optional supplement to engine data) */
  localEvidenceCounts?: {
    evidenced: number
    total: number
  }
  /** Additional CSS classes */
  className?: string
}

/**
 * Get color class based on score threshold
 * >= 0.8: green (good)
 * >= 0.6: amber (needs work)
 * < 0.6: red (poor)
 */
function getScoreColor(score: number): {
  text: string
  bg: string
  border: string
  progress: string
} {
  // Use paper-50 background for all states - semantic colors only for text/icons
  if (score >= 0.8) {
    return {
      text: 'text-green-700',
      bg: 'bg-paper-50',
      border: 'border-sand-200',
      progress: 'bg-green-500',
    }
  }
  if (score >= 0.6) {
    return {
      text: 'text-amber-700',
      bg: 'bg-paper-50',
      border: 'border-sand-200',
      progress: 'bg-amber-500',
    }
  }
  return {
    text: 'text-red-700',
    bg: 'bg-paper-50',
    border: 'border-sand-200',
    progress: 'bg-red-500',
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

interface MetricRowProps {
  label: string
  value: number
  tooltip: string
}

function MetricRow({ label, value, tooltip }: MetricRowProps) {
  const colors = getScoreColor(value)

  return (
    <Tooltip content={tooltip} position="right">
      <div className="flex items-center justify-between gap-3 py-1">
        <span className={`${typography.bodySmall} text-ink-900/70`}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {/* Mini progress bar - P1.7: Added aria-valuetext */}
          <div
            className="h-1.5 w-16 bg-sand-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(value * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${label}: ${formatPercent(value)}`}
          >
            <div
              className={`h-full ${colors.progress} transition-all duration-300`}
              style={{ width: `${value * 100}%` }}
            />
          </div>
          <span className={`${typography.code} tabular-nums ${colors.text}`}>
            {formatPercent(value)}
          </span>
        </div>
      </div>
    </Tooltip>
  )
}

export function ModelQualityScore({
  quality,
  defaultExpanded = false,
  localEvidenceCounts,
  className = '',
}: ModelQualityScoreProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Phase 3: No-data state
  if (!quality) {
    return (
      <div
        className={`rounded-lg border border-sand-200 bg-paper-50 ${className}`}
        data-testid="model-quality-score-empty"
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex items-center gap-2">
            <Activity
              className="w-5 h-5 text-sand-400"
              aria-hidden="true"
            />
            <span className={`${typography.label} text-sand-500`}>
              Model Quality
            </span>
          </div>
          <span className={`${typography.body} text-sand-400`}>
            —
          </span>
        </div>
        <div className="px-3 pb-2">
          <p className={`${typography.caption} text-sand-500`}>
            Run analysis to see quality metrics
          </p>
        </div>
      </div>
    )
  }

  const {
    score,
    completeness,
    evidence_coverage,
    balance,
    issues_count,
    recommendation,
  } = quality

  // Compute local evidence coverage percentage when counts are provided
  const localEvidencePercent = localEvidenceCounts && localEvidenceCounts.total > 0
    ? localEvidenceCounts.evidenced / localEvidenceCounts.total
    : null

  const colors = getScoreColor(score)
  const hasRecommendation = recommendation && recommendation.length > 0

  const tooltipContent = `Model quality: ${formatPercent(score)}. ${
    issues_count > 0 ? `${issues_count} issue(s) detected.` : 'No issues.'
  }`

  return (
    <div
      className={`rounded-lg border ${colors.border} ${colors.bg} ${className}`}
      data-testid="model-quality-score"
    >
      {/* Header - Always visible */}
      <Tooltip content={tooltipContent} position="bottom">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-3 py-2"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="quality-details"
        >
          <div className="flex items-center gap-2">
            <Activity
              className={`w-5 h-5 ${colors.text}`}
              aria-hidden="true"
            />
            <span className={`${typography.label} ${colors.text}`}>
              Model Quality
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Main score display - P1.7: Added aria-live for score updates */}
            <span
              className={`${typography.h4} tabular-nums ${colors.text}`}
              role="status"
              aria-live="polite"
              aria-label={`Model quality score: ${formatPercent(score)}`}
              data-testid="quality-score"
            >
              {formatPercent(score)}
            </span>

            {/* Issues badge */}
            {issues_count > 0 && (
              <span
                className={`${typography.caption} px-1.5 py-0.5 rounded bg-red-100 text-red-700`}
                data-testid="issues-count"
              >
                {issues_count} issue{issues_count !== 1 ? 's' : ''}
              </span>
            )}

            {/* Expand/collapse chevron */}
            <span className="text-ink-900/40">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </span>
          </div>
        </button>
      </Tooltip>

      {/* Expandable details */}
      {isExpanded && (
        <div
          id="quality-details"
          className="px-3 pb-3 border-t border-current/10"
          data-testid="quality-details"
        >
          {/* Sub-metrics */}
          <div className="pt-2 space-y-0.5">
            <MetricRow
              label="Completeness"
              value={completeness}
              tooltip="How complete is the model structure? Are all necessary nodes and edges present?"
            />
            <MetricRow
              label="Evidence Coverage"
              value={evidence_coverage}
              tooltip={localEvidenceCounts
                ? `${localEvidenceCounts.evidenced} of ${localEvidenceCounts.total} edges have documented evidence sources`
                : "What percentage of relationships have supporting evidence?"
              }
            />
            {/* Show local evidence count detail when available */}
            {localEvidenceCounts && localEvidenceCounts.total > 0 && (
              <div className={`flex items-center justify-between py-0.5 pl-4 ${typography.caption} text-ink-900/60`}>
                <span>{localEvidenceCounts.evidenced}/{localEvidenceCounts.total} edges documented</span>
                {localEvidencePercent !== null && Math.abs(localEvidencePercent - evidence_coverage) > 0.05 && (
                  <span className="text-amber-600" title="Local count differs from engine assessment">
                    (local: {formatPercent(localEvidencePercent)})
                  </span>
                )}
              </div>
            )}
            <MetricRow
              label="Balance"
              value={balance}
              tooltip="Are pro and con factors evenly represented? Unbalanced models may be biased."
            />
          </div>

          {/* Recommendation */}
          {hasRecommendation && (
            <div
              className="mt-3 pt-2 border-t border-current/10"
              data-testid="quality-recommendation"
            >
              <div className="flex items-start gap-2">
                <Lightbulb
                  className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span className={`${typography.bodySmall} text-ink-900/80`}>
                  {recommendation}
                </span>
              </div>
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
export function ModelQualityScoreCompact({
  quality,
  className = '',
}: Pick<ModelQualityScoreProps, 'quality' | 'className'>) {
  // Phase 3: No-data state for compact variant
  if (!quality) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-sand-200 bg-paper-50 text-sand-400 ${className}`}
        role="status"
        aria-label="Model quality: not available"
        data-testid="model-quality-compact-empty"
      >
        <Activity className="w-3.5 h-3.5" aria-hidden="true" />
        <span className={`${typography.labelSmall} font-medium`}>
          —
        </span>
      </div>
    )
  }

  const { score, issues_count } = quality
  const colors = getScoreColor(score)

  const tooltipContent = `Model quality: ${formatPercent(score)}${
    issues_count > 0 ? ` (${issues_count} issues)` : ''
  }`

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colors.border} ${colors.bg} ${colors.text} ${className}`}
        role="status"
        aria-label={`Model quality: ${formatPercent(score)}`}
        data-testid="model-quality-compact"
      >
        <Activity className="w-3.5 h-3.5" aria-hidden="true" />
        <span className={`${typography.labelSmall} font-medium tabular-nums`}>
          {formatPercent(score)}
        </span>
        {issues_count > 0 && (
          <span
            className={`${typography.caption} px-1 py-0.5 rounded bg-red-200/50 text-red-700`}
          >
            {issues_count}
          </span>
        )}
      </div>
    </Tooltip>
  )
}

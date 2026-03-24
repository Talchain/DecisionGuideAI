/**
 * StickyFooter - 48px bar pinned to bottom of panel
 *
 * Left: CheckCircle/XCircle/Loader icon + "Ready"/"Blocked"/"Checking"
 *       · X/Y reviewed (with source-distribution tooltip)
 * Right: CTA button(s)
 *   - Primary: "Analyse Now" (brand green, pill shape)
 *   - Retry: "Retry Draft" appears when blocked due to incomplete draft
 *   - States: "Checking..." → "Fix N issues" → "Retry Draft" → "Analyse Now" → "Analysing..."
 *
 * Source-distribution tooltip on reviewed count:
 *   0% from brief  → "All values estimated by AI"
 *   <50% from brief → "Most values estimated by AI"
 *   ≥50% from brief → "Most values from your brief"
 *   100% from brief → "All values from your brief"
 */

import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { Tooltip } from '../Tooltip'
import { AnalysisFooter } from '../../shared/AnalysisFooter'

/** Derive source distribution tooltip from raw counts */
function getReviewedTooltip(nonAiCount?: number, totalCount?: number): string {
  if (totalCount == null || totalCount === 0) {
    return "Number of factor values you've confirmed or marked as assumptions"
  }
  const briefCount = nonAiCount ?? 0
  const ratio = briefCount / totalCount
  if (ratio === 0) return 'All values estimated by AI'
  if (ratio < 0.5) return 'Most values estimated by AI'
  if (ratio < 1) return 'Most values from your brief'
  return 'All values from your brief'
}

interface StickyFooterProps {
  /** Whether analysis can run */
  isReady: boolean
  /** Whether there are blockers */
  hasBlockers: boolean
  /** Number of blocker issues */
  blockerCount: number
  /** Whether analysis is currently running */
  isAnalysing: boolean
  /** Click handler for analyse button */
  onAnalyse: () => void
  /** Human-readable reason when Analyse is blocked */
  blockedReason?: string
  /** Whether CEE data is still loading */
  isLoading?: boolean
  /** Whether retry is in progress */
  isRetrying?: boolean
  /** Number of reviewed (user-confirmed) factors */
  reviewedCount?: number
  /** Total number of reviewable factors */
  totalReviewableCount?: number
  /** Factors NOT from AI sources — used to build source-distribution tooltip */
  evidenceNonAiCount?: number
  /** Total factor count — used to build source-distribution tooltip */
  evidenceTotalCount?: number
  /** Fraction (0–1) of total factor influence covered by user-reviewed factors */
  weightedInfluenceReviewed?: number
}

export function StickyFooter({
  isReady,
  hasBlockers,
  blockerCount,
  isAnalysing,
  onAnalyse,
  blockedReason,
  isLoading = false,
  isRetrying = false,
  reviewedCount,
  totalReviewableCount,
  evidenceNonAiCount,
  evidenceTotalCount,
  weightedInfluenceReviewed,
}: StickyFooterProps) {
  const isDisabled = !isReady || isAnalysing || isLoading || isRetrying

  let StatusIcon: typeof CheckCircle | typeof XCircle | typeof Loader2 | typeof AlertTriangle
  let statusIconColor: string
  let statusText: string

  if (isLoading) {
    StatusIcon = Loader2
    statusIconColor = 'text-text-light animate-spin'
    statusText = 'Checking'
  } else if (isRetrying) {
    StatusIcon = Loader2
    statusIconColor = 'text-primary animate-spin'
    statusText = 'Updating draft'
  } else if (isReady) {
    StatusIcon = CheckCircle
    statusIconColor = 'text-success'
    statusText = 'Ready'
  } else if (hasBlockers) {
    StatusIcon = XCircle
    statusIconColor = 'text-danger'
    statusText = 'Blocked'
  } else {
    StatusIcon = AlertTriangle
    statusIconColor = 'text-warning'
    statusText = 'Not ready'
  }

  const allReviewed = totalReviewableCount != null && totalReviewableCount > 0 &&
    (reviewedCount ?? 0) >= totalReviewableCount

  const reviewedTooltip = getReviewedTooltip(evidenceNonAiCount, evidenceTotalCount)
  // Show "0% of influence reviewed" when sensitivity data exists but nothing reviewed yet;
  // hide only when influence data is unavailable (undefined)
  const influenceText = weightedInfluenceReviewed != null
    ? ` · ${Math.round(weightedInfluenceReviewed * 100)}% of influence reviewed`
    : ''
  const metaText = !isRetrying && totalReviewableCount != null && totalReviewableCount > 0 ? (
    <>
      <Tooltip content={reviewedTooltip}>
        <span className="cursor-help">
          {allReviewed ? 'All contributed' : `${reviewedCount ?? 0}/${totalReviewableCount} contributed`}
        </span>
      </Tooltip>
      {influenceText && (
        <Tooltip content="Weighted by how much each item affects the outcome">
          <span className="cursor-help">{influenceText}</span>
        </Tooltip>
      )}
    </>
  ) : hasBlockers ? `${blockerCount} to address` : undefined

  return (
    <AnalysisFooter
      statusIcon={StatusIcon}
      statusIconClassName={statusIconColor}
      statusText={statusText}
      metaText={metaText}
      actionLabel={isAnalysing ? 'Analysing...' : 'Analyse now'}
      onAction={onAnalyse}
      actionDisabled={isDisabled}
      actionLoading={isAnalysing || isRetrying}
      actionAriaLabel={
        isRetrying
          ? 'Draft update in progress'
          : isAnalysing
            ? 'Analysis in progress'
            : hasBlockers
              ? `Fix issues before analysing${blockedReason ? `: ${blockedReason}` : ''}`
              : !isReady
                ? `Analysis not ready${blockedReason ? `: ${blockedReason}` : ''}`
                : 'Run analysis'
      }
      actionTitle={isDisabled && !isAnalysing && !isLoading && !isRetrying
        ? (blockedReason || 'Complete required actions before analysing')
        : undefined}
    />
  )
}

export default StickyFooter

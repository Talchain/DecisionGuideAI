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

import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { Tooltip } from '../Tooltip'

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
  /** Whether CEE data is still loading */
  isLoading?: boolean
  /** Whether retry draft is available (blocked due to incomplete draft) */
  canRetryDraft?: boolean
  /** Whether retry is in progress */
  isRetrying?: boolean
  /** Click handler for retry draft button */
  onRetryDraft?: () => void
  /** Number of reviewed (user-confirmed) factors */
  reviewedCount?: number
  /** Total number of reviewable factors */
  totalReviewableCount?: number
  /** Factors NOT from AI sources — used to build source-distribution tooltip */
  evidenceNonAiCount?: number
  /** Total factor count — used to build source-distribution tooltip */
  evidenceTotalCount?: number
}

export function StickyFooter({
  isReady,
  hasBlockers,
  blockerCount,
  isAnalysing,
  onAnalyse,
  isLoading = false,
  canRetryDraft = false,
  isRetrying = false,
  onRetryDraft,
  reviewedCount,
  totalReviewableCount,
  evidenceNonAiCount,
  evidenceTotalCount,
}: StickyFooterProps) {
  const isDisabled = !isReady || isAnalysing || isLoading || isRetrying

  let buttonLabel: string
  let buttonStyle: string

  if (isLoading) {
    buttonLabel = 'Checking...'
    buttonStyle = 'bg-factor-light text-text-light cursor-wait opacity-40'
  } else if (isRetrying) {
    buttonLabel = 'Re-drafting...'
    buttonStyle = 'bg-factor-light text-text-light cursor-wait opacity-40'
  } else if (isAnalysing) {
    buttonLabel = 'Analysing...'
    buttonStyle = 'bg-primary text-white cursor-wait'
  } else if (hasBlockers) {
    buttonLabel = `Fix ${blockerCount} issue${blockerCount !== 1 ? 's' : ''} first`
    buttonStyle = 'bg-factor-light text-text-light cursor-not-allowed opacity-40'
  } else if (!isReady) {
    buttonLabel = 'Not ready'
    buttonStyle = 'bg-factor-light text-text-light cursor-not-allowed opacity-40'
  } else {
    buttonLabel = 'Analyse Now'
    buttonStyle = 'bg-primary hover:bg-primary-hover text-white'
  }

  let StatusIcon: typeof CheckCircle | typeof XCircle | typeof Loader2
  let statusIconColor: string
  let statusText: string

  if (isLoading) {
    StatusIcon = Loader2
    statusIconColor = 'text-text-light animate-spin'
    statusText = 'Checking'
  } else if (isRetrying) {
    StatusIcon = Loader2
    statusIconColor = 'text-primary animate-spin'
    statusText = 'Re-drafting'
  } else if (isReady) {
    StatusIcon = CheckCircle
    statusIconColor = 'text-success'
    statusText = 'Ready'
  } else {
    StatusIcon = XCircle
    statusIconColor = 'text-danger'
    statusText = 'Blocked'
  }

  const showRetryButton = canRetryDraft && hasBlockers && !isLoading && !isAnalysing && !isRetrying

  const allReviewed = totalReviewableCount != null && totalReviewableCount > 0 &&
    (reviewedCount ?? 0) >= totalReviewableCount

  const reviewedTooltip = getReviewedTooltip(evidenceNonAiCount, evidenceTotalCount)

  return (
    <div
      className="flex-shrink-0 h-12 px-3 flex items-center justify-between bg-panel border-t border-panel-border"
      data-testid="sticky-footer"
    >
      {/* Left: Status + Reviewed count */}
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon className={`w-4 h-4 ${statusIconColor}`} aria-hidden="true" />
        <span className="font-medium text-text-body">{statusText}</span>
        {!isRetrying && (totalReviewableCount != null && totalReviewableCount > 0) && (
          <>
            <span className="text-text-light">·</span>
            <Tooltip content={reviewedTooltip}>
              <span className="text-text-body cursor-help">
                {allReviewed ? 'All reviewed' : `${reviewedCount ?? 0}/${totalReviewableCount} reviewed`}
              </span>
            </Tooltip>
          </>
        )}
      </div>

      {/* Right: CTA Button(s) */}
      <div className="flex items-center gap-2">
        {showRetryButton && onRetryDraft && (
          <Tooltip content="Re-run the AI draft to fix missing data">
            <button
              type="button"
              onClick={onRetryDraft}
              className="px-3 py-2 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 border border-primary/30 text-primary hover:bg-primary-light"
              aria-label="Retry draft to fix blocked state"
              data-testid="retry-draft-button"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Retry Draft
            </button>
          </Tooltip>
        )}

        <button
          type="button"
          onClick={onAnalyse}
          disabled={isDisabled}
          aria-disabled={isDisabled ? 'true' : 'false'}
          className={`
            px-4 py-2 rounded-full text-[11px] font-medium transition-colors
            flex items-center gap-2
            ${buttonStyle}
          `}
          aria-label={
            isRetrying
              ? 'Re-drafting in progress'
              : isAnalysing
                ? 'Analysis in progress'
                : hasBlockers
                  ? 'Fix issues before analysing'
                  : !isReady
                    ? 'Analysis not ready'
                    : 'Run analysis'
          }
          title={isDisabled && !isAnalysing && !isLoading && !isRetrying ? 'Complete required actions before analysing' : undefined}
        >
          {(isAnalysing || isRetrying) && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

export default StickyFooter

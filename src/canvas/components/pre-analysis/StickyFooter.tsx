/**
 * StickyFooter - 48px bar pinned to bottom of panel
 *
 * Left: CheckCircle/XCircle/Loader icon + "Ready"/"Blocked"/"Checking"
 * Right: CTA button(s)
 *   - Primary: "Analyse Now" (info bg, white text, pill shape)
 *   - Retry: "Retry Draft" appears when blocked due to incomplete draft (ANALYSIS_NOT_READY)
 *   - States: disabled "Checking..." → disabled "Fix N issues" → "Retry Draft" (when retryable) → enabled "Analyse Now" → "Analysing..." with spinner
 *
 * Reviewed count tooltip shows source distribution ("N from brief, M estimated by AI").
 * Evidence tier label removed — the reviewed count is the primary trust signal.
 */

import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { Tooltip } from '../Tooltip'

/** Derive source distribution tooltip from raw counts */
function getReviewedTooltip(nonAiCount?: number, totalCount?: number): string {
  if (totalCount == null || totalCount === 0) {
    return "Number of factor values you've confirmed or marked as assumptions"
  }
  const aiCount = totalCount - (nonAiCount ?? 0)
  const briefCount = nonAiCount ?? 0
  if (aiCount === 0) return `All ${totalCount} values from your brief`
  if (briefCount === 0) return `All ${totalCount} values estimated by AI`
  return `${briefCount} from brief, ${aiCount} estimated by AI`
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
  // Determine primary button state
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
    buttonStyle = 'bg-info text-white cursor-wait'
  } else if (hasBlockers) {
    buttonLabel = `Fix ${blockerCount} issue${blockerCount !== 1 ? 's' : ''} first`
    buttonStyle = 'bg-factor-light text-text-light cursor-not-allowed opacity-40'
  } else if (!isReady) {
    // isReady=false but hasBlockers=false (e.g., status !== 'ready')
    buttonLabel = 'Not ready'
    buttonStyle = 'bg-factor-light text-text-light cursor-not-allowed opacity-40'
  } else {
    buttonLabel = 'Analyse Now'
    buttonStyle = 'bg-info hover:bg-info-hover text-white'
  }

  // Status icon and text - loading shows spinner
  let StatusIcon: typeof CheckCircle | typeof XCircle | typeof Loader2
  let statusIconColor: string
  let statusText: string

  if (isLoading) {
    StatusIcon = Loader2
    statusIconColor = 'text-text-light animate-spin'
    statusText = 'Checking'
  } else if (isRetrying) {
    StatusIcon = Loader2
    statusIconColor = 'text-info animate-spin'
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

  // Show retry button when blocked due to incomplete draft and retry is available
  const showRetryButton = canRetryDraft && hasBlockers && !isLoading && !isAnalysing && !isRetrying

  // "All reviewed" when every reviewable factor has been confirmed
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
        <span className="font-medium text-text-body">
          {statusText}
        </span>
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
              className="px-3 py-2 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 border border-info/30 text-info hover:bg-info-light"
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

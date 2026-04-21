/**
 * V5AnalysisResultBlock — renders V5 OlumiResponse.analysis_result.
 *
 * Two render modes:
 *   1. Enrichment contains a valid decision_review → caller routes the
 *      payload to DecisionReviewPanel (not rendered here; this block stays
 *      inline in chat with a summary card).
 *   2. Enrichment missing / malformed → inline summary card with
 *      summary text and win_probabilities as pills.
 *
 * Design tokens (DS v5 §21.2):
 *   - Card frame: bg-panel + rounded-xl + border-panel-border
 *   - Card header: typography.panelHeader (14px semibold)
 *   - Body: typography.panelBody (12px)
 *   - Pills: bg-transparent border-{semantic}/30 text-text-body
 */
import { type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../canvas/conversation/types'
import { extractDecisionReview } from '../decisionReviewAdapter'

export interface V5AnalysisResultBlockProps {
  block: V5AnalysisResultBlockType
}

function formatProbability(p: number): string {
  if (!Number.isFinite(p)) return '—'
  return `${Math.round(p * 100)}%`
}

export function V5AnalysisResultBlock({ block }: V5AnalysisResultBlockProps): ReactElement {
  const review = extractDecisionReview(block.enrichment)
  const hasProbs =
    block.win_probabilities && Object.keys(block.win_probabilities).length > 0

  // Sort so the leading option appears first and the rest descending by prob.
  const sortedProbs = hasProbs
    ? Object.entries(block.win_probabilities as Record<string, number>).sort(
        ([idA, pA], [idB, pB]) => {
          if (idA === block.leading_option_id) return -1
          if (idB === block.leading_option_id) return 1
          return pB - pA
        },
      )
    : []

  return (
    <div
      data-testid="v5-analysis-result"
      data-has-decision-review={review ? 'true' : 'false'}
      className="rounded-xl border border-panel-border bg-panel p-4 space-y-3"
    >
      <h3
        className={typography.panelHeader}
        data-testid="v5-analysis-result-heading"
      >
        Analysis result
      </h3>
      <p className={typography.panelBody} data-testid="v5-analysis-result-summary">
        {block.summary}
      </p>

      {hasProbs && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Option win probabilities"
          data-testid="v5-analysis-result-probabilities"
        >
          {sortedProbs.map(([optionId, prob]) => {
            const isLeader = optionId === block.leading_option_id
            return (
              <span
                key={optionId}
                role="listitem"
                className={[
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5',
                  'bg-transparent text-text-body',
                  isLeader ? 'border border-option/50' : 'border border-option/30',
                  typography.panelMeta,
                ].join(' ')}
                data-leader={isLeader ? 'true' : 'false'}
              >
                <span className="font-medium">{optionId}</span>
                <span className="text-text-light">·</span>
                <span>{formatProbability(prob)}</span>
              </span>
            )
          })}
        </div>
      )}

      {review === null && block.enrichment && (
        // DEV diagnostic — enrichment present but decision_review malformed.
        // Users see only the summary card; operators see this in the DOM.
        <div
          className="hidden"
          data-testid="v5-analysis-result-enrichment-invalid"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default V5AnalysisResultBlock

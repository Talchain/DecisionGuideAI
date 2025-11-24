import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from '../decisionReview/types'
import { typography } from '../../styles/typography'

export type DecisionReviewStatus = 'loading' | 'empty' | 'error' | 'ready'

interface DecisionReviewPanelProps {
  status: DecisionReviewStatus
  review?: CeeDecisionReviewPayload | null
  error?: CeeErrorViewModel | null
  trace?: CeeTraceMeta | null
}

export function DecisionReviewPanel({ status, review, error, trace }: DecisionReviewPanelProps) {
  if (status === 'loading') {
    return (
      <section aria-label="Decision review" data-testid="decision-review-loading" className={`p-3 ${typography.caption} text-ink-900/60`}>
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-sand-200 rounded" />
          <div className="h-3 bg-sand-200 rounded w-5/6" />
          <div className="h-3 bg-sand-100 rounded w-4/6" />
        </div>
      </section>
    )
  }

  if (status === 'empty') {
    return (
      <section aria-label="Decision review" data-testid="decision-review-empty" className={`p-3 ${typography.caption}`}>
        <p className="text-ink-900/70">
          Decision Review is not available for this run. You can still use the main results to guide your next steps.
        </p>
      </section>
    )
  }

  if (status === 'error') {
    const suggested = error?.suggestedAction
    const headline =
      suggested === 'retry'
        ? 'Decision Review is temporarily unavailable'
        : suggested === 'fix_input'
        ? 'Decision Review could not run on this input'
        : 'Decision Review is unavailable for this run'

    const body =
      suggested === 'retry'
        ? 'This is usually transient. You can try again in a moment; core results remain valid.'
        : suggested === 'fix_input'
        ? 'Please adjust the scenario or inputs, then run analysis again. The main results panel has more detail.'
        : 'The engine results are still available. Decision Review could not be generated this time.'

    return (
      <section aria-label="Decision review" data-testid="decision-review-error" className={`p-3 ${typography.caption} bg-sun-50 border border-sun-200 rounded`}>
        <h3 className={`${typography.label} text-sun-900 mb-1`}>{headline}</h3>
        <p className="text-sun-900 mb-1">{body}</p>
        {trace?.requestId && (
          <p className={`${typography.code} text-sun-900/70`} data-testid="decision-review-trace-id">
            Reference ID: <span className="font-mono">{trace.requestId}</span>
          </p>
        )}
      </section>
    )
  }

  // Ready state
  const story = review?.story
  const keyDrivers = story?.key_drivers ?? []
  const nextActions = story?.next_actions ?? []

  return (
    <section aria-label="Decision review" data-testid="decision-review-ready" className={`p-3 ${typography.caption} text-ink-900/70 space-y-3`}>
      <div>
        <h3 className={`${typography.label} text-ink-900`} data-testid="decision-review-headline">
          {story?.headline || 'Decision Review'}
        </h3>
        {review?.journey && (
          <p className={`mt-1 ${typography.code} text-ink-900/60`} data-testid="decision-review-journey">
            {review.journey.is_complete ? 'Based on a complete decision journey.' : 'Based on the current decision journey.'}
          </p>
        )}
      </div>

      {keyDrivers.length > 0 && (
        <div data-testid="decision-review-drivers">
          <div className={`${typography.code} font-medium text-ink-900/60 mb-1`}>What shaped this view</div>
          <ul className="list-disc pl-4 space-y-1">
            {keyDrivers.map((d, idx) => (
              <li key={idx} className={`${typography.caption} text-ink-900`}>
                <span className="font-medium">{d.label}</span>
                {d.why && <span className="text-ink-900/60"> — {d.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextActions.length > 0 && (
        <div data-testid="decision-review-next-actions">
          <div className={`${typography.code} font-medium text-ink-900/60 mb-1`}>Suggested next moves</div>
          <ul className="list-disc pl-4 space-y-1">
            {nextActions.map((a, idx) => (
              <li key={idx} className={`${typography.caption} text-ink-900`}>
                <span className="font-medium">{a.label}</span>
                {a.why && <span className="text-ink-900/60"> — {a.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

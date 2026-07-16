import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { DecisionReviewPanel } from '../DecisionReviewPanel'
import type { CeeDecisionReviewPayload, CeeErrorViewModel, CeeTraceMeta } from '../../decisionReview/types'

describe('DecisionReviewPanel', () => {
  it('renders loading skeleton when status is loading', () => {
    render(<DecisionReviewPanel status="loading" />)
    expect(screen.getByTestId('decision-review-loading')).toBeInTheDocument()
  })

  it('renders empty state when status is empty', () => {
    render(<DecisionReviewPanel status="empty" />)
    expect(screen.getByTestId('decision-review-empty')).toBeInTheDocument()
  })

  it('renders ready state with headline, journey, drivers, and next actions', () => {
    const review: CeeDecisionReviewPayload = {
      story: {
        headline: 'Why this decision makes sense',
        key_drivers: [
          { label: 'Strong customer demand', why: 'Consistent growth over several quarters' },
          { label: 'Manageable downside', why: 'Staged rollout limits worst case' },
        ],
        next_actions: [
          { label: 'Align stakeholders', why: 'Ensure cross-functional agreement before launch' },
          { label: 'Run sensitivity analysis', why: 'Validate robustness to demand and cost swings' },
        ],
      },
      journey: {
        is_complete: true,
        missing_envelopes: [],
      },
    }

    render(<DecisionReviewPanel status="ready" review={review} />)

    expect(screen.getByTestId('decision-review-ready')).toBeInTheDocument()
    expect(screen.getByTestId('decision-review-headline')).toHaveTextContent(
      'Why this decision makes sense',
    )
    expect(screen.getByTestId('decision-review-journey')).toHaveTextContent(
      'Based on a complete decision journey.',
    )

    const drivers = screen.getByTestId('decision-review-drivers')
    expect(drivers).toHaveTextContent('Strong customer demand')
    expect(drivers).toHaveTextContent('Manageable downside')

    const nextActions = screen.getByTestId('decision-review-next-actions')
    expect(nextActions).toHaveTextContent('Align stakeholders')
    expect(nextActions).toHaveTextContent('Run sensitivity analysis')
  })

  it('renders error state with suggested messaging and trace reference ID', () => {
    const error: CeeErrorViewModel = {
      code: 'CEE_TEMP',
      retryable: true,
      traceId: 'trace-123',
      suggestedAction: 'retry',
    }

    const trace: CeeTraceMeta = {
      requestId: 'req-789',
      degraded: false,
      timestamp: '2025-11-20T18:30:00Z',
    }

    render(<DecisionReviewPanel status="error" error={error} trace={trace} />)

    const panel = screen.getByTestId('decision-review-error')
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveTextContent('Decision Review is temporarily unavailable')
    expect(panel).toHaveTextContent(
      'This is usually transient. You can try again in a moment; core results remain valid.',
    )

    const ref = screen.getByTestId('decision-review-trace-id')
    expect(ref).toHaveTextContent('Reference ID:')
    expect(ref).toHaveTextContent('req-789')
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StickyFooter } from '../StickyFooter'

const baseProps = {
  isReady: true,
  hasBlockers: false,
  blockerCount: 0,
  isAnalysing: false,
  onAnalyse: () => {},
}

describe('StickyFooter — addressed count display', () => {
  it('shows X/Y addressed when totalReviewableCount > 0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={2}
        totalReviewableCount={5}
      />,
    )
    expect(screen.getByText('2/5 addressed')).toBeInTheDocument()
  })

  it('shows "All addressed" when reviewedCount equals totalReviewableCount', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={3}
        totalReviewableCount={3}
      />,
    )
    expect(screen.getByText('All addressed')).toBeInTheDocument()
  })

  it('does not show addressed count when totalReviewableCount is 0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={0}
        totalReviewableCount={0}
      />,
    )
    expect(screen.queryByText(/addressed/)).not.toBeInTheDocument()
  })
})

describe('StickyFooter — no quality/evidence tier label', () => {
  it('does not render "Quality:" label regardless of evidenceLevel', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={2}
        totalReviewableCount={5}
        evidenceNonAiCount={2}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Data confidence:/)).not.toBeInTheDocument()
  })
})

describe('StickyFooter — addressed count tooltip (source distribution)', () => {
  it('addressed count element has cursor-help class (tooltip trigger) when totalReviewableCount > 0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={0}
        totalReviewableCount={5}
        evidenceNonAiCount={0}
        evidenceTotalCount={5}
      />,
    )
    const addressedEl = screen.getByText('0/5 addressed')
    expect(addressedEl).toBeInTheDocument()
    expect(addressedEl).toHaveClass('cursor-help')
  })

  it('shows addressed count when some from brief and some AI', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={2}
        totalReviewableCount={5}
        evidenceNonAiCount={2}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText('2/5 addressed')).toBeInTheDocument()
  })

  it('shows "All addressed" when all factors addressed', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={5}
        totalReviewableCount={5}
        evidenceNonAiCount={5}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText('All addressed')).toBeInTheDocument()
  })

  it('does not show addressed count when totalReviewableCount is 0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={0}
        totalReviewableCount={0}
        evidenceNonAiCount={0}
        evidenceTotalCount={0}
      />,
    )
    expect(screen.queryByText(/addressed/)).not.toBeInTheDocument()
  })

  it('tooltip shows "All values estimated by AI" when 0% from brief', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={0}
        totalReviewableCount={5}
        evidenceNonAiCount={0}
        evidenceTotalCount={5}
      />,
    )
    const trigger = screen.getByText('0/5 addressed')
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('All values estimated by AI')
  })

  it('tooltip shows "Most values estimated by AI" when <50% from brief', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={1}
        totalReviewableCount={5}
        evidenceNonAiCount={1}
        evidenceTotalCount={5}
      />,
    )
    const trigger = screen.getByText('1/5 addressed')
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Most values estimated by AI')
  })

  it('tooltip shows "Most values from your brief" when ≥50% from brief', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={3}
        totalReviewableCount={5}
        evidenceNonAiCount={3}
        evidenceTotalCount={5}
      />,
    )
    const trigger = screen.getByText('3/5 addressed')
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Most values from your brief')
  })

  it('tooltip shows "All values from your brief" when 100% from brief', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={5}
        totalReviewableCount={5}
        evidenceNonAiCount={5}
        evidenceTotalCount={5}
      />,
    )
    const trigger = screen.getByText('All addressed')
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('All values from your brief')
  })

  it('uses the shared blocked reason for the disabled Analyse CTA tooltip', () => {
    render(
      <StickyFooter
        {...baseProps}
        isReady={false}
        blockedReason="Select a goal node before running analysis"
      />,
    )

    const button = screen.getByRole('button', { name: /analysis not ready/i })
    expect(button).toHaveAttribute('title', 'Select a goal node before running analysis')
  })
})

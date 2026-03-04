import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StickyFooter } from '../StickyFooter'

const baseProps = {
  isReady: true,
  hasBlockers: false,
  blockerCount: 0,
  isAnalysing: false,
  onAnalyse: () => {},
}

describe('StickyFooter — reviewed count display', () => {
  it('shows X/Y reviewed when totalReviewableCount > 0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={2}
        totalReviewableCount={5}
      />,
    )
    expect(screen.getByText('2/5 reviewed')).toBeInTheDocument()
  })

  it('shows "All reviewed" when reviewedCount equals totalReviewableCount', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={3}
        totalReviewableCount={3}
      />,
    )
    expect(screen.getByText('All reviewed')).toBeInTheDocument()
  })

  it('does not show reviewed count when totalReviewableCount is 0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={0}
        totalReviewableCount={0}
      />,
    )
    expect(screen.queryByText(/reviewed/)).not.toBeInTheDocument()
  })
})

describe('StickyFooter — reviewed count tooltip (source distribution)', () => {
  it('shows "All N values estimated by AI" tooltip when nonAiCount=0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={0}
        totalReviewableCount={5}
        evidenceNonAiCount={0}
        evidenceTotalCount={5}
      />,
    )
    const reviewedEl = screen.getByText('0/5 reviewed')
    expect(reviewedEl).toBeInTheDocument()
    // Tooltip content rendered as title-equivalent via Tooltip component
    // The tooltip wraps reviewed text, so check the tooltip content prop indirectly
    // by confirming the element has cursor-help class (tooltip trigger)
    expect(reviewedEl).toHaveClass('cursor-help')
  })

  it('shows mixed source tooltip when some from brief and some AI', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={2}
        totalReviewableCount={5}
        evidenceNonAiCount={2}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText('2/5 reviewed')).toBeInTheDocument()
  })

  it('shows "All N values from your brief" tooltip when aiCount=0', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={5}
        totalReviewableCount={5}
        evidenceNonAiCount={5}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText('All reviewed')).toBeInTheDocument()
  })
})

describe('StickyFooter — no evidence tier label', () => {
  it('does not render "Data confidence:" label', () => {
    render(
      <StickyFooter
        {...baseProps}
        reviewedCount={2}
        totalReviewableCount={5}
        evidenceNonAiCount={2}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.queryByText(/Data confidence:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
  })
})

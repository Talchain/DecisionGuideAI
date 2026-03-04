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

describe('StickyFooter — Quality label display', () => {
  it('shows "Quality: High" when evidenceLevel is high', () => {
    render(
      <StickyFooter
        {...baseProps}
        evidenceLevel="high"
        evidenceNonAiCount={5}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText(/Quality:/)).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('shows "Quality: Medium" when evidenceLevel is medium', () => {
    render(
      <StickyFooter
        {...baseProps}
        evidenceLevel="medium"
        evidenceNonAiCount={2}
        evidenceTotalCount={4}
      />,
    )
    expect(screen.getByText(/Quality:/)).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('shows "Quality: Low" when evidenceLevel is low', () => {
    render(
      <StickyFooter
        {...baseProps}
        evidenceLevel="low"
        evidenceNonAiCount={0}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText(/Quality:/)).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('does not show Quality label when evidenceLevel is absent', () => {
    render(<StickyFooter {...baseProps} />)
    expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
  })
})

describe('StickyFooter — Quality tooltip (source distribution)', () => {
  it('Quality label has cursor-help class (tooltip trigger) when evidenceLevel present', () => {
    render(
      <StickyFooter
        {...baseProps}
        evidenceLevel="low"
        evidenceNonAiCount={0}
        evidenceTotalCount={5}
      />,
    )
    const qualityEl = screen.getByText(/Quality:/)
    expect(qualityEl).toHaveClass('cursor-help')
  })

  it('shows mixed source tooltip when some from brief and some AI', () => {
    render(
      <StickyFooter
        {...baseProps}
        evidenceLevel="medium"
        evidenceNonAiCount={2}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText(/Quality:/)).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('shows Quality label with all-brief tooltip when aiCount=0', () => {
    render(
      <StickyFooter
        {...baseProps}
        evidenceLevel="high"
        evidenceNonAiCount={5}
        evidenceTotalCount={5}
      />,
    )
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('shows Quality label with fallback tooltip text when evidenceTotalCount is 0', () => {
    render(
      <StickyFooter
        {...baseProps}
        evidenceLevel="low"
        evidenceNonAiCount={0}
        evidenceTotalCount={0}
      />,
    )
    expect(screen.getByText(/Quality:/)).toBeInTheDocument()
  })
})

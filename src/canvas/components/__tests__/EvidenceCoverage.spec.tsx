import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvidenceCoverage, EvidenceCoverageCompact } from '../EvidenceCoverage'

describe('EvidenceCoverage', () => {
  it('renders full coverage when all edges have evidence', () => {
    render(<EvidenceCoverage evidencedCount={10} totalCount={10} />)

    const component = screen.getByTestId('evidence-coverage')
    expect(component).toBeInTheDocument()
    expect(screen.getByText('Full Coverage')).toBeInTheDocument()
    expect(screen.getByText('(100%)')).toBeInTheDocument()
    expect(screen.getByText('10 of 10 edges documented')).toBeInTheDocument()
  })

  it('renders partial coverage when most edges have evidence', () => {
    render(<EvidenceCoverage evidencedCount={7} totalCount={10} />)

    expect(screen.getByText('Partial Coverage')).toBeInTheDocument()
    expect(screen.getByText('(70%)')).toBeInTheDocument()
    expect(screen.getByText('7 of 10 edges documented')).toBeInTheDocument()
  })

  it('renders minimal coverage when few edges have evidence', () => {
    render(<EvidenceCoverage evidencedCount={3} totalCount={10} />)

    expect(screen.getByText('Minimal Coverage')).toBeInTheDocument()
    expect(screen.getByText('(30%)')).toBeInTheDocument()
    expect(screen.getByText('3 of 10 edges documented')).toBeInTheDocument()
  })

  it('renders no coverage when no edges have evidence', () => {
    render(<EvidenceCoverage evidencedCount={0} totalCount={10} />)

    expect(screen.getByText('No Coverage')).toBeInTheDocument()
    expect(screen.getByText('(0%)')).toBeInTheDocument()
    expect(screen.getByText('0 of 10 edges documented')).toBeInTheDocument()
  })

  it('handles zero total edges gracefully', () => {
    render(<EvidenceCoverage evidencedCount={0} totalCount={0} />)

    expect(screen.getByText('No Coverage')).toBeInTheDocument()
    expect(screen.getByText('(0%)')).toBeInTheDocument()
    expect(screen.getByText('0 of 0 edges documented')).toBeInTheDocument()
  })

  it('accepts override level prop', () => {
    render(<EvidenceCoverage evidencedCount={1} totalCount={10} level="full" />)

    // Even though 10% coverage, override shows Full Coverage
    expect(screen.getByText('Full Coverage')).toBeInTheDocument()
  })

  it('hides percentage when showPercentage is false', () => {
    render(<EvidenceCoverage evidencedCount={10} totalCount={10} showPercentage={false} />)

    expect(screen.getByText('Full Coverage')).toBeInTheDocument()
    expect(screen.queryByText('(100%)')).not.toBeInTheDocument()
  })

  it('has correct aria attributes for accessibility', () => {
    render(<EvidenceCoverage evidencedCount={5} totalCount={10} />)

    const component = screen.getByTestId('evidence-coverage')
    expect(component).toHaveAttribute('role', 'status')
    expect(component).toHaveAttribute('aria-label', 'Evidence coverage: Minimal Coverage, 50%')

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })
})

describe('EvidenceCoverageCompact', () => {
  it('renders compact variant with percentage only', () => {
    render(<EvidenceCoverageCompact evidencedCount={7} totalCount={10} />)

    const component = screen.getByTestId('evidence-coverage-compact')
    expect(component).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
    // Should not have verbose text
    expect(screen.queryByText('Partial Coverage')).not.toBeInTheDocument()
    expect(screen.queryByText('edges documented')).not.toBeInTheDocument()
  })

  it('has correct aria-label for accessibility', () => {
    render(<EvidenceCoverageCompact evidencedCount={5} totalCount={10} />)

    const component = screen.getByTestId('evidence-coverage-compact')
    expect(component).toHaveAttribute('aria-label', 'Evidence coverage: 50%')
  })
})

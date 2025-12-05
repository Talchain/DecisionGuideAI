import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdentifiabilityBadge } from '../IdentifiabilityBadge'

describe('IdentifiabilityBadge', () => {
  it('renders identifiable status with neutral background and semantic text color', () => {
    render(<IdentifiabilityBadge status="identifiable" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Identifiable')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-green-700')
  })

  it('renders underidentified status with neutral background and semantic text color', () => {
    render(<IdentifiabilityBadge status="underidentified" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Under-identified')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-amber-700')
  })

  it('renders overidentified status with neutral background and semantic text color', () => {
    render(<IdentifiabilityBadge status="overidentified" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Over-identified')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-red-700')
  })

  it('renders unknown status with neutral background and muted text color', () => {
    render(<IdentifiabilityBadge status="unknown" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Run analysis to calculate')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-ink-500')
  })

  it('has correct aria-label for accessibility', () => {
    render(<IdentifiabilityBadge status="identifiable" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toHaveAttribute('aria-label', 'Model identifiability: Identifiable')
    expect(badge).toHaveAttribute('role', 'status')
  })

  it('accepts custom className', () => {
    render(<IdentifiabilityBadge status="identifiable" className="custom-class" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toHaveClass('custom-class')
  })
})

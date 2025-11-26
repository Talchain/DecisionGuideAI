import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdentifiabilityBadge } from '../IdentifiabilityBadge'

describe('IdentifiabilityBadge', () => {
  it('renders identifiable status with green styling', () => {
    render(<IdentifiabilityBadge status="identifiable" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Identifiable')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-50', 'border-green-200', 'text-green-700')
  })

  it('renders underidentified status with amber styling', () => {
    render(<IdentifiabilityBadge status="underidentified" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Under-identified')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-amber-50', 'border-amber-200', 'text-amber-700')
  })

  it('renders overidentified status with red styling', () => {
    render(<IdentifiabilityBadge status="overidentified" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Over-identified')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-red-50', 'border-red-200', 'text-red-700')
  })

  it('renders unknown status with gray styling', () => {
    render(<IdentifiabilityBadge status="unknown" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(badge).toHaveClass('bg-gray-50', 'border-gray-200', 'text-gray-600')
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

/**
 * IdentifiabilityBadge Tests
 *
 * Task 3.2: Tests for Y₀ Identifiability Status display
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  IdentifiabilityBadge,
  normalizeIdentifiabilityTag,
} from '../IdentifiabilityBadge'

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

  it('accepts custom className', () => {
    render(<IdentifiabilityBadge status="identifiable" className="custom-class" />)

    const badge = screen.getByTestId('identifiability-badge')
    expect(badge).toHaveClass('custom-class')
  })
})

describe('normalizeIdentifiabilityTag', () => {
  it('returns null for empty/null input', () => {
    expect(normalizeIdentifiabilityTag(null)).toBeNull()
    expect(normalizeIdentifiabilityTag(undefined)).toBeNull()
    expect(normalizeIdentifiabilityTag('')).toBeNull()
  })

  it('returns valid status as-is', () => {
    expect(normalizeIdentifiabilityTag('identifiable')).toBe('identifiable')
    expect(normalizeIdentifiabilityTag('underidentified')).toBe('underidentified')
    expect(normalizeIdentifiabilityTag('overidentified')).toBe('overidentified')
    expect(normalizeIdentifiabilityTag('unknown')).toBe('unknown')
  })

  it('returns unknown for invalid values', () => {
    expect(normalizeIdentifiabilityTag('invalid')).toBe('unknown')
    expect(normalizeIdentifiabilityTag('random')).toBe('unknown')
  })
})


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
  getIdentifiabilityExplanation,
  isIdentifiabilityWarning,
} from '../IdentifiabilityBadge'

describe('IdentifiabilityBadge', () => {
  describe('full label mode (default)', () => {
    it('renders identifiable status with causal effect label', () => {
      render(<IdentifiabilityBadge status="identifiable" />)

      const badge = screen.getByTestId('identifiability-badge')
      expect(badge).toBeInTheDocument()
      expect(screen.getByText('Causal effect identifiable')).toBeInTheDocument()
      expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-green-700')
    })

    it('renders underidentified status with uncertain label', () => {
      render(<IdentifiabilityBadge status="underidentified" />)

      const badge = screen.getByTestId('identifiability-badge')
      expect(badge).toBeInTheDocument()
      expect(screen.getByText('Causal effect uncertain')).toBeInTheDocument()
      expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-amber-700')
    })

    it('renders overidentified status with conflicting label', () => {
      render(<IdentifiabilityBadge status="overidentified" />)

      const badge = screen.getByTestId('identifiability-badge')
      expect(badge).toBeInTheDocument()
      expect(screen.getByText('Conflicting constraints')).toBeInTheDocument()
      expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-red-700')
    })

    it('renders unknown status with prompt to run analysis', () => {
      render(<IdentifiabilityBadge status="unknown" />)

      const badge = screen.getByTestId('identifiability-badge')
      expect(badge).toBeInTheDocument()
      expect(screen.getByText('Run analysis to calculate')).toBeInTheDocument()
      expect(badge).toHaveClass('bg-paper-50', 'border-sand-200', 'text-ink-500')
    })
  })

  describe('compact mode', () => {
    it('renders short label when compact', () => {
      render(<IdentifiabilityBadge status="identifiable" compact />)

      expect(screen.getByText('Identifiable')).toBeInTheDocument()
      expect(screen.queryByText('Causal effect identifiable')).not.toBeInTheDocument()
    })

    it('renders short labels for all statuses', () => {
      const { rerender } = render(<IdentifiabilityBadge status="underidentified" compact />)
      expect(screen.getByText('Uncertain')).toBeInTheDocument()

      rerender(<IdentifiabilityBadge status="overidentified" compact />)
      expect(screen.getByText('Conflicting')).toBeInTheDocument()

      rerender(<IdentifiabilityBadge status="unknown" compact />)
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('showExplanation mode', () => {
    it('shows plain language explanation when enabled', () => {
      render(<IdentifiabilityBadge status="identifiable" showExplanation />)

      expect(screen.getByText(/reliably estimate causal effects/i)).toBeInTheDocument()
    })

    it('shows warning explanation for underidentified', () => {
      render(<IdentifiabilityBadge status="underidentified" showExplanation />)

      expect(screen.getByText(/unmeasured factors/i)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has correct aria-label', () => {
      render(<IdentifiabilityBadge status="identifiable" />)

      const badge = screen.getByTestId('identifiability-badge')
      expect(badge).toHaveAttribute('aria-label', 'Model identifiability: Causal effect identifiable')
      expect(badge).toHaveAttribute('role', 'status')
    })

    it('accepts custom className', () => {
      render(<IdentifiabilityBadge status="identifiable" className="custom-class" />)

      const badge = screen.getByTestId('identifiability-badge')
      expect(badge).toHaveClass('custom-class')
    })
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

describe('getIdentifiabilityExplanation', () => {
  it('returns plain language for each status', () => {
    expect(getIdentifiabilityExplanation('identifiable')).toContain('reliably')
    expect(getIdentifiabilityExplanation('underidentified')).toContain('unmeasured')
    expect(getIdentifiabilityExplanation('overidentified')).toContain('conflict')
    expect(getIdentifiabilityExplanation('unknown')).toContain('Run an analysis')
  })
})

describe('isIdentifiabilityWarning', () => {
  it('returns true for warning statuses', () => {
    expect(isIdentifiabilityWarning('underidentified')).toBe(true)
    expect(isIdentifiabilityWarning('overidentified')).toBe(true)
  })

  it('returns false for non-warning statuses', () => {
    expect(isIdentifiabilityWarning('identifiable')).toBe(false)
    expect(isIdentifiabilityWarning('unknown')).toBe(false)
  })
})

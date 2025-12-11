/**
 * RobustnessIndicator Tests
 *
 * Task 3.1: Tests for ranking stability indicator
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  RobustnessIndicator,
  getRobustnessLevel,
  getRobustnessExplanation,
} from '../RobustnessIndicator'

describe('RobustnessIndicator', () => {
  describe('compact mode', () => {
    it('renders high robustness badge', () => {
      render(<RobustnessIndicator level="high" compact />)

      expect(screen.getByTestId('robustness-indicator-compact')).toBeInTheDocument()
      expect(screen.getByText('Robust')).toBeInTheDocument()
    })

    it('renders medium robustness badge', () => {
      render(<RobustnessIndicator level="medium" compact />)

      expect(screen.getByText('Sensitive')).toBeInTheDocument()
    })

    it('renders low robustness badge', () => {
      render(<RobustnessIndicator level="low" compact />)

      expect(screen.getByText('Fragile')).toBeInTheDocument()
    })

    it('includes switching scenarios in tooltip', () => {
      render(<RobustnessIndicator level="medium" switchingScenarios={3} compact />)

      const badge = screen.getByTestId('robustness-indicator-compact')
      expect(badge.title).toContain('3 scenarios')
    })
  })

  describe('full mode', () => {
    it('renders full robustness indicator with meter', () => {
      render(<RobustnessIndicator level="high" />)

      expect(screen.getByTestId('robustness-indicator')).toBeInTheDocument()
      expect(screen.getByText('Robustness:')).toBeInTheDocument()
      expect(screen.getByText('High Robustness')).toBeInTheDocument()
    })

    it('shows explanation in info button', () => {
      render(
        <RobustnessIndicator
          level="low"
          explanation="Custom explanation text"
        />
      )

      const infoButton = screen.getByRole('button', { name: /explanation/i })
      expect(infoButton).toHaveAttribute('title', expect.stringContaining('Custom explanation'))
    })
  })
})

describe('getRobustnessLevel', () => {
  it('returns high for 0 switching scenarios', () => {
    expect(getRobustnessLevel(0)).toBe('high')
  })

  it('returns medium for 1-2 switching scenarios', () => {
    expect(getRobustnessLevel(1)).toBe('medium')
    expect(getRobustnessLevel(2)).toBe('medium')
  })

  it('returns low for 3+ switching scenarios', () => {
    expect(getRobustnessLevel(3)).toBe('low')
    expect(getRobustnessLevel(5)).toBe('low')
    expect(getRobustnessLevel(10)).toBe('low')
  })
})

describe('getRobustnessExplanation', () => {
  it('returns description for each level', () => {
    expect(getRobustnessExplanation('high')).toContain('stable')
    expect(getRobustnessExplanation('medium')).toContain('race')
    expect(getRobustnessExplanation('low')).toContain('perturbation')
  })
})

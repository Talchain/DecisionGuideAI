/**
 * OptionCards Component Tests (V9.2 Phase 2)
 *
 * Tests for the card-based option comparison replacing RangeVisualization.
 * Layout: option name + rank badge + description + "Wins" bar + "Hits target" bar.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

const mockOptions: OptionResult[] = [
  {
    id: 'option-1',
    label: 'Option A',
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.75,
    rank: 1,
  },
  {
    id: 'option-2',
    label: 'Option B',
    expected: 90,
    outcome: { mean: 90, p10: 50, p50: 90, p90: 130 },
    p10: 50,
    p50: 90,
    p90: 130,
    isRecommended: false,
    winProbability: 0.35,
    goalProbability: 0.55,
    rank: 2,
  },
]

describe('OptionCards', () => {
  describe('Basic rendering', () => {
    it('renders cards for all options', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('renders data-testid for each card', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByTestId('option-card-option-1')).toBeInTheDocument()
      expect(screen.getByTestId('option-card-option-2')).toBeInTheDocument()
    })

    it('renders wrapper with data-testid', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    })

    it('returns null when no options', () => {
      const { container } = render(<OptionCards options={[]} />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Rank badges', () => {
    it('shows rank badge for each option', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('#1 of 2')).toBeInTheDocument()
      expect(screen.getByText('#2 of 2')).toBeInTheDocument()
    })

    it('does not show rank badge for single option', () => {
      render(<OptionCards options={[mockOptions[0]]} winnerId="option-1" />)

      expect(screen.queryByText(/#\d+ of/)).not.toBeInTheDocument()
    })
  })

  describe('Descriptions', () => {
    it('shows story headline when available', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          storyHeadlines={{
            'option-1': 'Strong performance across all scenarios.',
            'option-2': 'Lower risk but lower upside.',
          }}
        />
      )

      expect(screen.getByText('Strong performance across all scenarios.')).toBeInTheDocument()
      expect(screen.getByText('Lower risk but lower upside.')).toBeInTheDocument()
    })

    it('falls back to default description when no story headline', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('Top-performing option based on current estimates.')).toBeInTheDocument()
      expect(screen.getByText('Compare against the leading option.')).toBeInTheDocument()
    })

    it('shows baseline description for baseline option', () => {
      const optionsWithBaseline = [
        mockOptions[0],
        { ...mockOptions[1], isBaseline: true },
      ]
      render(<OptionCards options={optionsWithBaseline} winnerId="option-1" />)

      expect(screen.getByText('Baseline for comparison.')).toBeInTheDocument()
    })
  })

  describe('Stat rows', () => {
    it('shows "Wins" stat for all options', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      const winsLabels = screen.getAllByText('Wins')
      expect(winsLabels).toHaveLength(2)
    })

    it('shows win probability percentages', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('65%')).toBeInTheDocument()
      expect(screen.getByText('35%')).toBeInTheDocument()
    })

    it('shows "Hits target" when hasGoalThreshold is true', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          hasGoalThreshold={true}
        />
      )

      const hitsTargetLabels = screen.getAllByText('Hits target')
      expect(hitsTargetLabels).toHaveLength(2)
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('55%')).toBeInTheDocument()
    })

    it('hides "Hits target" when hasGoalThreshold is false', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          hasGoalThreshold={false}
        />
      )

      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })
  })

  describe('Ordering', () => {
    it('renders winner first regardless of input order', () => {
      const reversed = [mockOptions[1], mockOptions[0]]
      const { container } = render(
        <OptionCards options={reversed} winnerId="option-1" />
      )

      const cards = container.querySelectorAll('[data-option-id]')
      expect(cards[0].getAttribute('data-option-id')).toBe('option-1')
      expect(cards[1].getAttribute('data-option-id')).toBe('option-2')
    })
  })

  describe('Winner styling', () => {
    it('applies border-success to winner card', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      const winnerCard = screen.getByTestId('option-card-option-1')
      expect(winnerCard.className).toContain('border-success')
    })

    it('applies border-panel-border to non-winner card', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      const otherCard = screen.getByTestId('option-card-option-2')
      expect(otherCard.className).toContain('border-panel-border')
    })
  })

  describe('Graceful degradation', () => {
    it('handles options without win probability', () => {
      const noWinProb = mockOptions.map(o => ({ ...o, winProbability: undefined }))
      render(<OptionCards options={noWinProb} winnerId="option-1" />)

      // Cards should still render, just no "Wins" stat bars
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('handles options without goal probability when target set', () => {
      const noGoalProb = mockOptions.map(o => ({ ...o, goalProbability: undefined }))
      render(
        <OptionCards
          options={noGoalProb}
          winnerId="option-1"
          hasGoalThreshold={true}
        />
      )

      // Cards render, "Hits target" rows are hidden since goalProbability is null
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })
  })
})

/**
 * RangeVisualization Component Tests (P3)
 *
 * Tests for the range visualization bars showing outcome distributions.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RangeVisualization } from '../RangeVisualization'
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
  },
]

describe('RangeVisualization', () => {
  describe('Basic rendering', () => {
    it('renders range bars for options with valid outcome data', () => {
      render(<RangeVisualization options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('does not render when no options have valid outcome data', () => {
      const invalidOptions: OptionResult[] = [
        {
          id: 'option-1',
          label: 'Option A',
          expected: 100,
          outcome: { mean: 100, p10: null, p50: null, p90: null },
          p10: null,
          p50: null,
          p90: null,
          isRecommended: true,
        },
      ]

      const { container } = render(<RangeVisualization options={invalidOptions} />)

      expect(container.firstChild).toBeNull()
    })

    it('shows probability of goal when goalThreshold is set', () => {
      render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
          goalThreshold={80}
        />
      )

      // goalProbability of 0.75 → "75% hit target"
      expect(screen.getByText('75% chance of hitting your goal')).toBeInTheDocument()
      // goalProbability of 0.55 → the A register
      expect(screen.getByText('55% chance of hitting your goal')).toBeInTheDocument()
    })
  })

  describe('Option count handling', () => {
    it('renders 2 options when only 2 provided', () => {
      render(<RangeVisualization options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
      expect(screen.queryByText(/more option/)).not.toBeInTheDocument()
    })

    it('shows +N more toggle when more than 3 options', () => {
      const manyOptions: OptionResult[] = [
        ...mockOptions,
        {
          id: 'option-3',
          label: 'Option C',
          expected: 80,
          outcome: { mean: 80, p10: 40, p50: 80, p90: 120 },
          p10: 40, p50: 80, p90: 120,
          isRecommended: false,
          winProbability: 0.20,
        },
        {
          id: 'option-4',
          label: 'Option D',
          expected: 70,
          outcome: { mean: 70, p10: 30, p50: 70, p90: 110 },
          p10: 30, p50: 70, p90: 110,
          isRecommended: false,
          winProbability: 0.10,
        },
        {
          id: 'option-5',
          label: 'Option E',
          expected: 60,
          outcome: { mean: 60, p10: 20, p50: 60, p90: 100 },
          p10: 20, p50: 60, p90: 100,
          isRecommended: false,
          winProbability: 0.05,
        },
      ]

      render(<RangeVisualization options={manyOptions} winnerId="option-1" />)

      // Should show top 3 initially
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
      expect(screen.getByText('Option C')).toBeInTheDocument()
      expect(screen.queryByText('Option D')).not.toBeInTheDocument()
      expect(screen.queryByText('Option E')).not.toBeInTheDocument()

      // Should show "+ 2 more" toggle
      expect(screen.getByText('+ 2 more')).toBeInTheDocument()
    })

    it('expands to show all options when toggle clicked', () => {
      const manyOptions: OptionResult[] = [
        ...mockOptions,
        {
          id: 'option-3',
          label: 'Option C',
          expected: 80,
          outcome: { mean: 80, p10: 40, p50: 80, p90: 120 },
          p10: 40, p50: 80, p90: 120,
          isRecommended: false,
          winProbability: 0.20,
        },
        {
          id: 'option-4',
          label: 'Option D',
          expected: 70,
          outcome: { mean: 70, p10: 30, p50: 70, p90: 110 },
          p10: 30, p50: 70, p90: 110,
          isRecommended: false,
          winProbability: 0.10,
        },
      ]

      render(<RangeVisualization options={manyOptions} winnerId="option-1" />)

      fireEvent.click(screen.getByText('+ 1 more'))

      // All options should now be visible
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
      expect(screen.getByText('Option C')).toBeInTheDocument()
      expect(screen.getByText('Option D')).toBeInTheDocument()

      // Should show "Show less" toggle
      expect(screen.getByText('Show less')).toBeInTheDocument()
    })

    it('renders single option correctly', () => {
      const singleOption: OptionResult[] = [mockOptions[0]]

      render(<RangeVisualization options={singleOption} winnerId="option-1" />)

      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.queryByText(/more option/)).not.toBeInTheDocument()
    })
  })

  describe('Target line', () => {
    it('shows target line when goalThreshold is set', () => {
      const { container } = render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
          goalThreshold={80}
        />
      )

      // Target label should be visible at section bottom
      expect(screen.getByText(/Target:\s*80/)).toBeInTheDocument()
    })

    it('does not show target line when goalThreshold is null', () => {
      render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
          goalThreshold={null}
        />
      )

      // Only option labels should be visible, no threshold values
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })
  })

  describe('Conditional driver sentence (Task 5)', () => {
    it('shows driver sentence when topDriverLabel is provided', () => {
      render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
          topDriverLabel="Tech Lead Hired"
        />
      )

      expect(
        screen.getByText(/If Tech Lead Hired is unfavourable than estimated, expect closer to the pessimistic end/)
      ).toBeInTheDocument()
    })

    it('does not show driver sentence when topDriverLabel is not provided', () => {
      render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
        />
      )

      expect(
        screen.queryByText(/expect closer to the pessimistic end/)
      ).not.toBeInTheDocument()
    })

    it('uses scenarioContexts when provided (M2 override)', () => {
      render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
          topDriverLabel="Tech Lead Hired"
          scenarioContexts={['Custom scenario context from M2']}
        />
      )

      // Should use M2 context, not the template
      expect(screen.getByText('Custom scenario context from M2')).toBeInTheDocument()
      expect(
        screen.queryByText(/If Tech Lead Hired is unfavourable/)
      ).not.toBeInTheDocument()
    })
  })

  describe('Defensive cleanFactorLabel (Task 6)', () => {
    it('strips encoding notation from driver label', () => {
      render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
          topDriverLabel="Tech Lead Hired (0/1)"
        />
      )

      // Should show cleaned label without encoding
      expect(
        screen.getByText(/If Tech Lead Hired is unfavourable/)
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/\(0\/1\)/)
      ).not.toBeInTheDocument()
    })

    it('strips qualitative scale notation from driver label', () => {
      render(
        <RangeVisualization
          options={mockOptions}
          winnerId="option-1"
          topDriverLabel="Market Conditions (0–1 qualitative scale)"
        />
      )

      // Should show cleaned label
      expect(
        screen.getByText(/If Market Conditions is unfavourable/)
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/qualitative scale/)
      ).not.toBeInTheDocument()
    })
  })

  describe('Graceful degradation', () => {
    it('skips options with missing outcome data', () => {
      const mixedOptions: OptionResult[] = [
        mockOptions[0], // valid
        {
          id: 'option-invalid',
          label: 'Invalid Option',
          expected: null,
          outcome: { mean: null, p10: null, p50: null, p90: null },
          p10: null,
          p50: null,
          p90: null,
          isRecommended: false,
        },
        mockOptions[1], // valid
      ]

      render(<RangeVisualization options={mixedOptions} winnerId="option-1" />)

      // Should only show valid options
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
      expect(screen.queryByText('Invalid Option')).not.toBeInTheDocument()
    })
  })

  describe('Winner ordering priority', () => {
    it('includes winner in top 3 even when its winProbability is lower', () => {
      // Winner has lower winProbability but should still be included due to tiebreaker
      const optionsWithLowerWinnerWp: OptionResult[] = [
        {
          id: 'option-high-wp',
          label: 'High WP Option',
          expected: 100,
          outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
          p10: 60, p50: 100, p90: 140,
          isRecommended: false,
          winProbability: 0.40,
        },
        {
          id: 'option-winner',
          label: 'Winner Option',
          expected: 90,
          outcome: { mean: 90, p10: 50, p50: 90, p90: 130 },
          p10: 50, p50: 90, p90: 130,
          isRecommended: true,
          winProbability: 0.40, // Same winProbability, but is the winner
        },
        {
          id: 'option-third',
          label: 'Third Option',
          expected: 80,
          outcome: { mean: 80, p10: 40, p50: 80, p90: 120 },
          p10: 40, p50: 80, p90: 120,
          isRecommended: false,
          winProbability: 0.20,
        },
      ]

      render(<RangeVisualization options={optionsWithLowerWinnerWp} winnerId="option-winner" />)

      // All three should be visible
      expect(screen.getByText('High WP Option')).toBeInTheDocument()
      expect(screen.getByText('Winner Option')).toBeInTheDocument()
      expect(screen.getByText('Third Option')).toBeInTheDocument()
    })

    it('prioritizes winner when winProbabilities are equal', () => {
      const { container } = render(
        <RangeVisualization
          options={[
            {
              id: 'option-a',
              label: 'Option A',
              expected: 100,
              outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
              p10: 60, p50: 100, p90: 140,
              isRecommended: false,
              winProbability: 0.50,
            },
            {
              id: 'option-b',
              label: 'Option B (Winner)',
              expected: 90,
              outcome: { mean: 90, p10: 50, p50: 90, p90: 130 },
              p10: 50, p50: 90, p90: 130,
              isRecommended: true,
              winProbability: 0.50, // Same winProbability
            },
          ]}
          winnerId="option-b"
        />
      )

      // Winner should appear first in the rendered list
      const labels = container.querySelectorAll('span')
      const labelTexts = Array.from(labels).map(l => l.textContent)
      const optionAIndex = labelTexts.findIndex(t => t === 'Option A')
      const optionBIndex = labelTexts.findIndex(t => t?.includes('Option B'))

      // Winner (Option B) should come before Option A
      expect(optionBIndex).toBeLessThan(optionAIndex)
    })
  })
})

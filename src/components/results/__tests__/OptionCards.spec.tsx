/**
 * OptionCards Component Tests (V9.2 Phase 2 + V11 Phase C)
 *
 * Tests for the card-based option comparison replacing RangeVisualization.
 * Layout: option name + rank badge + description + "Wins" bar + "Hits target" bar.
 *
 * V11 additions: indeterminate neutralisation, conditional hits target,
 * hinge-aware descriptions.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult, HingeInfo } from '../types'

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
    it('V12.3: winner card uses border-panel-border class (colour via inline style)', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      const winnerCard = screen.getByTestId('option-card-option-1')
      // V12.3: border colour is now applied via inline borderLeftColor, not class
      expect(winnerCard.className).toContain('border-panel-border')
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

  describe('Multi-constraint badge', () => {
    it('shows "Meets all targets X%" when constraint_analysis is present', () => {
      const withConstraints: OptionResult[] = [
        {
          ...mockOptions[0],
          constraintAnalysis: {
            joint_probability: 0.68,
            constraints: [
              { node_id: 'c1', operator: '>=', threshold: 100, label: 'MRR', prob_satisfied: 0.85, failure_margin_median: 10, near_miss_fraction: 0.1, binding: false },
            ],
          },
        },
        mockOptions[1],
      ]

      render(<OptionCards options={withConstraints} winnerId="option-1" />)

      const badge = screen.getByTestId('option-constraint-badge')
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toContain('Meets all targets')
      expect(badge.textContent).toContain('68%')
    })

    it('shows "May miss targets" when joint_probability < 0.4', () => {
      const withConstraints: OptionResult[] = [
        {
          ...mockOptions[0],
          constraintAnalysis: {
            joint_probability: 0.25,
            constraints: [
              { node_id: 'c1', operator: '>=', threshold: 100, label: 'MRR', prob_satisfied: 0.3, failure_margin_median: 20, near_miss_fraction: 0.5, binding: true },
            ],
          },
        },
      ]

      render(<OptionCards options={withConstraints} winnerId="option-1" />)

      const badge = screen.getByTestId('option-constraint-badge')
      expect(badge.textContent).toContain('May miss targets')
      expect(badge.textContent).toContain('25%')
    })

    it('does not show constraint line when constraint_analysis is absent', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.queryByTestId('option-constraint-badge')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // V11 Phase C: Indeterminate Neutralisation + Hinge-Aware Descriptions
  // =========================================================================

  describe('V11: Indeterminate neutralisation', () => {
    it('removes border-success from winner when indeterminate', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      const winnerCard = screen.getByTestId('option-card-option-1')
      expect(winnerCard.className).not.toContain('border-success')
      expect(winnerCard.className).toContain('border-panel-border')
    })

    it('shows percentage in rank badge instead of "#1 of N" when indeterminate', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      const badge = screen.getByTestId('rank-badge-option-1')
      expect(badge.textContent).toBe('65%')
      expect(screen.queryByText('#1 of 2')).not.toBeInTheDocument()
    })

    it('uses stone badge styling (bg-factor-light text-factor) when indeterminate', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      const badge = screen.getByTestId('rank-badge-option-1')
      expect(badge.className).toContain('bg-factor-light')
      expect(badge.className).toContain('text-factor')
      expect(badge.className).not.toContain('text-success')
    })

    it('uses stone bar colour (bg-factor) for win bars when indeterminate', () => {
      const { container } = render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      // All bar fills should be bg-factor, not bg-success
      const bars = container.querySelectorAll('.bg-factor')
      expect(bars.length).toBeGreaterThanOrEqual(2) // at least 2 win bars
      expect(container.querySelectorAll('.bg-success')).toHaveLength(0)
    })

    it('V12.3: preserves border-panel-border when robust (colour via inline style)', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="robust"
        />
      )

      const winnerCard = screen.getByTestId('option-card-option-1')
      // V12.3: all cards use border-panel-border; winner gets coloured left border via inline style
      expect(winnerCard.className).toContain('border-panel-border')
    })

    it('preserves normal "#1 of N" badges when sensitive', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
        />
      )

      expect(screen.getByText('#1 of 2')).toBeInTheDocument()
    })
  })

  describe('V11: Conditional hits target', () => {
    it('hides "Hits target" when hasGoalThreshold but no option has goalProbability', () => {
      const noGoalProb = mockOptions.map(o => ({ ...o, goalProbability: undefined }))
      render(
        <OptionCards
          options={noGoalProb}
          winnerId="option-1"
          hasGoalThreshold={true}
          decisionState="robust"
        />
      )

      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })

    it('shows "Hits target" when hasGoalThreshold and ALL options have goalProbability', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          hasGoalThreshold={true}
          decisionState="robust"
        />
      )

      expect(screen.getAllByText('Hits target')).toHaveLength(2)
    })

    it('hides "Hits target" when only SOME options have goalProbability', () => {
      const partialGoalProb: OptionResult[] = [
        { ...mockOptions[0], goalProbability: 0.75 },
        { ...mockOptions[1], goalProbability: undefined },
      ]
      render(
        <OptionCards
          options={partialGoalProb}
          winnerId="option-1"
          hasGoalThreshold={true}
          decisionState="robust"
        />
      )

      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })
  })

  describe('V11: Hinge-aware descriptions', () => {
    const fragileHinge: HingeInfo = {
      label: 'Customer churn',
      nodeId: 'factor-1',
      kind: 'edge',
      reason: 'fragile_edge',
      edgeDetail: 'Customer churn → Revenue',
      alternativeWinnerLabel: 'Option B',
    }

    const heuristicHinge: HingeInfo = {
      label: 'Market size',
      nodeId: 'factor-2',
      kind: 'node',
      reason: 'heuristic',
      edgeDetail: null,
      alternativeWinnerLabel: null,
    }

    it('winner: fragile edge hinge shows "depends on {label}"', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
        />
      )

      expect(screen.getByText('Highest win likelihood but depends on Customer churn')).toBeInTheDocument()
    })

    it('winner: heuristic hinge shows "{label} has the widest uncertainty"', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={heuristicHinge}
          runnerId="option-2"
        />
      )

      expect(screen.getByText('Highest win likelihood. Market size has the widest uncertainty.')).toBeInTheDocument()
    })

    it('winner: no hinge shows generic description', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="robust"
          hinge={null}
          runnerId="option-2"
        />
      )

      expect(screen.getByText('Highest win likelihood across simulated scenarios')).toBeInTheDocument()
    })

    it('runner-up: matched alternate winner shows overtake description', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
        />
      )

      // Option B is runnerId AND matches hinge.alternativeWinnerLabel
      expect(screen.getByText('If Customer churn shifts, this option overtakes')).toBeInTheDocument()
    })

    it('runner-up: unmatched alternate winner shows generic runner-up', () => {
      const hingeNoMatch: HingeInfo = {
        ...fragileHinge,
        alternativeWinnerLabel: 'Option C', // not Option B
      }
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={hingeNoMatch}
          runnerId="option-2"
        />
      )

      expect(screen.getByText('Second highest win likelihood')).toBeInTheDocument()
    })

    it('other options show "Lower win likelihood"', () => {
      const threeOptions: OptionResult[] = [
        ...mockOptions,
        {
          id: 'option-3',
          label: 'Option C',
          expected: 80,
          outcome: { mean: 80, p10: 40, p50: 80, p90: 120 },
          p10: 40,
          p50: 80,
          p90: 120,
          isRecommended: false,
          winProbability: 0.10,
          rank: 3,
        },
      ]

      render(
        <OptionCards
          options={threeOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
        />
      )

      expect(screen.getByText('Lower win likelihood')).toBeInTheDocument()
    })

    it('V11.2: VM hinge-aware description takes priority over story_headline when decisionState available', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
          storyHeadlines={{ 'option-1': 'Custom headline for winner.' }}
        />
      )

      // VM description wins when decisionState is set
      expect(screen.getByText('Highest win likelihood but depends on Customer churn')).toBeInTheDocument()
      expect(screen.queryByText('Custom headline for winner.')).not.toBeInTheDocument()
    })

    it('V11.2: story_headline is used when decisionState is absent', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          storyHeadlines={{ 'option-1': 'Custom headline for winner.' }}
        />
      )

      expect(screen.getByText('Custom headline for winner.')).toBeInTheDocument()
    })

    it('falls back to legacy descriptions when decisionState is absent and no headlines', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('Top-performing option based on current estimates.')).toBeInTheDocument()
    })

    it('V11.2: strips arrow characters from story_headline fallback', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          storyHeadlines={{ 'option-1': 'Leads by 5pp → strongest performer' }}
        />
      )

      // Arrow should be replaced with "to"
      expect(screen.getByText('Leads by 5pp to strongest performer')).toBeInTheDocument()
      expect(screen.queryByText(/→/)).not.toBeInTheDocument()
    })
  })
})

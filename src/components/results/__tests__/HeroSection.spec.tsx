/**
 * HeroSection Tests (P1)
 *
 * Tests for the restructured hero section with M1 templates and M2 integration.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeroSection, type HeroSectionProps } from '../HeroSection'

// Mock focusNodeById
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

const baseProps: HeroSectionProps = {
  winnerLabel: 'Option A',
  winnerId: 'option-a',
  optionCount: 3,
  hasBaseline: false,
  analysisStatus: 'computed',
}

describe('HeroSection', () => {
  describe('M1 Headline Precedence', () => {
    it('shows partial analysis message when status is partial (rule 1)', () => {
      render(
        <HeroSection
          {...baseProps}
          analysisStatus="partial"
        />
      )

      expect(screen.getByText(/Some analysis steps did not complete/)).toBeInTheDocument()
    })

    it('shows no clear front-runner when stability < 0.55 (rule 2)', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.45}
        />
      )

      expect(screen.getByText(/No clear front-runner/)).toBeInTheDocument()
    })

    it('shows goal probability when present (rule 3)', () => {
      render(
        <HeroSection
          {...baseProps}
          winnerGoalProbability={0.85}
          goalThreshold={100}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Option A performs strongest — 85% chance of achieving your goal/)).toBeInTheDocument()
    })

    it('shows fallback headline when no special conditions (rule 4)', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText('Option A performs strongest')).toBeInTheDocument()
    })

    it('precedence rule 2 overrides rule 3 (low stability beats goal probability)', () => {
      render(
        <HeroSection
          {...baseProps}
          winnerGoalProbability={0.85}
          goalThreshold={100}
          recommendationStability={0.4} // Below 0.55
        />
      )

      expect(screen.getByText(/No clear front-runner/)).toBeInTheDocument()
      expect(screen.queryByText(/85% chance/)).not.toBeInTheDocument()
    })
  })

  describe('M1 Bullets', () => {
    it('shows comparative bullet with goal probabilities when available', () => {
      render(
        <HeroSection
          {...baseProps}
          winnerGoalProbability={0.85}
          runnerUpGoalProbability={0.65}
          runnerUpLabel="Option B"
          runnerUpId="option-b"
          goalThreshold={100}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/85% vs 65% chance of achieving your goal/)).toBeInTheDocument()
    })

    it('shows "outperforms most consistently" when no goal probabilities', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Option A outperforms alternatives most consistently/)).toBeInTheDocument()
    })

    it('shows single option message when optionCount is 1', () => {
      render(
        <HeroSection
          {...baseProps}
          optionCount={1}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Only one option analysed/)).toBeInTheDocument()
    })

    it('shows top drivers bullet when drivers present', () => {
      render(
        <HeroSection
          {...baseProps}
          topDrivers={[
            { id: 'factor-1', label: 'Market Size (0-100)' },
            { id: 'factor-2', label: 'Tech Lead Hired (0/1)' },
          ]}
          recommendationStability={0.9}
        />
      )

      // Should clean encoding notation
      expect(screen.getByText(/Market Size and Tech Lead Hired are the biggest drivers/)).toBeInTheDocument()
    })

    it('shows single driver message when only one driver', () => {
      render(
        <HeroSection
          {...baseProps}
          topDrivers={[{ id: 'factor-1', label: 'Market Size' }]}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Market Size is the biggest driver/)).toBeInTheDocument()
    })

    it('shows balanced factors message when no drivers', () => {
      render(
        <HeroSection
          {...baseProps}
          topDrivers={[]}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/No dominant drivers identified/)).toBeInTheDocument()
    })

    it('shows fragile edge risk bullet when present', () => {
      render(
        <HeroSection
          {...baseProps}
          topFragileEdge={{
            fromId: 'factor-1',
            fromLabel: 'Market Size (0-100)',
            toId: 'outcome-1',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
          }}
          recommendationStability={0.9}
        />
      )

      // Should clean encoding notation
      expect(screen.getByText(/If the link between Market Size and Revenue is weaker than expected, Option B becomes the stronger option/)).toBeInTheDocument()
    })

    it('shows stable result message when no fragile edges', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Result is stable across all assumptions tested/)).toBeInTheDocument()
    })
  })

  describe('Stability Label', () => {
    it('shows "Stable result" for stability >= 0.85', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.92}
        />
      )

      expect(screen.getByText('Stable result')).toBeInTheDocument()
    })

    it('shows "Mostly stable" for stability >= 0.70', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.75}
        />
      )

      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
    })

    it('shows "Sensitive to assumptions" for stability >= 0.55', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.60}
        />
      )

      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
    })

    it('shows "Highly sensitive" for stability < 0.55', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.40}
        />
      )

      expect(screen.getByText('Highly sensitive')).toBeInTheDocument()
    })
  })

  describe('Learn More Expand', () => {
    it('shows "Learn more" link', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByRole('button', { name: /Learn more/i })).toBeInTheDocument()
    })

    it('expands on click to show technical details', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          nSamples={10000}
          fragileEdgeCount={3}
          robustEdgeCount={12}
          seedUsed={42}
          responseHash="abc123def456"
        />
      )

      const expandButton = screen.getByRole('button', { name: /Learn more/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Technical details')).toBeInTheDocument()
      expect(screen.getByText('90% of assumption tests')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument() // Fragile assumptions
      expect(screen.getByText('12')).toBeInTheDocument() // Stable assumptions
      expect(screen.getByText('10,000')).toBeInTheDocument() // Scenarios
      expect(screen.getByText('42')).toBeInTheDocument() // Seed
    })

    it('shows M1 coaching narrative when no M2 content', () => {
      render(
        <HeroSection
          {...baseProps}
          winnerGoalProbability={0.85}
          runnerUpGoalProbability={0.65}
          runnerUpLabel="Option B"
          goalThreshold={100}
          recommendationStability={0.9}
          nSamples={10000}
        />
      )

      const expandButton = screen.getByRole('button', { name: /Learn more/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Analysis summary')).toBeInTheDocument()
      expect(screen.getByText(/Based on 10,000 simulated scenarios/)).toBeInTheDocument()
    })

    it('collapses when "Show less" is clicked', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          nSamples={10000}
        />
      )

      const expandButton = screen.getByRole('button', { name: /Learn more/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Technical details')).toBeInTheDocument()

      const collapseButton = screen.getByRole('button', { name: /Show less/i })
      fireEvent.click(collapseButton)

      expect(screen.queryByText('Technical details')).not.toBeInTheDocument()
    })
  })

  describe('M2 Content Integration', () => {
    it('uses M2 headline when available and stability is high', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          m2Headline="Custom M2 headline"
        />
      )

      expect(screen.getByText('Custom M2 headline')).toBeInTheDocument()
    })

    it('keeps M1 headline when stability < 0.55 even if M2 is available', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.4}
          m2Headline="Custom M2 headline"
        />
      )

      expect(screen.getByText(/No clear front-runner/)).toBeInTheDocument()
      expect(screen.queryByText('Custom M2 headline')).not.toBeInTheDocument()
    })

    it('shows M2 bias insights when available', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          nSamples={10000}
          m2BiasInsights={[
            'Are you overweighting recent experiences?',
            'Have you considered opposing viewpoints?',
          ]}
        />
      )

      const expandButton = screen.getByRole('button', { name: /Learn more/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Questions to consider')).toBeInTheDocument()
      expect(screen.getByText('Are you overweighting recent experiences?')).toBeInTheDocument()
      expect(screen.getByText('Have you considered opposing viewpoints?')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles missing stability gracefully', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={undefined}
        />
      )

      // Should not crash and should show fallback headline
      expect(screen.getByText('Option A performs strongest')).toBeInTheDocument()
    })

    it('handles missing drivers gracefully', () => {
      render(
        <HeroSection
          {...baseProps}
          topDrivers={undefined}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/No dominant drivers identified/)).toBeInTheDocument()
    })

    it('cleans encoding notation from all labels', () => {
      render(
        <HeroSection
          {...baseProps}
          topDrivers={[
            { id: 'f1', label: 'Factor (0/1)' },
            { id: 'f2', label: 'Another (0-100)' },
          ]}
          topFragileEdge={{
            fromId: 'f1',
            fromLabel: 'Source (0/1)',
            toId: 'f2',
            toLabel: 'Target (yes/no)',
            alternativeWinnerLabel: 'Alt Option',
          }}
          recommendationStability={0.9}
        />
      )

      // Should not contain encoding patterns
      const html = document.body.innerHTML
      expect(html).not.toContain('(0/1)')
      expect(html).not.toContain('(0-100)')
      expect(html).not.toContain('(yes/no)')
    })
  })

  describe('Accessibility', () => {
    it('has correct aria-expanded attribute', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      const expandButton = screen.getByRole('button', { name: /Learn more/i })
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(expandButton)
      expect(expandButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('has data-testid for component identification', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })
  })
})

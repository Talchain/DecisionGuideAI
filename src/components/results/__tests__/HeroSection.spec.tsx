/**
 * HeroSection Tests (V9.2)
 *
 * Tests for the restructured hero section:
 * - Merged headline: "To achieve [goal], [winner] performs best"
 * - Condition card (replaces bullets)
 * - 1-line coaching narrative
 * - Simplified "More" expand: narrative + stability summary
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeroSection, type HeroSectionProps } from '../HeroSection'

// Mock focusByTarget (used by GraphLink)
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusByTarget: vi.fn(),
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
  describe('Merged Headline', () => {
    it('shows partial analysis message when status is partial (rule 1)', () => {
      render(
        <HeroSection
          {...baseProps}
          analysisStatus="partial"
        />
      )

      expect(screen.getByText(/Some analysis steps did not complete/)).toBeInTheDocument()
    })

    it('shows "no clear winner" when stability < 0.55 (rule 2)', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.45}
        />
      )

      // V9.2: merged headline — lowercase "no clear winner" after "To achieve..."
      expect(screen.getByText(/no clear winner/)).toBeInTheDocument()
      expect(screen.getByText(/sensitive to your estimates/)).toBeInTheDocument()
    })

    it('shows "[winner] performs best" for standard case (rule 4)', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText('Option A performs best')).toBeInTheDocument()
    })

    it('shows "[winner] is your only option" for single option', () => {
      render(
        <HeroSection
          {...baseProps}
          optionCount={1}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Option A is your only option/)).toBeInTheDocument()
    })

    it('includes goal label in merged headline', () => {
      render(
        <HeroSection
          {...baseProps}
          goalLabel="increase revenue"
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/To achieve increase revenue,/)).toBeInTheDocument()
    })

    it('falls back to "your goal" when no goal label', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/To achieve your goal,/)).toBeInTheDocument()
    })

    it('precedence rule 2 overrides normal headline (low stability)', () => {
      render(
        <HeroSection
          {...baseProps}
          winnerGoalProbability={0.85}
          goalThreshold={100}
          recommendationStability={0.4}
        />
      )

      expect(screen.getByText(/no clear winner/)).toBeInTheDocument()
    })
  })

  describe('M2 Headline Override', () => {
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

      expect(screen.getByText(/no clear winner/)).toBeInTheDocument()
      expect(screen.queryByText('Custom M2 headline')).not.toBeInTheDocument()
    })
  })

  describe('Goal Probability Line', () => {
    it('shows probability line when goalThreshold and winnerGoalProbability are set', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          goalThreshold={100}
          winnerGoalProbability={0.72}
        />
      )

      expect(screen.getByText(/Option A has a 72% chance of reaching your target of 100/)).toBeInTheDocument()
    })

    it('hides probability line when goalThreshold is null', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          goalThreshold={null}
          winnerGoalProbability={0.72}
        />
      )

      expect(screen.queryByText(/chance of reaching your target/)).not.toBeInTheDocument()
    })

    it('hides probability line when winnerGoalProbability is null', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          goalThreshold={100}
          winnerGoalProbability={null}
        />
      )

      expect(screen.queryByText(/chance of reaching your target/)).not.toBeInTheDocument()
    })

    it('hides probability line when both are absent', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.queryByText(/chance of reaching your target/)).not.toBeInTheDocument()
    })
  })

  describe('Condition Card', () => {
    it('shows specific condition card when fragile edge has resolved labels', () => {
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

      // Condition card should contain fragile edge info (encoding notation cleaned)
      const card = screen.getByText(/is weaker than expected/)
      expect(card).toBeInTheDocument()
      expect(screen.getByText(/Option B becomes stronger/)).toBeInTheDocument()
    })

    it('shows generic condition card when labels are unresolved', () => {
      render(
        <HeroSection
          {...baseProps}
          topFragileEdge={{
            fromId: 'factor-1',
            fromLabel: 'Unknown',
            toId: 'outcome-1',
            toLabel: 'Unknown',
            alternativeWinnerLabel: 'Unknown',
            labelsResolved: false,
          }}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Some estimates could change the recommendation/)).toBeInTheDocument()
    })

    it('does not render condition card when no fragile edges', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.queryByText(/is weaker than expected/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Some estimates could change/)).not.toBeInTheDocument()
    })

    it('condition card GraphLink calls onFocusNode on click', () => {
      const onFocusNode = vi.fn()

      render(
        <HeroSection
          {...baseProps}
          topFragileEdge={{
            fromId: 'factor-1',
            fromLabel: 'Market Size',
            toId: 'outcome-1',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
          }}
          recommendationStability={0.9}
          onFocusNode={onFocusNode}
        />
      )

      // GraphLink is a <button> with aria-label
      const graphLink = screen.getByRole('button', { name: /Focus on Market Size/ })
      fireEvent.click(graphLink)

      expect(onFocusNode).toHaveBeenCalledWith('factor-1')
    })

    it('cleans encoding notation from condition card labels', () => {
      render(
        <HeroSection
          {...baseProps}
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

      const html = document.body.innerHTML
      expect(html).not.toContain('(0/1)')
      expect(html).not.toContain('(yes/no)')
    })
  })

  describe('Coaching Narrative', () => {
    it('shows 1-line coaching narrative when provided and collapsed', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          coachingHeadline="Option A is clearly the strongest choice given current estimates."
        />
      )

      expect(screen.getByText(/Option A is clearly the strongest/)).toBeInTheDocument()
    })

    it('hides coaching narrative when More is expanded', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          coachingHeadline="Option A is clearly the strongest choice."
        />
      )

      // Expand
      const expandButton = screen.getByRole('button', { name: /More/i })
      fireEvent.click(expandButton)

      // Narrative should be hidden when expanded
      expect(screen.queryByText(/Option A is clearly the strongest choice\./)).not.toBeInTheDocument()
    })

    it('does not render narrative when coachingHeadline is absent', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      // No narrative line rendered (11px font-size element)
      const narrativeElements = container.querySelectorAll('[style*="font-size: 11"]')
      // If there are any, they shouldn't have coaching text
      narrativeElements.forEach(el => {
        expect(el.textContent).not.toMatch(/strongest|clearly/)
      })
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

  describe('More / Less Expand', () => {
    it('shows "More" toggle button', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument()
    })

    it('expands to show stability summary on click', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          nSamples={10000}
          fragileEdgeCount={3}
        />
      )

      const expandButton = screen.getByRole('button', { name: /More/i })
      fireEvent.click(expandButton)

      // V9.2: Stability summary rows
      expect(screen.getByText('Stability')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
      expect(screen.getByText('Fragile edges')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Convergence')).toBeInTheDocument()
      expect(screen.getByText(/10,000 simulations/)).toBeInTheDocument()
    })

    it('shows coaching paragraph when expanded', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          coachingParagraph="This is a full narrative paragraph about the analysis results."
        />
      )

      const expandButton = screen.getByRole('button', { name: /More/i })
      fireEvent.click(expandButton)

      expect(screen.getByText(/full narrative paragraph/)).toBeInTheDocument()
    })

    it('collapses when "Less" is clicked', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          nSamples={10000}
          fragileEdgeCount={3}
        />
      )

      const expandButton = screen.getByRole('button', { name: /More/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Stability')).toBeInTheDocument()

      const collapseButton = screen.getByRole('button', { name: /Less/i })
      fireEvent.click(collapseButton)

      expect(screen.queryByText('Convergence')).not.toBeInTheDocument()
    })

    it('does not show "Technical detail" (moved to Advanced in Phase 4)', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
          nSamples={10000}
          fragileEdgeCount={3}
        />
      )

      const expandButton = screen.getByRole('button', { name: /More/i })
      fireEvent.click(expandButton)

      expect(screen.queryByText('Technical detail')).not.toBeInTheDocument()
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

      expect(screen.getByText('Option A performs best')).toBeInTheDocument()
    })

    it('renders without crashing when no optional props provided', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
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

      const expandButton = screen.getByRole('button', { name: /More/i })
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(expandButton)
      const lessButton = screen.getByRole('button', { name: /Less/i })
      expect(lessButton).toHaveAttribute('aria-expanded', 'true')
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

    it('condition card GraphLink is a button with aria-label', () => {
      render(
        <HeroSection
          {...baseProps}
          topFragileEdge={{
            fromId: 'factor-1',
            fromLabel: 'Market Size',
            toId: 'outcome-1',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
          }}
          recommendationStability={0.9}
        />
      )

      const graphLink = screen.getByRole('button', { name: /Focus on Market Size/ })
      expect(graphLink).toBeInTheDocument()
      expect(graphLink).toHaveClass('cursor-pointer')
    })
  })

  // ===========================================================================
  // V11: Structured Hero — decisionState-driven path
  // ===========================================================================
  describe('V11: Structured Hero Rows', () => {
    const v11Props: HeroSectionProps = {
      ...baseProps,
      recommendationStability: 0.85,
      winnerWinProbability: 0.62,
      runnerUpLabel: 'Option B',
      runnerUpId: 'option-b',
      runnerUpWinProbability: 0.30,
      goalLabel: 'increase revenue',
    }

    describe('Robust state', () => {
      it('renders "Leads" row with winner in green', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
          />
        )

        expect(screen.getByTestId('hero-rows')).toBeInTheDocument()
        expect(screen.getByText('Leads')).toBeInTheDocument()
        expect(screen.getByText('Option A')).toHaveClass('text-success')
        expect(screen.getByText(/62% win likelihood/)).toBeInTheDocument()
      })

      it('renders Status row with "No single assumption could flip this"', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
          />
        )

        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText(/No single assumption could flip this/)).toBeInTheDocument()
      })

      it('renders hinge link in Status row when hinge is provided', () => {
        const onFocusNode = vi.fn()

        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
            hinge={{
              label: 'Market Size',
              nodeId: 'factor-1',
              kind: 'edge',
              reason: 'fragile_edge',
              edgeDetail: 'Market Size → Revenue',
              alternativeWinnerLabel: null,
            }}
            onFocusNode={onFocusNode}
          />
        )

        const link = screen.getByRole('button', { name: /Focus on Market Size/ })
        expect(link).toBeInTheDocument()
        fireEvent.click(link)
        expect(onFocusNode).toHaveBeenCalledWith('factor-1')
      })
    })

    describe('Sensitive state', () => {
      it('renders "Leads" row and "Validate first" label', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="sensitive"
            hinge={{
              label: 'Customer Growth',
              nodeId: 'factor-2',
              kind: 'node',
              reason: 'voi',
              edgeDetail: null,
              alternativeWinnerLabel: null,
            }}
          />
        )

        expect(screen.getByText('Leads')).toBeInTheDocument()
        expect(screen.getByText('Validate first')).toBeInTheDocument()
      })
    })

    describe('Indeterminate state', () => {
      it('renders "Result" row with "No clear winner" and percentages', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="indeterminate"
          />
        )

        expect(screen.getByText('Result')).toBeInTheDocument()
        expect(screen.getByText(/No clear winner/)).toBeInTheDocument()
        expect(screen.getByText(/62% vs 30%/)).toBeInTheDocument()
      })

      it('renders "Resolve first" label with hinge', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="indeterminate"
            hinge={{
              label: 'Adoption Rate',
              nodeId: 'factor-3',
              kind: 'edge',
              reason: 'fragile_edge',
              edgeDetail: 'Adoption Rate → Market Share',
              alternativeWinnerLabel: 'Option B',
            }}
          />
        )

        expect(screen.getByText('Resolve first')).toBeInTheDocument()
        const link = screen.getByRole('button', { name: /Focus on Adoption Rate/ })
        expect(link).toBeInTheDocument()
      })

      it('does not render winner in green', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="indeterminate"
          />
        )

        // "No clear winner" should be text-text-body (muted), not text-success
        const resultText = screen.getByText(/No clear winner/)
        expect(resultText).toHaveClass('text-text-body')
        expect(resultText).not.toHaveClass('text-success')
      })
    })
  })

  describe('V11: Meta Strip', () => {
    it('renders evidence badge for "good" level', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          evidenceLevel="good"
        />
      )

      const badge = screen.getByTestId('evidence-badge')
      expect(badge).toHaveTextContent('Evidence: Good')
      expect(badge).toHaveClass('bg-success-light')
    })

    it('renders evidence badge for "fair" level', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          evidenceLevel="fair"
        />
      )

      const badge = screen.getByTestId('evidence-badge')
      expect(badge).toHaveTextContent('Evidence: Fair')
      expect(badge).toHaveClass('bg-goal-light')
    })

    it('renders evidence badge for "needs_work" level', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          evidenceLevel="needs_work"
        />
      )

      const badge = screen.getByTestId('evidence-badge')
      expect(badge).toHaveTextContent('Evidence: Needs work')
      expect(badge).toHaveClass('bg-danger-light')
    })

    it('shows meta strip with target when goalThreshold is set', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={500}
        />
      )

      const strip = screen.getByTestId('meta-strip')
      expect(strip).toHaveTextContent('Target:')
      expect(strip).toHaveTextContent('500')
    })
  })

  describe('V11: Stats Grid (More Detail)', () => {
    it('shows V11 labels: Win likelihood, Robustness, Fragile edges X of Y, Sampling', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          winnerWinProbability={0.62}
          recommendationStability={0.90}
          fragileEdgeCount={2}
          robustEdgeCount={8}
          nSamples={10000}
        />
      )

      // Expand More
      const expandButton = screen.getByRole('button', { name: /More/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Win likelihood')).toBeInTheDocument()
      expect(screen.getByText('62%')).toBeInTheDocument()
      expect(screen.getByText('Robustness')).toBeInTheDocument()
      expect(screen.getByText(/90%.*stable result/i)).toBeInTheDocument()
      expect(screen.getByText('Fragile edges')).toBeInTheDocument()
      expect(screen.getByText('2 of 10')).toBeInTheDocument()
      expect(screen.getByText('Sampling')).toBeInTheDocument()
      expect(screen.getByText(/10,000 simulations/)).toBeInTheDocument()
    })
  })

  describe('V11: Win Gauge Colour Swap', () => {
    it('uses standard colours for robust state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          optionWinShares={[
            { id: 'a', label: 'Option A', winProbability: 0.6, isWinner: true },
            { id: 'b', label: 'Option B', winProbability: 0.4, isWinner: false },
          ]}
        />
      )

      const bars = screen.getAllByRole('img')
      expect(bars[0]).toHaveStyle({ backgroundColor: 'var(--success)' })
      expect(bars[1]).toHaveStyle({ backgroundColor: 'var(--info-light)' })
    })

    it('uses factor colours for indeterminate state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          optionWinShares={[
            { id: 'a', label: 'Option A', winProbability: 0.5, isWinner: true },
            { id: 'b', label: 'Option B', winProbability: 0.45, isWinner: false },
          ]}
        />
      )

      const bars = screen.getAllByRole('img')
      expect(bars[0]).toHaveStyle({ backgroundColor: 'var(--factor)' })
      expect(bars[1]).toHaveStyle({ backgroundColor: 'var(--factor)' })
    })
  })
})

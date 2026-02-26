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
      it('V12.5: renders winner in green with win likelihood (prose layout)', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
          />
        )

        expect(screen.getByTestId('hero-rows')).toBeInTheDocument()
        expect(screen.getByText('Option A')).toHaveClass('text-success')
        expect(screen.getByText(/62% win likelihood/)).toBeInTheDocument()
      })

      it('V12.5: renders action line with hinge link when hinge is provided', () => {
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

        expect(screen.getByText(/Validate:/)).toBeInTheDocument()
        const link = screen.getByRole('button', { name: /Focus on Market Size/ })
        expect(link).toBeInTheDocument()
        fireEvent.click(link)
        expect(onFocusNode).toHaveBeenCalledWith('factor-1')
      })

      it('V12.3: omits Action row when no hinge in robust state', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
            hinge={null}
          />
        )

        expect(screen.queryByText('Action')).not.toBeInTheDocument()
      })
    })

    describe('Sensitive state', () => {
      it('V12.5: renders winner and action line with "Validate first:" content', () => {
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

        expect(screen.getByText('Option A')).toHaveClass('text-success')
        expect(screen.getByText(/Validate first:/)).toBeInTheDocument()
      })
    })

    describe('Indeterminate state', () => {
      it('V12.5: renders "No clear winner" with percentages (prose layout)', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="indeterminate"
          />
        )

        expect(screen.getByText(/No clear winner/)).toBeInTheDocument()
        expect(screen.getByText(/62% vs 30%/)).toBeInTheDocument()
      })

      it('V12.5: renders "Resolve first:" action line with hinge', () => {
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

        expect(screen.getByText(/Resolve first:/)).toBeInTheDocument()
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

        // "No clear winner" is in the result line (text-text-header), not coloured success
        const resultText = screen.getByText(/No clear winner/)
        expect(resultText).toHaveClass('text-text-header')
        expect(resultText).not.toHaveClass('text-success')
      })
    })
  })

  describe('V11: Meta Strip', () => {
    it('V12.3: does NOT render evidence badge in hero for robust state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
        />
      )

      expect(screen.queryByTestId('evidence-badge')).not.toBeInTheDocument()
    })

    it('V12.3: does NOT render evidence badge in hero for sensitive state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
        />
      )

      expect(screen.queryByTestId('evidence-badge')).not.toBeInTheDocument()
    })

    it('V12.3: does NOT render evidence badge in hero for indeterminate state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
        />
      )

      expect(screen.queryByTestId('evidence-badge')).not.toBeInTheDocument()
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
    it('V12.3: uses success/info colours for robust state', () => {
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
      expect(bars[1]).toHaveStyle({ backgroundColor: 'var(--info)' })
    })

    it('V12.3: uses info/info-light colours for indeterminate state', () => {
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
      expect(bars[0]).toHaveStyle({ backgroundColor: 'var(--info)' })
      expect(bars[1]).toHaveStyle({ backgroundColor: 'var(--info-light)' })
    })

    it('applies de-emphasis (reduced height, opacity) for indeterminate state', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          optionWinShares={[
            { id: 'a', label: 'Option A', winProbability: 0.5, isWinner: true },
            { id: 'b', label: 'Option B', winProbability: 0.45, isWinner: false },
          ]}
        />
      )

      const gauge = container.querySelector('[role="figure"]')!
      expect(gauge).toHaveClass('opacity-70')
      // Bar container should use h-2 (smaller) instead of h-3
      const barContainer = gauge.querySelector('.flex.rounded-full')!
      expect(barContainer).toHaveClass('h-2')
      expect(barContainer).not.toHaveClass('h-3')
    })
  })

  describe('V12.5: Target-unset Prompt removed', () => {
    it('does NOT show verbose target-unset prompt when goalThreshold is null', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={null}
        />
      )

      expect(screen.queryByTestId('target-unset-prompt')).not.toBeInTheDocument()
      expect(screen.queryByText(/Set a success target/)).not.toBeInTheDocument()
    })

    it('shows target value when goalThreshold is set', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={500}
        />
      )

      expect(screen.queryByTestId('target-unset-prompt')).not.toBeInTheDocument()
      expect(screen.getByTestId('meta-strip')).toHaveTextContent('500')
    })
  })

  describe('V12.3: Row-3 Fallback', () => {
    it('shows action fallback text when hinge is null in sensitive state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          hinge={null}
        />
      )

      expect(screen.getByText(/Review key assumptions before committing/)).toBeInTheDocument()
    })

    it('shows action fallback text when hinge is null in indeterminate state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          hinge={null}
        />
      )

      expect(screen.getByText(/Review key assumptions to distinguish/)).toBeInTheDocument()
    })
  })

  describe('V12.3: Action Row with Hinge', () => {
    it('shows "Validate:" action line in robust state with hinge', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          hinge={{
            label: 'Market Size',
            nodeId: 'factor-1',
            kind: 'edge',
            reason: 'fragile_edge',
            edgeDetail: 'Market Size → Revenue',
            alternativeWinnerLabel: null,
          }}
        />
      )

      expect(screen.getByText(/Validate:/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Focus on Market Size/ })).toBeInTheDocument()
    })

    it('shows "Validate first:" action line in sensitive state with hinge', () => {
      render(
        <HeroSection
          {...baseProps}
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

      expect(screen.getByText(/Validate first:/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Focus on Customer Growth/ })).toBeInTheDocument()
    })
  })

  describe('V11: Goal Row Unit Display', () => {
    it('shows currency symbol + formatted threshold for currency unit', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={100000}
          outcomeUnit="currency"
          outcomeUnitSymbol="$"
        />
      )

      expect(screen.getByTestId('hero-rows')).toHaveTextContent('$100,000')
    })

    it('shows percentage suffix for percent unit', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={75}
          outcomeUnit="percent"
        />
      )

      expect(screen.getByTestId('hero-rows')).toHaveTextContent('75%')
    })
  })

  // V12: Executive summary fields in "More detail" expand
  describe('V12: Executive summary in More detail', () => {
    it('renders decision statement when expanded', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingDecisionStatement="Acquire Competitor is the clear winner."
        />
      )

      // Click "More" to expand (high stability defaults to collapsed)
      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)

      expect(screen.getByText('Acquire Competitor is the clear winner.')).toBeInTheDocument()
    })

    it('renders key qualifier and action implication when expanded', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingKeyQualifier="Key uncertainty: Engineering Capacity"
          coachingActionImplication="Gather evidence on Engineering Capacity before deciding."
        />
      )

      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)

      expect(screen.getByText('Key uncertainty: Engineering Capacity')).toBeInTheDocument()
      expect(screen.getByText('Gather evidence on Engineering Capacity before deciding.')).toBeInTheDocument()
    })

    it('falls back to coachingParagraph when no decision statement', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingParagraph="General coaching paragraph."
        />
      )

      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)

      expect(screen.getByText('General coaching paragraph.')).toBeInTheDocument()
    })
  })

  // V12: Identifiability advisory
  describe('V12: Identifiability advisory', () => {
    it('shows advisory for partially_identifiable', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          identifiabilityTag="partially_identifiable"
        />
      )

      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)

      expect(screen.getByText('Structural validity: Some limitations')).toBeInTheDocument()
    })

    it('shows advisory for not_backdoor_identifiable', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          identifiabilityTag="not_backdoor_identifiable"
        />
      )

      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)

      expect(screen.getByText('Structural validity: Treat as directional')).toBeInTheDocument()
    })

    it('does not show advisory for identifiable', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          identifiabilityTag="identifiable"
        />
      )

      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)

      expect(screen.queryByText(/Structural validity/)).not.toBeInTheDocument()
    })

    it('does not show advisory when identifiabilityTag absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
        />
      )

      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)

      expect(screen.queryByText(/Structural validity/)).not.toBeInTheDocument()
    })
  })

  // ===========================================================================
  // V12.4: Stability tier override (indeterminate + readiness downgrade)
  // ===========================================================================
  describe('V12.4: Stability tier override (indeterminate + readiness downgrade)', () => {
    it('shows "Too close to call" instead of "Highly sensitive" when decisionState is indeterminate', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          recommendationStability={0.40}
          winnerWinProbability={0.39}
          runnerUpLabel="Option B"
          runnerUpWinProbability={0.35}
        />
      )

      expect(screen.getByText('Too close to call')).toBeInTheDocument()
      expect(screen.queryByText('Highly sensitive')).not.toBeInTheDocument()
    })

    it('preserves "Stable result" for robust state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.92}
        />
      )

      expect(screen.getByText('Stable result')).toBeInTheDocument()
      expect(screen.queryByText('Too close to call')).not.toBeInTheDocument()
    })

    it('preserves "Sensitive to assumptions" for sensitive state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
        />
      )

      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
      expect(screen.queryByText('Too close to call')).not.toBeInTheDocument()
    })

    it('uses text-info colour for indeterminate badge', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          recommendationStability={0.40}
        />
      )

      const badge = screen.getByText('Too close to call')
      expect(badge).toHaveClass('text-info')
      expect(badge).not.toHaveClass('text-danger')
    })

    it('overrides "Stable result" to "Sensitive to assumptions" when readiness downgraded to sensitive', () => {
      // stability=0.90 → getStabilityTier returns "Stable result" (text-success)
      // but decisionState='sensitive' due to readiness downgrade
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.90}
        />
      )

      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
      expect(screen.queryByText('Stable result')).not.toBeInTheDocument()
    })

    it('overrides "Mostly stable" to "Sensitive to assumptions" when readiness downgraded to sensitive', () => {
      // stability=0.75 → getStabilityTier returns "Mostly stable" (text-success)
      // but decisionState='sensitive' due to readiness downgrade
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.75}
        />
      )

      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
      expect(screen.queryByText('Mostly stable')).not.toBeInTheDocument()
    })

    it('uses text-warning colour for readiness-downgraded sensitive badge', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.90}
        />
      )

      const badge = screen.getByText('Sensitive to assumptions')
      expect(badge).toHaveClass('text-warning')
      expect(badge).not.toHaveClass('text-success')
    })

    it('does NOT override when sensitive state matches natural stability tier', () => {
      // stability=0.60 → getStabilityTier returns "Sensitive to assumptions" (text-warning)
      // decisionState='sensitive' — no contradiction, no override needed
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
        />
      )

      const badge = screen.getByText('Sensitive to assumptions')
      expect(badge).toHaveClass('text-warning')
    })
  })
})

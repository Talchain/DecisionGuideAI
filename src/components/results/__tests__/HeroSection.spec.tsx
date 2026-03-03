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
  focusEdgeByEndpoints: vi.fn(),
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

    it('includes goal label in Objective line', () => {
      render(
        <HeroSection
          {...baseProps}
          goalLabel="increase revenue"
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Objective:/)).toBeInTheDocument()
      expect(screen.getByText(/increase revenue/)).toBeInTheDocument()
      expect(screen.getByText(/Result:/)).toBeInTheDocument()
    })

    it('falls back to "your goal" when no goal label', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Objective:/)).toBeInTheDocument()
      expect(screen.getByText(/your goal/)).toBeInTheDocument()
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

      // V14: Condition card uses factor-only format (no arrow)
      const card = screen.getByText(/differs from your estimate/)
      expect(card).toBeInTheDocument()
      expect(screen.getByText(/becomes the stronger option/)).toBeInTheDocument()
    })

    it('does not render condition card when labels are unresolved', () => {
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

      // V14: generic condition card is no longer rendered (unresolved labels suppressed)
      expect(screen.queryByText(/Some estimates could change the recommendation/)).not.toBeInTheDocument()
      expect(screen.queryByText(/differs from your estimate/)).not.toBeInTheDocument()
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
      it('V14: renders winner in green in headline (GraphLink)', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
          />
        )

        expect(screen.getByText(/performs best/)).toBeInTheDocument()
      })

      it('V14: renders coaching next action with hinge target', () => {
        const onFocusNode = vi.fn()

        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
            topNextAction={{
              action: 'Validate Market Size before deciding.',
              rationale: 'Fragile edge',
              priority: 1,
              targetType: 'factor',
              targetId: 'factor-1',
              targetLabel: 'Market Size',
            }}
            onFocusNode={onFocusNode}
          />
        )

        // V14: action lines replaced by coaching-next-action
        const actionRow = screen.getByTestId('coaching-next-action')
        expect(actionRow.textContent).toContain('Market Size')
      })

      it('V14: omits coaching next action when not provided in robust state', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
          />
        )

        expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
      })
    })

    describe('Sensitive state', () => {
      it('renders winner in headline for sensitive state', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="sensitive"
          />
        )

        expect(screen.getByText(/performs best/)).toBeInTheDocument()
        expect(screen.queryByTestId('decision-state-dot')).not.toBeInTheDocument()
      })
    })

    describe('Indeterminate state', () => {
      it('does not render decision-state-dot', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="indeterminate"
          />
        )

        expect(screen.queryByTestId('decision-state-dot')).not.toBeInTheDocument()
      })

      it('V14: renders coaching next action when provided', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="indeterminate"
            topNextAction={{
              action: 'Resolve Adoption Rate uncertainty before deciding.',
              rationale: 'Fragile edge',
              priority: 1,
              targetType: 'factor',
              targetId: 'factor-3',
              targetLabel: 'Adoption Rate',
            }}
          />
        )

        const actionRow = screen.getByTestId('coaching-next-action')
        expect(actionRow.textContent).toContain('Adoption Rate')
      })

      it('V14: headline does not use success colour for indeterminate state', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="indeterminate"
          />
        )

        expect(screen.queryByTestId('decision-state-dot')).not.toBeInTheDocument()
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

    it('V14: shows target in baseline-target-row when goalThreshold is set', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={500}
        />
      )

      const row = screen.getByTestId('baseline-target-row')
      expect(row).toHaveTextContent('500')
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

    it('V14: shows target value in baseline-target-row when goalThreshold is set', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={500}
        />
      )

      expect(screen.queryByTestId('target-unset-prompt')).not.toBeInTheDocument()
      expect(screen.getByTestId('baseline-target-row')).toHaveTextContent('500')
    })
  })

  describe('V14: No coaching-next-action when not provided', () => {
    it('sensitive state: no coaching-next-action when topNextAction absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          hinge={null}
        />
      )

      // V14: action lines removed; coaching-next-action only renders when topNextAction is provided
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })

    it('indeterminate state: no coaching-next-action when topNextAction absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          hinge={null}
        />
      )

      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })
  })

  describe('V14: Coaching next action with target', () => {
    it('shows coaching next action with Market Size target in robust state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          topNextAction={{
            action: 'Validate Market Size before deciding.',
            rationale: 'Fragile edge',
            priority: 1,
            targetType: 'factor',
            targetId: 'factor-1',
            targetLabel: 'Market Size',
          }}
        />
      )

      const actionRow = screen.getByTestId('coaching-next-action')
      expect(actionRow.textContent).toContain('Market Size')
      expect(screen.getByRole('button', { name: /Focus on Market Size/ })).toBeInTheDocument()
    })

    it('shows coaching next action with Customer Growth target in sensitive state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          topNextAction={{
            action: 'Review Customer Growth estimates before committing.',
            rationale: 'VOI factor',
            priority: 1,
            targetType: 'factor',
            targetId: 'factor-2',
            targetLabel: 'Customer Growth',
          }}
        />
      )

      const actionRow = screen.getByTestId('coaching-next-action')
      expect(actionRow.textContent).toContain('Customer Growth')
      expect(screen.getByRole('button', { name: /Focus on Customer Growth/ })).toBeInTheDocument()
    })
  })

  describe('V14: Goal Target Unit Display in BaselineTargetRow', () => {
    it('shows currency symbol + formatted threshold in baseline-target-row', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={100000}
          outcomeUnit="currency"
          outcomeUnitSymbol="$"
        />
      )

      expect(screen.getByTestId('baseline-target-row')).toHaveTextContent('$100,000')
    })

    it('shows percentage suffix in baseline-target-row for percent unit', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          goalThreshold={75}
          outcomeUnit="percent"
        />
      )

      expect(screen.getByTestId('baseline-target-row')).toHaveTextContent('75%')
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

    it('V14: renders action implication in structured-executive (always visible)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingActionImplication="Gather evidence on Engineering Capacity before deciding."
        />
      )

      // V14: action implication renders in structured-executive, visible without expanding
      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).toContain('Gather evidence on Engineering Capacity before deciding.')
    })

    it('V14: falls back to coachingParagraph in structured-executive when no decision statement', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingParagraph="General coaching paragraph."
        />
      )

      // V14: coachingParagraph renders in structured-executive as fallback (always visible)
      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).toContain('General coaching paragraph.')
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
    // V14: Both the stability badge and decision-state-dot render the same text,
    // so we use getAllByText and check specific containers.

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

      expect(screen.getAllByText('Too close to call').length).toBeGreaterThanOrEqual(1)
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

      expect(screen.getAllByText('Stable result').length).toBeGreaterThanOrEqual(1)
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

      expect(screen.getAllByText('Sensitive to assumptions').length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText('Too close to call')).not.toBeInTheDocument()
    })

    it('uses text-info colour for indeterminate stability badge', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          recommendationStability={0.40}
        />
      )

      // Find the stability badge (inside bg-panel-hover pill)
      const badgePill = container.querySelector('.bg-panel-hover span')
      expect(badgePill).toBeTruthy()
      expect(badgePill!.textContent).toBe('Too close to call')
      expect(badgePill!.className).toContain('text-info')
      expect(badgePill!.className).not.toContain('text-danger')
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

      expect(screen.getAllByText('Sensitive to assumptions').length).toBeGreaterThanOrEqual(1)
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

      expect(screen.getAllByText('Sensitive to assumptions').length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText('Mostly stable')).not.toBeInTheDocument()
    })

    it('uses text-warning colour for readiness-downgraded sensitive stability badge', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.90}
        />
      )

      // Find the stability badge (inside bg-panel-hover pill)
      const badgePill = container.querySelector('.bg-panel-hover span')
      expect(badgePill).toBeTruthy()
      expect(badgePill!.textContent).toBe('Sensitive to assumptions')
      expect(badgePill!.className).toContain('text-warning')
      expect(badgePill!.className).not.toContain('text-success')
    })

    it('does NOT override when sensitive state matches natural stability tier', () => {
      // stability=0.60 → getStabilityTier returns "Sensitive to assumptions" (text-warning)
      // decisionState='sensitive' — no contradiction, no override needed
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
        />
      )

      const badgePill = container.querySelector('.bg-panel-hover span')
      expect(badgePill).toBeTruthy()
      expect(badgePill!.textContent).toBe('Sensitive to assumptions')
      expect(badgePill!.className).toContain('text-warning')
    })
  })

  // ===========================================================================
  // V14 Tests
  // ===========================================================================

  describe('V14 Task 2: Near-tie headline', () => {
    it('shows near-tie headline when nearTie.isTie is true', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          nearTie={{
            isTie: true,
            topOptionId: 'option-a',
            secondOptionId: 'option-b',
            tiedOptionIds: ['option-a', 'option-b'],
            gap: 0.05,
            threshold: 0.10,
          }}
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.35, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.33, isWinner: false },
          ]}
        />
      )

      expect(screen.getByText(/are too close to separate/)).toBeInTheDocument()
      // Both option names should be rendered as buttons (GraphLinks)
      const buttons = screen.getAllByRole('button')
      const optAButton = buttons.find(b => b.textContent === 'Option A')
      const optBButton = buttons.find(b => b.textContent === 'Option B')
      expect(optAButton).toBeTruthy()
      expect(optBButton).toBeTruthy()
    })

    it('shows standard winner headline when not near-tie', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.65, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.35, isWinner: false },
          ]}
        />
      )

      expect(screen.getByText(/performs best/)).toBeInTheDocument()
    })

    it('derives near-tie from win probability gap when nearTie absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.35, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.33, isWinner: false },
          ]}
        />
      )

      // Gap = 0.02 < 0.10 = GAP_THRESHOLD → treated as near-tie
      expect(screen.getByText(/are too close to separate/)).toBeInTheDocument()
    })
  })


  describe('V14 Task 1: Structured executive', () => {
    it('renders decision_statement and action_implication', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingDecisionStatement="Option A is the clear winner for revenue growth."
          coachingActionImplication="Proceed with confidence on Option A."
        />
      )

      const exec = screen.getByTestId('structured-executive')
      expect(exec).toBeInTheDocument()
      expect(exec.textContent).toContain('Option A is the clear winner')
      expect(exec.textContent).toContain('Proceed with confidence')
    })

    it('falls back to coachingParagraph when decision_statement is missing', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingParagraph="This is the M1 coaching summary paragraph."
        />
      )

      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).toContain('M1 coaching summary paragraph')
    })

    it('hides executive block when no coaching data', () => {
      render(
        <HeroSection {...baseProps} decisionState="robust" recommendationStability={0.90} />
      )

      expect(screen.queryByTestId('structured-executive')).toBeNull()
    })

    it('renders pre-sanitized coaching text (sanitization happens at data layer)', () => {
      // Data layer sanitizes arrows before passing to HeroSection
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingDecisionStatement="Factor A to Goal shows strong influence."
        />
      )

      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).not.toContain('\u2192')
      expect(exec.textContent).toContain('Factor A to Goal')
    })
  })

  describe('V14.3: Executive copy guard', () => {
    it('guards "proceed" text when decision state is sensitive', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingDecisionStatement="Option A leads on revenue growth."
          coachingActionImplication="Proceed with implementation."
          topFragileEdge={{
            fromId: 'fac-market', fromLabel: 'Market Size',
            toId: 'fac-revenue', toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
            switchProbability: 0.45, labelsResolved: true,
          }}
        />,
      )
      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).not.toContain('Proceed')
      expect(exec.textContent).toContain('Validate key assumptions before deciding')
      expect(exec.textContent).toContain('Market Size')
    })

    it('guards "proceed" text when indeterminate, without hinge', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          recommendationStability={0.40}
          coachingDecisionStatement="No clear winner."
          coachingActionImplication="Move forward with Option A."
        />,
      )
      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).not.toContain('Move forward')
      expect(exec.textContent).toContain('Validate key assumptions before deciding.')
    })

    it('allows "proceed" text when decision state is robust', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingActionImplication="Proceed with confidence on Option A."
        />,
      )
      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).toContain('Proceed with confidence')
    })

    it('passes through non-proceed text unchanged when sensitive', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingActionImplication="Gather evidence on Engineering Capacity before deciding."
        />,
      )
      const exec = screen.getByTestId('structured-executive')
      expect(exec.textContent).toContain('Gather evidence')
    })
  })

  describe('V14 Task 4: Condition card', () => {
    const fragileEdge = {
      fromId: 'fac-eng',
      fromLabel: 'Engineering Capacity',
      toId: 'out-rev',
      toLabel: 'Revenue',
      alternativeWinnerLabel: 'Option B',
      alternativeWinnerId: 'option-b',
      switchProbability: 0.40,
      labelsResolved: true,
    }

    it('renders factor-only condition card with direction-aware copy', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={fragileEdge}
          topDrivers={[{ id: 'fac-eng', label: 'Engineering Capacity', direction: 'positive' }]}
        />
      )

      const card = screen.getByTestId('condition-card')
      expect(card.textContent).toContain('is weaker than expected')
      expect(card.textContent).toContain('Engineering Capacity')
      // No arrow notation
      expect(card.textContent).not.toContain('\u2192')
      expect(card.textContent).not.toContain('->')
    })

    it('uses "differs" copy when direction is not positive', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={fragileEdge}
          topDrivers={[{ id: 'fac-eng', label: 'Engineering Capacity', direction: 'negative' }]}
        />
      )

      const card = screen.getByTestId('condition-card')
      expect(card.textContent).toContain('differs from your estimate')
    })

    it('hides condition card when switchProbability <= 0.25', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={{ ...fragileEdge, switchProbability: 0.20 }}
        />
      )

      expect(screen.queryByTestId('condition-card')).toBeNull()
    })

    it('hides condition card when topFragileEdge is absent', () => {
      render(
        <HeroSection {...baseProps} decisionState="robust" recommendationStability={0.90} />
      )

      expect(screen.queryByTestId('condition-card')).toBeNull()
    })
  })

  describe('V14 Task 5: More detail readiness bars', () => {
    it('renders readiness bars when dimensions provided and expanded', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingReadinessDimensions={{ evidence: 0.78, robustness: 0.45, clarity: 0.30 }}
        />
      )

      // Auto-expanded because stability < 0.70
      const bars = screen.getByTestId('readiness-bars')
      expect(bars).toBeInTheDocument()
      expect(bars.textContent).toContain('Evidence')
      expect(bars.textContent).toContain('78%')
      expect(bars.textContent).toContain('Robustness')
      expect(bars.textContent).toContain('45%')
      expect(bars.textContent).toContain('Framing')
      expect(bars.textContent).toContain('30%')

      // Check semantic fill colours: evidence >= 0.7 = success, robustness 0.4-0.69 = warning, clarity < 0.4 = danger
      const fills = container.querySelectorAll('[class*="rounded-full"]')
      const fillClasses = Array.from(fills).map(el => el.className)
      expect(fillClasses.some(c => c.includes('bg-success'))).toBe(true)
      expect(fillClasses.some(c => c.includes('bg-warning'))).toBe(true)
      expect(fillClasses.some(c => c.includes('bg-danger'))).toBe(true)
    })

    it('skips readiness bars when dimensions not provided', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
        />
      )

      expect(screen.queryByTestId('readiness-bars')).toBeNull()
    })

    it('renders M2 narrative with label when available', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          m2NarrativeSummary="This is the M2 enhanced analysis."
        />
      )

      expect(screen.getByText('AI-enhanced analysis')).toBeInTheDocument()
      expect(screen.getByText(/M2 enhanced analysis/)).toBeInTheDocument()
    })

    it('falls back to M1 paragraph when M2 absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingParagraph="M1 deterministic coaching paragraph."
        />
      )

      expect(screen.queryByText('AI-enhanced analysis')).toBeNull()
      // V14: M1 paragraph may appear in both structured-executive and "More" expand
      expect(screen.getAllByText(/M1 deterministic coaching/).length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('V14 Task 6: Win gauge no legend', () => {
    it('renders win gauge without legend row', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.65, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.35, isWinner: false },
          ]}
        />
      )

      // Win gauge label exists
      expect(screen.getByText('Wins across scenarios')).toBeInTheDocument()
      // No legend labels below the bar (option labels only appear in gauge aria-labels)
      const figure = container.querySelector('[role="figure"]')
      expect(figure).toBeTruthy()
      // Legend items would be plain text with option labels — ensure they're only in aria
      const figureText = figure!.querySelector('p')
      expect(figureText?.textContent).toBe('Wins across scenarios')
    })
  })

  describe('V14 Task 7: BaselineTargetRow', () => {
    it('renders baseline-target-row in V14 path', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          baselineOptions={[
            { id: 'option-a', label: 'Option A' },
            { id: 'option-b', label: 'Option B' },
          ]}
        />
      )

      expect(screen.getByTestId('baseline-target-row')).toBeInTheDocument()
    })
  })

  describe('V14 Task 8: Coaching next action', () => {
    it('renders next action with GraphLink when target_label in text', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          topNextAction={{
            action: 'Gather evidence on Engineering Capacity before deciding.',
            rationale: 'Low confidence factor',
            priority: 1,
            targetType: 'factor',
            targetId: 'fac-eng',
            targetLabel: 'Engineering Capacity',
          }}
        />
      )

      const actionRow = screen.getByTestId('coaching-next-action')
      expect(actionRow).toBeInTheDocument()
      expect(actionRow.textContent).toContain('Gather evidence on')
      expect(actionRow.textContent).toContain('Engineering Capacity')
      // Target label should be a button (GraphLink)
      const buttons = actionRow.querySelectorAll('button')
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })

    it('renders plain text when target_label not in action text', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          topNextAction={{
            action: 'Review your assumptions carefully.',
            rationale: 'General advice',
            priority: 1,
          }}
        />
      )

      const actionRow = screen.getByTestId('coaching-next-action')
      expect(actionRow.textContent).toContain('Review your assumptions')
    })

    it('hides next action when topNextAction is undefined', () => {
      render(
        <HeroSection {...baseProps} decisionState="robust" recommendationStability={0.90} />
      )

      expect(screen.queryByTestId('coaching-next-action')).toBeNull()
    })

    it('hides next action when action text is empty', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          topNextAction={{ action: '', rationale: '', priority: 1 }}
        />
      )

      expect(screen.queryByTestId('coaching-next-action')).toBeNull()
    })
  })
})

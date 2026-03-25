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
import * as focusHelpers from '../../../canvas/utils/focusHelpers'

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

    it('includes goal label in Goal line', () => {
      render(
        <HeroSection
          {...baseProps}
          goalLabel="increase revenue"
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Goal/)).toBeInTheDocument()
      expect(screen.getByText(/increase revenue/)).toBeInTheDocument()
      expect(screen.getByText(/Result/)).toBeInTheDocument()
    })

    it('falls back to "your goal" when no goal label', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.9}
        />
      )

      expect(screen.getByText(/Goal/)).toBeInTheDocument()
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
    it('shows "Stable result" for stability >= 0.80', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.85}
        />
      )

      expect(screen.getByText('Stable result')).toBeInTheDocument()
    })

    it('shows "Mostly stable" for stability >= 0.55', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.60}
        />
      )

      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
    })

    it('shows "Sensitive to assumptions" for stability >= 0.30', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.40}
        />
      )

      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
    })

    it('shows "Highly sensitive" for stability < 0.30', () => {
      render(
        <HeroSection
          {...baseProps}
          recommendationStability={0.20}
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

      const collapseButton = screen.getByRole('button', { name: /Hide/i })
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
      const hideButton = screen.getByRole('button', { name: /Hide/i })
      expect(hideButton).toHaveAttribute('aria-expanded', 'true')
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

      it('V16: renders next action in insight-bullets (bullet 3)', () => {
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

        // V16: action is now bullet 3 in insight-bullets (no standalone coaching-next-action)
        const bullets = screen.getByTestId('insight-bullets')
        expect(bullets.textContent).toContain('Market Size')
        expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
      })

      it('V16: omits insight bullets when no sources provided', () => {
        render(
          <HeroSection
            {...v11Props}
            decisionState="robust"
          />
        )

        // No qualifier, no fragile edge, no next action → no bullets
        expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
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

      it('V16: renders next action in insight-bullets for indeterminate state', () => {
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

        // V16: action is now bullet 3 in insight-bullets
        const bullets = screen.getByTestId('insight-bullets')
        expect(bullets.textContent).toContain('Adoption Rate')
        expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
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

  describe('V11: Trust One-Liner (replaces stats grid)', () => {
    it('shows inline trust one-liner with stability score instead of More expand', () => {
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

      // Trust one-liner should be present
      expect(screen.getByTestId('trust-one-liner')).toBeInTheDocument()
      // Should show "Stable result" for stability >= 0.85
      expect(screen.getByText('Stable result')).toBeInTheDocument()
      // No "More ▸" expand/collapse toggle in the hero (trust "more" link is different)
      expect(screen.queryByRole('button', { name: /More ▸/i })).not.toBeInTheDocument()
    })
  })

  describe('Win Gauge removed from hero (moved to options section)', () => {
    it('does not render WinGauge inside the hero', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          optionWinShares={[
            { id: 'a', label: 'Option A', winProbability: 0.6, isWinner: true },
            { id: 'b', label: 'Option B', winProbability: 0.4, isWinner: false },
          ]}
        />
      )

      // WinGauge uses role="figure" — should not be in the hero
      expect(container.querySelector('[role="figure"]')).toBeNull()
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

  describe('V16: No insight bullets when all sources absent', () => {
    it('sensitive state: no insight-bullets when no qualifier, no fragile edge, no action', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          hinge={null}
        />
      )

      // V16: insight-bullets only renders when at least one source is present
      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })

    it('indeterminate state: no insight-bullets when all sources absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          hinge={null}
        />
      )

      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })
  })

  describe('V16: Insight bullet 3 — next action with GraphLink', () => {
    it('shows next action in insight-bullets with Market Size as GraphLink', () => {
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

      const bullets = screen.getByTestId('insight-bullets')
      expect(bullets.textContent).toContain('Market Size')
      expect(screen.getByRole('button', { name: /Focus on Market Size/ })).toBeInTheDocument()
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })

    it('shows next action in insight-bullets with Customer Growth as GraphLink', () => {
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

      const bullets = screen.getByTestId('insight-bullets')
      expect(bullets.textContent).toContain('Customer Growth')
      expect(screen.getByRole('button', { name: /Focus on Customer Growth/ })).toBeInTheDocument()
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
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

  // V16: Executive summary fields moved to insight bullets / More expand
  describe('V16: Insight bullet 1 — key qualifier', () => {
    it('renders key qualifier as bullet 1', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingKeyQualifier="The recommendation is sensitive to uncertainties around engineering resources."
        />
      )

      const bullets = screen.getByTestId('insight-bullets')
      expect(bullets.textContent).toContain('sensitive to uncertainties around engineering resources')
      // No structured-executive in V16
      expect(screen.queryByTestId('structured-executive')).not.toBeInTheDocument()
    })

    it('no bullet 1 when key qualifier is absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
        />
      )

      // No sources → no bullets
      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
    })

    it('coachingParagraph renders inline (2-line clamp, no More expand)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingParagraph="General coaching paragraph."
        />
      )

      // Coaching paragraph shown inline (no More expand needed)
      expect(screen.getByText('General coaching paragraph.')).toBeInTheDocument()
    })

    it('suppresses contradictory executive copy when robustness is low', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.35}
          robustnessLevel="low"
          coachingKeyQualifier="This looks robust enough to proceed."
          coachingHeadline="This looks robust enough to proceed."
          coachingParagraph="This looks robust enough to proceed."
        />
      )

      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
      expect(screen.queryByText('This looks robust enough to proceed.')).not.toBeInTheDocument()

      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)
      expect(screen.queryByText('This looks robust enough to proceed.')).not.toBeInTheDocument()
    })
  })

  // V12: Identifiability advisory (moved to Advanced section in Task 7b)
  describe('V12: Identifiability advisory (moved to Advanced)', () => {
    it('does not show identifiability advisory in hero (moved to Advanced)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          identifiabilityTag="partially_identifiable"
        />
      )

      expect(screen.queryByText('Structural validity: Some limitations')).not.toBeInTheDocument()
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

    it('shows "Sensitive to assumptions" in trust-one-liner when decisionState is indeterminate (stability=0.40)', () => {
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

      // TrustOneLiner delegates to getStabilityClassification: 0.40 → low → "Sensitive to assumptions"
      const trustEl = screen.getByTestId('trust-one-liner')
      expect(trustEl).toBeInTheDocument()
      expect(trustEl.textContent).toContain('Sensitive to assumptions')
    })

    it('preserves "Stable result" in trust-one-liner for robust state', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.92}
        />
      )

      const trustEl = screen.getByTestId('trust-one-liner')
      expect(trustEl.textContent).toContain('Stable result')
    })

    it('preserves "Sensitive to assumptions" in trust-one-liner for sensitive state (stability=0.40)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.40}
        />
      )

      // stability=0.40 is >= 0.30, < 0.55 → "Sensitive to assumptions" (canonical thresholds)
      const trustEl = screen.getByTestId('trust-one-liner')
      expect(trustEl.textContent).toContain('Sensitive to assumptions')
    })

    it('trust-one-liner shows "Sensitive to assumptions" for indeterminate (stability=0.40)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          recommendationStability={0.40}
        />
      )

      const trustEl = screen.getByTestId('trust-one-liner')
      expect(trustEl.textContent).toContain('Sensitive to assumptions')
      // decision-state-pill is removed from V16 path
      expect(screen.queryByTestId('decision-state-pill')).not.toBeInTheDocument()
    })

    it('trust-one-liner shows "Stable result" when decisionState=sensitive but stability=0.90', () => {
      // stability=0.90 → TrustOneLiner shows "Stable result" based on pure stability thresholds
      // (decisionState no longer overrides the trust one-liner label)
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.90}
        />
      )

      const trustEl = screen.getByTestId('trust-one-liner')
      expect(trustEl.textContent).toContain('Stable result')
    })

    it('trust-one-liner shows "Mostly stable" for stability=0.75', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.75}
        />
      )

      const trustEl = screen.getByTestId('trust-one-liner')
      expect(trustEl.textContent).toContain('Mostly stable')
    })

    it('trust-one-liner renders in V16 path (no decision-state-pill)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.90}
        />
      )

      expect(screen.getByTestId('trust-one-liner')).toBeInTheDocument()
      expect(screen.queryByTestId('decision-state-pill')).not.toBeInTheDocument()
    })

    it('trust-one-liner shows "Mostly stable" for stability=0.60 (natural tier)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
        />
      )

      // stability=0.60 is >= 0.55, < 0.80 → "Mostly stable" (canonical thresholds)
      const trustEl = screen.getByTestId('trust-one-liner')
      expect(trustEl.textContent).toContain('Mostly stable')
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

      expect(screen.getByText(/are too close to call/)).toBeInTheDocument()
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
      expect(screen.getByText(/are too close to call/)).toBeInTheDocument()
    })
  })


  describe('V16 Task 1: Insight bullets — all combinations', () => {
    it('renders 3 bullets when all sources present', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingKeyQualifier="The recommendation is sensitive to engineering estimates."
          topFragileEdge={{
            fromId: 'fac-eng',
            fromLabel: 'Engineering Capacity',
            toId: 'out-rev',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
            alternativeWinnerId: 'option-b',
            switchProbability: 0.40,
            labelsResolved: true,
          }}
          topNextAction={{
            action: 'Gather evidence on Market Size.',
            rationale: 'Low confidence',
            priority: 1,
            targetId: 'fac-mkt',
            targetLabel: 'Market Size',
          }}
        />
      )

      const bullets = screen.getByTestId('insight-bullets')
      const items = bullets.querySelectorAll('li')
      expect(items.length).toBe(3)
      expect(items[0].textContent).toContain('sensitive to engineering estimates')
      expect(items[1].textContent).toContain('If Engineering Capacity is weaker')
      expect(items[1].textContent).toContain('overtakes')
      expect(items[2].textContent).toContain('Market Size')
    })

    it('renders 2 bullets when qualifier missing', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={{
            fromId: 'fac-eng',
            fromLabel: 'Engineering Capacity',
            toId: 'out-rev',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
            switchProbability: 0.40,
            labelsResolved: true,
          }}
          topNextAction={{
            action: 'Gather evidence on Market Size.',
            rationale: 'Low confidence',
            priority: 1,
            targetId: 'fac-mkt',
            targetLabel: 'Market Size',
          }}
        />
      )

      const bullets = screen.getByTestId('insight-bullets')
      const items = bullets.querySelectorAll('li')
      expect(items.length).toBe(2)
      expect(items[0].textContent).toContain('is weaker')
      expect(items[0].textContent).toContain('overtakes')
      expect(items[1].textContent).toContain('Market Size')
    })

    it('renders 1 bullet when only qualifier present', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingKeyQualifier="The recommendation holds under most conditions."
        />
      )

      const bullets = screen.getByTestId('insight-bullets')
      const items = bullets.querySelectorAll('li')
      expect(items.length).toBe(1)
    })

    it('renders no bullet list when all sources empty', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
        />
      )

      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
    })

    it('no structured-executive in default view', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingKeyQualifier="Option A is the clear winner for revenue growth."
        />
      )

      expect(screen.queryByTestId('structured-executive')).not.toBeInTheDocument()
    })
  })

  describe('V16: Trust summary (via TrustOneLiner)', () => {
    it('always renders trust-one-liner in V16 path', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust).toBeInTheDocument()
      // TrustOneLiner shows stability label, not "Trust: level" format
      expect(trust.textContent).toContain('Stable result')
    })

    it('shows "Stable result" when stability is high (readiness=ready, robustness=high)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingReadiness="ready"
          robustnessLevel="high"
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust.textContent).toContain('Stable result')
    })

    it('shows "Stable result" when stability is high (readiness=ready, robustness=moderate)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingReadiness="ready"
          robustnessLevel="moderate"
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust.textContent).toContain('Stable result')
    })

    it('shows "Sensitive to assumptions" for low stability (needs_evidence, low robustness)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.50}
          coachingReadiness="needs_evidence"
          robustnessLevel="low"
        />
      )

      // stability=0.50 is >= 0.30, < 0.55 → "Sensitive to assumptions" (canonical thresholds)
      const trust = screen.getByTestId('trust-one-liner')
      expect(trust.textContent).toContain('Sensitive to assumptions')
    })

    it('shows evidence suffix when default estimates dominate', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.50}
          defaultEstimateCount={4}
          totalFactorCount={5}
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      // ratio 4/5 = 0.8 > 0.75 → "most values are AI estimates"
      expect(trust.textContent).toContain('most values are AI estimates')
    })

    it('shows "Stable result" with "more" link for high stability', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          coachingReadiness="ready"
          robustnessLevel="high"
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust.textContent).toContain('Stable result')
      expect(screen.getByTestId('trust-more-link')).toBeInTheDocument()
    })
  })

  describe('V16 Task 1+5: Condition card and hinge bullet', () => {
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

    it('hinge bullet 2 shows "Could change if {factor} shifts" when fragile edge present', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={fragileEdge}
        />
      )

      const bullets = screen.getByTestId('insight-bullets')
      expect(bullets.textContent).toContain('If Engineering Capacity is weaker')
      expect(bullets.textContent).toContain('overtakes')
    })

    it('condition card is in "Show more" expansion when fragile edge present', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={fragileEdge}
          topDrivers={[{ id: 'fac-eng', label: 'Engineering Capacity', direction: 'positive' }]}
        />
      )

      // Show more button visible
      const showMore = screen.getByTestId('show-more-bullets')
      expect(showMore).toBeInTheDocument()

      // No standalone condition-card in default view
      expect(screen.queryByTestId('condition-card')).toBeNull()

      // Click show more → condition card detail appears
      fireEvent.click(showMore)
      const expanded = screen.getByTestId('show-more-expanded')
      expect(expanded.textContent).toContain('is weaker than expected')
      expect(expanded.textContent).toContain('Engineering Capacity')
      expect(expanded.textContent).not.toContain('\u2192')
      expect(expanded.textContent).not.toContain('->')
    })

    it('condition card uses "differs" copy when direction is not positive', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={fragileEdge}
          topDrivers={[{ id: 'fac-eng', label: 'Engineering Capacity', direction: 'negative' }]}
        />
      )

      fireEvent.click(screen.getByTestId('show-more-bullets'))
      expect(screen.getByTestId('show-more-expanded').textContent).toContain('differs from your estimate')
    })

    it('condition card detail in show-more when qualifying fragile edge exists', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={fragileEdge}
        />
      )

      // Qualifying fragile edge (switchProb > 0.25) → show-more button with detail
      expect(screen.getByTestId('show-more-bullets')).toBeInTheDocument()
    })

    it('no show-more button when switchProbability <= 0.25', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={{ ...fragileEdge, switchProbability: 0.20 }}
        />
      )

      // switchProb <= 0.25 → v14ConditionCard is null → no hinge bullet, no show-more
      expect(screen.queryByTestId('show-more-bullets')).not.toBeInTheDocument()
      expect(screen.queryByTestId('condition-card')).toBeNull()
    })

    it('no show-more button when topFragileEdge is absent', () => {
      render(
        <HeroSection {...baseProps} decisionState="robust" recommendationStability={0.90} />
      )

      expect(screen.queryByTestId('show-more-bullets')).not.toBeInTheDocument()
      expect(screen.queryByTestId('condition-card')).toBeNull()
    })

    it('promotes condition card to default bullets when switchProbability <= 0.25 but edge exists', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={{
            fromId: 'fac-eng',
            fromLabel: 'Engineering Capacity',
            toId: 'out-rev',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
            alternativeWinnerId: 'option-b',
            switchProbability: 0.20,
            labelsResolved: true,
          }}
          topDrivers={[{ id: 'fac-eng', label: 'Engineering Capacity', direction: 'positive' }]}
        />
      )

      // No hinge bullet (switchProb <= 0.25) → no "Show more" button
      expect(screen.queryByTestId('show-more-bullets')).not.toBeInTheDocument()
      // Condition card promoted to default bullets
      const bullets = screen.getByTestId('insight-bullets')
      expect(bullets.textContent).toContain('Engineering Capacity')
      expect(bullets.textContent).toContain('is weaker than expected')
      expect(bullets.textContent).toContain('becomes the stronger option')
    })

    it('does not promote condition card when labels are unresolved', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={{
            fromId: 'fac-eng',
            fromLabel: 'Engineering Capacity',
            toId: 'out-rev',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
            switchProbability: 0.20,
            labelsResolved: false,
          }}
        />
      )

      // Unresolved labels → no promotion
      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
    })
  })

  describe('V16: TrustOneLiner — evidence suffix branches', () => {
    it('shows "most values are AI estimates" when default ratio > 75%', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.50}
          coachingReadiness="needs_evidence"
          robustnessLevel="low"
          defaultEstimateCount={8}
          totalFactorCount={10}
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust.textContent).toContain('most values are AI estimates')
    })

    it('shows "evidence is limited" when default ratio > 50% but <= 75%', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.50}
          coachingReadiness="needs_evidence"
          robustnessLevel="low"
          defaultEstimateCount={3}
          totalFactorCount={5}
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust.textContent).toContain('evidence is limited')
    })

    it('no evidence suffix when default ratio <= 50%', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.50}
          defaultEstimateCount={2}
          totalFactorCount={4}
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust.textContent).not.toContain('AI estimates')
      expect(trust.textContent).not.toContain('evidence is limited')
    })

    it('trust-one-liner is always present in V16 path', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
        />
      )

      const trust = screen.getByTestId('trust-one-liner')
      expect(trust).toBeInTheDocument()
    })
  })

  describe('V16: Layout order', () => {
    it('baseline/target row renders in hero (gauge moved to options section)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          goalThreshold={500}
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.6, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.4, isWinner: false },
          ]}
        />
      )

      // Baseline/target row exists in hero
      expect(screen.getByTestId('baseline-target-row')).toBeInTheDocument()
      // Win gauge is NOT in the hero (moved to options section)
      const heroSection = screen.getByTestId('hero-section')
      expect(heroSection.querySelector('[role="figure"]')).toBeNull()
    })

    it('trust-one-liner replaces decision-state-pill in V16 path', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
        />
      )

      // decision-state-pill is removed; trust-one-liner is used instead
      expect(screen.queryByTestId('decision-state-pill')).not.toBeInTheDocument()
      expect(screen.getByTestId('trust-one-liner')).toBeInTheDocument()
    })
  })

  describe('V16: No standalone executive statement or coaching CTA in default view', () => {
    it.each(['robust', 'sensitive', 'indeterminate'] as const)(
      'decisionState="%s" — no standalone coaching-next-action or decision-statement',
      (state) => {
        render(
          <HeroSection
            {...baseProps}
            decisionState={state}
            recommendationStability={state === 'robust' ? 0.90 : 0.50}
            topNextAction={{
              action: 'Validate X before deciding.',
              rationale: 'Test',
              priority: 1,
              targetType: 'factor',
              targetId: 'f-x',
              targetLabel: 'X',
            }}
          />
        )

        expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
        expect(screen.queryByTestId('decision-statement')).not.toBeInTheDocument()
      },
    )
  })

  describe('V14 Task 5: Readiness bars + narrative (moved to Advanced)', () => {
    it('readiness bars NOT present in hero (moved to Advanced section)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingReadinessDimensions={{ evidence: 0.78, robustness: 0.45, clarity: 0.30 }}
        />
      )

      // Readiness bars are gone from hero entirely
      expect(screen.queryByTestId('readiness-bars')).not.toBeInTheDocument()
    })

    it('readiness bars NOT present when dimensions not provided', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
        />
      )

      expect(screen.queryByTestId('readiness-bars')).toBeNull()
    })

    it('renders M2 narrative inline with line-clamp-2', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          m2NarrativeSummary="This is the M2 enhanced analysis."
        />
      )

      // M2 narrative is inline (data-testid="hero-m2-narrative"), not inside a "More" expand
      const narrative = screen.getByTestId('hero-m2-narrative')
      expect(narrative).toBeInTheDocument()
      expect(narrative.textContent).toContain('M2 enhanced analysis')
    })

    it('falls back to M1 paragraph inline when M2 absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingParagraph="M1 deterministic coaching paragraph."
        />
      )

      // M1 paragraph appears inline (line-clamp-2), no "More" expand needed
      expect(screen.getByText(/M1 deterministic coaching/)).toBeInTheDocument()
    })
  })

  describe('V14 Task 6: Win gauge removed from hero', () => {
    it('does not render WinGauge in hero (moved to options section)', () => {
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

      // WinGauge uses role="figure" — should NOT be in the hero
      expect(container.querySelector('[role="figure"]')).toBeNull()
      expect(screen.queryByText('Wins across scenarios')).not.toBeInTheDocument()
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

  describe('V16 Task 1: Bullet 3 — next action replaces standalone coaching CTA', () => {
    it('renders next action with GraphLink in insight-bullets', () => {
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

      const bullets = screen.getByTestId('insight-bullets')
      expect(bullets.textContent).toContain('Next step')
      expect(bullets.textContent).toContain('gather evidence on')
      expect(bullets.textContent).toContain('Engineering Capacity')
      // "Next step" scroll button + GraphLink button
      expect(bullets.querySelectorAll('button').length).toBeGreaterThanOrEqual(1)
      // No standalone coaching-next-action
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })

    it('suppresses bullet 3 when topNextAction has no targetLabel', () => {
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

      // No targetLabel → bullet 3 must not appear (no free-text fabrication)
      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
    })

    it('no bullets when topNextAction is undefined and other sources absent', () => {
      render(
        <HeroSection {...baseProps} decisionState="robust" recommendationStability={0.90} />
      )

      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })

    it('no bullets when action text is empty and other sources absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          topNextAction={{ action: '', rationale: '', priority: 1 }}
        />
      )

      expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
      expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    })

    it('P1-7: clicking "Next step" scrolls to #mvs-card', () => {
      const scrollIntoView = vi.fn()
      const mockEl = { scrollIntoView } as unknown as HTMLElement
      vi.spyOn(document, 'getElementById').mockReturnValue(mockEl)

      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          topNextAction={{
            action: 'Gather evidence on Market Size.',
            rationale: 'Low confidence',
            priority: 1,
            targetId: 'fac-mkt',
            targetLabel: 'Market Size',
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
      expect(document.getElementById).toHaveBeenCalledWith('mvs-card')
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })

      vi.restoreAllMocks()
    })
  })

  describe('P1-8: bullet suppression when source data absent', () => {
    it('no bullet 2 when topFragileEdge absent (no v14ConditionCard)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          coachingKeyQualifier="Sensitive to engineering estimates."
          // no topFragileEdge → no v14ConditionCard → no bullet 2
        />
      )

      const bullets = screen.getByTestId('insight-bullets')
      const items = bullets.querySelectorAll('li')
      expect(items.length).toBe(1)
      expect(items[0].textContent).toContain('Sensitive to engineering estimates')
    })

    it('no bullet 3 when topNextAction targetLabel absent', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.85}
          coachingKeyQualifier="The recommendation holds."
          topNextAction={{
            action: 'General advice without a specific target.',
            rationale: 'Coaching',
            priority: 1,
            // no targetLabel
          }}
        />
      )

      const bullets = screen.getByTestId('insight-bullets')
      const items = bullets.querySelectorAll('li')
      // Only qualifier bullet — bullet 3 suppressed due to absent targetLabel
      expect(items.length).toBe(1)
      expect(items[0].textContent).toContain('The recommendation holds')
    })
  })

  describe('V15 Task 1: Winner colour assignment', () => {
    it('winner GraphLink is text-success for clear winner (robust)', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          winnerId="option-a"
          winnerLabel="Option A"
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.65, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.35, isWinner: false },
          ]}
        />
      )

      // Winner button should have text-success class
      const buttons = container.querySelectorAll('button')
      const winnerBtn = Array.from(buttons).find(b => b.textContent === 'Option A')
      expect(winnerBtn).toBeTruthy()
      expect(winnerBtn!.className).toContain('text-success')
    })

    it('both options are text-info in indeterminate (near-tie)', () => {
      const { container } = render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          recommendationStability={0.40}
          winnerId="option-a"
          winnerLabel="Option A"
          nearTie={{ isTie: true, tiedOptionIds: ['option-a', 'option-b'], gap: 0.02, threshold: 0.10 }}
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.35, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.33, isWinner: false },
          ]}
        />
      )

      // Both options in near-tie headline should be text-info, not text-success
      const buttons = container.querySelectorAll('button')
      const optABtn = Array.from(buttons).find(b => b.textContent === 'Option A')
      const optBBtn = Array.from(buttons).find(b => b.textContent === 'Option B')
      expect(optABtn).toBeTruthy()
      expect(optBBtn).toBeTruthy()
      expect(optABtn!.className).not.toContain('text-success')
      expect(optABtn!.className).toContain('text-info')
      expect(optBBtn!.className).not.toContain('text-success')
      expect(optBBtn!.className).toContain('text-info')
    })

    it('V16: condition card alt option is text-success for non-indeterminate (in show-more expansion)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          topFragileEdge={{
            fromId: 'fac-eng',
            fromLabel: 'Engineering Capacity',
            toId: 'out-rev',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
            alternativeWinnerId: 'option-b',
            switchProbability: 0.40,
            labelsResolved: true,
          }}
        />
      )

      // Expand show-more to access condition card detail
      fireEvent.click(screen.getByTestId('show-more-bullets'))
      const expanded = screen.getByTestId('show-more-expanded')
      const altBtn = expanded.querySelector('button[title="Option B"]')
      expect(altBtn).toBeTruthy()
      expect(altBtn!.className).toContain('text-success')
    })

    it('V16: condition card alt option is text-info for indeterminate (in show-more expansion)', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          recommendationStability={0.40}
          topFragileEdge={{
            fromId: 'fac-eng',
            fromLabel: 'Engineering Capacity',
            toId: 'out-rev',
            toLabel: 'Revenue',
            alternativeWinnerLabel: 'Option B',
            alternativeWinnerId: 'option-b',
            switchProbability: 0.40,
            labelsResolved: true,
          }}
        />
      )

      fireEvent.click(screen.getByTestId('show-more-bullets'))
      const expanded = screen.getByTestId('show-more-expanded')
      const altBtn = expanded.querySelector('button[title="Option B"]')
      expect(altBtn).toBeTruthy()
      expect(altBtn!.className).not.toContain('text-success')
      expect(altBtn!.className).toContain('text-info')
    })
  })

  describe('V15 Task 2: Goal label + clickable goal node', () => {
    it('renders "Goal" label (not "Objective")', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          goalLabel="Increase MRR"
        />
      )

      expect(screen.getByText('Goal')).toBeInTheDocument()
      expect(screen.queryByText(/Objective/)).not.toBeInTheDocument()
    })

    it('goal content is clickable button when goalNodeId provided', () => {
      const mockFocusNodeById = vi.mocked(focusHelpers.focusNodeById)
      mockFocusNodeById.mockClear()
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          goalLabel="Increase MRR"
          goalNodeId="goal-node-1"
        />
      )

      const goalBtn = screen.getByRole('button', { name: /Increase MRR/ })
      expect(goalBtn).toBeTruthy()
      expect(goalBtn.className).toContain('text-info')
      fireEvent.click(goalBtn)
      expect(mockFocusNodeById).toHaveBeenCalledWith('goal-node-1')
    })

    it('goal content is plain text when goalNodeId not provided', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="robust"
          recommendationStability={0.90}
          goalLabel="Increase MRR"
        />
      )

      // Should not be a button
      expect(screen.queryByRole('button', { name: /Increase MRR/ })).toBeNull()
      expect(screen.getByText('Increase MRR')).toBeInTheDocument()
    })
  })

  describe('V15 Task 3: Too close to call phrase', () => {
    it('uses "too close to call" not "too close to separate" in near-tie headline', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="indeterminate"
          nearTie={{ isTie: true, tiedOptionIds: ['option-a', 'option-b'], gap: 0.02, threshold: 0.10 }}
          optionWinShares={[
            { id: 'option-a', label: 'Option A', winProbability: 0.35, isWinner: true },
            { id: 'option-b', label: 'Option B', winProbability: 0.33, isWinner: false },
          ]}
        />
      )

      expect(screen.getByText(/are too close to call/)).toBeInTheDocument()
      expect(screen.queryByText(/are too close to separate/)).not.toBeInTheDocument()
    })
  })

  describe('V16 Task 4: M2 narrative inline with line-clamp-2', () => {
    it('renders M2 narrative inline with "Read more" link for long text', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          m2NarrativeSummary="This is the first sentence of the AI analysis. This is additional context that should be hidden initially and only shown when the user clicks Read more."
        />
      )

      // M2 narrative is inline (data-testid="hero-m2-narrative"), not inside a "More" expand
      const narrative = screen.getByTestId('hero-m2-narrative')
      expect(narrative).toBeInTheDocument()
      // First sentence visible
      expect(narrative.textContent).toContain('This is the first sentence')
      // "Read more" button exists inline (scrolls to #trust-narrative)
      expect(screen.getByRole('button', { name: /Read more/ })).toBeInTheDocument()
    })

    it('Read more link scrolls to #trust-narrative', () => {
      const scrollIntoView = vi.fn()
      const mockEl = { scrollIntoView, closest: vi.fn(() => null) } as unknown as HTMLElement
      vi.spyOn(document, 'getElementById').mockReturnValue(mockEl)

      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          m2NarrativeSummary="This is the first sentence of the AI analysis. This is additional context that should be hidden initially and only shown when the user clicks Read more."
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Read more/ }))
      expect(document.getElementById).toHaveBeenCalledWith('trust-narrative')
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })

      vi.restoreAllMocks()
    })

    it('no Read more button for short single-sentence narrative', () => {
      render(
        <HeroSection
          {...baseProps}
          decisionState="sensitive"
          recommendationStability={0.60}
          m2NarrativeSummary="Short narrative."
        />
      )

      // Short narrative should not have "Read more"
      const narrative = screen.getByTestId('hero-m2-narrative')
      expect(narrative).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Read more/ })).not.toBeInTheDocument()
    })
  })
})

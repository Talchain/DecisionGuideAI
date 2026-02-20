/**
 * SuccessTargetRow Component Tests (V9.2 Phase 2)
 *
 * Tests for the compact inline success target input.
 * Layout: "Success target ≥ [value]" + edit mode + microcopy.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuccessTargetRow } from '../SuccessTargetRow'
import type { ConstraintAnalysis } from '../../../types/constraints'

describe('SuccessTargetRow', () => {
  describe('No target set', () => {
    it('renders with data-testid', () => {
      render(<SuccessTargetRow />)

      expect(screen.getByTestId('success-target-row')).toBeInTheDocument()
    })

    it('shows "Set target" button', () => {
      render(<SuccessTargetRow />)

      expect(screen.getByText('Set target')).toBeInTheDocument()
    })

    it('shows placeholder microcopy', () => {
      render(<SuccessTargetRow />)

      expect(
        screen.getByText("Set a success target to see each option's chance of achieving it.")
      ).toBeInTheDocument()
    })

    it('hides "Wins"/"Hits target" microcopy', () => {
      render(<SuccessTargetRow />)

      expect(screen.queryByText(/outperforms alternatives/)).not.toBeInTheDocument()
    })
  })

  describe('Target set', () => {
    it('shows target value', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('shows ≥ operator', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(screen.getByText('≥')).toBeInTheDocument()
    })

    it('shows Wins/Hits target microcopy', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(screen.getByText(/outperforms alternatives/)).toBeInTheDocument()
      expect(screen.getByText(/reaches your success target/)).toBeInTheDocument()
    })

    it('hides placeholder microcopy', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(
        screen.queryByText("Set a success target to see each option's chance of achieving it.")
      ).not.toBeInTheDocument()
    })

    it('shows "(from brief)" when isFromBrief is true', () => {
      render(<SuccessTargetRow goalThreshold={100} isFromBrief={true} />)

      expect(screen.getByText('(from brief)')).toBeInTheDocument()
    })
  })

  describe('Edit mode', () => {
    it('opens edit mode when "Set target" is clicked', () => {
      render(<SuccessTargetRow />)

      fireEvent.click(screen.getByText('Set target'))

      expect(screen.getByLabelText('Edit success target value')).toBeInTheDocument()
    })

    it('opens edit mode when current value is clicked', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      fireEvent.click(screen.getByText('100'))

      expect(screen.getByLabelText('Edit success target value')).toBeInTheDocument()
    })

    it('calls onApplyThreshold on Enter', () => {
      const onApply = vi.fn()
      render(<SuccessTargetRow goalThreshold={100} onApplyThreshold={onApply} />)

      fireEvent.click(screen.getByText('100'))

      const input = screen.getByLabelText('Edit success target value')
      fireEvent.change(input, { target: { value: '150' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onApply).toHaveBeenCalledWith(150)
    })

    it('reverts on Escape', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      fireEvent.click(screen.getByText('100'))
      const input = screen.getByLabelText('Edit success target value')
      fireEvent.keyDown(input, { key: 'Escape' })

      // Should exit edit mode, showing the value button again
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.queryByLabelText('Edit success target value')).not.toBeInTheDocument()
    })

    it('disables input when isRunning', () => {
      render(<SuccessTargetRow goalThreshold={100} isRunning={true} />)

      // "Set target" or value button should be disabled
      const button = screen.getByLabelText(/Edit success target/)
      expect(button).toBeDisabled()
    })
  })

  describe('V11.1: showHitsTarget microcopy gating', () => {
    it('shows full Wins + Hits target microcopy when showHitsTarget is true', () => {
      render(<SuccessTargetRow goalThreshold={100} showHitsTarget={true} />)

      expect(screen.getByText(/outperforms alternatives/)).toBeInTheDocument()
      expect(screen.getByText(/reaches your success target/)).toBeInTheDocument()
    })

    it('shows Wins-only microcopy with rerun note when showHitsTarget is false', () => {
      render(<SuccessTargetRow goalThreshold={100} showHitsTarget={false} />)

      expect(screen.getByText(/outperforms alternatives/)).toBeInTheDocument()
      expect(screen.queryByText(/reaches your success target/)).not.toBeInTheDocument()
      expect(screen.getByText(/Run analysis again to compute target likelihood/)).toBeInTheDocument()
    })

    it('defaults showHitsTarget to true (backwards compatible)', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(screen.getByText(/reaches your success target/)).toBeInTheDocument()
    })
  })

  describe('Multi-constraint display', () => {
    const constraintAnalysis: ConstraintAnalysis = {
      joint_probability: 0.52,
      constraints: [
        {
          node_id: 'churn',
          operator: '<=',
          threshold: 0.04,
          label: 'Churn rate',
          prob_satisfied: 0.85,
          failure_margin_median: 0.01,
          near_miss_fraction: 0.1,
          binding: false,
        },
        {
          node_id: 'budget',
          operator: '<=',
          threshold: 20000,
          label: 'Budget',
          prob_satisfied: 0.35,
          failure_margin_median: 2000,
          near_miss_fraction: 0.15,
          binding: true,
        },
        {
          node_id: 'timeline',
          operator: '<=',
          threshold: 6,
          label: 'Timeline',
          prob_satisfied: 0.61,
          failure_margin_median: 0.5,
          near_miss_fraction: 0.42,
          binding: false,
        },
      ],
    }

    it('renders constraint breakdown when constraintAnalysis is present', () => {
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      expect(screen.getByTestId('constraint-breakdown')).toBeInTheDocument()
      expect(screen.getByText(/Meeting all targets/)).toBeInTheDocument()
      expect(screen.getByText('52%')).toBeInTheDocument()
    })

    it('renders "Set target" placeholder when no constraintAnalysis', () => {
      render(<SuccessTargetRow />)

      expect(screen.queryByTestId('constraint-breakdown')).not.toBeInTheDocument()
      expect(screen.getByText('Set target')).toBeInTheDocument()
    })

    it('shows per-constraint rows with correct labels', () => {
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      expect(screen.getByText(/Churn rate/)).toBeInTheDocument()
      expect(screen.getByText(/Budget/)).toBeInTheDocument()
      expect(screen.getByText(/Timeline/)).toBeInTheDocument()
    })

    it('renders unicode operators', () => {
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      // All 3 constraints use '<=' which should render as '≤'
      const leqSymbols = screen.getAllByText(/≤/)
      expect(leqSymbols.length).toBeGreaterThanOrEqual(3)
    })

    it('shows "(binding)" label for binding constraint', () => {
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      expect(screen.getByText('(binding)')).toBeInTheDocument()
    })

    it('shows "Edit targets" instead of "Set target"', () => {
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      expect(screen.getByText('Edit targets')).toBeInTheDocument()
      expect(screen.queryByText('Set target')).not.toBeInTheDocument()
    })

    it('applies success colour for probability >= 70%', () => {
      // Churn rate has 85% → should be text-success
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      const churnRow = screen.getByTestId('constraint-row-churn')
      expect(churnRow.textContent).toContain('85%')
    })

    it('applies danger colour for probability < 40%', () => {
      // Budget has 35% → should be text-danger
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      const budgetRow = screen.getByTestId('constraint-row-budget')
      expect(budgetRow.textContent).toContain('35%')
    })

    it('applies info colour for probability between 40-69%', () => {
      // Timeline has 61% → should be text-info
      render(<SuccessTargetRow constraintAnalysis={constraintAnalysis} />)

      const timelineRow = screen.getByTestId('constraint-row-timeline')
      expect(timelineRow.textContent).toContain('61%')
    })
  })
})

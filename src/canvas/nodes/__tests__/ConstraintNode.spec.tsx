/**
 * ConstraintNode Tests
 *
 * Task 4.5: Tests for constraint node component
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReactFlowProvider } from '@xyflow/react'
import { ConstraintNode } from '../ConstraintNode'

// Mock NodeProps
const createNodeProps = (data: Record<string, any>) => ({
  id: 'constraint-1',
  type: 'constraint',
  data,
  xPos: 0,
  yPos: 0,
  selected: false,
  isConnectable: true,
  zIndex: 1,
  dragging: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
})

// Wrapper for React Flow context
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
)

describe('ConstraintNode', () => {
  describe('basic rendering', () => {
    it('renders constraint node with label', () => {
      render(
        <ConstraintNode {...createNodeProps({ label: 'Budget Cap' })} />,
        { wrapper: Wrapper }
      )

      expect(screen.getByTestId('constraint-node')).toBeInTheDocument()
      expect(screen.getByText('Budget Cap')).toBeInTheDocument()
    })

    it('renders with shield icon', () => {
      render(
        <ConstraintNode {...createNodeProps({ label: 'Budget Cap' })} />,
        { wrapper: Wrapper }
      )

      // Check aria-label includes "Constraint"
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-label',
        'Constraint: Budget Cap'
      )
    })

    it('has red/carrot border styling', () => {
      render(
        <ConstraintNode {...createNodeProps({ label: 'Test' })} />,
        { wrapper: Wrapper }
      )

      const node = screen.getByTestId('constraint-node')
      expect(node).toHaveClass('border-carrot-400')
    })
  })

  describe('constraint types', () => {
    it('displays upper_bound type correctly', () => {
      render(
        <ConstraintNode
          {...createNodeProps({
            label: 'Max Budget',
            constraintType: 'upper_bound',
            thresholdValue: 100000,
            unit: 'usd',
          })}
        />,
        { wrapper: Wrapper }
      )

      expect(screen.getByText('Maximum')).toBeInTheDocument()
      expect(screen.getByText(/\$100,000/)).toBeInTheDocument()
    })

    it('displays lower_bound type correctly', () => {
      render(
        <ConstraintNode
          {...createNodeProps({
            label: 'Min Score',
            constraintType: 'lower_bound',
            thresholdValue: 80,
            unit: '%',
          })}
        />,
        { wrapper: Wrapper }
      )

      expect(screen.getByText('Minimum')).toBeInTheDocument()
      expect(screen.getByText(/≥ 80%/)).toBeInTheDocument()
    })

    it('displays deadline type correctly', () => {
      render(
        <ConstraintNode
          {...createNodeProps({
            label: 'Project Deadline',
            constraintType: 'deadline',
            thresholdValue: 30,
            unit: 'days',
          })}
        />,
        { wrapper: Wrapper }
      )

      expect(screen.getByText('Deadline')).toBeInTheDocument()
      expect(screen.getByText(/by 30 days/)).toBeInTheDocument()
    })
  })

  describe('hard vs soft constraints', () => {
    it('shows hard constraint indicator by default', () => {
      render(
        <ConstraintNode {...createNodeProps({ label: 'Hard Limit' })} />,
        { wrapper: Wrapper }
      )

      // Hard constraint should have indicator
      expect(screen.getByTitle('Hard constraint - must be met')).toBeInTheDocument()
    })

    it('shows soft constraint badge when hardConstraint is false', () => {
      render(
        <ConstraintNode
          {...createNodeProps({
            label: 'Soft Limit',
            hardConstraint: false,
          })}
        />,
        { wrapper: Wrapper }
      )

      expect(screen.getByText('Soft')).toBeInTheDocument()
    })
  })

  describe('description', () => {
    it('renders description when provided', () => {
      render(
        <ConstraintNode
          {...createNodeProps({
            label: 'Budget',
            description: 'Total marketing spend limit',
          })}
        />,
        { wrapper: Wrapper }
      )

      expect(screen.getByText('Total marketing spend limit')).toBeInTheDocument()
    })
  })
})

/**
 * NeedleMoversOverlay DOM Tests (Phase B - M4.4)
 *
 * Verifies:
 * - Renders top 5 movers sorted by impact (descending)
 * - Displays impact percentage correctly
 * - Shows correct color coding (high/medium/low)
 * - Calls onFocusNode when mover clicked
 * - Renders legend with all impact levels
 * - Empty state (no render when movers.length === 0)
 * - Truncates node labels and reasons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NeedleMoversOverlay } from '../NeedleMoversOverlay'
import type { NeedleMover } from '../../validation/types'

describe('NeedleMoversOverlay', () => {
  const mockMovers: NeedleMover[] = [
    {
      nodeId: 'node-1',
      type: 'high',
      impact: 0.85,
      reason: 'Highest probability path',
    },
    {
      nodeId: 'node-2',
      type: 'medium',
      impact: 0.45,
      reason: 'Significant contribution to variance',
    },
    {
      nodeId: 'node-3',
      type: 'low',
      impact: 0.12,
      reason: 'Minor impact on outcome',
    },
  ]

  const mockOnFocusNode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering states', () => {
    it('should return null when no movers provided', () => {
      const { container } = render(<NeedleMoversOverlay movers={[]} onFocusNode={mockOnFocusNode} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render header with title and icon', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('Key Factors')).toBeInTheDocument()
    })

    it('should render all movers when ≤5', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('node-1')).toBeInTheDocument()
      expect(screen.getByText('node-2')).toBeInTheDocument()
      expect(screen.getByText('node-3')).toBeInTheDocument()
    })

    it('should render only top 5 movers when >5', () => {
      const manyMovers: NeedleMover[] = Array.from({ length: 10 }, (_, i) => ({
        nodeId: `node-${i}`,
        type: 'medium' as const,
        impact: 0.5 - i * 0.05,
        reason: `Reason ${i}`,
      }))

      render(<NeedleMoversOverlay movers={manyMovers} onFocusNode={mockOnFocusNode} />)

      // Should show first 5
      expect(screen.getByText('node-0')).toBeInTheDocument()
      expect(screen.getByText('node-4')).toBeInTheDocument()

      // Should not show 6th+
      expect(screen.queryByText('node-5')).not.toBeInTheDocument()
      expect(screen.queryByText('node-9')).not.toBeInTheDocument()
    })
  })

  describe('Sorting by impact', () => {
    it('should sort movers by impact descending', () => {
      const unsortedMovers: NeedleMover[] = [
        { nodeId: 'low', type: 'low', impact: 0.10, reason: 'Low' },
        { nodeId: 'high', type: 'high', impact: 0.90, reason: 'High' },
        { nodeId: 'medium', type: 'medium', impact: 0.50, reason: 'Medium' },
      ]

      render(<NeedleMoversOverlay movers={unsortedMovers} onFocusNode={mockOnFocusNode} />)

      const buttons = screen.getAllByRole('button')
      // First button should be the highest impact
      expect(buttons[0]).toHaveTextContent('high')
      expect(buttons[0]).toHaveTextContent('90%')
    })

    it('should maintain sorted order when rendering', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      const percentages = screen.getAllByText(/%$/)
      expect(percentages[0]).toHaveTextContent('85%')
      expect(percentages[1]).toHaveTextContent('45%')
      expect(percentages[2]).toHaveTextContent('12%')
    })
  })

  describe('Impact percentage display', () => {
    it('should display impact as rounded percentage', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('85%')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
      expect(screen.getByText('12%')).toBeInTheDocument()
    })

    it('should round impact correctly', () => {
      const preciseMovers: NeedleMover[] = [
        { nodeId: 'round-down', type: 'medium', impact: 0.444, reason: 'Should round to 44%' },
        { nodeId: 'round-up', type: 'medium', impact: 0.445, reason: 'Should round to 45%' },
        { nodeId: 'exact', type: 'high', impact: 0.50, reason: 'Should be 50%' },
      ]

      render(<NeedleMoversOverlay movers={preciseMovers} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('44%')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  describe('Color coding by impact level', () => {
    it('should apply red styling for high impact', () => {
      render(<NeedleMoversOverlay movers={[mockMovers[0]]} onFocusNode={mockOnFocusNode} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-red-700')
      expect(button).toHaveClass('bg-red-50')
      expect(button).toHaveClass('border-red-200')
    })

    it('should apply orange styling for medium impact', () => {
      render(<NeedleMoversOverlay movers={[mockMovers[1]]} onFocusNode={mockOnFocusNode} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-orange-700')
      expect(button).toHaveClass('bg-orange-50')
      expect(button).toHaveClass('border-orange-200')
    })

    it('should apply yellow styling for low impact', () => {
      render(<NeedleMoversOverlay movers={[mockMovers[2]]} onFocusNode={mockOnFocusNode} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-yellow-700')
      expect(button).toHaveClass('bg-yellow-50')
      expect(button).toHaveClass('border-yellow-200')
    })
  })

  describe('onFocusNode callback', () => {
    it('should call onFocusNode with nodeId when clicked', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      const firstButton = screen.getByText('node-1').closest('button')
      fireEvent.click(firstButton!)

      expect(mockOnFocusNode).toHaveBeenCalledTimes(1)
      expect(mockOnFocusNode).toHaveBeenCalledWith('node-1')
    })

    it('should call onFocusNode with correct nodeId for each mover', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      const secondButton = screen.getByText('node-2').closest('button')
      fireEvent.click(secondButton!)

      expect(mockOnFocusNode).toHaveBeenCalledWith('node-2')
    })

    it('should support multiple clicks', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      const button = screen.getByText('node-1').closest('button')
      fireEvent.click(button!)
      fireEvent.click(button!)
      fireEvent.click(button!)

      expect(mockOnFocusNode).toHaveBeenCalledTimes(3)
    })
  })

  describe('Legend display', () => {
    it('should render legend with all three impact levels', () => {
      render(<NeedleMoversOverlay movers={mockMovers} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Low')).toBeInTheDocument()
    })

    it('should render legend even with single mover', () => {
      render(<NeedleMoversOverlay movers={[mockMovers[0]]} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Low')).toBeInTheDocument()
    })
  })

  describe('Content display', () => {
    it('should display node ID', () => {
      render(<NeedleMoversOverlay movers={[mockMovers[0]]} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('node-1')).toBeInTheDocument()
    })

    it('should display reason', () => {
      render(<NeedleMoversOverlay movers={[mockMovers[0]]} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('Highest probability path')).toBeInTheDocument()
    })

    it('should truncate long node IDs', () => {
      const longIdMover: NeedleMover = {
        nodeId: 'very-long-node-id-that-should-be-truncated-in-the-ui',
        type: 'high',
        impact: 0.80,
        reason: 'Test',
      }

      render(<NeedleMoversOverlay movers={[longIdMover]} onFocusNode={mockOnFocusNode} />)

      const nodeLabel = screen.getByText(longIdMover.nodeId)
      expect(nodeLabel).toHaveClass('truncate')
    })

    it('should truncate long reasons', () => {
      const longReasonMover: NeedleMover = {
        nodeId: 'node-1',
        type: 'high',
        impact: 0.80,
        reason: 'This is a very long reason that describes why this particular node is considered a key factor in the decision analysis and should be truncated in the UI',
      }

      render(<NeedleMoversOverlay movers={[longReasonMover]} onFocusNode={mockOnFocusNode} />)

      const reason = screen.getByText(longReasonMover.reason)
      expect(reason).toHaveClass('truncate')
    })
  })

  describe('Edge cases', () => {
    it('should handle zero impact', () => {
      const zeroMover: NeedleMover = {
        nodeId: 'zero',
        type: 'low',
        impact: 0,
        reason: 'No impact',
      }

      render(<NeedleMoversOverlay movers={[zeroMover]} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('should handle 100% impact', () => {
      const fullMover: NeedleMover = {
        nodeId: 'full',
        type: 'high',
        impact: 1.0,
        reason: 'Maximum impact',
      }

      render(<NeedleMoversOverlay movers={[fullMover]} onFocusNode={mockOnFocusNode} />)

      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('should handle empty reason', () => {
      const noReasonMover: NeedleMover = {
        nodeId: 'no-reason',
        type: 'medium',
        impact: 0.50,
        reason: '',
      }

      render(<NeedleMoversOverlay movers={[noReasonMover]} onFocusNode={mockOnFocusNode} />)

      // Should render without crashing
      expect(screen.getByText('no-reason')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('should handle exactly 5 movers (boundary)', () => {
      const fiveMovers: NeedleMover[] = Array.from({ length: 5 }, (_, i) => ({
        nodeId: `node-${i}`,
        type: 'medium' as const,
        impact: 0.5 - i * 0.1,
        reason: `Reason ${i}`,
      }))

      render(<NeedleMoversOverlay movers={fiveMovers} onFocusNode={mockOnFocusNode} />)

      // Should show all 5
      for (let i = 0; i < 5; i++) {
        expect(screen.getByText(`node-${i}`)).toBeInTheDocument()
      }
    })
  })
})

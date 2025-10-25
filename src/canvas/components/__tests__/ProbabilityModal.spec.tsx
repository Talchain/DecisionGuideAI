/**
 * ProbabilityModal - Comprehensive test suite
 *
 * Tests for:
 * - Rendering and initialization
 * - Lock/Unlock functionality
 * - Auto-balance and Equal split logic
 * - Validation feedback
 * - Apply/Reset/Cancel actions
 * - Keyboard support
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ProbabilityModal } from '../ProbabilityModal'
import { useCanvasStore } from '../../store'
import type { Node } from 'reactflow'
import type { NodeData } from '../../domain/nodes'
import type { Edge } from 'reactflow'
import type { EdgeData } from '../../domain/edges'

describe('ProbabilityModal', () => {
  const mockNodes: Node<NodeData>[] = [
    {
      id: 'n1',
      type: 'decision',
      position: { x: 0, y: 0 },
      data: { label: 'Decision A', kind: 'decision' }
    },
    {
      id: 'n2',
      type: 'option',
      position: { x: 100, y: 0 },
      data: { label: 'Option 1', kind: 'option' }
    },
    {
      id: 'n3',
      type: 'option',
      position: { x: 200, y: 0 },
      data: { label: 'Option 2', kind: 'option' }
    },
    {
      id: 'n4',
      type: 'option',
      position: { x: 300, y: 0 },
      data: { label: 'Option 3', kind: 'option' }
    }
  ]

  const mockEdges: Edge<EdgeData>[] = [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      data: { confidence: 0.4, label: '40%' }
    },
    {
      id: 'e2',
      source: 'n1',
      target: 'n3',
      data: { confidence: 0.3, label: '30%' }
    },
    {
      id: 'e3',
      source: 'n1',
      target: 'n4',
      data: { confidence: 0.3, label: '30%' }
    }
  ]

  beforeEach(() => {
    useCanvasStore.setState({
      nodes: mockNodes,
      edges: mockEdges,
      touchedNodeIds: new Set()
    })
  })

  describe('Rendering', () => {
    it('renders modal with node name in subtitle', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      expect(screen.getByText('Edit Probabilities')).toBeInTheDocument()
      expect(screen.getByText('Decision A')).toBeInTheDocument()
    })

    it('renders all outgoing edges as rows', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('initializes with current probabilities', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      expect(screen.getByText('40%')).toBeInTheDocument()
      expect(screen.getAllByText('30%')).toHaveLength(2)
    })

    it('shows validation message when sum ≠ 100%', () => {
      // Create invalid state
      useCanvasStore.setState({
        nodes: mockNodes,
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.6, label: '60%' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.3, label: '30%' } }
        ]
      })

      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      expect(screen.getByText(/Total: 90%/)).toBeInTheDocument()
      expect(screen.getByText(/must be 100% ±1%/)).toBeInTheDocument()
    })
  })

  describe('Lock/Unlock', () => {
    it('toggles lock when lock button clicked', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const lockButtons = screen.getAllByRole('button', { name: /^(lock|unlock)$/i })
      const firstLockButton = lockButtons[0]
      expect(firstLockButton).toBeInTheDocument()

      // Initially unlocked
      expect(firstLockButton).toHaveAttribute('aria-label', 'Lock')

      // Click to lock
      fireEvent.click(firstLockButton)
      expect(firstLockButton).toHaveAttribute('aria-label', 'Unlock')

      // Click to unlock
      fireEvent.click(firstLockButton)
      expect(firstLockButton).toHaveAttribute('aria-label', 'Lock')
    })

    it('disables slider when row is locked', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const slider = screen.getAllByRole('slider')[0]
      expect(slider).not.toBeDisabled()

      // Lock the first row
      const lockButtons = screen.getAllByRole('button', { name: /^(lock|unlock)$/i })
      fireEvent.click(lockButtons[0])

      expect(slider).toBeDisabled()
    })
  })

  describe('Auto-balance and Equal Split Logic', () => {
    it('distributes remaining % equally across unlocked rows', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      // Lock first row at 40%
      const lockButtons = screen.getAllByRole('button', { name: /^(lock|unlock)$/i })
      fireEvent.click(lockButtons[0])

      // Click Equal split
      const equalSplitButton = screen.getByRole('button', { name: /equal split/i })
      fireEvent.click(equalSplitButton)

      // Should distribute 60% equally across 2 unlocked rows = 30% each
      const percentages = screen.getAllByText(/\d+%$/)
      expect(percentages[0]).toHaveTextContent('40%') // locked, unchanged
      expect(percentages[1]).toHaveTextContent('30%') // (100-40)/2
      expect(percentages[2]).toHaveTextContent('30%') // (100-40)/2
    })

    it('handles rounding remainder correctly', () => {
      // Create scenario where remainder exists: 100% / 3 = 33.33...
      useCanvasStore.setState({
        nodes: mockNodes,
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0, label: '0%' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0, label: '0%' } },
          { id: 'e3', source: 'n1', target: 'n4', data: { confidence: 0, label: '0%' } }
        ]
      })

      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      // Click Equal split
      const equalSplitButton = screen.getByRole('button', { name: /equal split/i })
      fireEvent.click(equalSplitButton)

      // Should round to 5% steps and sum to 100%
      // 100/3 = 33.33 → rounds to 30/35/35 or 35/35/30
      const percentages = screen.getAllByText(/\d+%$/)
      const values = percentages.map(p => parseInt(p.textContent || '0'))

      // All should be multiples of 5
      expect(values.every(v => v % 5 === 0)).toBe(true)

      // Should sum to 100
      expect(values.reduce((sum, v) => sum + v, 0)).toBe(100)
    })

    it('disables both balance buttons when all rows locked', () => {
      const onClose = vi.fn()
      const { container } = render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      // Lock all rows
      const lockButtons = screen.getAllByRole('button', { name: /lock/i })
      lockButtons.forEach(btn => fireEvent.click(btn))

      // Both balance buttons should be disabled
      const autoBalanceButton = screen.getByRole('button', { name: /auto-balance/i })
      const equalSplitButton = screen.getByRole('button', { name: /equal split/i })
      expect(autoBalanceButton).toBeDisabled()
      expect(equalSplitButton).toBeDisabled()
    })
  })

  describe('Actions', () => {
    it('resets to original values when Reset clicked', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      // Modify a slider
      const slider = screen.getAllByRole('slider')[0]
      fireEvent.change(slider, { target: { value: '50' } })

      // Should show 50%
      expect(screen.getByText('50%')).toBeInTheDocument()

      // Click Reset
      const resetButton = screen.getByRole('button', { name: /reset/i })
      fireEvent.click(resetButton)

      // Should restore original 40%
      expect(screen.getByText('40%')).toBeInTheDocument()
      expect(screen.queryByText('50%')).not.toBeInTheDocument()
    })

    it('closes modal when Cancel clicked', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes modal when backdrop clicked', () => {
      const onClose = vi.fn()
      const { container } = render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const backdrop = container.querySelector('[class*="backdrop"]')
      expect(backdrop).toBeInTheDocument()

      fireEvent.click(backdrop!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('disables Apply when validation fails', () => {
      // Create invalid state
      useCanvasStore.setState({
        nodes: mockNodes,
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.6, label: '60%' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.3, label: '30%' } }
        ]
      })

      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const applyButton = screen.getByRole('button', { name: /apply/i })
      expect(applyButton).toBeDisabled()
    })

    it('applies changes and closes when Apply clicked (valid state)', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      // Initial state is valid (40%+30%+30%=100%)
      const applyButton = screen.getByRole('button', { name: /apply/i })
      expect(applyButton).not.toBeDisabled()

      fireEvent.click(applyButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('updates edge data when Apply clicked', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      // Change first slider to 50%
      const slider = screen.getAllByRole('slider')[0]
      fireEvent.change(slider, { target: { value: '50' } })

      // Change second slider to 25%
      fireEvent.change(screen.getAllByRole('slider')[1], { target: { value: '25' } })

      // Third automatically should be 25% for valid sum
      fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '25' } })

      // Click Apply
      const applyButton = screen.getByRole('button', { name: /apply/i })
      fireEvent.click(applyButton)

      // Check that edges were updated
      const state = useCanvasStore.getState()
      const edge1 = state.edges.find(e => e.id === 'e1')
      expect(edge1?.data?.confidence).toBe(0.5)
      expect(edge1?.data?.label).toBe('50%')
    })
  })

  describe('Keyboard Support', () => {
    it('closes modal when Escape pressed', () => {
      const onClose = vi.fn()
      const { container } = render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const modal = container.querySelector('[class*="modal"]')
      expect(modal).toBeInTheDocument()

      fireEvent.keyDown(modal!, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('applies changes when Enter pressed (valid state)', () => {
      const onClose = vi.fn()
      const { container } = render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const modal = container.querySelector('[class*="modal"]')
      fireEvent.keyDown(modal!, { key: 'Enter' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not apply when Enter pressed with invalid state', () => {
      // Create invalid state
      useCanvasStore.setState({
        nodes: mockNodes,
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.6, label: '60%' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.3, label: '30%' } }
        ]
      })

      const onClose = vi.fn()
      const { container } = render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const modal = container.querySelector('[class*="modal"]')
      fireEvent.keyDown(modal!, { key: 'Enter' })

      // Should NOT close
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper dialog semantics', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'probability-modal-title')
    })

    it('has accessible slider labels', () => {
      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const slider1 = screen.getByLabelText('Probability to Option 1')
      const slider2 = screen.getByLabelText('Probability to Option 2')
      const slider3 = screen.getByLabelText('Probability to Option 3')

      expect(slider1).toBeInTheDocument()
      expect(slider2).toBeInTheDocument()
      expect(slider3).toBeInTheDocument()
    })

    it('announces validation errors with role="alert"', () => {
      // Create invalid state
      useCanvasStore.setState({
        nodes: mockNodes,
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.6, label: '60%' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.3, label: '30%' } }
        ]
      })

      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(/Total: 90%/)
    })
  })

  describe('Validation', () => {
    it('accepts sum within ±1% tolerance', () => {
      // Create state with 99% total (within tolerance)
      useCanvasStore.setState({
        nodes: mockNodes,
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.5, label: '50%' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.49, label: '49%' } }
        ]
      })

      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const applyButton = screen.getByRole('button', { name: /apply/i })
      expect(applyButton).not.toBeDisabled() // Should be valid

      // No validation error shown
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('rejects sum outside ±1% tolerance', () => {
      // Create state with 98% total (outside tolerance)
      useCanvasStore.setState({
        nodes: mockNodes,
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.5, label: '50%' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.48, label: '48%' } }
        ]
      })

      const onClose = vi.fn()
      render(<ProbabilityModal nodeId="n1" onClose={onClose} />)

      const applyButton = screen.getByRole('button', { name: /apply/i })
      expect(applyButton).toBeDisabled()

      // Validation error shown
      expect(screen.getByRole('alert')).toHaveTextContent(/Total: 98%/)
    })
  })
})

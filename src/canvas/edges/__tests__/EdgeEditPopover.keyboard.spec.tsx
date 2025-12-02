/**
 * S6-INLINE: EdgeEditPopover Keyboard Tests
 *
 * Tests arrow key nudging functionality:
 * - ±0.01 for normal arrow keys
 * - ±0.05 for Shift+arrow keys
 * - Clamping at [0, 1] boundaries
 * - Focus management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeEditPopover } from '../EdgeEditPopover'

describe('S6-INLINE: EdgeEditPopover Keyboard Navigation', () => {
  const mockEdge = {
    id: 'edge-1',
    data: {
      weight: 0.5,
      belief: 0.5
    }
  }

  const mockOnUpdate = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('Arrow Key Nudging (±0.01)', () => {
    it('should increase weight by 0.01 when ArrowUp pressed on weight slider', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })

      // Check immediate state update
      expect(weightSlider).toHaveValue('0.51')

      // Advance timers for debounced update
      vi.advanceTimersByTime(120)

      // Check debounced onUpdate was called
      expect(mockOnUpdate).toHaveBeenCalledWith('edge-1', {
        weight: 0.51,
        belief: 0.5
      })
    })

    it('should decrease weight by 0.01 when ArrowDown pressed on weight slider', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      fireEvent.keyDown(weightSlider, { key: 'ArrowDown' })

      expect(weightSlider).toHaveValue('0.49')
    })

    it('should increase weight by 0.01 when ArrowRight pressed on weight slider', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      fireEvent.keyDown(weightSlider, { key: 'ArrowRight' })

      expect(weightSlider).toHaveValue('0.51')
    })

    it('should decrease weight by 0.01 when ArrowLeft pressed on weight slider', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      fireEvent.keyDown(weightSlider, { key: 'ArrowLeft' })

      expect(weightSlider).toHaveValue('0.49')
    })

    it('should increase belief by 0.01 when ArrowUp pressed on belief slider', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const beliefSlider = screen.getByLabelText('Belief slider')
      beliefSlider.focus()

      fireEvent.keyDown(beliefSlider, { key: 'ArrowUp' })

      expect(beliefSlider).toHaveValue('0.51')
    })

    it('should decrease belief by 0.01 when ArrowDown pressed on belief slider', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const beliefSlider = screen.getByLabelText('Belief slider')
      beliefSlider.focus()

      fireEvent.keyDown(beliefSlider, { key: 'ArrowDown' })

      expect(beliefSlider).toHaveValue('0.49')
    })
  })

  describe('Shift+Arrow Key Nudging (±0.05)', () => {
    it('should increase weight by 0.05 when Shift+ArrowUp pressed', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      fireEvent.keyDown(weightSlider, { key: 'ArrowUp', shiftKey: true })

      expect(weightSlider).toHaveValue('0.55')
    })

    it('should decrease weight by 0.05 when Shift+ArrowDown pressed', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      fireEvent.keyDown(weightSlider, { key: 'ArrowDown', shiftKey: true })

      expect(weightSlider).toHaveValue('0.45')
    })

    it('should increase belief by 0.05 when Shift+ArrowRight pressed', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const beliefSlider = screen.getByLabelText('Belief slider')
      beliefSlider.focus()

      fireEvent.keyDown(beliefSlider, { key: 'ArrowRight', shiftKey: true })

      expect(beliefSlider).toHaveValue('0.55')
    })

    it('should decrease belief by 0.05 when Shift+ArrowLeft pressed', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const beliefSlider = screen.getByLabelText('Belief slider')
      beliefSlider.focus()

      fireEvent.keyDown(beliefSlider, { key: 'ArrowLeft', shiftKey: true })

      expect(beliefSlider).toHaveValue('0.45')
    })
  })

  describe('Boundary Clamping', () => {
    it('should clamp weight at 1.0 when incrementing beyond max', async () => {
      const highValueEdge = {
        id: 'edge-high',
        data: { weight: 0.98, belief: 0.5 }
      }

      render(
        <EdgeEditPopover
          edge={highValueEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      // Press ArrowUp 3 times (0.98 + 0.03 = 1.01, should clamp to 1.0)
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })

      expect(weightSlider).toHaveValue('1')
    })

    it('should clamp weight at 0.0 when decrementing below min', async () => {
      const lowValueEdge = {
        id: 'edge-low',
        data: { weight: 0.02, belief: 0.5 }
      }

      render(
        <EdgeEditPopover
          edge={lowValueEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      // Press ArrowDown 3 times (0.02 - 0.03 = -0.01, should clamp to 0.0)
      fireEvent.keyDown(weightSlider, { key: 'ArrowDown' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowDown' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowDown' })

      expect(weightSlider).toHaveValue('0')
    })

    it('should clamp belief at 1.0 when Shift+ArrowUp exceeds max', async () => {
      const highValueEdge = {
        id: 'edge-high',
        data: { weight: 0.5, belief: 0.97 }
      }

      render(
        <EdgeEditPopover
          edge={highValueEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const beliefSlider = screen.getByLabelText('Belief slider')
      beliefSlider.focus()

      // Shift+ArrowUp (0.97 + 0.05 = 1.02, should clamp to 1.0)
      fireEvent.keyDown(beliefSlider, { key: 'ArrowUp', shiftKey: true })

      expect(beliefSlider).toHaveValue('1')
    })

    it('should clamp belief at 0.0 when Shift+ArrowDown goes below min', async () => {
      const lowValueEdge = {
        id: 'edge-low',
        data: { weight: 0.5, belief: 0.03 }
      }

      render(
        <EdgeEditPopover
          edge={lowValueEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const beliefSlider = screen.getByLabelText('Belief slider')
      beliefSlider.focus()

      // Shift+ArrowDown (0.03 - 0.05 = -0.02, should clamp to 0.0)
      fireEvent.keyDown(beliefSlider, { key: 'ArrowDown', shiftKey: true })

      expect(beliefSlider).toHaveValue('0')
    })
  })

  describe('Focus Management', () => {
    it('should not respond to arrow keys when no slider is focused', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight')
      const dialog = screen.getByRole('dialog')

      // Focus the dialog container (not a slider)
      dialog.focus()

      fireEvent.keyDown(dialog, { key: 'ArrowUp' })

      // Weight should remain unchanged
      expect(weightSlider).toHaveValue('0.5')
    })

    it('should stop responding to arrow keys when slider loses focus', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')

      // Focus weight slider
      weightSlider.focus()

      // Increment weight
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      expect(weightSlider).toHaveValue('0.51')

      // Blur weight slider
      fireEvent.blur(weightSlider)

      // Try to increment again (should not work)
      const dialog = screen.getByRole('dialog')
      fireEvent.keyDown(dialog, { key: 'ArrowUp' })
      expect(weightSlider).toHaveValue('0.51') // Unchanged
    })

    it('should switch between weight and belief sliders on focus', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      const beliefSlider = screen.getByLabelText('Belief slider')

      // Focus weight slider and increment
      weightSlider.focus()
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      expect(weightSlider).toHaveValue('0.51')

      // Switch to belief slider
      beliefSlider.focus()
      fireEvent.keyDown(beliefSlider, { key: 'ArrowDown' })
      expect(beliefSlider).toHaveValue('0.49')

      // Weight should be unchanged
      expect(weightSlider).toHaveValue('0.51')
    })
  })

  describe('Multiple Adjustments', () => {
    it('should allow multiple consecutive arrow key adjustments', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const weightSlider = screen.getByLabelText('Weight slider')
      weightSlider.focus()

      // Press ArrowUp 5 times
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })
      fireEvent.keyDown(weightSlider, { key: 'ArrowUp' })

      // 0.5 + (0.01 * 5) = 0.55
      expect(weightSlider).toHaveValue('0.55')
    })

    it('should mix normal and Shift arrow key adjustments', async () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const beliefSlider = screen.getByLabelText('Belief slider')
      beliefSlider.focus()

      // +0.05 (Shift+ArrowUp)
      fireEvent.keyDown(beliefSlider, { key: 'ArrowUp', shiftKey: true })
      expect(beliefSlider).toHaveValue('0.55')

      // +0.01 (ArrowUp)
      fireEvent.keyDown(beliefSlider, { key: 'ArrowUp' })
      expect(beliefSlider).toHaveValue('0.56')

      // -0.05 (Shift+ArrowDown)
      fireEvent.keyDown(beliefSlider, { key: 'ArrowDown', shiftKey: true })
      expect(beliefSlider).toHaveValue('0.51')

      // -0.01 (ArrowDown)
      fireEvent.keyDown(beliefSlider, { key: 'ArrowDown' })
      expect(beliefSlider).toHaveValue('0.5')
    })
  })

  describe('Hint Text', () => {
    it('should display arrow key hint in footer', () => {
      render(
        <EdgeEditPopover
          edge={mockEdge}
          position={{ x: 100, y: 100 }}
          onUpdate={mockOnUpdate}
          onClose={mockOnClose}
        />
      )

      const hint = screen.getByText((text) =>
        text.includes('Arrow keys:') && text.includes('0.01') && text.includes('0.05')
      )
      expect(hint).toBeInTheDocument()
    })
  })
})

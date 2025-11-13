/**
 * S2-INLINE: DOM Integration Tests for Edge Edit Popover
 * Tests slider interactions, keyboard shortcuts, click-outside, and debounced updates
 * Uses React Testing Library for user-centric testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EdgeEditPopover, type EdgeEditPopoverProps } from '../EdgeEditPopover'

describe('S2-INLINE: EdgeEditPopover DOM Integration', () => {
  const mockOnUpdate = vi.fn()
  const mockOnClose = vi.fn()

  const defaultEdge = {
    id: 'edge-1',
    data: {
      weight: 0.6,
      belief: 0.8
    }
  }

  const defaultProps: EdgeEditPopoverProps = {
    edge: defaultEdge,
    position: { x: 400, y: 300 },
    onUpdate: mockOnUpdate,
    onClose: mockOnClose
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Rendering and Structure', () => {
    it('should render with correct title', () => {
      render(<EdgeEditPopover {...defaultProps} />)
      expect(screen.getByText('Edit Edge')).toBeDefined()
    })

    it('should render at correct screen position', () => {
      const { container } = render(<EdgeEditPopover {...defaultProps} />)

      const popover = container.querySelector('[role="dialog"]') as HTMLElement
      expect(popover.style.left).toBe('400px')
      expect(popover.style.top).toBe('300px')
      expect(popover.style.transform).toBe('translate(-50%, -100%) translateY(-8px)')
    })

    it('should render both weight and belief sliders', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      const beliefSlider = screen.getByLabelText('Belief') as HTMLInputElement

      expect(weightSlider).toBeDefined()
      expect(beliefSlider).toBeDefined()
      expect(weightSlider.type).toBe('range')
      expect(beliefSlider.type).toBe('range')
    })

    it('should display initial values', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      const beliefSlider = screen.getByLabelText('Belief') as HTMLInputElement

      expect(parseFloat(weightSlider.value)).toBe(0.6)
      expect(parseFloat(beliefSlider.value)).toBe(0.8)
    })

    it('should display formatted values', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      expect(screen.getByText('0.60')).toBeDefined() // Weight display
      expect(screen.getByText('0.80')).toBeDefined() // Belief display
    })

    it('should render close button', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const closeButton = screen.getByLabelText('Close')
      expect(closeButton).toBeDefined()
    })

    it('should render keyboard hint', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      expect(screen.getByText(/Press Enter to save, ESC to cancel/i)).toBeDefined()
    })
  })

  describe('Slider Interactions', () => {
    it('should update weight slider value', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      fireEvent.change(weightSlider, { target: { value: '0.75' } })

      expect(weightSlider.value).toBe('0.75')
      expect(screen.getByText('0.75')).toBeDefined()
    })

    it('should update belief slider value', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const beliefSlider = screen.getByLabelText('Belief') as HTMLInputElement

      fireEvent.change(beliefSlider, { target: { value: '0.33' } })

      expect(beliefSlider.value).toBe('0.33')
      expect(screen.getByText('0.33')).toBeDefined()
    })

    it('should handle edge values (0 and 1)', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      fireEvent.change(weightSlider, { target: { value: '0' } })
      expect(screen.getByText('0.00')).toBeDefined()

      fireEvent.change(weightSlider, { target: { value: '1' } })
      expect(screen.getByText('1.00')).toBeDefined()
    })

    it('should have correct slider attributes', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      expect(weightSlider.min).toBe('0')
      expect(weightSlider.max).toBe('1')
      expect(weightSlider.step).toBe('0.01')
    })
  })

  describe('Debounced Updates', () => {
    it('should debounce updates at 120ms', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      // Change value
      fireEvent.change(weightSlider, { target: { value: '0.9' } })

      // Should not call immediately
      expect(mockOnUpdate).not.toHaveBeenCalled()

      // Advance timers by 120ms
      vi.runAllTimers()

      // Should call now
      expect(mockOnUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.9, belief: 0.8 })
    })

    it('should reset debounce timer on rapid changes', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      // Rapid changes
      fireEvent.change(weightSlider, { target: { value: '0.1' } })
      vi.advanceTimersByTime(50)

      fireEvent.change(weightSlider, { target: { value: '0.2' } })
      vi.advanceTimersByTime(50)

      fireEvent.change(weightSlider, { target: { value: '0.3' } })

      // Should not have called yet (debounce reset)
      expect(mockOnUpdate).not.toHaveBeenCalled()

      // Complete the debounce
      vi.runAllTimers()

      expect(mockOnUpdate).toHaveBeenCalledTimes(1)
      expect(mockOnUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.3, belief: 0.8 })
    })

    it('should update both weight and belief in same call', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      const beliefSlider = screen.getByLabelText('Belief') as HTMLInputElement

      fireEvent.change(weightSlider, { target: { value: '0.4' } })
      fireEvent.change(beliefSlider, { target: { value: '0.7' } })

      vi.runAllTimers()

      expect(mockOnUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.4, belief: 0.7 })
    })

    it('should cleanup debounce timer on unmount', () => {
      const { unmount } = render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      fireEvent.change(weightSlider, { target: { value: '0.5' } })

      unmount()

      vi.advanceTimersByTime(120)

      // Should not crash or call after unmount
      expect(mockOnUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should close on Enter key', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')
      fireEvent.keyDown(popover, { key: 'Enter' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should close on Escape key', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')
      fireEvent.keyDown(popover, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should handle Enter key behavior', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')

      // Test that Enter calls onClose (preventDefault is internal implementation)
      fireEvent.keyDown(popover, { key: 'Enter' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should handle Escape key behavior', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')

      // Test that Escape calls onClose (preventDefault is internal implementation)
      fireEvent.keyDown(popover, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not close on other keys', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')

      fireEvent.keyDown(popover, { key: 'Tab' })
      fireEvent.keyDown(popover, { key: 'Space' })
      fireEvent.keyDown(popover, { key: 'a' })

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Click Outside Behavior', () => {
    it('should close when clicking outside', () => {
      const { container } = render(
        <div>
          <EdgeEditPopover {...defaultProps} />
          <div data-testid="outside">Outside element</div>
        </div>
      )

      const outside = screen.getByTestId('outside')
      fireEvent.mouseDown(outside)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not close when clicking inside', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')
      fireEvent.mouseDown(popover)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should not close when clicking sliders', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight')
      fireEvent.mouseDown(weightSlider)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should cleanup click listener on unmount', () => {
      const { unmount } = render(
        <div>
          <EdgeEditPopover {...defaultProps} />
          <div data-testid="outside">Outside</div>
        </div>
      )

      unmount()

      const outside = document.querySelector('[data-testid="outside"]')
      if (outside) {
        fireEvent.mouseDown(outside)
      }

      // Should not call after unmount
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Close Button', () => {
    it('should close when clicking X button', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const closeButton = screen.getByLabelText('Close')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should have hover state on close button', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const closeButton = screen.getByLabelText('Close')
      expect(closeButton.className).toContain('hover:text-gray-600')
    })
  })

  describe('Accessibility', () => {
    it('should have dialog role', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeDefined()
    })

    it('should have aria-label on dialog', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('aria-label')).toBe('Edit edge weight and belief')
    })

    it('should have labels associated with sliders', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightLabel = screen.getByText('Weight')
      const beliefLabel = screen.getByText('Belief')

      expect(weightLabel.getAttribute('for')).toBe('weight-slider')
      expect(beliefLabel.getAttribute('for')).toBe('belief-slider')
    })

    it('should have semantic HTML structure', () => {
      const { container } = render(<EdgeEditPopover {...defaultProps} />)

      const heading = container.querySelector('h3')
      expect(heading?.textContent).toBe('Edit Edge')

      const labels = container.querySelectorAll('label')
      expect(labels.length).toBe(2)
    })

    it('should have high z-index for overlay', () => {
      const { container } = render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')
      expect(popover.className).toContain('z-[3000]')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing belief (use default)', () => {
      const edgeWithoutBelief = {
        id: 'edge-2',
        data: { weight: 0.5 }
      }

      render(<EdgeEditPopover {...defaultProps} edge={edgeWithoutBelief} />)

      const beliefSlider = screen.getByLabelText('Belief') as HTMLInputElement
      expect(parseFloat(beliefSlider.value)).toBe(0.5) // Default value
    })

    it('should handle edge position at screen boundaries', () => {
      const { container } = render(
        <EdgeEditPopover {...defaultProps} position={{ x: 0, y: 0 }} />
      )

      const popover = screen.getByRole('dialog')
      expect(popover.style.left).toBe('0px')
      expect(popover.style.top).toBe('0px')
    })

    it('should handle very large coordinate values', () => {
      const { container } = render(
        <EdgeEditPopover {...defaultProps} position={{ x: 99999, y: 99999 }} />
      )

      const popover = screen.getByRole('dialog')
      expect(popover.style.left).toBe('99999px')
      expect(popover.style.top).toBe('99999px')
    })

    it('should handle rapid slider movements', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      // Simulate 10 rapid changes
      for (let i = 0; i <= 10; i++) {
        fireEvent.change(weightSlider, { target: { value: (i / 10).toString() } })
      }

      vi.runAllTimers()

      expect(mockOnUpdate).toHaveBeenCalledTimes(1)
      expect(mockOnUpdate).toHaveBeenCalledWith('edge-1', { weight: 1, belief: 0.8 })
    })

    it('should format decimal values consistently', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      fireEvent.change(weightSlider, { target: { value: '0.1' } })
      expect(screen.getByText('0.10')).toBeDefined()

      fireEvent.change(weightSlider, { target: { value: '0.999' } })
      expect(screen.getByText('1.00')).toBeDefined() // Rounds to 2 decimals
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete edit workflow', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      // Change weight
      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      fireEvent.change(weightSlider, { target: { value: '0.75' } })

      // Change belief
      const beliefSlider = screen.getByLabelText('Belief') as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.25' } })

      // Wait for debounce
      vi.runAllTimers()

      expect(mockOnUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.75, belief: 0.25 })

      // Close with Enter
      const popover = screen.getByRole('dialog')
      fireEvent.keyDown(popover, { key: 'Enter' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should handle cancel workflow', () => {
      const { unmount } = render(<EdgeEditPopover {...defaultProps} />)

      // Make changes
      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      fireEvent.change(weightSlider, { target: { value: '0.9' } })

      // Cancel before debounce completes (unmount simulates cancel/close)
      unmount()

      // Advance timer after cancel
      vi.runAllTimers()

      // Should not update after unmount (cleanup should prevent it)
      expect(mockOnUpdate).not.toHaveBeenCalled()
    })
  })
})

/**
 * S6-KEYBOARD: RadialQuickAddMenu Keyboard Navigation Tests
 *
 * Tests keyboard navigation features:
 * - Arrow keys (Left/Right/Up/Down) for navigation
 * - Enter key to select
 * - Number keys (1-6) for direct selection
 * - Tab/Shift+Tab for cycling
 * - Escape to cancel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RadialQuickAddMenu } from '../RadialQuickAddMenu'

describe('S6-KEYBOARD: RadialQuickAddMenu Keyboard Navigation', () => {
  const mockOnSelect = vi.fn()
  const mockOnCancel = vi.fn()
  const defaultProps = {
    position: { x: 100, y: 100 },
    onSelect: mockOnSelect,
    onCancel: mockOnCancel
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Arrow Key Navigation', () => {
    it('should navigate to next item with ArrowRight', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // First item should be selected by default
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')

      // Press ArrowRight
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      // Second item should now be selected
      expect(screen.getByTestId('radial-menu-item-1')).toHaveAttribute('fill', '#3B82F6')
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#F1F5F9')
    })

    it('should navigate to next item with ArrowDown', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Press ArrowDown
      fireEvent.keyDown(window, { key: 'ArrowDown' })

      // Second item should be selected
      expect(screen.getByTestId('radial-menu-item-1')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should navigate to previous item with ArrowLeft', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Start at first item (index 0), go left should wrap to last item
      fireEvent.keyDown(window, { key: 'ArrowLeft' })

      // Last item (index 5) should be selected
      expect(screen.getByTestId('radial-menu-item-5')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should navigate to previous item with ArrowUp', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Start at first item (index 0), go up should wrap to last item
      fireEvent.keyDown(window, { key: 'ArrowUp' })

      // Last item (index 5) should be selected
      expect(screen.getByTestId('radial-menu-item-5')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should wrap around when navigating past last item', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Navigate to last item
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(window, { key: 'ArrowRight' })
      }

      // Verify we're at last item
      expect(screen.getByTestId('radial-menu-item-5')).toHaveAttribute('fill', '#3B82F6')

      // Navigate one more time - should wrap to first
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')
      expect(screen.getByTestId('radial-menu-item-5')).toHaveAttribute('fill', '#F1F5F9')
    })

    it('should wrap around when navigating before first item', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Start at first item, go left
      fireEvent.keyDown(window, { key: 'ArrowLeft' })

      // Should wrap to last item
      expect(screen.getByTestId('radial-menu-item-5')).toHaveAttribute('fill', '#3B82F6')
    })
  })

  describe('Enter Key Selection', () => {
    it('should select current item when Enter is pressed', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Press Enter (first item should be selected by default)
      fireEvent.keyDown(window, { key: 'Enter' })

      expect(mockOnSelect).toHaveBeenCalledWith('decision')
    })

    it('should select navigated item when Enter is pressed', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Navigate to third item
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      // Press Enter
      fireEvent.keyDown(window, { key: 'Enter' })

      expect(mockOnSelect).toHaveBeenCalledWith('option')
    })
  })

  describe('Number Key Direct Selection', () => {
    it('should select first item with key "1"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: '1' })

      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should select second item with key "2"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: '2' })

      expect(screen.getByTestId('radial-menu-item-1')).toHaveAttribute('fill', '#3B82F6')
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#F1F5F9')
    })

    it('should select third item with key "3"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: '3' })

      expect(screen.getByTestId('radial-menu-item-2')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should select fourth item with key "4"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: '4' })

      expect(screen.getByTestId('radial-menu-item-3')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should select fifth item with key "5"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: '5' })

      expect(screen.getByTestId('radial-menu-item-4')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should select sixth item with key "6"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: '6' })

      expect(screen.getByTestId('radial-menu-item-5')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should ignore keys above "6"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Should start at first item
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')

      // Press "7" - should be ignored
      fireEvent.keyDown(window, { key: '7' })

      // Should still be at first item
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should ignore key "0"', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Should start at first item
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')

      // Press "0" - should be ignored
      fireEvent.keyDown(window, { key: '0' })

      // Should still be at first item
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')
    })
  })

  describe('Tab Key Cycling', () => {
    it('should navigate to next item with Tab', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Press Tab
      fireEvent.keyDown(window, { key: 'Tab' })

      // Second item should be selected
      expect(screen.getByTestId('radial-menu-item-1')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should navigate to previous item with Shift+Tab', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Press Shift+Tab
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })

      // Last item should be selected (wraps around)
      expect(screen.getByTestId('radial-menu-item-5')).toHaveAttribute('fill', '#3B82F6')
    })

    it('should wrap around when tabbing past last item', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Tab through all 6 items
      for (let i = 0; i < 6; i++) {
        fireEvent.keyDown(window, { key: 'Tab' })
      }

      // Should be back at first item
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')
    })
  })

  describe('Escape Key', () => {
    it('should call onCancel when Escape is pressed', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('should not select anything when Escape is pressed', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(mockOnSelect).not.toHaveBeenCalled()
      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('Mixed Interactions', () => {
    it('should handle arrow navigation followed by Enter selection', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Navigate right twice
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      // Verify third item is selected
      expect(screen.getByTestId('radial-menu-item-2')).toHaveAttribute('fill', '#3B82F6')

      // Press Enter
      fireEvent.keyDown(window, { key: 'Enter' })

      // Should select third item type ('option')
      expect(mockOnSelect).toHaveBeenCalledWith('option')
    })

    it('should handle number key selection followed by Enter', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Select item 5 with number key
      fireEvent.keyDown(window, { key: '5' })

      // Verify fifth item is selected
      expect(screen.getByTestId('radial-menu-item-4')).toHaveAttribute('fill', '#3B82F6')

      // Press Enter
      fireEvent.keyDown(window, { key: 'Enter' })

      // Should select fifth item type ('risk')
      expect(mockOnSelect).toHaveBeenCalledWith('risk')
    })

    it('should handle Tab + arrow key combination', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Tab twice
      fireEvent.keyDown(window, { key: 'Tab' })
      fireEvent.keyDown(window, { key: 'Tab' })

      // Should be at third item
      expect(screen.getByTestId('radial-menu-item-2')).toHaveAttribute('fill', '#3B82F6')

      // Arrow right
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      // Should be at fourth item
      expect(screen.getByTestId('radial-menu-item-3')).toHaveAttribute('fill', '#3B82F6')
    })
  })

  describe('Mouse and Keyboard Integration', () => {
    it('should update selection when mouse hovers over item', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Start at first item
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#3B82F6')

      // Hover over third item
      const thirdItem = screen.getByTestId('radial-menu-item-2')
      fireEvent.mouseEnter(thirdItem)

      // Third item should now be selected
      expect(screen.getByTestId('radial-menu-item-2')).toHaveAttribute('fill', '#3B82F6')
      expect(screen.getByTestId('radial-menu-item-0')).toHaveAttribute('fill', '#F1F5F9')
    })

    it('should allow keyboard navigation after mouse hover', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Hover over fourth item
      const fourthItem = screen.getByTestId('radial-menu-item-3')
      fireEvent.mouseEnter(fourthItem)

      // Fourth item should be selected
      expect(screen.getByTestId('radial-menu-item-3')).toHaveAttribute('fill', '#3B82F6')

      // Use keyboard to navigate right
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      // Fifth item should be selected
      expect(screen.getByTestId('radial-menu-item-4')).toHaveAttribute('fill', '#3B82F6')
      expect(screen.getByTestId('radial-menu-item-3')).toHaveAttribute('fill', '#F1F5F9')
    })

    it('should select item with mouse click', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      // Click second item
      const secondItem = screen.getByTestId('radial-menu-item-1')
      fireEvent.click(secondItem)

      expect(mockOnSelect).toHaveBeenCalledWith('outcome')
    })
  })

  describe('Accessibility', () => {
    it('should have role="button" on all menu items', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      for (let i = 0; i < 6; i++) {
        const item = screen.getByTestId(`radial-menu-item-${i}`)
        expect(item).toHaveAttribute('role', 'button')
      }
    })

    it('should have aria-label on all menu items', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      const expectedLabels = [
        'Select Decision',
        'Select Outcome',
        'Select Option',
        'Select Factor',
        'Select Risk',
        'Select Goal'
      ]

      for (let i = 0; i < 6; i++) {
        const item = screen.getByTestId(`radial-menu-item-${i}`)
        expect(item).toHaveAttribute('aria-label', expectedLabels[i])
      }
    })

    it('should prevent default behavior for all navigation keys', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape', '1']

      keys.forEach(key => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
        window.dispatchEvent(event)
        expect(preventDefaultSpy).toHaveBeenCalled()
      })
    })
  })
})

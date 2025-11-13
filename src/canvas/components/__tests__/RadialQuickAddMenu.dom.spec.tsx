/**
 * S2-QUICKADD: DOM Integration Tests for Radial Quick-Add Menu
 * Tests keyboard navigation (Q key, ESC), clicks, and node creation
 * Uses React Testing Library for user-centric testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RadialQuickAddMenu } from '../RadialQuickAddMenu'
import type { NodeType } from '../../domain/nodes'

describe('S2-QUICKADD: RadialQuickAddMenu DOM Integration', () => {
  const mockOnSelect = vi.fn()
  const mockOnCancel = vi.fn()
  const defaultProps = {
    position: { x: 400, y: 300 },
    onSelect: mockOnSelect,
    onCancel: mockOnCancel
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering and Structure', () => {
    it('should render 6 node type segments', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      // Check for SVG paths (one per segment)
      const paths = container.querySelectorAll('path')
      expect(paths.length).toBe(6)
    })

    it('should render at correct screen position', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.style.left).toBe('400px')
      expect(wrapper.style.top).toBe('300px')
      expect(wrapper.style.transform).toBe('translate(-50%, -50%)')
    })

    it('should render center dot indicator', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const centerDot = container.querySelector('.bg-info-500')
      expect(centerDot).toBeDefined()
      expect(centerDot?.classList.contains('rounded-full')).toBe(true)
    })

    it('should render all 6 node type labels', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const labels = container.querySelectorAll('text')
      expect(labels.length).toBe(6)

      // Check for common node types
      const labelTexts = Array.from(labels).map(label => label.textContent?.toLowerCase())
      expect(labelTexts).toContain('decision')
      expect(labelTexts).toContain('outcome')
      expect(labelTexts).toContain('option')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should close menu on Escape key', async () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: 'Escape' })

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalledTimes(1)
      })
    })

    it('should not close on other keys', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      fireEvent.keyDown(window, { key: 'Enter' })
      fireEvent.keyDown(window, { key: 'Space' })
      fireEvent.keyDown(window, { key: 'q' })

      expect(mockOnCancel).not.toHaveBeenCalled()
    })

    it('should clean up event listeners on unmount', () => {
      const { unmount } = render(<RadialQuickAddMenu {...defaultProps} />)

      unmount()

      // Should not crash or cause warnings
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(mockOnCancel).not.toHaveBeenCalled()
    })
  })

  describe('Mouse Interactions', () => {
    it('should highlight segment on hover', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const firstPath = container.querySelector('path')!

      // Hover over segment
      fireEvent.mouseEnter(firstPath)

      // Check fill color changed to blue (hover state)
      expect(firstPath.getAttribute('fill')).toBe('#3B82F6')
    })

    it('should remove highlight on mouse leave', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const firstPath = container.querySelector('path')!

      fireEvent.mouseEnter(firstPath)
      expect(firstPath.getAttribute('fill')).toBe('#3B82F6')

      fireEvent.mouseLeave(firstPath)
      expect(firstPath.getAttribute('fill')).toBe('#F1F5F9')
    })

    it('should call onSelect with correct node type on click', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const paths = container.querySelectorAll('path')
      const firstPath = paths[0]

      fireEvent.click(firstPath)

      expect(mockOnSelect).toHaveBeenCalledTimes(1)
      expect(mockOnSelect).toHaveBeenCalledWith('decision')
    })

    it('should call onSelect for each segment type', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const paths = container.querySelectorAll('path')
      const expectedTypes: NodeType[] = ['decision', 'outcome', 'option', 'factor', 'risk', 'goal']

      paths.forEach((path, index) => {
        mockOnSelect.mockClear()
        fireEvent.click(path)
        expect(mockOnSelect).toHaveBeenCalledWith(expectedTypes[index])
      })
    })
  })

  describe('Accessibility', () => {
    it('should have clickable cursor on segments', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const firstPath = container.querySelector('path')!
      expect(firstPath.style.cursor).toBe('pointer')
    })

    it('should not allow text selection (pointer-events: none)', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const labels = container.querySelectorAll('text')
      labels.forEach(label => {
        expect((label as SVGTextElement).getAttribute('pointer-events')).toBe('none')
      })
    })

    it('should have high z-index for overlay', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('z-[4000]')
    })
  })

  describe('Integration with ReactFlowGraph', () => {
    it('should handle rapid open/close cycles', () => {
      const { rerender, unmount } = render(<RadialQuickAddMenu {...defaultProps} />)

      // Simulate rapid rerender
      rerender(<RadialQuickAddMenu {...defaultProps} position={{ x: 500, y: 400 }} />)
      rerender(<RadialQuickAddMenu {...defaultProps} position={{ x: 600, y: 500 }} />)

      // Close with Escape
      fireEvent.keyDown(window, { key: 'Escape' })

      expect(mockOnCancel).toHaveBeenCalledTimes(1)

      unmount()
    })

    it('should prevent Escape event propagation', () => {
      render(<RadialQuickAddMenu {...defaultProps} />)

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      const preventDefaultSpy = vi.spyOn(escapeEvent, 'preventDefault')

      window.dispatchEvent(escapeEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('Visual Feedback', () => {
    it('should change label color on hover', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const firstPath = container.querySelector('path')!
      const firstLabel = container.querySelectorAll('text')[0]

      // Initial state: dark text
      expect(firstLabel.getAttribute('fill')).toBe('#475569')

      // Hover: white text
      fireEvent.mouseEnter(firstPath)
      expect(firstLabel.getAttribute('fill')).toBe('#FFFFFF')

      // Leave: back to dark
      fireEvent.mouseLeave(firstPath)
      expect(firstLabel.getAttribute('fill')).toBe('#475569')
    })

    it('should maintain consistent segment sizes', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const paths = container.querySelectorAll('path')

      // Each path should have similar complexity (same number of commands)
      const pathLengths = Array.from(paths).map(p => p.getAttribute('d')?.length || 0)
      const avgLength = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length

      // All paths should be within 20% of average (ensuring uniform size)
      pathLengths.forEach(length => {
        expect(Math.abs(length - avgLength) / avgLength).toBeLessThan(0.2)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle position at screen edge', () => {
      const { container } = render(
        <RadialQuickAddMenu {...defaultProps} position={{ x: 0, y: 0 }} />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.style.left).toBe('0px')
      expect(wrapper.style.top).toBe('0px')
    })

    it('should handle very large coordinates', () => {
      const { container } = render(
        <RadialQuickAddMenu {...defaultProps} position={{ x: 9999, y: 9999 }} />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.style.left).toBe('9999px')
      expect(wrapper.style.top).toBe('9999px')
    })

    it('should not crash on rapid clicks', () => {
      const { container } = render(<RadialQuickAddMenu {...defaultProps} />)

      const firstPath = container.querySelector('path')!

      // Simulate rapid clicking
      for (let i = 0; i < 10; i++) {
        fireEvent.click(firstPath)
      }

      expect(mockOnSelect).toHaveBeenCalledTimes(10)
      expect(mockOnSelect).toHaveBeenCalledWith('decision')
    })
  })
})

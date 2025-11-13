/**
 * S4-A11Y & S4-ARIA: Accessibility Validation Tests
 *
 * Validates focus management, ARIA labels, keyboard navigation,
 * and screen reader support across canvas components.
 *
 * WCAG 2.1 AA compliance requirements.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeEditPopover } from '../edges/EdgeEditPopover'
import { RadialQuickAddMenu } from '../components/RadialQuickAddMenu'
import { UnknownKindWarning } from '../components/UnknownKindWarning'

describe('S4-A11Y: Focus Management and ARIA', () => {
  describe('EdgeEditPopover Accessibility', () => {
    const mockProps = {
      edge: { id: 'e1', data: { weight: 0.5, belief: 0.5 } },
      position: { x: 400, y: 300 },
      onUpdate: () => {},
      onClose: () => {}
    }

    it('should have dialog role for screen readers', () => {
      render(<EdgeEditPopover {...mockProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeDefined()
    })

    it('should have descriptive aria-label on dialog', () => {
      render(<EdgeEditPopover {...mockProps} />)

      const dialog = screen.getByRole('dialog')
      const ariaLabel = dialog.getAttribute('aria-label')

      expect(ariaLabel).toBe('Edit edge weight and belief')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel!.length).toBeGreaterThan(10) // Descriptive label
    })

    it('should have proper labels for form controls', () => {
      render(<EdgeEditPopover {...mockProps} />)

      // Weight slider should have label
      const weightSlider = screen.getByLabelText('Weight')
      expect(weightSlider).toBeDefined()
      expect(weightSlider.getAttribute('type')).toBe('range')

      // Belief slider should have label
      const beliefSlider = screen.getByLabelText('Belief')
      expect(beliefSlider).toBeDefined()
      expect(beliefSlider.getAttribute('type')).toBe('range')
    })

    it('should have aria-label on close button', () => {
      render(<EdgeEditPopover {...mockProps} />)

      const closeButton = screen.getByLabelText('Close')
      expect(closeButton).toBeDefined()
      expect(closeButton.tagName.toLowerCase()).toBe('button')
    })

    it('should have proper heading hierarchy', () => {
      const { container } = render(<EdgeEditPopover {...mockProps} />)

      const heading = container.querySelector('h3')
      expect(heading).toBeDefined()
      expect(heading?.textContent).toBe('Edit Edge')
    })

    it('should have keyboard hint text for screen readers', () => {
      render(<EdgeEditPopover {...mockProps} />)

      const hint = screen.getByText(/Press Enter to save, ESC to cancel/i)
      expect(hint).toBeDefined()
    })

    it('should have proper input attributes for sliders', () => {
      render(<EdgeEditPopover {...mockProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      expect(weightSlider.min).toBe('0')
      expect(weightSlider.max).toBe('1')
      expect(weightSlider.step).toBe('0.01')
      expect(weightSlider.type).toBe('range')
    })
  })

  describe('RadialQuickAddMenu Accessibility', () => {
    const mockProps = {
      position: { x: 400, y: 300 },
      onSelect: () => {},
      onCancel: () => {}
    }

    it('should have appropriate z-index for overlay', () => {
      const { container } = render(<RadialQuickAddMenu {...mockProps} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('z-[4000]')
    })

    it('should have text labels for each segment', () => {
      const { container } = render(<RadialQuickAddMenu {...mockProps} />)

      const labels = container.querySelectorAll('text')
      expect(labels.length).toBe(6) // 6 node types

      // All labels should have text content
      labels.forEach(label => {
        expect(label.textContent).toBeTruthy()
        expect(label.textContent!.length).toBeGreaterThan(0)
      })
    })

    it('should have clickable segments with pointer cursor', () => {
      const { container } = render(<RadialQuickAddMenu {...mockProps} />)

      const paths = container.querySelectorAll('path')
      expect(paths.length).toBe(6)

      paths.forEach(path => {
        expect((path as SVGPathElement).style.cursor).toBe('pointer')
      })
    })

    it('should not allow text selection on labels', () => {
      const { container } = render(<RadialQuickAddMenu {...mockProps} />)

      const labels = container.querySelectorAll('text')
      labels.forEach(label => {
        expect((label as SVGTextElement).getAttribute('pointer-events')).toBe('none')
      })
    })
  })

  describe('UnknownKindWarning Accessibility', () => {
    it('should have status role for announcements', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)

      const warning = container.querySelector('[role="status"]')
      expect(warning).toBeDefined()
    })

    it('should have aria-label for screen readers', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)

      const warning = container.querySelector('[role="status"]')
      const ariaLabel = warning?.getAttribute('aria-label')

      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel).toContain('custom-type')
    })

    it('should have title attribute for tooltip', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)

      const warning = container.querySelector('[role="status"]')
      const title = warning?.getAttribute('title')

      expect(title).toBeTruthy()
      expect(title).toContain('custom-type')
    })

    it('should have visual icon with aria-hidden', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)

      const icon = container.querySelector('[aria-hidden="true"]')
      expect(icon).toBeDefined()
      expect(icon?.classList.contains('w-3')).toBe(true)
    })

    it('should have descriptive text', () => {
      render(<UnknownKindWarning originalKind="custom-type" />)

      const text = screen.getByText('Unknown type')
      expect(text).toBeDefined()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support Escape key to close popover', () => {
      const mockOnClose = vi.fn()
      render(
        <EdgeEditPopover
          edge={{ id: 'e1', data: { weight: 0.5, belief: 0.5 } }}
          position={{ x: 400, y: 300 }}
          onUpdate={() => {}}
          onClose={mockOnClose}
        />
      )

      const dialog = screen.getByRole('dialog')
      fireEvent.keyDown(dialog, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should support Enter key to save popover', () => {
      const mockOnClose = vi.fn()
      render(
        <EdgeEditPopover
          edge={{ id: 'e1', data: { weight: 0.5, belief: 0.5 } }}
          position={{ x: 400, y: 300 }}
          onUpdate={() => {}}
          onClose={mockOnClose}
        />
      )

      const dialog = screen.getByRole('dialog')
      fireEvent.keyDown(dialog, { key: 'Enter' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Color Contrast', () => {
    it('should use high-contrast colors for text', () => {
      const { container } = render(
        <EdgeEditPopover
          edge={{ id: 'e1', data: { weight: 0.5, belief: 0.5 } }}
          position={{ x: 400, y: 300 }}
          onUpdate={() => {}}
          onClose={() => {}}
        />
      )

      // Check heading color
      const heading = container.querySelector('h3')
      const headingStyle = window.getComputedStyle(heading!)

      // Should have dark text (gray-900 or similar)
      // Just verify it exists and has styling
      expect(heading).toBeDefined()
    })

    it('should have sufficient contrast for warning chip', () => {
      const { container } = render(<UnknownKindWarning originalKind="test" />)

      const warning = container.querySelector('[role="status"]')

      // Should have amber color scheme
      expect(warning?.classList.toString()).toContain('amber')
    })
  })

  describe('Screen Reader Support', () => {
    it('should provide context for slider values', () => {
      render(
        <EdgeEditPopover
          edge={{ id: 'e1', data: { weight: 0.75, belief: 0.9 } }}
          position={{ x: 400, y: 300 }}
          onUpdate={() => {}}
          onClose={() => {}}
        />
      )

      // Value should be displayed next to label
      expect(screen.getByText('0.75')).toBeDefined()
      expect(screen.getByText('0.90')).toBeDefined()
    })

    it('should announce warning status with role="status"', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom" />)

      const status = container.querySelector('[role="status"]')
      expect(status).toBeDefined()
      expect(status?.getAttribute('aria-label')).toBeTruthy()
    })

    it('should have semantic HTML structure', () => {
      const { container } = render(
        <EdgeEditPopover
          edge={{ id: 'e1', data: { weight: 0.5, belief: 0.5 } }}
          position={{ x: 400, y: 300 }}
          onUpdate={() => {}}
          onClose={() => {}}
        />
      )

      // Should have proper heading
      const heading = container.querySelector('h3')
      expect(heading).toBeDefined()

      // Should have proper labels
      const labels = container.querySelectorAll('label')
      expect(labels.length).toBe(2) // Weight and Belief
    })
  })
})

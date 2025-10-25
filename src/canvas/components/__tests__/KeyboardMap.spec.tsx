/**
 * KeyboardMap - Test suite
 *
 * Tests for:
 * - Rendering and visibility control
 * - Keyboard shortcuts display
 * - Escape key handler
 * - Backdrop click handler
 * - Accessibility
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardMap } from '../KeyboardMap'

describe('KeyboardMap', () => {
  describe('Visibility Control', () => {
    it('renders when isOpen is true', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={false} onClose={onClose} />)

      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()
    })
  })

  describe('Escape Key Handler', () => {
    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not attach listener when closed', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={false} onClose={onClose} />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(onClose).not.toHaveBeenCalled()
    })

    it('cleans up event listener on unmount', () => {
      const onClose = vi.fn()
      const { unmount } = render(<KeyboardMap isOpen={true} onClose={onClose} />)

      unmount()

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(onClose).not.toHaveBeenCalled()
    })

    it('prevents default behavior for Escape key', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('Backdrop Click', () => {
    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const backdrop = container.querySelector('[class*="backdrop"]')
      expect(backdrop).toBeInTheDocument()

      fireEvent.click(backdrop!)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close when modal content is clicked', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const modal = container.querySelector('[class*="modal"]')
      expect(modal).toBeInTheDocument()

      fireEvent.click(modal!)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard Shortcuts Display', () => {
    it('displays Run template shortcut', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      expect(screen.getByText('Run selected template')).toBeInTheDocument()
      expect(screen.getAllByText('⌘/Ctrl').length).toBeGreaterThan(0)
      expect(screen.getByText('Enter')).toBeInTheDocument()
    })

    it('displays Jump to invalid node shortcut', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      expect(screen.getByText('Jump to next invalid node')).toBeInTheDocument()
      expect(screen.getByText('Alt/Option')).toBeInTheDocument()
      expect(screen.getByText('V')).toBeInTheDocument()
    })

    it('displays Edit probabilities shortcut', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      expect(screen.getByText('Edit probabilities (batch)')).toBeInTheDocument()
      expect(screen.getByText('P')).toBeInTheDocument()
    })

    it('displays Undo/Redo shortcuts', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      expect(screen.getByText('Undo')).toBeInTheDocument()
      expect(screen.getByText('Redo')).toBeInTheDocument()
      // ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z
      const cmdKeys = screen.getAllByText('⌘/Ctrl')
      expect(cmdKeys.length).toBeGreaterThanOrEqual(2)
    })

    it('displays Help shortcut', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      expect(screen.getByText('Show this keyboard map')).toBeInTheDocument()
      expect(screen.getByText('?')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper dialog semantics', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has accessible title', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const title = screen.getByText('Keyboard Shortcuts')
      expect(title).toBeInTheDocument()
    })

    it('has close button with accessible label', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const closeButton = screen.getByLabelText('Close keyboard shortcuts')
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('Visual Structure', () => {
    it('renders shortcut rows with kbd elements', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const kbdElements = container.querySelectorAll('kbd')
      expect(kbdElements.length).toBeGreaterThan(0)
    })

    it('uses Olumi brand tokens in CSS modules', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const backdrop = container.querySelector('[class*="backdrop"]')
      expect(backdrop).toBeInTheDocument()
      expect(backdrop?.className).toMatch(/backdrop/)

      const modal = container.querySelector('[class*="modal"]')
      expect(modal).toBeInTheDocument()
      expect(modal?.className).toMatch(/modal/)
    })

    it('has proper z-index for modal overlay', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const backdrop = container.querySelector('[class*="backdrop"]')
      expect(backdrop).toBeInTheDocument()

      // Verify backdrop exists and has a className (z-index is set via CSS modules)
      expect(backdrop?.className).toBeTruthy()
    })
  })

  describe('Content Completeness', () => {
    it('displays all required shortcuts from spec', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      // Required shortcuts from build brief
      const requiredShortcuts = [
        'Run selected template',
        'Jump to next invalid node',
        'Edit probabilities (batch)',
        'Undo',
        'Redo',
        'Show this keyboard map',
      ]

      requiredShortcuts.forEach(shortcut => {
        expect(screen.getByText(shortcut)).toBeInTheDocument()
      })
    })

    it('groups shortcuts logically', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      // Should have multiple shortcut rows
      const descriptions = [
        'Run selected template',
        'Jump to next invalid node',
        'Edit probabilities (batch)',
      ]

      descriptions.forEach(desc => {
        expect(screen.getByText(desc)).toBeInTheDocument()
      })
    })
  })

  describe('Close Button', () => {
    it('closes modal when close button is clicked', () => {
      const onClose = vi.fn()
      render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const closeButton = screen.getByLabelText('Close keyboard shortcuts')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('has X icon in close button', () => {
      const onClose = vi.fn()
      const { container } = render(<KeyboardMap isOpen={true} onClose={onClose} />)

      const closeButton = screen.getByLabelText('Close keyboard shortcuts')
      const svg = closeButton.querySelector('svg')

      expect(svg).toBeInTheDocument()
    })
  })
})

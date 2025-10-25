/**
 * FirstRunHint - Test suite
 *
 * Tests for:
 * - Initial render and visibility
 * - Dismissal behavior
 * - localStorage persistence
 * - SSR/test safety (no localStorage crashes)
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FirstRunHint, resetOnboardingHint } from '../FirstRunHint'

describe('FirstRunHint', () => {
  const STORAGE_KEY = 'canvas-onboarding-dismissed'

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Initial Render', () => {
    it('renders hint on first visit', () => {
      render(<FirstRunHint />)

      expect(screen.getByText('Welcome to Templates')).toBeInTheDocument()
      expect(screen.getByText(/Insert a template/)).toBeInTheDocument()
    })

    it('has proper ARIA attributes', () => {
      render(<FirstRunHint />)

      const hint = screen.getByRole('complementary')
      expect(hint).toHaveAttribute('aria-label', 'Quick start guide')
    })

    it('includes dismiss button with accessible label', () => {
      render(<FirstRunHint />)

      const dismissButton = screen.getByLabelText('Dismiss hint')
      expect(dismissButton).toBeInTheDocument()
    })
  })

  describe('Dismissal', () => {
    it('hides hint when dismissed', () => {
      render(<FirstRunHint />)

      const dismissButton = screen.getByLabelText('Dismiss hint')
      fireEvent.click(dismissButton)

      expect(screen.queryByText('Welcome to Templates')).not.toBeInTheDocument()
    })

    it('persists dismissal to localStorage', () => {
      render(<FirstRunHint />)

      const dismissButton = screen.getByLabelText('Dismiss hint')
      fireEvent.click(dismissButton)

      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('does not render when already dismissed', () => {
      localStorage.setItem(STORAGE_KEY, 'true')

      render(<FirstRunHint />)

      expect(screen.queryByText('Welcome to Templates')).not.toBeInTheDocument()
    })
  })

  describe('localStorage Safety', () => {
    it('handles missing localStorage gracefully', () => {
      // Mock localStorage as undefined (SSR scenario)
      const originalLocalStorage = globalThis.localStorage
      // @ts-expect-error - Testing SSR scenario
      delete globalThis.localStorage

      expect(() => {
        render(<FirstRunHint />)
      }).not.toThrow()

      // Should render since storage is unavailable (defaults to showing hint)
      expect(screen.getByText('Welcome to Templates')).toBeInTheDocument()

      // Restore
      globalThis.localStorage = originalLocalStorage
    })

    it('handles localStorage.getItem errors gracefully', () => {
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage blocked')
      })

      expect(() => {
        render(<FirstRunHint />)
      }).not.toThrow()

      // Should render when storage fails (defaults to showing hint)
      expect(screen.getByText('Welcome to Templates')).toBeInTheDocument()

      localStorage.getItem = originalGetItem
    })

    it('handles localStorage.setItem errors gracefully', () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage blocked')
      })

      render(<FirstRunHint />)
      const dismissButton = screen.getByLabelText('Dismiss hint')

      expect(() => {
        fireEvent.click(dismissButton)
      }).not.toThrow()

      // Should still hide the hint even if storage fails
      expect(screen.queryByText('Welcome to Templates')).not.toBeInTheDocument()

      localStorage.setItem = originalSetItem
    })
  })

  describe('resetOnboardingHint', () => {
    it('clears dismissal state from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'true')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')

      resetOnboardingHint()

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('allows hint to show again after reset', () => {
      localStorage.setItem(STORAGE_KEY, 'true')

      const { unmount } = render(<FirstRunHint />)
      expect(screen.queryByText('Welcome to Templates')).not.toBeInTheDocument()

      resetOnboardingHint()
      unmount()

      // Mount fresh component (useState initializer runs again)
      render(<FirstRunHint />)

      expect(screen.getByText('Welcome to Templates')).toBeInTheDocument()
    })

    it('handles missing localStorage gracefully', () => {
      const originalLocalStorage = globalThis.localStorage
      // @ts-expect-error - Testing SSR scenario
      delete globalThis.localStorage

      expect(() => {
        resetOnboardingHint()
      }).not.toThrow()

      globalThis.localStorage = originalLocalStorage
    })

    it('handles localStorage.removeItem errors gracefully', () => {
      const originalRemoveItem = localStorage.removeItem
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage blocked')
      })

      expect(() => {
        resetOnboardingHint()
      }).not.toThrow()

      localStorage.removeItem = originalRemoveItem
    })
  })

  describe('Content', () => {
    it('displays correct welcome message', () => {
      render(<FirstRunHint />)

      expect(screen.getByText('Welcome to Templates')).toBeInTheDocument()
    })

    it('displays correct quick-start instructions', () => {
      render(<FirstRunHint />)

      const instructions = screen.getByText(/Insert a template → tweak probabilities → Run/)
      expect(instructions).toBeInTheDocument()
      expect(instructions).toHaveTextContent('⌘/Ctrl+Enter')
    })
  })
})

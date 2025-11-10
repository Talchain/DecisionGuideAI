/**
 * FirstRunHint - Test suite
 *
 * Tests for:
 * - Initial render and visibility
 * - Browse templates button interaction
 * - Dismissal behavior
 * - localStorage persistence
 * - SSR/test safety (no localStorage crashes)
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FirstRunHint, resetOnboardingHint } from '../FirstRunHint'
import { useCanvasStore } from '../../store'

// Mock zustand store
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn()
}))

describe('FirstRunHint', () => {
  const STORAGE_KEY = 'canvas-onboarding-dismissed'
  const mockOpenTemplatesPanel = vi.fn()

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()

    // Setup store mock
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const store = {
        openTemplatesPanel: mockOpenTemplatesPanel,
      }
      return selector ? selector(store) : store
    })

    mockOpenTemplatesPanel.mockClear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('renders hint on first visit', () => {
      render(<FirstRunHint />)

      expect(screen.getByText('Welcome to Canvas')).toBeInTheDocument()
      expect(screen.getByText('Browse templates')).toBeInTheDocument()
      expect(screen.getByText('Start with ready-made scenarios')).toBeInTheDocument()
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

    it('includes Browse templates button with test ID', () => {
      render(<FirstRunHint />)

      const browseButton = screen.getByTestId('btn-open-templates-welcome')
      expect(browseButton).toBeInTheDocument()
    })
  })

  describe('Browse Templates Button', () => {
    it('calls openTemplatesPanel when clicked', () => {
      render(<FirstRunHint />)

      const browseButton = screen.getByTestId('btn-open-templates-welcome')
      fireEvent.click(browseButton)

      expect(mockOpenTemplatesPanel).toHaveBeenCalledTimes(1)
      expect(mockOpenTemplatesPanel).toHaveBeenCalledWith(expect.anything()) // Called with button ref
    })

    it('has correct text content', () => {
      render(<FirstRunHint />)

      const browseButton = screen.getByTestId('btn-open-templates-welcome')
      expect(browseButton).toHaveTextContent('Browse templates')
      expect(browseButton).toHaveTextContent('Start with ready-made scenarios')
    })

    it('has correct accessibility attributes', () => {
      render(<FirstRunHint />)

      const browseButton = screen.getByTestId('btn-open-templates-welcome')
      expect(browseButton).toHaveAttribute('type', 'button')
    })
  })

  describe('Dismissal', () => {
    it('hides hint when dismissed', () => {
      render(<FirstRunHint />)

      const dismissButton = screen.getByLabelText('Dismiss hint')
      fireEvent.click(dismissButton)

      expect(screen.queryByText('Welcome to Canvas')).not.toBeInTheDocument()
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

      expect(screen.queryByText('Welcome to Canvas')).not.toBeInTheDocument()
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
      expect(screen.getByText('Welcome to Canvas')).toBeInTheDocument()

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
      expect(screen.getByText('Welcome to Canvas')).toBeInTheDocument()

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
      expect(screen.queryByText('Welcome to Canvas')).not.toBeInTheDocument()

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
      expect(screen.queryByText('Welcome to Canvas')).not.toBeInTheDocument()

      resetOnboardingHint()
      unmount()

      // Mount fresh component (useState initializer runs again)
      render(<FirstRunHint />)

      expect(screen.getByText('Welcome to Canvas')).toBeInTheDocument()
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

      expect(screen.getByText('Welcome to Canvas')).toBeInTheDocument()
    })

    it('displays correct card content', () => {
      render(<FirstRunHint />)

      expect(screen.getByText('Browse templates')).toBeInTheDocument()
      expect(screen.getByText('Start with ready-made scenarios')).toBeInTheDocument()
    })

    it('includes Layout icon', () => {
      render(<FirstRunHint />)

      // Layout icon should be rendered (we can't directly test Lucide icons, but we can verify the button structure)
      const browseButton = screen.getByTestId('btn-open-templates-welcome')
      expect(browseButton.querySelector('svg')).toBeInTheDocument()
    })
  })
})

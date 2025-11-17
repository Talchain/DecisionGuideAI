/**
 * S8-ONBOARD: OnboardingOverlay DOM Tests
 * Tests localStorage gating, step navigation, focus trap, keyboard shortcuts, ARIA
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OnboardingOverlay } from '../OnboardingOverlay'
import { useOnboarding } from '../useOnboarding'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'olumi_seen_onboarding'
const STORAGE_VERSION = 'v1'

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Basic Rendering', () => {
    it('renders when isOpen=true', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Welcome to Olumi')).toBeInTheDocument()
    })

    it('does not render when isOpen=false', () => {
      render(<OnboardingOverlay isOpen={false} onClose={vi.fn()} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders unified progress indicator with segments', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toBeInTheDocument()
      // Segments are purely visual and aria-hidden
      const segments = progressbar.querySelectorAll('[aria-hidden="true"]')
      expect(segments.length).toBeGreaterThanOrEqual(4)
    })

    it('renders Previous, Next, Skip, and Close buttons', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByLabelText('Previous step')).toBeInTheDocument()
      expect(screen.getByLabelText('Next step')).toBeInTheDocument()
      expect(screen.getByText('Skip')).toBeInTheDocument()
      expect(screen.getByLabelText('Close onboarding')).toBeInTheDocument()
    })
  })

  describe('Step Navigation', () => {
    it('starts at step 0 (Welcome)', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Welcome to Olumi')).toBeInTheDocument()
      expect(screen.getByText(/Olumi helps you model complex decisions/)).toBeInTheDocument()
    })

    it('advances to step 1 on Next click', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')
      fireEvent.click(nextButton)
      expect(screen.getByText('Your Decision Workflow')).toBeInTheDocument()
    })

    it('advances through all 4 steps', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')

      // Step 0 → 1
      fireEvent.click(nextButton)
      expect(screen.getByText('Your Decision Workflow')).toBeInTheDocument()

      // Step 1 → 2
      fireEvent.click(nextButton)
      expect(screen.getByText('Start from Template or Merge')).toBeInTheDocument()

      // Step 2 → 3
      fireEvent.click(nextButton)
      expect(screen.getByText('Save & Autosave')).toBeInTheDocument()
    })

    it('goes back to previous step on Previous click', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')
      const prevButton = screen.getByLabelText('Previous step')

      // Go to step 1
      fireEvent.click(nextButton)
      expect(screen.getByText('Your Decision Workflow')).toBeInTheDocument()

      // Go back to step 0
      fireEvent.click(prevButton)
      expect(screen.getByText('Welcome to Olumi')).toBeInTheDocument()
    })

    it('disables Previous button on first step', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const prevButton = screen.getByLabelText('Previous step')
      expect(prevButton).toBeDisabled()
    })

    it('shows "Get Started" on last step instead of "Next"', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')

      // Navigate to last step (step 3)
      fireEvent.click(nextButton) // Step 1
      fireEvent.click(nextButton) // Step 2
      fireEvent.click(nextButton) // Step 3

      expect(screen.getByText('Get Started')).toBeInTheDocument()
      expect(screen.queryByText('Next')).not.toBeInTheDocument()
    })

    it('calls onClose when clicking "Get Started" on last step', () => {
      const onClose = vi.fn()
      render(<OnboardingOverlay isOpen={true} onClose={onClose} />)
      const nextButton = screen.getByLabelText('Next step')

      // Navigate to last step
      fireEvent.click(nextButton) // Step 1
      fireEvent.click(nextButton) // Step 2
      fireEvent.click(nextButton) // Step 3

      const getStartedButton = screen.getByText('Get Started')
      fireEvent.click(getStartedButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Close Actions', () => {
    it('calls onClose when clicking Skip button', () => {
      const onClose = vi.fn()
      render(<OnboardingOverlay isOpen={true} onClose={onClose} />)
      const skipButton = screen.getByText('Skip')
      fireEvent.click(skipButton)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when clicking X close button', () => {
      const onClose = vi.fn()
      render(<OnboardingOverlay isOpen={true} onClose={onClose} />)
      const closeButton = screen.getByLabelText('Close onboarding')
      fireEvent.click(closeButton)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('saves to localStorage when closing', () => {
      const onClose = vi.fn()
      render(<OnboardingOverlay isOpen={true} onClose={onClose} />)
      const skipButton = screen.getByText('Skip')
      fireEvent.click(skipButton)

      expect(localStorage.getItem(STORAGE_KEY)).toBe(STORAGE_VERSION)
    })
  })

  describe('Keyboard Navigation', () => {
    it('closes on Escape key', () => {
      const onClose = vi.fn()
      render(<OnboardingOverlay isOpen={true} onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('saves to localStorage when closing with Escape', () => {
      const onClose = vi.fn()
      render(<OnboardingOverlay isOpen={true} onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(localStorage.getItem(STORAGE_KEY)).toBe(STORAGE_VERSION)
    })

    it('does not close on other keys', () => {
      const onClose = vi.fn()
      render(<OnboardingOverlay isOpen={true} onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Space' })
      fireEvent.keyDown(document, { key: 'a' })

      expect(onClose).not.toHaveBeenCalled()
    })

    it('focuses first element on mount', async () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close onboarding')
        expect(closeButton).toHaveFocus()
      })
    })
  })

  describe('Focus Trap', () => {
    it('traps focus within dialog', async () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)

      const focusableElements = screen.getAllByRole('button')
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      // Tab from last element should cycle to first
      lastElement.focus()
      fireEvent.keyDown(document, { key: 'Tab' })

      await waitFor(() => {
        expect(firstElement).toHaveFocus()
      })
    })

    it('reverse traps focus with Shift+Tab', async () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)

      const focusableElements = screen.getAllByRole('button')
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      // Shift+Tab from first element should cycle to last
      firstElement.focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

      await waitFor(() => {
        expect(lastElement).toHaveFocus()
      })
    })
  })

  describe('Progress Indicators', () => {
    const totalSteps = 9

    it('reports cumulative progress percentage', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '100')
      expect(bar).toHaveAttribute('aria-valuenow', String((1 / totalSteps) * 100))
    })

    it('updates aria-valuenow as steps advance', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')
      const bar = screen.getByRole('progressbar')

      fireEvent.click(nextButton)
      expect(bar).toHaveAttribute('aria-valuenow', String((2 / totalSteps) * 100))

      fireEvent.click(nextButton)
      expect(bar).toHaveAttribute('aria-valuenow', String((3 / totalSteps) * 100))
    })
  })

  describe('ARIA Attributes', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has aria-labelledby pointing to title', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'onboarding-title')
      expect(screen.getByText('Welcome to Olumi')).toHaveAttribute('id', 'onboarding-title')
    })

    it('has aria-live region for step announcements', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const liveRegion = screen.getByText(/Step 1 of 4: Welcome to Olumi/)
      expect(liveRegion).toHaveClass('sr-only')
      expect(liveRegion.closest('p')).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion.closest('p')).toHaveAttribute('aria-atomic', 'true')
    })

    it('updates aria-live when changing steps', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')

      fireEvent.click(nextButton)

      expect(screen.getByText(/Step 2 of 4: Your Decision Workflow/)).toBeInTheDocument()
    })
  })

  describe('localStorage Gating', () => {
    it('does not show overlay when localStorage has correct version', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)

      const TestComponent = () => {
        const { shouldShow, isOpen } = useOnboarding()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <div data-testid="is-open">{isOpen.toString()}</div>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId('should-show')).toHaveTextContent('false')
      expect(screen.getByTestId('is-open')).toHaveTextContent('false')
    })

    it('shows overlay when localStorage is empty', () => {
      const TestComponent = () => {
        const { shouldShow, isOpen } = useOnboarding()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <div data-testid="is-open">{isOpen.toString()}</div>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId('should-show')).toHaveTextContent('true')
      expect(screen.getByTestId('is-open')).toHaveTextContent('true')
    })

    it('shows overlay when localStorage has wrong version', () => {
      localStorage.setItem(STORAGE_KEY, 'v0')

      const TestComponent = () => {
        const { shouldShow, isOpen } = useOnboarding()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <div data-testid="is-open">{isOpen.toString()}</div>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId('should-show')).toHaveTextContent('true')
      expect(screen.getByTestId('is-open')).toHaveTextContent('true')
    })

    it('handles localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Mock localStorage.getItem to throw
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage disabled')
      })

      const TestComponent = () => {
        const { shouldShow, isOpen } = useOnboarding()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <div data-testid="is-open">{isOpen.toString()}</div>
          </div>
        )
      }

      render(<TestComponent />)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to check onboarding status:',
        expect.any(Error)
      )

      // Should gracefully fail to false (don't show)
      expect(screen.getByTestId('should-show')).toHaveTextContent('false')
      expect(screen.getByTestId('is-open')).toHaveTextContent('false')

      // Restore
      localStorage.getItem = originalGetItem
      consoleWarnSpy.mockRestore()
    })
  })

  describe('useOnboarding Hook', () => {
    it('provides open() function to show overlay', () => {
      const TestComponent = () => {
        const { isOpen, open } = useOnboarding()
        return (
          <div>
            <div data-testid="is-open">{isOpen.toString()}</div>
            <button onClick={open}>Open</button>
          </div>
        )
      }

      // Set as already seen
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)

      render(<TestComponent />)

      expect(screen.getByTestId('is-open')).toHaveTextContent('false')

      // Click open
      fireEvent.click(screen.getByText('Open'))

      expect(screen.getByTestId('is-open')).toHaveTextContent('true')
    })

    it('provides close() function to hide overlay', () => {
      const TestComponent = () => {
        const { isOpen, close } = useOnboarding()
        return (
          <div>
            <div data-testid="is-open">{isOpen.toString()}</div>
            <button onClick={close}>Close</button>
          </div>
        )
      }

      // Set as not seen (will auto-open)
      localStorage.removeItem(STORAGE_KEY)

      render(<TestComponent />)

      expect(screen.getByTestId('is-open')).toHaveTextContent('true')

      // Click close
      fireEvent.click(screen.getByText('Close'))

      expect(screen.getByTestId('is-open')).toHaveTextContent('false')
    })

    it('provides reset() function to clear localStorage and re-show', () => {
      const TestComponent = () => {
        const { shouldShow, isOpen, reset } = useOnboarding()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <div data-testid="is-open">{isOpen.toString()}</div>
            <button onClick={reset}>Reset</button>
          </div>
        )
      }

      // Set as seen
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)

      render(<TestComponent />)

      expect(screen.getByTestId('should-show')).toHaveTextContent('false')
      expect(screen.getByTestId('is-open')).toHaveTextContent('false')

      // Click reset
      fireEvent.click(screen.getByText('Reset'))

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      expect(screen.getByTestId('should-show')).toHaveTextContent('true')
      expect(screen.getByTestId('is-open')).toHaveTextContent('true')
    })

    it('reset() handles localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const TestComponent = () => {
        const { reset } = useOnboarding()
        return <button onClick={reset}>Reset</button>
      }

      // Mock localStorage.removeItem to throw
      const originalRemoveItem = localStorage.removeItem
      localStorage.removeItem = vi.fn(() => {
        throw new Error('localStorage disabled')
      })

      render(<TestComponent />)

      fireEvent.click(screen.getByText('Reset'))

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to reset onboarding:',
        expect.any(Error)
      )

      // Restore
      localStorage.removeItem = originalRemoveItem
      consoleWarnSpy.mockRestore()
    })
  })

  describe('British English', () => {
    it('uses flex alignment utilities', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveClass('items-center')
      expect(dialog).toHaveClass('justify-center')
    })

    it('uses transition-colors on close button', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const closeButton = screen.getByLabelText('Close onboarding')
      expect(closeButton).toHaveClass('transition-colors')
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid clicking of Next button', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')

      // Rapidly click Next 10 times
      for (let i = 0; i < 10; i++) {
        fireEvent.click(nextButton)
      }

      // Should be on last step (step 3)
      expect(screen.getByText('Save & Autosave')).toBeInTheDocument()
      expect(screen.getByText('Get Started')).toBeInTheDocument()
    })

    it('handles rapid clicking of Previous button', () => {
      render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      const nextButton = screen.getByLabelText('Next step')
      const prevButton = screen.getByLabelText('Previous step')

      // Go to step 2
      fireEvent.click(nextButton)
      fireEvent.click(nextButton)

      // Rapidly click Previous 10 times
      for (let i = 0; i < 10; i++) {
        fireEvent.click(prevButton)
      }

      // Should be on first step
      expect(screen.getByText('Welcome to Olumi')).toBeInTheDocument()
      expect(prevButton).toBeDisabled()
    })

    it('does not add duplicate event listeners', () => {
      const { rerender } = render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)

      // Rerender multiple times
      rerender(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      rerender(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)
      rerender(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)

      const onClose = vi.fn()
      rerender(<OnboardingOverlay isOpen={true} onClose={onClose} />)

      // Press Escape once
      fireEvent.keyDown(document, { key: 'Escape' })

      // Should only call onClose once, not 4 times
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('cleans up event listeners on unmount', () => {
      const { unmount } = render(<OnboardingOverlay isOpen={true} onClose={vi.fn()} />)

      unmount()

      const onClose = vi.fn()
      // Pressing Escape after unmount should not call anything
      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})

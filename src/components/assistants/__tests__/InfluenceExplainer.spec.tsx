/**
 * S8-EXPLAIN: InfluenceExplainer Tests
 * Tests localStorage dismissal, force show, compact mode, expand/collapse
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { InfluenceExplainer, useInfluenceExplainer } from '../InfluenceExplainer'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'olumi_seen_influence_explainer'
const STORAGE_VERSION = 'v1'

describe('InfluenceExplainer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Basic Rendering', () => {
    it('renders when not dismissed', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByText('Understanding Influence Models')).toBeInTheDocument()
      expect(screen.getByText(/Olumi uses/)).toBeInTheDocument()
    })

    it('does not render when dismissed', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
      render(<InfluenceExplainer />)
      expect(screen.queryByText('Understanding Influence Models')).not.toBeInTheDocument()
    })

    it('renders Info icon', () => {
      render(<InfluenceExplainer />)
      const region = screen.getByRole('region')
      expect(region).toBeInTheDocument()
    })

    it('renders dismiss button', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByLabelText('Dismiss explanation')).toBeInTheDocument()
    })

    it('renders key concepts in summary', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByText(/Nodes/)).toBeInTheDocument()
      expect(screen.getByText(/Edges/)).toBeInTheDocument()
      expect(screen.getByText(/Weights/)).toBeInTheDocument()
    })
  })

  describe('Dismissal', () => {
    it('hides when dismiss button clicked', () => {
      render(<InfluenceExplainer />)
      const dismissButton = screen.getByLabelText('Dismiss explanation')
      fireEvent.click(dismissButton)
      expect(screen.queryByText('Understanding Influence Models')).not.toBeInTheDocument()
    })

    it('saves dismissal to localStorage', () => {
      render(<InfluenceExplainer />)
      const dismissButton = screen.getByLabelText('Dismiss explanation')
      fireEvent.click(dismissButton)
      expect(localStorage.getItem(STORAGE_KEY)).toBe(STORAGE_VERSION)
    })

    it('calls onDismiss callback when dismissed', () => {
      const onDismiss = vi.fn()
      render(<InfluenceExplainer onDismiss={onDismiss} />)
      const dismissButton = screen.getByLabelText('Dismiss explanation')
      fireEvent.click(dismissButton)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('handles localStorage errors gracefully on save', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('localStorage disabled')
      })

      render(<InfluenceExplainer />)
      const dismissButton = screen.getByLabelText('Dismiss explanation')
      fireEvent.click(dismissButton)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save influence explainer status:',
        expect.any(Error)
      )

      // Restore
      localStorage.setItem = originalSetItem
      consoleWarnSpy.mockRestore()
    })

    it('handles localStorage errors gracefully on load', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Mock localStorage.getItem to throw
      const originalGetItem = localStorage.getItem
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage disabled')
      })

      render(<InfluenceExplainer />)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to check influence explainer status:',
        expect.any(Error)
      )

      // Should still render (graceful fallback)
      expect(screen.getByText('Understanding Influence Models')).toBeInTheDocument()

      // Restore
      localStorage.getItem = originalGetItem
      consoleWarnSpy.mockRestore()
    })
  })

  describe('Force Show', () => {
    it('shows when forceShow=true even if dismissed', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
      render(<InfluenceExplainer forceShow={true} />)
      expect(screen.getByText('Understanding Influence Models')).toBeInTheDocument()
    })

    it('can be dismissed when force shown', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
      render(<InfluenceExplainer forceShow={true} />)

      const dismissButton = screen.getByLabelText('Dismiss explanation')
      fireEvent.click(dismissButton)

      expect(screen.queryByText('Understanding Influence Models')).not.toBeInTheDocument()
    })
  })

  describe('Compact Mode', () => {
    it('renders compact summary when compact=true', () => {
      render(<InfluenceExplainer compact={true} />)
      expect(screen.getByText(/Nodes = factors/)).toBeInTheDocument()
    })

    it('does not show bullet list in compact mode', () => {
      render(<InfluenceExplainer compact={true} />)
      const lists = screen.queryAllByRole('list')
      expect(lists).toHaveLength(0)
    })

    it('does not show Learn more button in compact mode', () => {
      render(<InfluenceExplainer compact={true} />)
      expect(screen.queryByText('Learn more')).not.toBeInTheDocument()
    })

    it('shows bullet list in normal mode', () => {
      render(<InfluenceExplainer compact={false} />)
      expect(screen.getByText(/represent factors, beliefs/)).toBeInTheDocument()
    })
  })

  describe('Expandable Details', () => {
    it('shows "Learn more" button by default', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByText('Learn more')).toBeInTheDocument()
    })

    it('does not show details by default', () => {
      render(<InfluenceExplainer />)
      expect(screen.queryByText(/Positive influence/)).not.toBeInTheDocument()
    })

    it('expands details when "Learn more" clicked', () => {
      render(<InfluenceExplainer />)
      const learnMoreButton = screen.getByText('Learn more')
      fireEvent.click(learnMoreButton)
      expect(screen.getByText(/Positive influence/)).toBeInTheDocument()
      expect(screen.getByText(/Negative influence/)).toBeInTheDocument()
    })

    it('shows "Show less" when expanded', () => {
      render(<InfluenceExplainer />)
      const learnMoreButton = screen.getByText('Learn more')
      fireEvent.click(learnMoreButton)
      expect(screen.getByText('Show less')).toBeInTheDocument()
    })

    it('collapses details when "Show less" clicked', () => {
      render(<InfluenceExplainer />)
      const learnMoreButton = screen.getByText('Learn more')
      fireEvent.click(learnMoreButton)

      const showLessButton = screen.getByText('Show less')
      fireEvent.click(showLessButton)

      expect(screen.queryByText(/Positive influence/)).not.toBeInTheDocument()
      expect(screen.getByText('Learn more')).toBeInTheDocument()
    })

    it('toggle button has aria-expanded attribute', () => {
      render(<InfluenceExplainer />)
      const learnMoreButton = screen.getByText('Learn more')
      expect(learnMoreButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(learnMoreButton)

      const showLessButton = screen.getByText('Show less')
      expect(showLessButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('toggle button has aria-controls pointing to details', () => {
      render(<InfluenceExplainer />)
      const learnMoreButton = screen.getByText('Learn more')
      expect(learnMoreButton).toHaveAttribute('aria-controls', 'influence-details')
    })

    it('shows detailed explanation of positive influence', () => {
      render(<InfluenceExplainer />)
      fireEvent.click(screen.getByText('Learn more'))
      expect(screen.getByText(/Positive influence/)).toBeInTheDocument()
      expect(screen.getByText(/More budget/)).toBeInTheDocument()
    })

    it('shows detailed explanation of negative influence', () => {
      render(<InfluenceExplainer />)
      fireEvent.click(screen.getByText('Learn more'))
      expect(screen.getByText(/Negative influence/)).toBeInTheDocument()
      expect(screen.getByText(/More risk/)).toBeInTheDocument()
    })

    it('shows weight magnitude explanation', () => {
      render(<InfluenceExplainer />)
      fireEvent.click(screen.getByText('Learn more'))
      expect(screen.getByText(/Weight magnitude/)).toBeInTheDocument()
      expect(screen.getByText(/Closer to 0 = weak influence/)).toBeInTheDocument()
    })

    it('shows "Why not probability?" explanation', () => {
      render(<InfluenceExplainer />)
      fireEvent.click(screen.getByText('Learn more'))
      expect(screen.getByText(/Why not probability/)).toBeInTheDocument()
      expect(screen.getByText(/causal relationships matter/)).toBeInTheDocument()
    })
  })

  describe('useInfluenceExplainer Hook', () => {
    it('returns shouldShow=true when not dismissed', () => {
      const TestComponent = () => {
        const { shouldShow } = useInfluenceExplainer()
        return <div data-testid="should-show">{shouldShow.toString()}</div>
      }

      render(<TestComponent />)
      expect(screen.getByTestId('should-show')).toHaveTextContent('true')
    })

    it('returns shouldShow=false when dismissed', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)

      const TestComponent = () => {
        const { shouldShow } = useInfluenceExplainer()
        return <div data-testid="should-show">{shouldShow.toString()}</div>
      }

      render(<TestComponent />)
      expect(screen.getByTestId('should-show')).toHaveTextContent('false')
    })

    it('provides show() function to force show', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)

      const TestComponent = () => {
        const { shouldShow, show } = useInfluenceExplainer()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <button onClick={show}>Show</button>
          </div>
        )
      }

      render(<TestComponent />)
      expect(screen.getByTestId('should-show')).toHaveTextContent('false')

      fireEvent.click(screen.getByText('Show'))

      expect(screen.getByTestId('should-show')).toHaveTextContent('true')
    })

    it('provides hide() function', () => {
      const TestComponent = () => {
        const { shouldShow, hide } = useInfluenceExplainer()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <button onClick={hide}>Hide</button>
          </div>
        )
      }

      render(<TestComponent />)
      expect(screen.getByTestId('should-show')).toHaveTextContent('true')

      fireEvent.click(screen.getByText('Hide'))

      expect(screen.getByTestId('should-show')).toHaveTextContent('false')
      expect(localStorage.getItem(STORAGE_KEY)).toBe(STORAGE_VERSION)
    })

    it('provides reset() function to clear localStorage', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)

      const TestComponent = () => {
        const { shouldShow, reset } = useInfluenceExplainer()
        return (
          <div>
            <div data-testid="should-show">{shouldShow.toString()}</div>
            <button onClick={reset}>Reset</button>
          </div>
        )
      }

      render(<TestComponent />)
      expect(screen.getByTestId('should-show')).toHaveTextContent('false')

      fireEvent.click(screen.getByText('Reset'))

      expect(screen.getByTestId('should-show')).toHaveTextContent('true')
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('provides forceShow boolean', () => {
      const TestComponent = () => {
        const { forceShow, show } = useInfluenceExplainer()
        return (
          <div>
            <div data-testid="force-show">{forceShow.toString()}</div>
            <button onClick={show}>Show</button>
          </div>
        )
      }

      render(<TestComponent />)
      expect(screen.getByTestId('force-show')).toHaveTextContent('false')

      fireEvent.click(screen.getByText('Show'))

      expect(screen.getByTestId('force-show')).toHaveTextContent('true')
    })

    it('handles localStorage errors gracefully in reset()', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const originalRemoveItem = localStorage.removeItem
      localStorage.removeItem = vi.fn(() => {
        throw new Error('localStorage disabled')
      })

      const TestComponent = () => {
        const { reset } = useInfluenceExplainer()
        return <button onClick={reset}>Reset</button>
      }

      render(<TestComponent />)
      fireEvent.click(screen.getByText('Reset'))

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to reset influence explainer:',
        expect.any(Error)
      )

      // Restore
      localStorage.removeItem = originalRemoveItem
      consoleWarnSpy.mockRestore()
    })

    it('handles localStorage errors gracefully in hide()', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('localStorage disabled')
      })

      const TestComponent = () => {
        const { hide } = useInfluenceExplainer()
        return <button onClick={hide}>Hide</button>
      }

      render(<TestComponent />)
      fireEvent.click(screen.getByText('Hide'))

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save influence explainer status:',
        expect.any(Error)
      )

      // Restore
      localStorage.setItem = originalSetItem
      consoleWarnSpy.mockRestore()
    })
  })

  describe('ARIA Attributes', () => {
    it('has role="region"', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByRole('region')).toBeInTheDocument()
    })

    it('has aria-label', () => {
      render(<InfluenceExplainer />)
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-label', 'Influence model explanation')
    })

    it('dismiss button has aria-label', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByLabelText('Dismiss explanation')).toBeInTheDocument()
    })

    it('Info icon has aria-hidden', () => {
      render(<InfluenceExplainer />)
      const region = screen.getByRole('region')
      const svg = region.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Content Quality', () => {
    it('emphasizes "influence models" not probability', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByText(/influence models.*not probability models/i)).toBeInTheDocument()
    })

    it('explains nodes as factors/beliefs', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByText(/Nodes.*represent factors, beliefs/i)).toBeInTheDocument()
    })

    it('explains edges as causal influence', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByText(/Edges.*causal influence.*not correlation/i)).toBeInTheDocument()
    })

    it('explains weight range (-1 to +1)', () => {
      render(<InfluenceExplainer />)
      expect(screen.getByText(/Weights.*-1 to \+1/i)).toBeInTheDocument()
    })

    it('provides concrete examples in expanded view', () => {
      render(<InfluenceExplainer />)
      fireEvent.click(screen.getByText('Learn more'))

      expect(screen.getByText(/More budget.*Better outcome/i)).toBeInTheDocument()
      expect(screen.getByText(/More risk.*Team confidence/i)).toBeInTheDocument()
    })
  })

  describe('Styling integrations', () => {
    it('aligns Learn more button content with Tailwind flex utilities', () => {
      render(<InfluenceExplainer />)
      const learnMoreButton = screen.getByText('Learn more')
      expect(learnMoreButton).toHaveClass('items-center')
    })

    it('applies transition-colors to dismiss button', () => {
      render(<InfluenceExplainer />)
      const dismissButton = screen.getByLabelText('Dismiss explanation')
      expect(dismissButton).toHaveClass('transition-colors')
    })
  })

  describe('Visual Polish', () => {
    it('has blue theme styling', () => {
      render(<InfluenceExplainer />)
      const region = screen.getByRole('region')
      expect(region).toHaveClass('bg-blue-50')
      expect(region).toHaveClass('border-blue-200')
    })

    it('has proper spacing', () => {
      render(<InfluenceExplainer />)
      const region = screen.getByRole('region')
      expect(region).toHaveClass('p-4')
      expect(region).toHaveClass('mb-4')
    })

    it('has rounded corners', () => {
      render(<InfluenceExplainer />)
      const region = screen.getByRole('region')
      expect(region).toHaveClass('rounded-lg')
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid dismiss clicks', () => {
      render(<InfluenceExplainer />)
      const dismissButton = screen.getByLabelText('Dismiss explanation')

      // Click 10 times rapidly
      for (let i = 0; i < 10; i++) {
        fireEvent.click(dismissButton)
      }

      // Should only dismiss once
      expect(localStorage.getItem(STORAGE_KEY)).toBe(STORAGE_VERSION)
    })

    it('handles rapid expand/collapse', () => {
      render(<InfluenceExplainer />)
      const toggleButton = screen.getByText('Learn more')

      // Toggle 10 times rapidly
      for (let i = 0; i < 10; i++) {
        fireEvent.click(toggleButton)
      }

      // Should be in a valid state (either expanded or collapsed)
      const isExpanded = screen.queryByText(/Positive influence/) !== null
      const hasLearnMore = screen.queryByText('Learn more') !== null
      const hasShowLess = screen.queryByText('Show less') !== null

      expect(isExpanded ? hasShowLess : hasLearnMore).toBe(true)
    })

    it('maintains expanded state when dismissing', () => {
      render(<InfluenceExplainer />)

      // Expand first
      fireEvent.click(screen.getByText('Learn more'))
      expect(screen.getByText(/Positive influence/)).toBeInTheDocument()

      // Then dismiss
      const dismissButton = screen.getByLabelText('Dismiss explanation')
      fireEvent.click(dismissButton)

      expect(screen.queryByText('Understanding Influence Models')).not.toBeInTheDocument()
    })

    it('does not show when both dismissed and forceShow=false', () => {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
      render(<InfluenceExplainer forceShow={false} />)
      expect(screen.queryByText('Understanding Influence Models')).not.toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('works with useInfluenceExplainer hook', () => {
      const TestComponent = () => {
        const { shouldShow, forceShow, hide } = useInfluenceExplainer()
        return (
          <>
            <InfluenceExplainer forceShow={forceShow} onDismiss={hide} />
            <div data-testid="should-show">{shouldShow.toString()}</div>
          </>
        )
      }

      render(<TestComponent />)

      expect(screen.getByText('Understanding Influence Models')).toBeInTheDocument()
      expect(screen.getByTestId('should-show')).toHaveTextContent('true')

      // Dismiss
      fireEvent.click(screen.getByLabelText('Dismiss explanation'))

      expect(screen.queryByText('Understanding Influence Models')).not.toBeInTheDocument()
      expect(screen.getByTestId('should-show')).toHaveTextContent('false')
    })
  })
})

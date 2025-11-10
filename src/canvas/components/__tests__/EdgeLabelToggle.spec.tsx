/**
 * EdgeLabelToggle component tests (P1 Polish - Task D)
 *
 * Tests:
 * 1. Renders with correct initial mode
 * 2. Toggles between human and numeric modes
 * 3. Updates store when toggled
 * 4. Keyboard navigation (Space/Enter)
 * 5. Accessibility (role, aria attributes)
 * 6. Visual indicators (icons, switch position)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeLabelToggle } from '../EdgeLabelToggle'
import { useEdgeLabelMode } from '../../store/edgeLabelMode'

// Mock the Zustand store
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn(),
}))

const mockUseEdgeLabelMode = vi.mocked(useEdgeLabelMode)

describe('EdgeLabelToggle', () => {
  let mockSetMode: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSetMode = vi.fn()

    // Default to human mode
    mockUseEdgeLabelMode.mockImplementation((selector: any) => {
      const store = {
        mode: 'human' as const,
        setMode: mockSetMode,
      }
      return selector ? selector(store) : store
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial render', () => {
    it('renders with human mode by default', () => {
      render(<EdgeLabelToggle />)

      expect(screen.getByText('Human')).toBeInTheDocument()
      expect(screen.getByTestId('edge-label-toggle')).toBeInTheDocument()
    })

    it('renders with numeric mode when store is numeric', () => {
      mockUseEdgeLabelMode.mockImplementation((selector: any) => {
        const store = {
          mode: 'numeric' as const,
          setMode: mockSetMode,
        }
        return selector ? selector(store) : store
      })

      render(<EdgeLabelToggle />)

      expect(screen.getByText('Numeric')).toBeInTheDocument()
    })

    it('shows label text by default', () => {
      render(<EdgeLabelToggle />)

      expect(screen.getByText('Edge labels:')).toBeInTheDocument()
    })

    it('hides label text when showLabel=false', () => {
      render(<EdgeLabelToggle showLabel={false} />)

      expect(screen.queryByText('Edge labels:')).not.toBeInTheDocument()
    })
  })

  describe('Toggle functionality', () => {
    it('calls setMode with numeric when clicked from human mode', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      fireEvent.click(button)

      expect(mockSetMode).toHaveBeenCalledWith('numeric')
    })

    it('calls setMode with human when clicked from numeric mode', () => {
      mockUseEdgeLabelMode.mockImplementation((selector: any) => {
        const store = {
          mode: 'numeric' as const,
          setMode: mockSetMode,
        }
        return selector ? selector(store) : store
      })

      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      fireEvent.click(button)

      expect(mockSetMode).toHaveBeenCalledWith('human')
    })
  })

  describe('Keyboard navigation', () => {
    it('toggles mode when Enter key is pressed', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      fireEvent.keyDown(button, { key: 'Enter' })

      expect(mockSetMode).toHaveBeenCalledWith('numeric')
    })

    it('toggles mode when Space key is pressed', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      fireEvent.keyDown(button, { key: ' ' })

      expect(mockSetMode).toHaveBeenCalledWith('numeric')
    })

    it('prevents default behavior for Space key', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      button.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('does not toggle for other keys', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      fireEvent.keyDown(button, { key: 'a' })

      expect(mockSetMode).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has role="switch"', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByRole('switch')
      expect(button).toBeInTheDocument()
    })

    it('has aria-checked="false" in human mode', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByRole('switch')
      expect(button).toHaveAttribute('aria-checked', 'false')
    })

    it('has aria-checked="true" in numeric mode', () => {
      mockUseEdgeLabelMode.mockImplementation((selector: any) => {
        const store = {
          mode: 'numeric' as const,
          setMode: mockSetMode,
        }
        return selector ? selector(store) : store
      })

      render(<EdgeLabelToggle />)

      const button = screen.getByRole('switch')
      expect(button).toHaveAttribute('aria-checked', 'true')
    })

    it('has descriptive aria-label in human mode', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByRole('switch')
      const ariaLabel = button.getAttribute('aria-label')

      expect(ariaLabel).toContain('Human-readable')
      expect(ariaLabel).toContain('switch to numeric')
    })

    it('has descriptive aria-label in numeric mode', () => {
      mockUseEdgeLabelMode.mockImplementation((selector: any) => {
        const store = {
          mode: 'numeric' as const,
          setMode: mockSetMode,
        }
        return selector ? selector(store) : store
      })

      render(<EdgeLabelToggle />)

      const button = screen.getByRole('switch')
      const ariaLabel = button.getAttribute('aria-label')

      expect(ariaLabel).toContain('Numeric')
      expect(ariaLabel).toContain('switch to human-readable')
    })

    it('has tooltip with explanation in human mode', () => {
      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      const title = button.getAttribute('title')

      expect(title).toContain('human-readable')
      expect(title).toContain('Strong boost')
      expect(title).toContain('w 0.60')
    })

    it('has tooltip with explanation in numeric mode', () => {
      mockUseEdgeLabelMode.mockImplementation((selector: any) => {
        const store = {
          mode: 'numeric' as const,
          setMode: mockSetMode,
        }
        return selector ? selector(store) : store
      })

      render(<EdgeLabelToggle />)

      const button = screen.getByTestId('edge-label-toggle')
      const title = button.getAttribute('title')

      expect(title).toContain('numeric')
      expect(title).toContain('w 0.60')
      expect(title).toContain('Strong boost')
    })

    it('icons have aria-hidden="true"', () => {
      const { container } = render(<EdgeLabelToggle />)

      const icons = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('Visual indicators', () => {
    it('shows Type icon in human mode', () => {
      const { container } = render(<EdgeLabelToggle />)

      // Type icon has specific className
      const icon = container.querySelector('.text-info-600')
      expect(icon).toBeInTheDocument()
    })

    it('shows Binary icon in numeric mode', () => {
      mockUseEdgeLabelMode.mockImplementation((selector: any) => {
        const store = {
          mode: 'numeric' as const,
          setMode: mockSetMode,
        }
        return selector ? selector(store) : store
      })

      const { container } = render(<EdgeLabelToggle />)

      // Binary icon has warning colour
      const icon = container.querySelector('.text-warning-600')
      expect(icon).toBeInTheDocument()
    })

    it('switch indicator is on left in human mode', () => {
      const { container } = render(<EdgeLabelToggle />)

      // Switch ball should have translate-x-0.5 class (left position)
      const switchBall = container.querySelector('.translate-x-0\\.5')
      expect(switchBall).toBeInTheDocument()
    })

    it('switch indicator is on right in numeric mode', () => {
      mockUseEdgeLabelMode.mockImplementation((selector: any) => {
        const store = {
          mode: 'numeric' as const,
          setMode: mockSetMode,
        }
        return selector ? selector(store) : store
      })

      const { container } = render(<EdgeLabelToggle />)

      // Switch ball should have translate-x-[18px] class (right position)
      const switchBall = container.querySelector('.translate-x-\\[18px\\]')
      expect(switchBall).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('applies custom className', () => {
      const { container } = render(<EdgeLabelToggle className="custom-class" />)

      const wrapper = container.querySelector('.custom-class')
      expect(wrapper).toBeInTheDocument()
    })

    it('has focus ring on keyboard navigation', () => {
      const { container } = render(<EdgeLabelToggle />)

      const button = container.querySelector('.focus\\:ring-2')
      expect(button).toBeInTheDocument()
    })
  })
})

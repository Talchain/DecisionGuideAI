/**
 * AcceptOverrideControl Tests
 *
 * Task 3.5: Tests for edge function confidence display messaging
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AcceptOverrideControl } from '../AcceptOverrideControl'

describe('AcceptOverrideControl', () => {
  const defaultProps = {
    suggestedValue: 'test-value',
    formatValue: (v: string) => v,
    confidence: 'high' as const,
    rationale: 'Test rationale',
    onAccept: vi.fn(),
    onOverride: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('confidence messaging', () => {
    it('shows "Suggested based on pattern" for high confidence', () => {
      render(<AcceptOverrideControl {...defaultProps} confidence="high" />)

      // Neutral "Suggested" framing per ea8d23a7 (no "Recommended"/"Winner").
      expect(screen.getByText('Suggested based on pattern')).toBeInTheDocument()
    })

    it('shows "Suggestion — please review" for medium confidence', () => {
      render(<AcceptOverrideControl {...defaultProps} confidence="medium" />)

      expect(screen.getByText('Suggestion — please review')).toBeInTheDocument()
    })

    it('shows "Suggestion — please verify" for low confidence', () => {
      render(<AcceptOverrideControl {...defaultProps} confidence="low" />)

      expect(screen.getByText('Suggestion — please verify')).toBeInTheDocument()
    })

    it('includes confidence level in title attribute', () => {
      render(
        <AcceptOverrideControl
          {...defaultProps}
          confidence="high"
          testIdPrefix="test"
        />
      )

      const badge = screen.getByTestId('test-confidence')
      expect(badge).toHaveAttribute('title', 'high confidence')
    })
  })

  describe('styling by confidence level', () => {
    it('uses semantic panel bg with success border for high confidence', () => {
      const { container } = render(
        <AcceptOverrideControl {...defaultProps} confidence="high" />
      )

      const wrapper = container.querySelector('[role="region"]')
      expect(wrapper).toHaveClass('bg-panel', 'border-success/30')
    })

    it('uses semantic panel bg with warning border for medium confidence', () => {
      const { container } = render(
        <AcceptOverrideControl {...defaultProps} confidence="medium" />
      )

      const wrapper = container.querySelector('[role="region"]')
      expect(wrapper).toHaveClass('bg-panel', 'border-warning/30')
    })

    it('uses semantic panel bg with neutral border for low confidence', () => {
      const { container } = render(
        <AcceptOverrideControl {...defaultProps} confidence="low" />
      )

      const wrapper = container.querySelector('[role="region"]')
      expect(wrapper).toHaveClass('bg-panel', 'border-neutral/30')
    })
  })

  describe('actions', () => {
    it('calls onAccept with suggested value when Accept is clicked', () => {
      const onAccept = vi.fn()
      render(
        <AcceptOverrideControl
          {...defaultProps}
          suggestedValue="my-value"
          onAccept={onAccept}
          testIdPrefix="test"
        />
      )

      fireEvent.click(screen.getByTestId('test-accept'))
      expect(onAccept).toHaveBeenCalledWith('my-value')
    })

    it('calls onOverride when Override is clicked', () => {
      const onOverride = vi.fn()
      render(
        <AcceptOverrideControl
          {...defaultProps}
          onOverride={onOverride}
          testIdPrefix="test"
        />
      )

      fireEvent.click(screen.getByTestId('test-override'))
      expect(onOverride).toHaveBeenCalled()
    })

    it('shows Override button regardless of confidence level', () => {
      const { rerender } = render(
        <AcceptOverrideControl {...defaultProps} confidence="high" testIdPrefix="test" />
      )
      expect(screen.getByTestId('test-override')).toBeInTheDocument()

      rerender(
        <AcceptOverrideControl {...defaultProps} confidence="medium" testIdPrefix="test" />
      )
      expect(screen.getByTestId('test-override')).toBeInTheDocument()

      rerender(
        <AcceptOverrideControl {...defaultProps} confidence="low" testIdPrefix="test" />
      )
      expect(screen.getByTestId('test-override')).toBeInTheDocument()
    })
  })

  describe('rationale', () => {
    it('hides rationale by default', () => {
      render(<AcceptOverrideControl {...defaultProps} rationale="Hidden rationale" />)

      // DS v5 §15.2: rationale is in the DOM but visually hidden via the
      // animated height/opacity transition (not removed on collapse).
      const rationaleText = screen.getByText('Hidden rationale')
      expect(rationaleText.closest('div[class*="transition-"]')).toHaveStyle({ height: '0', opacity: '0' })
    })

    it('shows rationale when expanded', () => {
      render(<AcceptOverrideControl {...defaultProps} rationale="Test rationale content" />)

      fireEvent.click(screen.getByText('Show rationale'))
      expect(screen.getByText('Test rationale content')).toBeInTheDocument()
    })

    it('shows rationale by default when defaultExpanded', () => {
      render(
        <AcceptOverrideControl
          {...defaultProps}
          rationale="Visible rationale"
          defaultExpanded
        />
      )

      expect(screen.getByText('Visible rationale')).toBeInTheDocument()
    })
  })

  describe('customization', () => {
    it('uses custom suggestion label', () => {
      render(
        <AcceptOverrideControl
          {...defaultProps}
          suggestionLabel="CEE recommends"
        />
      )

      expect(screen.getByText('CEE recommends:')).toBeInTheDocument()
    })

    it('formats value using formatValue function', () => {
      render(
        <AcceptOverrideControl
          {...defaultProps}
          suggestedValue="linear"
          formatValue={(v) => `${v.toUpperCase()} function`}
        />
      )

      expect(screen.getByText('LINEAR function')).toBeInTheDocument()
    })
  })
})

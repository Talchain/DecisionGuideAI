/**
 * BeliefInput Unit Tests
 *
 * Tests for the dual-mode belief input component that supports
 * slider and natural language input modes with CEE integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BeliefInput } from '../BeliefInput'

// Mock the httpV1Adapter
vi.mock('../../../adapters/plot/httpV1Adapter', () => ({
  httpV1Adapter: {
    elicitBelief: vi.fn(),
  },
}))

describe('BeliefInput', () => {
  const defaultProps = {
    value: 0.5,
    onChange: vi.fn(),
    label: 'Confidence',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('slider mode (default)', () => {
    it('renders in slider mode by default', () => {
      render(<BeliefInput {...defaultProps} />)
      expect(screen.getByRole('slider')).toBeInTheDocument()
    })

    it('displays the current value as percentage', () => {
      render(<BeliefInput {...defaultProps} value={0.75} />)
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('calls onChange when slider value changes', () => {
      const onChange = vi.fn()
      render(<BeliefInput {...defaultProps} onChange={onChange} />)

      const slider = screen.getByRole('slider')
      fireEvent.change(slider, { target: { value: '0.8' } })

      expect(onChange).toHaveBeenCalledWith(0.8)
    })

    it('displays min and max labels', () => {
      render(<BeliefInput {...defaultProps} min={0} max={1} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('respects custom formatValue function', () => {
      render(
        <BeliefInput
          {...defaultProps}
          value={0.65}
          formatValue={(v) => `${v.toFixed(2)} units`}
        />
      )
      expect(screen.getByText('0.65 units')).toBeInTheDocument()
    })

    it('is disabled when disabled prop is true', () => {
      render(<BeliefInput {...defaultProps} disabled={true} />)
      const slider = screen.getByRole('slider')
      expect(slider).toBeDisabled()
    })

    it('has accessible slider label', () => {
      render(<BeliefInput {...defaultProps} />)
      expect(screen.getByLabelText('Confidence slider')).toBeInTheDocument()
    })
  })

  describe('mode toggle', () => {
    it('renders mode toggle buttons', () => {
      render(<BeliefInput {...defaultProps} />)
      expect(
        screen.getByLabelText('Switch to slider mode')
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText('Switch to natural language mode')
      ).toBeInTheDocument()
    })

    it('switches to natural language mode when toggle clicked', () => {
      render(<BeliefInput {...defaultProps} />)

      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      expect(
        screen.getByLabelText('Confidence natural language input')
      ).toBeInTheDocument()
    })

    it('switches back to slider mode', () => {
      render(<BeliefInput {...defaultProps} />)

      // Switch to NL mode
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()

      // Switch back to slider mode
      fireEvent.click(screen.getByLabelText('Switch to slider mode'))
      expect(screen.getByRole('slider')).toBeInTheDocument()
    })

    it('has aria-pressed indicating current mode', () => {
      render(<BeliefInput {...defaultProps} />)

      const sliderButton = screen.getByLabelText('Switch to slider mode')
      const nlButton = screen.getByLabelText('Switch to natural language mode')

      expect(sliderButton).toHaveAttribute('aria-pressed', 'true')
      expect(nlButton).toHaveAttribute('aria-pressed', 'false')

      fireEvent.click(nlButton)

      expect(sliderButton).toHaveAttribute('aria-pressed', 'false')
      expect(nlButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('disables toggle buttons when disabled prop is true', () => {
      render(<BeliefInput {...defaultProps} disabled={true} />)

      expect(screen.getByLabelText('Switch to slider mode')).toBeDisabled()
      expect(
        screen.getByLabelText('Switch to natural language mode')
      ).toBeDisabled()
    })
  })

  describe('natural language mode', () => {
    it('renders text input in natural language mode', () => {
      render(<BeliefInput {...defaultProps} />)
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      expect(
        screen.getByPlaceholderText("Type your estimate (e.g., 'around 60-70%')")
      ).toBeInTheDocument()
    })

    it('uses custom placeholder when provided', () => {
      render(
        <BeliefInput
          {...defaultProps}
          placeholder="Enter your confidence level"
        />
      )
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      expect(
        screen.getByPlaceholderText('Enter your confidence level')
      ).toBeInTheDocument()
    })

    it('shows current value indicator when input is empty', () => {
      render(<BeliefInput {...defaultProps} value={0.5} />)
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      expect(screen.getByText('Current value: 50%')).toBeInTheDocument()
    })

    it('allows text input', () => {
      render(<BeliefInput {...defaultProps} />)
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      const input = screen.getByLabelText('Confidence natural language input')
      fireEvent.change(input, { target: { value: 'about 65%' } })

      expect(input).toHaveValue('about 65%')
    })

    it('clears current value indicator when text is entered', () => {
      render(<BeliefInput {...defaultProps} value={0.5} />)
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      const input = screen.getByLabelText('Confidence natural language input')
      fireEvent.change(input, { target: { value: 'test' } })

      expect(screen.queryByText('Current value: 50%')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has data-testid for integration testing', () => {
      render(<BeliefInput {...defaultProps} />)
      expect(screen.getByTestId('belief-input')).toBeInTheDocument()
    })

    it('displays label text', () => {
      render(<BeliefInput {...defaultProps} label="Risk Level" />)
      expect(screen.getByText('Risk Level')).toBeInTheDocument()
    })

    it('focuses text input when switching to natural language mode', () => {
      render(<BeliefInput {...defaultProps} />)
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      const input = screen.getByLabelText('Confidence natural language input')
      expect(document.activeElement).toBe(input)
    })

    it('has proper aria-label on text input', () => {
      render(<BeliefInput {...defaultProps} label="Certainty" />)
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))

      expect(
        screen.getByLabelText('Certainty natural language input')
      ).toBeInTheDocument()
    })
  })

  describe('slider constraints', () => {
    it('uses default min/max values', () => {
      render(<BeliefInput {...defaultProps} />)
      const slider = screen.getByRole('slider')
      expect(slider).toHaveAttribute('min', '0')
      expect(slider).toHaveAttribute('max', '1')
    })

    it('uses custom min/max values', () => {
      render(<BeliefInput {...defaultProps} min={0.1} max={0.9} />)
      const slider = screen.getByRole('slider')
      expect(slider).toHaveAttribute('min', '0.1')
      expect(slider).toHaveAttribute('max', '0.9')
    })

    it('uses custom step value', () => {
      render(<BeliefInput {...defaultProps} step={0.05} />)
      const slider = screen.getByRole('slider')
      expect(slider).toHaveAttribute('step', '0.05')
    })
  })

  describe('mode state persistence', () => {
    it('clears suggestion when switching back to slider mode', () => {
      render(<BeliefInput {...defaultProps} />)

      // Switch to NL mode
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))
      const input = screen.getByLabelText('Confidence natural language input')
      fireEvent.change(input, { target: { value: 'test input' } })

      // Switch back to slider
      fireEvent.click(screen.getByLabelText('Switch to slider mode'))

      // Switch back to NL - input should be cleared
      fireEvent.click(screen.getByLabelText('Switch to natural language mode'))
      expect(
        screen.getByLabelText('Confidence natural language input')
      ).toHaveValue('')
    })
  })
})

/**
 * ThresholdInput Component Tests
 *
 * Verifies the threshold input functionality for probability_of_goal calculation.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThresholdInput } from '../ThresholdInput'

describe('ThresholdInput', () => {
  describe('rendering', () => {
    it('renders with null value as empty input', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} />)

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveValue(null)
    })

    it('renders with numeric value', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={100000} onChange={onChange} />)

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveValue(100000)
    })

    it('shows label text', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} />)

      expect(screen.getByText('Success threshold')).toBeInTheDocument()
      expect(screen.getByText('(optional)')).toBeInTheDocument()
    })

    it('shows help text', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} />)

      expect(screen.getByText(/When set, shows probability/)).toBeInTheDocument()
    })

    it('shows unit when provided', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={100} onChange={onChange} unit="$" />)

      expect(screen.getByText('$')).toBeInTheDocument()
    })
  })

  describe('compact mode', () => {
    it('renders compact variant', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} compact />)

      expect(screen.getByTestId('threshold-input-compact')).toBeInTheDocument()
    })

    it('does not show label in compact mode', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} compact />)

      expect(screen.queryByText('Success threshold')).not.toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onChange with number when valid value entered', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} />)

      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '50000' } })

      expect(onChange).toHaveBeenCalledWith(50000)
    })

    it('calls onChange with null when input cleared', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={100} onChange={onChange} />)

      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '' } })

      expect(onChange).toHaveBeenCalledWith(null)
    })

    it('handles decimal values', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} />)

      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '1234.56' } })

      expect(onChange).toHaveBeenCalledWith(1234.56)
    })

    it('handles negative values', () => {
      const onChange = vi.fn()
      render(<ThresholdInput value={null} onChange={onChange} />)

      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '-500' } })

      expect(onChange).toHaveBeenCalledWith(-500)
    })
  })

  describe('value synchronization', () => {
    it('updates display when value prop changes', () => {
      const onChange = vi.fn()
      const { rerender } = render(<ThresholdInput value={100} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveValue(100)

      rerender(<ThresholdInput value={200} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveValue(200)
    })

    it('handles transition from number to null', () => {
      const onChange = vi.fn()
      const { rerender } = render(<ThresholdInput value={100} onChange={onChange} />)

      rerender(<ThresholdInput value={null} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveValue(null)
    })
  })
})

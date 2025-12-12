/**
 * FormSelector Tests
 *
 * Brief 11.6: Tests for expert mode form selector
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormSelector } from '../FormSelector'

describe('FormSelector', () => {
  describe('Dropdown variant', () => {
    it('renders dropdown selector', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} />)
      expect(screen.getByTestId('form-selector-dropdown')).toBeInTheDocument()
    })

    it('shows current value in trigger', () => {
      render(<FormSelector value="diminishing_returns" onChange={vi.fn()} />)
      expect(screen.getByText('Diminishing')).toBeInTheDocument()
    })

    it('opens dropdown on click', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} />)

      const trigger = screen.getByRole('button', { expanded: false })
      fireEvent.click(trigger)

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('shows all form options in dropdown', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))

      expect(screen.getByTestId('form-option-linear')).toBeInTheDocument()
      expect(screen.getByTestId('form-option-diminishing_returns')).toBeInTheDocument()
      expect(screen.getByTestId('form-option-threshold')).toBeInTheDocument()
      expect(screen.getByTestId('form-option-s_curve')).toBeInTheDocument()
      expect(screen.getByTestId('form-option-noisy_or')).toBeInTheDocument()
      expect(screen.getByTestId('form-option-logistic')).toBeInTheDocument()
    })

    it('calls onChange when option is selected', () => {
      const onChange = vi.fn()
      render(<FormSelector value="linear" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      fireEvent.click(screen.getByTestId('form-option-threshold'))

      expect(onChange).toHaveBeenCalledWith('threshold')
    })

    it('closes dropdown after selection', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('form-option-threshold'))
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('shows label when provided', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} label="Relationship Form" />)
      expect(screen.getByText('Relationship Form')).toBeInTheDocument()
    })

    it('is disabled when disabled prop is true', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} disabled />)

      const trigger = screen.getByRole('button')
      expect(trigger).toBeDisabled()
    })
  })

  describe('Radio variant', () => {
    it('renders radio selector', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} variant="radio" />)
      expect(screen.getByTestId('form-selector-radio')).toBeInTheDocument()
    })

    it('shows all options as radio buttons', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} variant="radio" />)

      const radiogroup = screen.getByRole('radiogroup')
      expect(radiogroup).toBeInTheDocument()

      // All options should be visible
      expect(screen.getByTestId('form-option-linear')).toBeInTheDocument()
      expect(screen.getByTestId('form-option-diminishing_returns')).toBeInTheDocument()
      expect(screen.getByTestId('form-option-threshold')).toBeInTheDocument()
    })

    it('marks selected option', () => {
      render(<FormSelector value="threshold" onChange={vi.fn()} variant="radio" />)

      const thresholdOption = screen.getByTestId('form-option-threshold')
      expect(thresholdOption).toHaveAttribute('aria-selected', 'true')
    })

    it('calls onChange when radio option is clicked', () => {
      const onChange = vi.fn()
      render(<FormSelector value="linear" onChange={onChange} variant="radio" />)

      fireEvent.click(screen.getByTestId('form-option-s_curve'))

      expect(onChange).toHaveBeenCalledWith('s_curve')
    })

    it('shows descriptions when showDescriptions is true', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} variant="radio" showDescriptions />)

      expect(screen.getByText('Each increase has the same effect')).toBeInTheDocument()
      expect(screen.getByText('Effect gets smaller at higher levels')).toBeInTheDocument()
    })

    it('hides descriptions when showDescriptions is false', () => {
      render(
        <FormSelector value="linear" onChange={vi.fn()} variant="radio" showDescriptions={false} />
      )

      expect(screen.queryByText('Each increase has the same effect')).not.toBeInTheDocument()
    })
  })

  describe('Form options display', () => {
    it('shows form icon for each option', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} variant="radio" />)

      // Icons should be present (they're aria-hidden but still in DOM)
      expect(screen.getByText('─')).toBeInTheDocument() // Linear
      expect(screen.getByText('╭')).toBeInTheDocument() // Diminishing
      expect(screen.getByText('╯')).toBeInTheDocument() // Threshold
    })

    it('shows plain language names', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} variant="radio" />)

      expect(screen.getByText('Proportional')).toBeInTheDocument()
      expect(screen.getByText('Diminishing')).toBeInTheDocument()
      expect(screen.getByText('Threshold')).toBeInTheDocument()
      expect(screen.getByText('Adoption curve')).toBeInTheDocument()
      expect(screen.getByText('Combined causes')).toBeInTheDocument()
      expect(screen.getByText('Tipping point')).toBeInTheDocument()
    })
  })

  describe('Keyboard interaction', () => {
    it('closes dropdown on Escape', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('dropdown has correct ARIA attributes', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} />)

      const trigger = screen.getByRole('button')
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('radio group has accessible label', () => {
      render(
        <FormSelector
          value="linear"
          onChange={vi.fn()}
          variant="radio"
          label="Choose relationship"
        />
      )

      const radiogroup = screen.getByRole('radiogroup', { name: 'Choose relationship' })
      expect(radiogroup).toBeInTheDocument()
    })

    it('options have correct aria-selected', () => {
      render(<FormSelector value="linear" onChange={vi.fn()} variant="radio" />)

      const linearOption = screen.getByTestId('form-option-linear')
      const thresholdOption = screen.getByTestId('form-option-threshold')

      expect(linearOption).toHaveAttribute('aria-selected', 'true')
      expect(thresholdOption).toHaveAttribute('aria-selected', 'false')
    })
  })
})

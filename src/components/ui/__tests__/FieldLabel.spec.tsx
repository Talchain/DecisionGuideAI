import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FieldLabel } from '../FieldLabel'

describe('FieldLabel', () => {
  it('renders basic label without tooltip', () => {
    render(<FieldLabel label="Field Name" />)

    expect(screen.getByText('Field Name')).toBeInTheDocument()
    expect(screen.queryByTestId('field-label-info-button')).not.toBeInTheDocument()
  })

  it('renders label with htmlFor attribute', () => {
    render(<FieldLabel label="Email" htmlFor="email-input" />)

    const label = screen.getByText('Email').closest('label')
    expect(label).toHaveAttribute('for', 'email-input')
  })

  it('shows required indicator when required is true', () => {
    render(<FieldLabel label="Required Field" required={true} />)

    expect(screen.getByLabelText('required')).toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('renders info button when technicalTerm provided', () => {
    render(
      <FieldLabel
        label="Confidence"
        technicalTerm="Belief (epistemic uncertainty)"
      />
    )

    expect(screen.getByTestId('field-label-info-button')).toBeInTheDocument()
  })

  it('renders info button when technicalDescription provided', () => {
    render(
      <FieldLabel
        label="Influence"
        technicalDescription="How strongly this affects the outcome"
      />
    )

    expect(screen.getByTestId('field-label-info-button')).toBeInTheDocument()
  })

  it('shows tooltip on info button click', () => {
    render(
      <FieldLabel
        label="Confidence"
        technicalTerm="Belief (epistemic uncertainty)"
        technicalDescription="How certain you are about this relationship"
      />
    )

    // Tooltip should not be visible initially
    expect(screen.queryByTestId('field-label-tooltip')).not.toBeInTheDocument()

    // Click the info button
    const infoButton = screen.getByTestId('field-label-info-button')
    fireEvent.click(infoButton)

    // Tooltip should now be visible
    expect(screen.getByTestId('field-label-tooltip')).toBeInTheDocument()
    expect(screen.getByText('Belief (epistemic uncertainty)')).toBeInTheDocument()
    expect(screen.getByText('How certain you are about this relationship')).toBeInTheDocument()
  })

  it('hides tooltip on second click', () => {
    render(
      <FieldLabel
        label="Test"
        technicalTerm="Technical Term"
      />
    )

    const infoButton = screen.getByTestId('field-label-info-button')

    // Show tooltip
    fireEvent.click(infoButton)
    expect(screen.getByTestId('field-label-tooltip')).toBeInTheDocument()

    // Hide tooltip
    fireEvent.click(infoButton)
    expect(screen.queryByTestId('field-label-tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip on mouse enter', () => {
    render(
      <FieldLabel
        label="Test"
        technicalTerm="Technical Term"
      />
    )

    const infoButton = screen.getByTestId('field-label-info-button')

    fireEvent.mouseEnter(infoButton)
    expect(screen.getByTestId('field-label-tooltip')).toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', () => {
    render(
      <FieldLabel
        label="Test"
        technicalTerm="Technical Term"
      />
    )

    const infoButton = screen.getByTestId('field-label-info-button')

    fireEvent.mouseEnter(infoButton)
    expect(screen.getByTestId('field-label-tooltip')).toBeInTheDocument()

    fireEvent.mouseLeave(infoButton)
    expect(screen.queryByTestId('field-label-tooltip')).not.toBeInTheDocument()
  })

  it('displays only technical term when no description provided', () => {
    render(
      <FieldLabel
        label="Test"
        technicalTerm="Technical Term Only"
      />
    )

    const infoButton = screen.getByTestId('field-label-info-button')
    fireEvent.click(infoButton)

    expect(screen.getByText('Technical Term Only')).toBeInTheDocument()
  })

  it('displays only description when no technical term provided', () => {
    render(
      <FieldLabel
        label="Test"
        technicalDescription="Description only"
      />
    )

    const infoButton = screen.getByTestId('field-label-info-button')
    fireEvent.click(infoButton)

    expect(screen.getByText('Description only')).toBeInTheDocument()
  })

  it('info button has proper accessibility attributes', () => {
    render(
      <FieldLabel
        label="Test"
        technicalTerm="Tech"
      />
    )

    const infoButton = screen.getByTestId('field-label-info-button')
    expect(infoButton).toHaveAttribute('aria-label', 'Show technical details')
    expect(infoButton).toHaveAttribute('type', 'button')
  })

  it('tooltip has role="tooltip"', () => {
    render(
      <FieldLabel
        label="Test"
        technicalTerm="Tech"
      />
    )

    fireEvent.click(screen.getByTestId('field-label-info-button'))

    const tooltip = screen.getByTestId('field-label-tooltip')
    expect(tooltip).toHaveAttribute('role', 'tooltip')
  })
})

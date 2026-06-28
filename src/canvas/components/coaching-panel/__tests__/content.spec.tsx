/**
 * Content — the panel renders the data it is given (and only that).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoachingPanel } from '../CoachingPanel'
import {
  typicalPanel,
  noSummary,
  noFutureFields,
  withAllFuture,
  withPriority,
} from '../__fixtures__/coaching.fixtures'

describe('CoachingPanel content', () => {
  it('renders the orientation summary line when present', () => {
    render(<CoachingPanel coaching={typicalPanel} />)
    expect(screen.getByTestId('coaching-summary')).toHaveTextContent(typicalPanel.summary!)
  })

  it('omits the summary line when absent (no synthesised line)', () => {
    render(<CoachingPanel coaching={noSummary} />)
    expect(screen.queryByTestId('coaching-summary')).toBeNull()
  })

  it('renders each visible signal observation as the primary line', () => {
    render(<CoachingPanel coaching={noFutureFields} />)
    expect(
      screen.getByText('A plain signal with nothing optional set beyond its label.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Another plain signal, no roadmap fields.')).toBeInTheDocument()
  })

  it('shows the target entity label only when a row is expanded', () => {
    render(<CoachingPanel coaching={noFutureFields} />)
    // Collapsed: label not shown (clean rows; shape is the row-level cue).
    expect(screen.queryByText('Keep the current plan')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /a plain signal with nothing optional/i }))
    expect(screen.getByText('Keep the current plan')).toBeInTheDocument()
  })

  it('renders future fields verbatim when present (after expand)', () => {
    render(<CoachingPanel coaching={withAllFuture} />)
    fireEvent.click(screen.getByRole('button', { name: /most influential estimate/i }))
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('It shifts the result more than anything else.')).toBeInTheDocument()
    expect(screen.getByText('Gather two more data points')).toBeInTheDocument()
    expect(screen.getByText('Pilot cohort, small sample')).toBeInTheDocument()
    expect(screen.getByText('From the first draft of figures.')).toBeInTheDocument()
  })

  it('does not render a bare numeric priority as prose (kept on a data attribute)', () => {
    render(<CoachingPanel coaching={withPriority} />)
    fireEvent.click(screen.getByRole('button', { name: /headline figure looks optimistic/i }))
    // The human reason is shown; the raw number is not surfaced as copy.
    expect(
      screen.getByText('This estimate moves the result more than the others.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('coaching-future-fields')).toHaveAttribute('data-priority', '1')
  })

  it('omits the future-fields block entirely when no roadmap fields are present', () => {
    render(<CoachingPanel coaching={noFutureFields} />)
    fireEvent.click(screen.getByRole('button', { name: /a plain signal with nothing optional/i }))
    expect(screen.queryByTestId('coaching-future-fields')).toBeNull()
  })
})

/**
 * Interaction — expand/collapse exclusivity, show all/fewer, button semantics.
 * View-state only; no data is computed.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoachingPanel } from '../CoachingPanel'
import { typicalPanel, noFutureFields } from '../__fixtures__/coaching.fixtures'

const rowA = /retention estimate rests/i
const rowB = /usually take longer/i

describe('CoachingPanel interaction', () => {
  it('expands a row to reveal its coaching moment', () => {
    render(<CoachingPanel coaching={typicalPanel} />)
    const a = screen.getByRole('button', { name: rowA })
    expect(a).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(a)
    expect(a).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByTestId('coaching-card-body')).toHaveLength(1)
  })

  it('keeps only one row open at a time', () => {
    render(<CoachingPanel coaching={typicalPanel} />)
    const a = screen.getByRole('button', { name: rowA })
    const b = screen.getByRole('button', { name: rowB })
    fireEvent.click(a)
    expect(a).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(b)
    expect(b).toHaveAttribute('aria-expanded', 'true')
    expect(a).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByTestId('coaching-card-body')).toHaveLength(1)
  })

  it('toggles the same row closed on a second activation', () => {
    render(<CoachingPanel coaching={typicalPanel} />)
    const a = screen.getByRole('button', { name: rowA })
    fireEvent.click(a)
    fireEvent.click(a)
    expect(a).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('coaching-card-body')).toBeNull()
  })

  it('reveals all rows and collapses back to the default set', () => {
    render(<CoachingPanel coaching={typicalPanel} />) // 5 signals, default visible 3
    expect(screen.getAllByTestId('coaching-card')).toHaveLength(3)
    expect(screen.queryByText('One supplier carries most of the delivery exposure.')).toBeNull()

    const reveal = screen.getByTestId('coaching-reveal')
    expect(reveal).toHaveTextContent('Show all 5')
    fireEvent.click(reveal)
    expect(screen.getAllByTestId('coaching-card')).toHaveLength(5)
    expect(
      screen.getByText('One supplier carries most of the delivery exposure.'),
    ).toBeInTheDocument()
    expect(reveal).toHaveTextContent('Show fewer')

    fireEvent.click(reveal)
    expect(screen.getAllByTestId('coaching-card')).toHaveLength(3)
  })

  it('does not show a reveal control when all signals fit the default set', () => {
    render(<CoachingPanel coaching={noFutureFields} />) // 2 signals
    expect(screen.queryByTestId('coaching-reveal')).toBeNull()
  })

  it('exposes native button semantics for full keyboard operation', () => {
    render(<CoachingPanel coaching={typicalPanel} />)
    // Row headers + the reveal control are all native, enabled buttons —
    // keyboard-operable (Tab focus, Enter/Space activate) by construction.
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(4) // 3 rows + reveal
    buttons.forEach((b) => expect(b).not.toBeDisabled())
    // The reveal control carries disclosure state.
    expect(screen.getByTestId('coaching-reveal')).toHaveAttribute('aria-expanded', 'false')
  })
})

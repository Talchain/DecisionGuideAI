/**
 * Tolerance — malformed / partial / absent data degrades safely, never throws.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoachingPanel } from '../CoachingPanel'
import {
  missingGrounding,
  emptySignals,
  unknownTargetKind,
  veryLongStrings,
} from '../__fixtures__/coaching.fixtures'

describe('CoachingPanel tolerance', () => {
  it('renders a row with empty grounding without throwing', () => {
    render(<CoachingPanel coaching={missingGrounding} />)
    const card = screen.getByTestId('coaching-card')
    expect(card).toBeInTheDocument()
    // Header is still operable; expanding does not throw.
    fireEvent.click(card.querySelector('button')!)
    expect(screen.getByTestId('coaching-card-body')).toBeInTheDocument()
  })

  it('shows the neutral empty state for an empty signal list', () => {
    render(<CoachingPanel coaching={emptySignals} />)
    expect(screen.getByTestId('coaching-empty')).toHaveTextContent('No coaching to show yet.')
    expect(screen.queryByTestId('coaching-list')).toBeNull()
  })

  it('shows the empty state for null coaching', () => {
    render(<CoachingPanel coaching={null} />)
    expect(screen.getByTestId('coaching-empty')).toBeInTheDocument()
  })

  it('shows the empty state when no coaching prop is provided', () => {
    render(<CoachingPanel />)
    expect(screen.getByTestId('coaching-empty')).toBeInTheDocument()
  })

  it('degrades an unknown target kind to a neutral marker, never a raw string', () => {
    render(<CoachingPanel coaching={unknownTargetKind} />)
    expect(screen.getByTestId('coaching-card')).toBeInTheDocument()
    expect(screen.queryByText('mystery_kind')).toBeNull()
  })

  it('renders very long strings without a reveal control (single signal)', () => {
    render(<CoachingPanel coaching={veryLongStrings} />)
    expect(screen.getByTestId('coaching-summary')).toBeInTheDocument()
    expect(screen.getByTestId('coaching-card')).toBeInTheDocument()
    expect(screen.queryByTestId('coaching-reveal')).toBeNull()
  })
})

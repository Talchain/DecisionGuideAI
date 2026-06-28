/**
 * Render, do not compute (invariant F.6).
 *
 * The panel must render signals in the order received and must not rank by
 * priority, select which signals matter, or transition lifecycle. These tests
 * are the guardrail against accidentally introducing CEE-owned logic.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoachingPanel } from '../CoachingPanel'
import { priorityOutOfOrder, typicalPanel, withLifecycle } from '../__fixtures__/coaching.fixtures'

describe('CoachingPanel F.6 — render, do not compute', () => {
  it('renders rows in received array order, never sorted by priority', () => {
    render(<CoachingPanel coaching={priorityOutOfOrder} />)
    const ids = screen
      .getAllByTestId('coaching-card')
      .map((el) => el.getAttribute('data-signal-id'))
    // Array order is 3,1,2 by priority — DOM must follow the array, not priority.
    expect(ids).toEqual(['order-first', 'order-second', 'order-third'])
  })

  it('renders every received signal (no selection/filtering) once revealed', () => {
    render(<CoachingPanel coaching={typicalPanel} />)
    fireEvent.click(screen.getByTestId('coaching-reveal'))
    expect(screen.getAllByTestId('coaching-card')).toHaveLength(typicalPanel.signals.length)
  })

  it('renders lifecycle state verbatim with no value-driven hiding or de-emphasis', () => {
    render(<CoachingPanel coaching={withLifecycle} />)
    const card = screen.getByTestId('coaching-card')
    expect(card).toBeInTheDocument() // not hidden because it is "Reopened"
    fireEvent.click(card.querySelector('button')!)
    expect(screen.getByTestId('coaching-lifecycle')).toHaveTextContent('Reopened')
  })
})

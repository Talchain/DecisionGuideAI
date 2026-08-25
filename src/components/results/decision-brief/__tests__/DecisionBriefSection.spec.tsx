import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DecisionBriefSection } from '../DecisionBriefSection'
import type { DecisionBriefViewModel } from '../decisionBriefViewModel'

const BRIEF: DecisionBriefViewModel = {
  topDrivers: [
    { label: 'October Product Launch Readiness' },
    { label: 'VP Enterprise Sales Scalability' },
    { label: 'AE Team Morale' },
  ],
  // ⚠ These were 'Assumption one'/'Assumption two' — values that overlap NOTHING.
  // Real producer data always overlaps: `key_assumptions` is a SUBSET of
  // `top_drivers` on every capture measured. A fixture that cannot overlap could
  // never observe the duplication defect this surface actually shipped, which is
  // why a green suite sat over it. The realistic values are used instead.
  keyAssumptions: ['October Product Launch Readiness', 'VP Enterprise Sales Scalability'],
  whatWouldChange: ['Factor A → Outcome B', 'Outcome B → Goal C'],
  defaultedAssumptions: [
    {
      factorLabel: 'Available Growth Budget',
      note: 'No starting value was provided for "Available Growth Budget" — the analysis used a default.',
    },
  ],
}

describe('DecisionBriefSection', () => {
  it('shows every licensed group and its first producer item without opening a disclosure', () => {
    render(<DecisionBriefSection brief={BRIEF} />)

    expect(screen.getByRole('heading', { name: 'Decision brief' })).toBeInTheDocument()
    expect(screen.getByText('What matters')).toBeInTheDocument()
    expect(screen.getByText('What Olumi assumed')).toBeInTheDocument()
    expect(screen.getByText('What could change')).toBeInTheDocument()

    expect(screen.getByText('October Product Launch Readiness')).toBeInTheDocument()
    expect(screen.getByText(/No starting value was provided for "Available Growth Budget"/)).toBeInTheDocument()
    expect(screen.getByText('Factor A → Outcome B')).toBeInTheDocument()
    expect(screen.queryByText('VP Enterprise Sales Scalability')).toBeNull()

    const toggle = screen.getByRole('button', { name: 'Show all brief details' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls')
  })

  it('expands and collapses all complete producer lists through one keyboard-operable control', async () => {
    const user = userEvent.setup()
    render(<DecisionBriefSection brief={BRIEF} />)

    const toggle = screen.getByRole('button', { name: 'Show all brief details' })
    toggle.focus()
    await user.keyboard('{Enter}')

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('VP Enterprise Sales Scalability')).toBeInTheDocument()
    expect(screen.getByText('AE Team Morale')).toBeInTheDocument()
    expect(screen.getByText('VP Enterprise Sales Scalability')).toBeInTheDocument()
    expect(screen.getByText('Outcome B → Goal C')).toBeInTheDocument()

    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'Show all brief details' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText('AE Team Morale')).toBeNull()
  })

  it('renders no recommendation, probability, confidence or robustness authority', () => {
    render(<DecisionBriefSection brief={BRIEF} />)
    const section = screen.getByTestId('decision-brief-section')

    expect(section).not.toHaveTextContent(/recommend|winner|leading option|probability|confidence|robust/i)
    expect(section).not.toHaveTextContent('%')
  })

  /**
   * The defect this surface shipped: two categories rendering the same list.
   * Bound by IDENTITY to the realistic overlap — `keyAssumptions` here is a
   * subset of `topDrivers`, exactly as the producer emits — so this test fails
   * the moment any category is sourced from a factor-name list again.
   */
  it('never renders the same content under two category headings', () => {
    render(<DecisionBriefSection brief={BRIEF} />)

    const groups = screen.getByTestId('decision-brief-groups')
    const rendered = Array.from(groups.querySelectorAll('ul')).map(list =>
      Array.from(list.querySelectorAll('li')).map(li => li.textContent?.trim() ?? ''),
    )

    const signatures = rendered.map(items => items.join('\u241f'))
    expect(new Set(signatures).size).toBe(signatures.length)

    // And specifically: no driver name appears as the whole content of a second group.
    const driverNames = new Set(BRIEF.topDrivers.map(d => d.label))
    const assumedGroup = screen.getByTestId('decision-brief-defaulted')
    const assumedItems = Array.from(assumedGroup.querySelectorAll('li')).map(li => li.textContent?.trim() ?? '')
    expect(assumedItems.every(item => !driverNames.has(item))).toBe(true)
  })
})

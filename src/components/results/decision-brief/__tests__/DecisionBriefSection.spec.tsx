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
  keyAssumptions: ['Assumption one', 'Assumption two'],
  whatWouldChange: ['Factor A → Outcome B', 'Outcome B → Goal C'],
}

describe('DecisionBriefSection', () => {
  it('shows every licensed group and its first producer item without opening a disclosure', () => {
    render(<DecisionBriefSection brief={BRIEF} />)

    expect(screen.getByRole('heading', { name: 'Decision brief' })).toBeInTheDocument()
    expect(screen.getByText('What matters')).toBeInTheDocument()
    expect(screen.getByText('What this rests on')).toBeInTheDocument()
    expect(screen.getByText('What could change')).toBeInTheDocument()

    expect(screen.getByText('October Product Launch Readiness')).toBeInTheDocument()
    expect(screen.getByText('Assumption one')).toBeInTheDocument()
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
    expect(screen.getByText('Assumption two')).toBeInTheDocument()
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
})

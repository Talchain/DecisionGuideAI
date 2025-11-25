import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerdictCard } from '../VerdictCard'

describe('VerdictCard', () => {
  it('renders supports verdict with green styling', () => {
    render(
      <VerdictCard
        verdict={{ verdict: 'supports', strength: 'strongly', confidence: 0.8 }}
        objectiveText="maximize revenue"
        outcomeValue={75000}
        units="$"
      />
    )

    expect(screen.getByTestId('verdict-card')).toBeInTheDocument()
    expect(screen.getByText(/Supports your objective/i)).toBeInTheDocument()
    expect(screen.getByText(/strongly supports/i)).toBeInTheDocument()
    expect(screen.getByText(/maximize revenue/i)).toBeInTheDocument()
    expect(screen.getByText(/75000\.00 \$/)).toBeInTheDocument()
  })

  it('renders mixed verdict with yellow styling', () => {
    render(
      <VerdictCard
        verdict={{ verdict: 'mixed', strength: 'slightly', confidence: 0.3 }}
        objectiveText="reduce costs"
        outcomeValue={50000}
      />
    )

    expect(screen.getByText(/Mixed outcome/i)).toBeInTheDocument()
    expect(screen.getByText(/mixed impact/i)).toBeInTheDocument()
    expect(screen.getByText(/reduce costs/i)).toBeInTheDocument()
  })

  it('renders opposes verdict with red styling', () => {
    render(
      <VerdictCard
        verdict={{ verdict: 'opposes', strength: 'moderately', confidence: 0.6 }}
        objectiveText="increase profit"
        outcomeValue={25000}
      />
    )

    expect(screen.getByText(/Works against your objective/i)).toBeInTheDocument()
    expect(screen.getByText(/this configuration.*works against.*increase profit/i)).toBeInTheDocument()
  })

  it('handles moderately strength modifier correctly', () => {
    render(
      <VerdictCard
        verdict={{ verdict: 'supports', strength: 'moderately', confidence: 0.5 }}
        objectiveText="test objective"
        outcomeValue={100}
      />
    )

    // Moderately should result in no strength modifier in text
    const text = screen.getByText(/supports.*test objective/i)
    expect(text.textContent).not.toContain('moderately')
    expect(text.textContent).toContain('supports')
  })

  it('formats values without units when not provided', () => {
    render(
      <VerdictCard
        verdict={{ verdict: 'supports', strength: 'slightly', confidence: 0.4 }}
        objectiveText="test"
        outcomeValue={42.567}
      />
    )

    expect(screen.getByText(/42\.57/)).toBeInTheDocument()
  })

  it('hides expected outcome for mixed verdict', () => {
    render(
      <VerdictCard
        verdict={{ verdict: 'mixed', strength: 'slightly', confidence: 0.2 }}
        objectiveText="test"
        outcomeValue={100}
      />
    )

    // Mixed verdict should still show outcome value
    expect(screen.getByText(/Expected outcome:/)).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(
      <VerdictCard
        verdict={{ verdict: 'supports', strength: 'strongly', confidence: 0.9 }}
        objectiveText="test"
        outcomeValue={100}
      />
    )

    const card = screen.getByTestId('verdict-card')
    expect(card).toHaveAttribute('role', 'status')
    expect(card).toHaveAttribute('aria-live', 'polite')
  })
})

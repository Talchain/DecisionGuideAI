/**
 * V7EvidenceDisclosure — V7 Lane L5 pins for the three-tab evidence disclosure
 * (spec row 7).
 *
 * Pins: the disclosure expands; Drivers clamp to three with a "Show N more"
 * expansion; the "est." tag renders on a defaulted driver; the Flip risks and
 * Trade-offs tabs render their live rows; the whole disclosure renders nothing
 * when there is nothing to disclose.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { V7EvidenceDisclosure } from '../V7EvidenceDisclosure'
import type { V7EvidenceModel } from '../buildV7Lenses'
import { v7EvidenceModel as model } from '@/__fixtures__/v7EvidenceModel'

const FIVE_DRIVERS: V7EvidenceModel['drivers'] = [
  { factorKey: 'f1', label: 'Price', direction: 'negative', isEstimate: true },
  { factorKey: 'f2', label: 'Demand', direction: 'positive', isEstimate: false },
  { factorKey: 'f3', label: 'Cost', direction: 'negative', isEstimate: false },
  { factorKey: 'f4', label: 'Speed', direction: 'positive', isEstimate: false },
  { factorKey: 'f5', label: 'Risk', direction: null, isEstimate: false },
]

describe('V7EvidenceDisclosure (V7 L5)', () => {
  it('renders nothing when there is nothing to disclose', () => {
    const { container } = render(<V7EvidenceDisclosure evidence={model({})} />)
    expect(container.firstChild).toBeNull()
  })

  it('expands to the Drivers view, clamps to three, and shows "Show N more"', () => {
    render(<V7EvidenceDisclosure evidence={model({ drivers: FIVE_DRIVERS })} />)
    fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))
    expect(screen.getByTestId('v7-evidence-drivers')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Cost')).toBeInTheDocument()
    // Fourth+ drivers are clamped until expanded.
    expect(screen.queryByText('Speed')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('v7-drivers-toggle'))
    expect(screen.getByText('Speed')).toBeInTheDocument()
    expect(screen.getByText('Risk')).toBeInTheDocument()
  })

  it('shows the "est." tag on a defaulted (low-confidence) driver', () => {
    render(<V7EvidenceDisclosure evidence={model({ drivers: FIVE_DRIVERS })} />)
    fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))
    const est = screen.getAllByTestId('v7-driver-est')
    expect(est).toHaveLength(1)
    expect(est[0]).toHaveTextContent('est.')
  })

  it('renders the Flip risks view from challengeFragileEdges values', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          flipRisks: [{ fromId: 'n1', fromLabel: 'Price', toLabel: 'Profit', switchProbability: 0.48 }],
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))
    fireEvent.click(screen.getByTestId('v7-evidence-tab-flipRisks'))
    expect(screen.getByTestId('v7-evidence-flip-risks')).toBeInTheDocument()
    expect(screen.getByText(/Price → Profit/)).toBeInTheDocument()
    expect(screen.getByText(/48% switch/)).toBeInTheDocument()
  })

  it('renders the Trade-offs view narrated from conditional_winners values', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          tradeOffs: [
            {
              factorLabel: 'Interest rate',
              factorId: 'n7',
              splitValue: 5,
              splitUnit: '%',
              highWinnerLabel: 'Rent',
              lowWinnerLabel: 'Buy',
            },
          ],
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))
    fireEvent.click(screen.getByTestId('v7-evidence-tab-tradeOffs'))
    expect(screen.getByTestId('v7-evidence-trade-offs')).toBeInTheDocument()
    expect(screen.getByText(/If Interest rate is above 5 %, Rent leads; below it, Buy leads\./)).toBeInTheDocument()
  })
})

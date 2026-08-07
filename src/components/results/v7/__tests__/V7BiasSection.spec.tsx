/**
 * V7BiasSection — V7 Lane L6 pins for "Challenge your assumptions" (spec
 * row 11).
 *
 * Pins: nothing renders without findings (no empty shell); a finding renders
 * its micro_intervention.steps AND estimated_minutes; the card carries a
 * COMPLETE border (never a border-left accent — the prototype's .coach-card
 * violation is not reproduced); the bias kind reads from a humanised badge.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7BiasSection } from '../V7BiasSection'
import { useCanvasStore } from '../../../../canvas/store'

function setBiasFindings(findings: unknown[] | undefined) {
  useCanvasStore.setState({
    runMeta: findings ? { ceeReviewV1: { bias_findings: findings } } : {},
  } as never)
}

beforeEach(() => {
  setBiasFindings(undefined)
})

describe('V7BiasSection (V7 L6)', () => {
  it('renders nothing when there are no bias findings', () => {
    const { container } = render(<V7BiasSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders steps and estimated minutes for a finding', () => {
    setBiasFindings([
      {
        type: 'ANCHORING_RISK',
        description: 'Your first estimate may anchor the rest.',
        micro_intervention: {
          estimated_minutes: 5,
          steps: ['Re-estimate from scratch', 'Compare with the anchor'],
        },
      },
    ])
    render(<V7BiasSection />)
    expect(screen.getByTestId('v7-bias-section')).toBeInTheDocument()
    expect(screen.getByTestId('v7-bias-kind')).toHaveTextContent('Anchoring')
    expect(screen.getByTestId('v7-bias-steps')).toHaveTextContent('Re-estimate from scratch')
    expect(screen.getByTestId('v7-bias-steps')).toHaveTextContent('Compare with the anchor')
    expect(screen.getByTestId('v7-bias-minutes')).toHaveTextContent('About 5 min')
  })

  it('renders the card with a COMPLETE border (never a border-left accent)', () => {
    setBiasFindings([
      { type: 'SUNK_COST', description: 'Past spend is pulling the decision.', micro_intervention: { steps: ['List future-only costs'] } },
    ])
    render(<V7BiasSection />)
    const card = screen.getByTestId('v7-bias-card')
    expect(card.className).toContain('border-panel-border')
    expect(card.className).not.toMatch(/border-[lrtb]-/)
  })
})

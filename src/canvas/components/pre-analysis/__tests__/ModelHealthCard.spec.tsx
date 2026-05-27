/**
 * ModelHealthCard — pre-analysis-power-v1 Task 1 regression tests.
 *
 * Locks the compact-mode readiness reframe: the ring + dimension bars
 * stay, the dynamic coaching summary / bucket-derived dynamic headline is
 * no longer rendered, and a fixed two-line copy replaces them.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ModelHealthCard } from '../ModelHealthCard'

const baseProps = {
  completeness: 1,
  evidence: 0.6,
  balance: 0.6,
  calibration: 0,
  optionCount: 2,
  goalLabel: 'Goal',
  isLoading: false,
  hasGoalNode: true,
}

describe('ModelHealthCard — compact mode renders the static readiness reframe', () => {
  it('renders "Ready for provisional analysis" + the assumption-led subline', () => {
    render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary={null}
        dynamicHeadline={null}
      />,
    )
    const headline = screen.getByTestId('model-health-card-headline')
    expect(headline).toHaveTextContent('Ready for provisional analysis')
    expect(headline).toHaveTextContent(
      'Good enough to run, but results will be assumption-led until you confirm the highest-impact inputs.',
    )
  })

  it('renders the static copy even when coachingSummary is provided (dynamic copy no longer rendered)', () => {
    render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary="A dynamic coaching summary that should not appear in the hero."
        dynamicHeadline={null}
      />,
    )
    expect(screen.getByTestId('model-health-card-headline')).toHaveTextContent('Ready for provisional analysis')
    expect(
      screen.queryByText('A dynamic coaching summary that should not appear in the hero.'),
    ).not.toBeInTheDocument()
  })

  it('renders the static copy even when dynamicHeadline is provided', () => {
    render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary={null}
        dynamicHeadline="Velocity has the biggest impact. Review before running."
      />,
    )
    expect(screen.getByTestId('model-health-card-headline')).toHaveTextContent('Ready for provisional analysis')
    expect(
      screen.queryByText('Velocity has the biggest impact. Review before running.'),
    ).not.toBeInTheDocument()
  })

  it('keeps the numeric readiness score visible inside the ring (existing behaviour)', () => {
    const { container } = render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary={null}
        dynamicHeadline={null}
      />,
    )
    // The ring SVG renders the numeric label as <text> with the percentage.
    expect(container.querySelector('text')).not.toBeNull()
  })
})

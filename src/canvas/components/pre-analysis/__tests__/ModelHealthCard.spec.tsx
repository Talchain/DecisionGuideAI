/**
 * ModelHealthCard — pre-analysis-power-v1 (post-deploy correction pass).
 *
 * Locks the compact-mode behaviour: the ring + dimension bars stay, the
 * dynamic coaching summary / bucket-derived dynamic headline is no longer
 * rendered, and the previous "Ready for provisional analysis" block is
 * also dropped (collapsed into the "Strengthen this model before
 * analysis" headline in `T1DecisionReadinessCard` to avoid double-billing
 * the same idea — P0 #4 of the correction pass).
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

describe('ModelHealthCard — compact mode (post-deploy headline dedupe)', () => {
  it('does NOT render the deduped "Ready for provisional analysis" block beneath the ring', () => {
    render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary={null}
        dynamicHeadline={null}
      />,
    )
    expect(screen.queryByText('Ready for provisional analysis')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-health-card-headline')).not.toBeInTheDocument()
  })

  it('does NOT render the assumption-led subline either (deduped)', () => {
    render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary={null}
        dynamicHeadline={null}
      />,
    )
    expect(
      screen.queryByText(/Good enough to run, but results will be assumption-led/),
    ).not.toBeInTheDocument()
  })

  it('still drops the dynamic coachingSummary in compact mode', () => {
    render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary="A dynamic coaching summary that should not appear in the hero."
        dynamicHeadline={null}
      />,
    )
    expect(
      screen.queryByText('A dynamic coaching summary that should not appear in the hero.'),
    ).not.toBeInTheDocument()
  })

  it('still drops the bucket-derived dynamicHeadline in compact mode', () => {
    render(
      <ModelHealthCard
        compact
        {...baseProps}
        coachingSummary={null}
        dynamicHeadline="Velocity has the biggest impact. Review before running."
      />,
    )
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

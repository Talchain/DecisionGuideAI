/**
 * Tests for BriefGuidanceStrip.
 *
 * Verifies:
 * - Renders 5 element pills when any are detected
 * - Does not render when no elements are detected
 * - Correct detected/missing states per element
 * - Click fires onElementClick with correct kind
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BriefGuidanceStrip } from '../zones/BriefGuidanceStrip'
import type { BriefElement } from '../hooks/useBriefSignals'

function makeElements(overrides: Partial<Record<string, boolean>> = {}): BriefElement[] {
  return [
    { kind: 'goal',        detected: overrides.goal ?? false,        label: 'Goal',        coachingTip: 'State your goal.' },
    { kind: 'options',     detected: overrides.options ?? false,     label: 'Options',     coachingTip: 'List options.' },
    { kind: 'metric',      detected: overrides.metric ?? false,      label: 'Metric',      coachingTip: 'Add a metric.' },
    { kind: 'constraints', detected: overrides.constraints ?? false, label: 'Constraints', coachingTip: 'Note constraints.' },
    { kind: 'risks',       detected: overrides.risks ?? false,       label: 'Risks',       coachingTip: 'Note risks.' },
  ]
}

describe('BriefGuidanceStrip', () => {
  it('does not render when no elements are detected', () => {
    const { container } = render(
      <BriefGuidanceStrip elements={makeElements()} onElementClick={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders 5 pills when at least one element is detected', () => {
    render(
      <BriefGuidanceStrip elements={makeElements({ goal: true })} onElementClick={vi.fn()} />,
    )
    expect(screen.getByTestId('brief-guidance-strip')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('marks detected elements correctly', () => {
    render(
      <BriefGuidanceStrip
        elements={makeElements({ goal: true, options: true })}
        onElementClick={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Goal: detected')).toBeInTheDocument()
    expect(screen.getByLabelText('Options: detected')).toBeInTheDocument()
    expect(screen.getByLabelText('Metric: not detected')).toBeInTheDocument()
  })

  it('fires onElementClick with correct kind', () => {
    const onClick = vi.fn()
    render(
      <BriefGuidanceStrip elements={makeElements({ goal: true })} onElementClick={onClick} />,
    )
    fireEvent.click(screen.getByTestId('brief-pill-metric'))
    expect(onClick).toHaveBeenCalledWith('metric')
  })
})

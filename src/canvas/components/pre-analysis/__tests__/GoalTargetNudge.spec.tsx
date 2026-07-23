/**
 * GoalTargetNudge — RED-first pins for the success-target elicitation nudge.
 *
 * The nudge is presence/absence on existing state only. These pins lock the
 * exact render condition (goal node present AND no success target), that it
 * disappears once a target is set, that it never renders with no goal to
 * target (the pre-draft / no-goal case), and that its CTA reaches the passed
 * setter seam. DS: complete border (no one-sided accent) + bg-panel.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalTargetNudge } from '../GoalTargetNudge'

describe('GoalTargetNudge', () => {
  it('renders when a goal exists and no success target is set (drafted graph, target absent)', () => {
    render(<GoalTargetNudge hasGoalNode hasSuccessTarget={false} onSetTarget={vi.fn()} />)
    expect(screen.getByTestId('goal-target-nudge')).toBeInTheDocument()
    // Honest about the value it unlocks + that it is optional.
    expect(screen.getByText('Set a success target')).toBeInTheDocument()
    expect(screen.getByText(/Unlock Goal fit/)).toBeInTheDocument()
    expect(screen.getByText(/Optional; analysis runs without one\./)).toBeInTheDocument()
  })

  it('disappears once a success target is set', () => {
    render(<GoalTargetNudge hasGoalNode hasSuccessTarget onSetTarget={vi.fn()} />)
    expect(screen.queryByTestId('goal-target-nudge')).not.toBeInTheDocument()
  })

  it('does not render when there is no goal node (pre-draft / nothing to target)', () => {
    render(<GoalTargetNudge hasGoalNode={false} hasSuccessTarget={false} onSetTarget={vi.fn()} />)
    expect(screen.queryByTestId('goal-target-nudge')).not.toBeInTheDocument()
  })

  it('reaches the setter seam: clicking the CTA calls onSetTarget exactly once', () => {
    const onSetTarget = vi.fn()
    render(<GoalTargetNudge hasGoalNode hasSuccessTarget={false} onSetTarget={onSetTarget} />)
    fireEvent.click(screen.getByTestId('goal-target-nudge-cta'))
    expect(onSetTarget).toHaveBeenCalledTimes(1)
  })

  it('is DS-compliant: complete border (no one-sided accent) on bg-panel', () => {
    render(<GoalTargetNudge hasGoalNode hasSuccessTarget={false} onSetTarget={vi.fn()} />)
    const card = screen.getByTestId('goal-target-nudge')
    expect(card.className).toContain('bg-panel')
    expect(card.className).toContain('border')
    // No one-sided coloured accent edge (complete-borders rule).
    expect(card.className).not.toMatch(/border-[lrtb]-/)
  })
})

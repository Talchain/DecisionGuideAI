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
import { GOAL_ANCHOR_COPY } from '@/components/results/utils/goalAnchorCopy'

describe('GoalTargetNudge', () => {
  it('renders when a goal exists and no success target is set (drafted graph, target absent)', () => {
    render(<GoalTargetNudge hasGoalNode hasSuccessTarget={false} onSetTarget={vi.fn()} />)
    expect(screen.getByTestId('goal-target-nudge')).toBeInTheDocument()
    // Honest about the value it unlocks + that it is optional.
    expect(screen.getByText('Set a success target')).toBeInTheDocument()
    expect(screen.getByText(/Optional; analysis runs without one\./)).toBeInTheDocument()
  })

  /**
   * ⭐ THE CONSEQUENCE, NOT JUST THE FEATURE NAME.
   *
   * Measured on deployed staging: a model ran with the goal reading "Target:
   * None set", and only AFTERWARDS did the panel report that the most-likely
   * question was not answered. Five pre-run affordances already point at the
   * missing target (this nudge, the frame bar, the best-next-step rung,
   * `sig_success_missing`, the footer subline) — but every one of them named
   * the FEATURE ("Goal fit") rather than the QUESTION the user loses, and the
   * loudest of them closed with "Optional; analysis runs without one", which
   * reads as reassurance that skipping it costs nothing.
   *
   * The sentence that connects the two already existed and was rendered ONLY
   * after the run (`GOAL_ANCHOR_COPY.noTarget`, the house register for this
   * question under Paul's 2026-07-31 ruling). This binds the nudge to that
   * register BY IDENTITY rather than re-spelling it, so the pre-run and
   * post-run surfaces cannot drift into saying different things.
   */
  it('states the question the user loses, in the words of the house register', () => {
    render(<GoalTargetNudge hasGoalNode hasSuccessTarget={false} onSetTarget={vi.fn()} />)
    expect(screen.getByTestId('goal-target-nudge')).toHaveTextContent(
      GOAL_ANCHOR_COPY.noTarget,
    )
  })

  it('still says the target is optional — it informs, it never blocks', () => {
    render(<GoalTargetNudge hasGoalNode hasSuccessTarget={false} onSetTarget={vi.fn()} />)
    // Paul's ruling on this register: "It NEVER blocks. This is an invitation
    // with a route, not a wall." Not every strategic conversation carries a
    // quantified target, so the nudge must never read as a gate.
    expect(screen.getByTestId('goal-target-nudge')).toHaveTextContent(/Optional/)
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

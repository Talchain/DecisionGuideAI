/**
 * WinGauge re-anchoring — BEHAVIOUR CHANGE 1 of 3 (map row 1).
 *
 * Before: the gauge headlined the COMPARATIVE quantity under the label
 * "Win probability across scenarios" — a number that is neither of Paul's
 * two questions (it is the share of Monte-Carlo runs in which an option
 * out-ranked the others), presented as the panel most prominent figure.
 *
 * After: the GOAL number is the headline (question A), the comparative
 * distribution is DEMOTED beneath it under a label that says what it
 * measures, and a run with no success target says so and offers the route —
 * it never blocks, and it never fabricates a goal figure.
 *
 * RED-first: every assertion below fails on `bf86f672`.
 *
 * ⚠ jsdom pins STATE, not layout. "Demoted" here is asserted as DOM order
 * (the goal block precedes the comparative block), which is what jsdom can
 * honestly see. The pixel claim rides the post-deploy walk.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { WinGauge, type OptionWinShare } from '../WinGauge'
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from '../utils/goalAnchorCopy'

/** Two options whose goal ranking and comparative ranking DISAGREE. */
function sharesWithGoal(substituted = false): OptionWinShare[] {
  return [
    {
      id: 'a',
      label: 'Option A',
      winProbability: 0.7,
      isWinner: true,
      goalProbability: 0.2,
      goalFitIsSubstitutedJoint: substituted,
    },
    {
      id: 'b',
      label: 'Option B',
      winProbability: 0.3,
      isWinner: false,
      goalProbability: 0.8,
      goalFitIsSubstitutedJoint: substituted,
    },
  ]
}

/** The no-target run: ISL computes no goal probability without a threshold. */
function sharesNoTarget(): OptionWinShare[] {
  return [
    { id: 'a', label: 'Option A', winProbability: 0.7, isWinner: true, goalProbability: null },
    { id: 'b', label: 'Option B', winProbability: 0.3, isWinner: false, goalProbability: null },
  ]
}

describe('WinGauge — the goal number is the headline', () => {
  it('labels the primary block with the A register, not "win probability"', () => {
    render(<WinGauge shares={sharesWithGoal()} />)
    expect(screen.getByTestId('win-gauge-goal-heading')).toHaveTextContent(
      GOAL_ANCHOR_COPY.label(false),
    )
    expect(screen.queryByText(/win probability/i)).not.toBeInTheDocument()
  })

  it('renders each option goal number, taken from goalProbability and not from winProbability', () => {
    render(<WinGauge shares={sharesWithGoal()} />)
    const goalBlock = screen.getByTestId('win-gauge-goal-block')
    // Option B leads on the GOAL quantity (80%) though it trails on the
    // comparative one (30%). If the block were still sourced from
    // winProbability these would read 70% / 30%.
    expect(within(goalBlock).getByTestId('goal-pct-b')).toHaveTextContent('80%')
    expect(within(goalBlock).getByTestId('goal-pct-a')).toHaveTextContent('20%')
  })

  it('orders the goal block by the goal number, so the goal leader is first', () => {
    render(<WinGauge shares={sharesWithGoal()} />)
    const rows = within(screen.getByTestId('win-gauge-goal-block')).getAllByTestId(/^goal-row-/)
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['goal-row-b', 'goal-row-a'])
  })

  it('gives the figure an A-anchored accessible name', () => {
    render(<WinGauge shares={sharesWithGoal()} />)
    expect(screen.getByRole('figure')).toHaveAccessibleName(GOAL_ANCHOR_COPY.byOptionAria(false))
  })
})

describe('WinGauge — the comparative number survives, demoted and described', () => {
  it('keeps the comparative distribution under the house comparative label', () => {
    render(<WinGauge shares={sharesWithGoal()} />)
    expect(screen.getByTestId('win-gauge-comparative-heading')).toHaveTextContent(
      COMPARATIVE_COPY.label,
    )
    // The distribution itself is data and is not suppressed.
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('places the goal block BEFORE the comparative block in the DOM', () => {
    render(<WinGauge shares={sharesWithGoal()} />)
    const goal = screen.getByTestId('win-gauge-goal-block')
    const comp = screen.getByTestId('win-gauge-comparative-block')
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(goal.compareDocumentPosition(comp) & 4).toBeTruthy()
  })
})

describe('WinGauge — the possessive gate', () => {
  it('never says "your goal" when the number is the substituted joint quantity', () => {
    const { container } = render(<WinGauge shares={sharesWithGoal(true)} />)
    expect(container.textContent?.toLowerCase()).not.toContain('your goal')
    expect(screen.getByTestId('win-gauge-goal-heading')).toHaveTextContent(
      GOAL_ANCHOR_COPY.label(true),
    )
  })
})

describe('WinGauge — the no-target state invites, never blocks', () => {
  it('renders the invitation and its action when no option carries a goal number', () => {
    render(<WinGauge shares={sharesNoTarget()} />)
    expect(screen.getByTestId('win-gauge-no-target')).toHaveTextContent(GOAL_ANCHOR_COPY.noTarget)
    expect(screen.getByTestId('win-gauge-no-target')).toHaveTextContent(
      GOAL_ANCHOR_COPY.noTargetCta,
    )
  })

  it('still draws the comparative distribution — the absent target hides nothing that was computed', () => {
    render(<WinGauge shares={sharesNoTarget()} />)
    expect(screen.getByTestId('win-gauge-comparative-block')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByTestId('win-gauge-comparative-heading')).toHaveTextContent(
      COMPARATIVE_COPY.label,
    )
  })

  it('renders no goal block and fabricates no goal figure', () => {
    render(<WinGauge shares={sharesNoTarget()} />)
    expect(screen.queryByTestId('win-gauge-goal-block')).not.toBeInTheDocument()
    expect(screen.queryByText(/chance of hitting your goal/i)).not.toBeInTheDocument()
  })

  it('names the comparative quantity in the accessible name when there is no goal number', () => {
    render(<WinGauge shares={sharesNoTarget()} />)
    expect(screen.getByRole('figure')).toHaveAccessibleName(COMPARATIVE_COPY.byOptionAria)
  })
})

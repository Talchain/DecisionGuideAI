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
import { SUB_ONE_PERCENT_READOUT, formatGoalProbability } from '../utils/displayFloors'
import { formatPercent } from '../../../utils/formatPercent'

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

// ─────────────────────────────────────────────────────────────────────────
// THE SUB-1% DISPLAY FLOOR (UI-SEM-057) — the gauge was the ONE goal surface
// that never got it.
//
// `OptionCards` ("< 1% likely to reach target"), the V7 goal lens and the
// analysis hero all route their goal readout through `SUB_ONE_PERCENT_FLOOR`
// + `formatPercent`, so a 0.4% probability renders "< 1%". The gauge printed
// `Math.round(clamp(v) * 100)%` directly, so the SAME number rendered a bare
// "0%" — a computed non-zero probability displayed as none at all, on the
// most prominent goal figure in the options block, beside a card that says
// "< 1%" about the identical value.
//
// RED-first: the "< 1%" assertions below fail on `48adda75` (they read "0%").
// The 100% row is a CONTROL, green before and after: it pins that the fix
// adopts the siblings' formatter and NOT some new ceiling rule the siblings
// do not have.
// ─────────────────────────────────────────────────────────────────────────
describe('WinGauge — the goal readout honours the shared sub-1% floor', () => {
  function sharesWithGoalValues(goalA: number, goalB: number): OptionWinShare[] {
    return [
      { id: 'a', label: 'Option A', winProbability: 0.7, isWinner: true, goalProbability: goalA },
      { id: 'b', label: 'Option B', winProbability: 0.3, isWinner: false, goalProbability: goalB },
    ]
  }

  it('renders a non-zero sub-1% goal probability as "< 1%", never a bare "0%"', () => {
    render(<WinGauge shares={sharesWithGoalValues(0.004, 0.5)} />)
    const cell = within(screen.getByTestId('win-gauge-goal-block')).getByTestId('goal-pct-a')
    expect(cell).toHaveTextContent(SUB_ONE_PERCENT_READOUT)
    expect(cell.textContent).not.toBe('0%')
  })

  it('uses the SAME floored formatter the sibling goal surfaces use', () => {
    render(<WinGauge shares={sharesWithGoalValues(0.004, 0.5)} />)
    const block = within(screen.getByTestId('win-gauge-goal-block'))
    expect(block.getByTestId('goal-pct-a').textContent).toBe(formatGoalProbability(0.004))
    expect(block.getByTestId('goal-pct-b').textContent).toBe(formatGoalProbability(0.5))
  })

  it('CONTROL — the top of the range is unchanged: no ceiling rule the siblings do not have', () => {
    render(<WinGauge shares={sharesWithGoalValues(0.995, 0.5)} />)
    const cell = within(screen.getByTestId('win-gauge-goal-block')).getByTestId('goal-pct-a')
    // The siblings' formatter: formatPercent(0.995, { fromDecimal: true }) === '100%'.
    expect(cell.textContent).toBe(formatPercent(0.995, { fromDecimal: true }))
    expect(cell.textContent).toBe('100%')
  })

  it('an exact zero takes the floor too — parity with the siblings, no carve-out only this surface has', () => {
    render(<WinGauge shares={sharesWithGoalValues(0, 0.5)} />)
    expect(
      within(screen.getByTestId('win-gauge-goal-block')).getByTestId('goal-pct-a'),
    ).toHaveTextContent(SUB_ONE_PERCENT_READOUT)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// THE WITHHELD-DESIGNATION SORT GATE (ROADMAP 1.267).
//
// The gauge already receives `designationsWithheld` and already honours it for
// the comparative segments — "no sort at all; `shares` already arrives in
// canonical order". The goal block, added by this PR, ranks unconditionally.
// Order IS a designation (`optionDisplayOrder`'s own header, ratified in row
// 1.306: "the G-UI-1 closure treated client-side ordering as benign when it is
// the designation channel"), and `sortOptionsForDisplay`'s second parameter is
// MANDATORY for exactly this reason. So on a withheld run the goal block put an
// option first — the designation channel — inside a figure whose every other
// ordering had just been de-designated.
//
// RED-first: fails on `48adda75`, where the withheld run still renders
// ['goal-row-b', 'goal-row-a'].
// ─────────────────────────────────────────────────────────────────────────
describe('WinGauge — the goal block does not re-designate on a withheld run', () => {
  const goalRowIds = () =>
    within(screen.getByTestId('win-gauge-goal-block'))
      .getAllByTestId(/^goal-row-/)
      .map((r) => r.getAttribute('data-testid'))

  it('withheld ⇒ goal rows are NOT ranked by goalProbability', () => {
    // Canonical order is [a, b]; the goal ranking would be [b, a] (0.8 > 0.2).
    render(<WinGauge shares={sharesWithGoal()} designationsWithheld />)
    expect(goalRowIds()).not.toEqual(['goal-row-b', 'goal-row-a'])
  })

  it('withheld ⇒ goal rows keep the display order the rest of the gauge uses', () => {
    render(<WinGauge shares={sharesWithGoal()} designationsWithheld />)
    expect(goalRowIds()).toEqual(['goal-row-a', 'goal-row-b'])
  })

  it('withheld withholds the CLAIM, never the DATA — both goal numbers still render', () => {
    render(<WinGauge shares={sharesWithGoal()} designationsWithheld />)
    const block = within(screen.getByTestId('win-gauge-goal-block'))
    expect(block.getByTestId('goal-pct-a')).toHaveTextContent('20%')
    expect(block.getByTestId('goal-pct-b')).toHaveTextContent('80%')
  })

  it('CONTROL — permitted runs are unchanged: still ranked by the goal number', () => {
    render(<WinGauge shares={sharesWithGoal()} designationsWithheld={false} />)
    expect(goalRowIds()).toEqual(['goal-row-b', 'goal-row-a'])
  })
})

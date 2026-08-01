/**
 * RESIDUAL COMPARATIVE SURFACES — OptionCards (ROADMAP 1.239, residual 2).
 *
 * #493 gated the OptionCards comparative sentences and stated, deliberately,
 * that two lines were left alone because "none designate a leader":
 *
 *   · runner-up: "If <factor> shifts, this option overtakes"
 *   · baseline:  "Lowest risk but lowest expected outcome"
 *
 * A1 has since ruled the class in scope, and the probe found both still
 * rendering on withheld runs (n=6 and n=2). They ARE comparative:
 *
 *   "overtakes" is a transitive verb with a suppressed object. There is
 *   nothing to overtake unless something is ahead — so the line asserts this
 *   option is behind, and (rendering on the runner-up while the front-runner's
 *   own sentence is correctly withheld) points at the silent card by
 *   elimination. That is A1's inverse-form leader claim exactly.
 *
 *   "lowest expected outcome" is a superlative over the option set: an
 *   ORDERING claim, and the producer withheld the ordering.
 *
 * MECHANISM. The probe traced it at the bytes in the minified `J3`: both
 * strings return BEFORE `if (hasLeadingOption === false) return ''`. The gate
 * exists and is simply unreachable for those branches. The fix is therefore
 * ORDERING — one gate hoisted above the branch table — not a new boolean
 * guard per line (the #491 lesson: a guard on an optional input has a
 * failure mode that ordering does not).
 *
 * Every withheld case has a PERMITTED twin. Over-suppression is an equal
 * failure.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { HingeInfo, OptionResult } from '../types'

vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

const WINNER_ID = 'opt_mac'
const RUNNER_UP_ID = 'opt_dell'
const BASELINE_ID = 'opt_status_quo'
const RUNNER_UP_LABEL = 'Standardise on Dell XPS'

/** The hinge whose `alternativeWinnerLabel` matches the runner-up card. */
const FRAGILE_HINGE: HingeInfo = {
  label: 'Customer churn',
  nodeId: 'factor_churn',
  kind: 'edge',
  reason: 'fragile_edge',
  edgeDetail: 'Customer churn → Revenue',
  alternativeWinnerLabel: RUNNER_UP_LABEL,
}

const WINNER = {
  id: WINNER_ID,
  label: 'Standardise on MacBook Pro',
  winProbability: 0.66,
  isRecommended: true,
  expected: 68,
  outcome: { mean: 68, p10: 54, p50: 67, p90: 82 },
}

const RUNNER_UP = {
  id: RUNNER_UP_ID,
  label: RUNNER_UP_LABEL,
  winProbability: 0.314,
  isRecommended: false,
  expected: 41,
  outcome: { mean: 41, p10: 30, p50: 40, p90: 52 },
}

const BASELINE = {
  id: BASELINE_ID,
  label: 'Status Quo',
  winProbability: 0.026,
  isRecommended: false,
  isBaseline: true,
  expected: 12,
  outcome: { mean: 12, p10: 8, p50: 12, p90: 17 },
}

// The component truncates to the top 2 cards (TOP_N), so each residual gets a
// two-option fixture that actually renders the card under test rather than one
// three-option fixture whose third card is collapsed behind "show more".
const RUNNER_UP_PAIR = [WINNER, RUNNER_UP] as unknown as OptionResult[]
const BASELINE_PAIR = [WINNER, BASELINE] as unknown as OptionResult[]

function renderRunnerUp(hasLeadingOption: boolean | undefined) {
  return render(
    <OptionCards
      options={RUNNER_UP_PAIR}
      winnerId={WINNER_ID}
      runnerId={RUNNER_UP_ID}
      hinge={FRAGILE_HINGE}
      decisionState={'sensitive' as never}
      hasLeadingOption={hasLeadingOption}
      onSendMessage={() => {}}
    />,
  )
}

function renderBaseline(hasLeadingOption: boolean | undefined) {
  // No `runnerId`: the baseline branch sits below the runner-up branch, so
  // naming it the runner-up would route it to different copy entirely.
  return render(
    <OptionCards
      options={BASELINE_PAIR}
      winnerId={WINNER_ID}
      decisionState={'sensitive' as never}
      hasLeadingOption={hasLeadingOption}
      onSendMessage={() => {}}
    />,
  )
}

describe('OptionCards — withheld turn (ROADMAP 1.239)', () => {
  it('withholds the runner-up overtake line', () => {
    const { container } = renderRunnerUp(false)
    expect(/this option overtakes/i.test(container.textContent ?? '')).toBe(false)
  })

  it('withholds the baseline superlative', () => {
    const { container } = renderBaseline(false)
    expect(/lowest risk but lowest expected outcome/i.test(container.textContent ?? '')).toBe(false)
  })

  it('still renders both options and their win probabilities — data is not a claim', () => {
    // Trap 13 positive control for both absence assertions above.
    renderRunnerUp(false)
    expect(screen.getByText('Standardise on MacBook Pro')).toBeDefined()
    expect(screen.getByText(RUNNER_UP_LABEL)).toBeDefined()
    expect(screen.getByTestId(`win-pct-${RUNNER_UP_ID}`).textContent).toMatch(/\d/)
  })

  it('the baseline card itself still renders — its suppression test is not vacuous', () => {
    renderBaseline(false)
    expect(screen.getByText('Status Quo')).toBeDefined()
    expect(screen.getByTestId(`win-pct-${BASELINE_ID}`).textContent).toMatch(/\d/)
  })
})

describe('OptionCards — permitted turn (over-suppression controls)', () => {
  it('keeps the runner-up overtake line', () => {
    const { container } = renderRunnerUp(true)
    expect(container.textContent ?? '').toMatch(/If Customer churn shifts, this option overtakes/i)
  })

  it('keeps the baseline superlative', () => {
    const { container } = renderBaseline(true)
    expect(container.textContent ?? '').toMatch(/Lowest risk but lowest expected outcome/i)
  })

  it('an ABSENT flag behaves exactly as a permitted one (legacy callers)', () => {
    // The same concession #493 pinned for the sentences it gated: the default
    // must not drift to silence and blank every legacy caller's cards.
    expect(renderRunnerUp(undefined).container.textContent ?? '').toMatch(/this option overtakes/i)
    expect(renderBaseline(undefined).container.textContent ?? '')
      .toMatch(/lowest risk but lowest expected outcome/i)
  })
})

describe('OptionCards — the lens carve-out survives (ROADMAP 1.239)', () => {
  it('WITHHELD: the crowned card still says it is strongest UNDER THIS LENS', () => {
    // The one branch that is exempt by construction, and the reason the gate
    // is hoisted to just BELOW it rather than to the top of the function: the
    // lens line is a per-view argmax over data on screen, not the producer's
    // designation. Gating it would be the over-suppression class this arc has
    // already had to fix once in DecisionNode.
    render(
      <OptionCards
        options={RUNNER_UP_PAIR}
        winnerId={WINNER_ID}
        runnerId={RUNNER_UP_ID}
        hinge={FRAGILE_HINGE}
        decisionState={'sensitive' as never}
        hasLeadingOption={false}
        lensActive
        lensHighlightedId={WINNER_ID}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByText(/Ahead on this outcome view/i)).toBeDefined()
  })
})

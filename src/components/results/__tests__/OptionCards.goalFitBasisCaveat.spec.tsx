/**
 * OptionCards — goal_fit_basis caveat rendering (ROADMAP 1.6b,
 * claim-integrity, shared-seam UI lane).
 *
 * Honesty rule (UI-BOUNDARY-DATA-INVENTORY.md §5): when
 * probability_of_joint_goal is shown and goal_fit_basis.scored_from
 * is 'modelled_outcome_distribution', the caveat MUST render adjacent
 * to the number — a bare number is false precision. The caveat must
 * NEVER appear for an option that doesn't carry the flag (no invention).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'option-a',
    label: 'Option A',
    expected: 50,
    outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
    p10: 20,
    p50: 50,
    p90: 80,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.42,
    rank: 1,
    ...overrides,
  }
}

describe('OptionCards — goal_fit_basis caveat', () => {
  it('renders the modelled-basis caveat adjacent to the goal-fit number when flagged', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', goalProbability: 0.42, goalFitIsModelledBasis: true }),
      makeOption({
        id: 'b',
        label: 'B',
        goalProbability: 0.3,
        goalFitIsModelledBasis: false,
        isRecommended: false,
      }),
    ]
    render(<OptionCards options={options} winnerId="a" hasGoalThreshold />)

    expect(screen.getByTestId('goal-fit-basis-caveat-a')).toBeTruthy()
    expect(screen.queryByTestId('goal-fit-basis-caveat-b')).toBeNull()
  })

  it('renders no caveat for any option when the flag is absent (honest default)', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', goalProbability: 0.42 }),
      makeOption({ id: 'b', label: 'B', goalProbability: 0.3, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" hasGoalThreshold />)

    expect(screen.queryByTestId('goal-fit-basis-caveat-a')).toBeNull()
    expect(screen.queryByTestId('goal-fit-basis-caveat-b')).toBeNull()
  })
})

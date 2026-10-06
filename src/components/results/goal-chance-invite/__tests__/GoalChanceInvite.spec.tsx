/**
 * D3 step 2 — the invitation's buttons write through the EXISTING goal-target door, as a PAIR (DL 0df0e1 #87 6006078553;
 * c6 6 Oct): "At least {target}" sends `at_least`, "At most {target}" sends `at_most`, each with the SAME stated figure and
 * unit. Nothing re-runs. The no-target invitation mounts the existing target door itself, for the goal CEE named.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const proposeGoalTarget = vi.fn((..._args: unknown[]) => 'dispatched' as const)
const authorityFor = vi.fn((_id: string | null) => ({ proposeGoalTarget }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({ useModelEditAuthority: (id: string | null) => authorityFor(id) }))
vi.mock('../../analysisNew/sections/SuccessTargetLine', () => ({
  SuccessTargetLine: ({ goalNodeId }: { goalNodeId: string | null }) => <div data-testid="existing-target-door" data-goal={goalNodeId} />,
}))

import { useCanvasStore } from '../../../../canvas/store'
import { GoalChanceInvite } from '../GoalChanceInvite'

beforeEach(() => {
  proposeGoalTarget.mockClear()
  authorityFor.mockClear()
  useCanvasStore.setState({ currentScenarioId: 'scn-1' } as never)
})
afterEach(() => cleanup())

const DIRECTION = { kind: 'state_goal_direction', goalNodeId: 'goal', value: 400, unit: 'tickets' } as const

describe('GoalChanceInvite', () => {
  it.each([
    ['goal-chance-invite-at-least', 'at_least'],
    ['goal-chance-invite-at-most', 'at_most'],
  ] as const)('%s writes %s with the SAME stated figure and unit, for the goal CEE named, through the target door', (testId, dir) => {
    render(<GoalChanceInvite invite={DIRECTION} goalLabel="Monthly cancellations" />)
    fireEvent.click(screen.getByTestId(testId))
    expect(authorityFor).toHaveBeenCalledWith('goal')
    expect(proposeGoalTarget).toHaveBeenCalledTimes(1)
    expect(proposeGoalTarget.mock.calls[0]!.slice(0, 4)).toEqual(['400', 'tickets', 'scn-1', dir])
  })

  it('renders c6\'s sentence and both buttons with the target as stated', () => {
    render(<GoalChanceInvite invite={DIRECTION} goalLabel={null} />)
    expect(screen.getByTestId('goal-chance-invite-text').textContent).toMatch(/at least 400 tickets or at most 400 tickets/)
    expect(screen.getByTestId('goal-chance-invite-at-least').textContent).toBe('At least 400 tickets')
    expect(screen.getByTestId('goal-chance-invite-at-most').textContent).toBe('At most 400 tickets')
  })

  it('NO TARGET: c6\'s sentence above the EXISTING target door, mounted for the goal CEE named', () => {
    render(<GoalChanceInvite invite={{ kind: 'state_goal_target', goalNodeId: 'goal' }} goalLabel="Monthly cancellations" />)
    expect(screen.getByTestId('goal-chance-invite-text').textContent)
      .toBe('Give ‘Monthly cancellations’ a target to see each option’s chance of meeting it.')
    expect(screen.getByTestId('existing-target-door').getAttribute('data-goal')).toBe('goal')
    expect(proposeGoalTarget).not.toHaveBeenCalled()
  })

  it('CONTROL: no invitation → nothing renders', () => {
    const { container } = render(<GoalChanceInvite invite={null} goalLabel="Monthly cancellations" />)
    expect(container.textContent).toBe('')
  })
})

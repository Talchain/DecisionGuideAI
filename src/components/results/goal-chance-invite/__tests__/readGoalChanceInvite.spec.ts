/**
 * D3 step 2 — the invitation is READ off CEE's own withhold record by `invite.kind`, never inferred (DL 0df0e1 #87
 * 6006078553; c6 6 Oct). Rows: each kind, the CONTROL with no invite, and records that disagree with themselves.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceInvite, GOAL_CHANCE_INVITE } from '../readGoalChanceInvite'

const DIRECTION = { code: 'GOAL_FIGURES_PROBABILITY_UNUSABLE', severity: 'warning', message: 'x', option_ids: ['a'],
  causes: [{ option_id: 'a', cause: 'no_stated_direction' }],
  invite: { kind: 'state_goal_direction', goal_node_id: 'goal', target: { value: 400, unit: 'tickets' } } }
const TARGET = { code: 'GOAL_FIGURES_NO_STATED_TARGET', severity: 'info', message: 'x', option_ids: ['a'], cause: 'no_stated_target',
  invite: { kind: 'state_goal_target', goal_node_id: 'goal' } }

describe('readGoalChanceInvite', () => {
  it('reads each kind by identity', () => {
    expect(readGoalChanceInvite([DIRECTION])).toEqual({ kind: 'state_goal_direction', goalNodeId: 'goal', value: 400, unit: 'tickets' })
    expect(readGoalChanceInvite([TARGET])).toEqual({ kind: 'state_goal_target', goalNodeId: 'goal' })
  })

  it('CONTROL: the same withhold with NO invite (e.g. ceiling_not_minimised) → nothing to offer', () => {
    const { invite: _i, ...bare } = DIRECTION
    expect(readGoalChanceInvite([{ ...bare, causes: [{ option_id: 'a', cause: 'ceiling_not_minimised' }] }])).toBeNull()
  })

  it('a record that disagrees with itself is not read (kind on the wrong code, no goal id, no unit, two invites)', () => {
    expect(readGoalChanceInvite([{ ...TARGET, invite: { ...DIRECTION.invite } }])).toBeNull()
    expect(readGoalChanceInvite([{ ...DIRECTION, invite: { ...DIRECTION.invite, goal_node_id: '' } }])).toBeNull()
    expect(readGoalChanceInvite([{ ...DIRECTION, invite: { ...DIRECTION.invite, target: { value: 400, unit: ' ' } } }])).toBeNull()
    expect(readGoalChanceInvite([DIRECTION, TARGET])).toBeNull()
  })

  it('c6\'s words (6 Oct): "chance of meeting", no contest word; no goal label → "your goal", unquoted', () => {
    expect(GOAL_CHANCE_INVITE.target('Monthly cancellations')).toBe('Give ‘Monthly cancellations’ a target to see each option’s chance of meeting it.')
    expect(GOAL_CHANCE_INVITE.target(null)).toBe('Give your goal a target to see each option’s chance of meeting it.')
    expect(GOAL_CHANCE_INVITE.direction('400 tickets')).toBe('Olumi can’t yet say how likely each option is to meet your goal: it doesn’t say '
      + 'whether you need at least 400 tickets or at most 400 tickets. Choose one and re-run, and Olumi can say.')
  })
})

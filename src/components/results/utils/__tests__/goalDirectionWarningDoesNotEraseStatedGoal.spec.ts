import { expect, it } from 'vitest'
import { humaniseCritique } from '../humaniseCritique'

const code = 'GOAL_DIRECTION_UNATTESTED'

it('a saved held-floor goal does not become "the model lacks a direction" when the Run omitted the separate wire sense', () => {
  // Selected current Run 6a56559f41cb7c8b: the brief said MRR at least £100,000.
  // The producer warning below accompanied this saved goal, not a bare goal.
  const savedGoal = { goal_direction: '>=', goal_threshold_raw: 100000, goal_horizon_months: 12 }
  expect(savedGoal.goal_direction).toBe('>=')
  const warning = {
    code,
    field: 'goal_direction',
    message: "No objective sense was stated for the goal node, so options were ranked by largest goal value. That is an assumption, not the team's stated aim: if the goal is a quantity to reduce, or the aim is to land near a target rather than as high as possible, this ranking answers a different question. Send goal_direction to rank against the stated objective.",
  }
  const copy = humaniseCritique(warning as never)
  const rendered = `${copy.title} ${copy.description}`
  expect(rendered).toMatch(/largest value/i)
  expect(rendered).not.toMatch(/model does not say|no objective sense was stated|nothing confirmed/i)
  expect(copy.displayText).not.toContain(warning.message)
  expect(copy.suggestion).toBeUndefined()
})

it('the bare-goal control still discloses the higher-is-better ranking assumption', () => {
  const copy = humaniseCritique({ code, message: '' } as never)
  expect(`${copy.title} ${copy.description}`).toMatch(/if no direction was stated.*as high as possible/i)
  expect(`${copy.title} ${copy.description}`).toMatch(/different question/i)
})

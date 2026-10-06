/**
 * D3 cut 5 (Codex r1 #2551 finding 4): the existence line has ONE home. Under the hero's chance lines when the hero's
 * goal-chance arm is open (`goalChanceHeroArmOpen`: a user target, goal figures not each a joint with limits); else under
 * the WinGauge goal rows, where the chances are then read. Never both, never neither.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { goalChanceExistenceLine, goalChanceHeroArmOpen, type GoalChanceLicence } from '../goalChanceLicence'
import { WinGauge } from '../../WinGauge'

const limits = { constraints: [{ id: 'c1' }] }
const LIC: GoalChanceLicence = { form: 'highest', optionIds: ['a', 'b'], pctByOption: { a: 50, b: 35 }, withheldOptionIds: [],
  similarOptionIds: [], leaderOptionId: 'a', nextOptionId: 'b', target: { comparator: 'at_least', value: 1, unit: '£' },
  userLinkExistence: { links: 2, oneIn: 5 } }
const LINE = 'These chances also count Olumi’s own assumption that each of your links might not hold (a 1-in-5 chance each).'

describe('the existence line\'s one home', () => {
  it('the hero\'s arm is open with a user target and no joint goal figures; closed with limits on every goal figure, or no target', () => {
    expect(goalChanceHeroArmOpen(20000, [{ goalProbability: 0.5 }, { goalProbability: 0.35 }])).toBe(true)
    expect(goalChanceHeroArmOpen(20000, [{ goalProbability: 0.5, constraintAnalysis: limits }, { goalProbability: 0.35, constraintAnalysis: limits }])).toBe(false)
    expect(goalChanceHeroArmOpen(null, [{ goalProbability: 0.5 }])).toBe(false)
  })

  it('the words are CEE\'s fraction; no record → none', () => {
    expect(goalChanceExistenceLine(LIC)).toBe(LINE)
    expect(goalChanceExistenceLine({ ...LIC, userLinkExistence: null })).toBeNull()
  })

  it('WinGauge says it under the goal rows when handed it (the hero\'s arm closed); otherwise nothing', () => {
    const goal = [{ id: 'a', label: 'Raise', goalProbability: 0.5 }, { id: 'b', label: 'Starter', goalProbability: 0.35 }]
    const { unmount } = render(<WinGauge shares={[]} goalShares={goal} goalChanceLicence={LIC} goalChanceDisclosure={LINE} />)
    expect(screen.getByTestId('win-gauge-goal-existence').textContent).toBe(LINE)
    unmount()
    render(<WinGauge shares={[]} goalShares={goal} goalChanceLicence={LIC} />)
    expect(screen.queryByTestId('win-gauge-goal-existence')).toBeNull()
  })
})

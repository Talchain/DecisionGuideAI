/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE WINGAUGE'S GOAL BLOCK STANDS ON ITS OWN (DL 0df0e1 #87 6006078553; Science d5
 * 6005640764; Wording c6 6 Oct).
 *
 *  · A withheld win share empties `shares` (the mapper drops every share); the goal block used to vanish with it
 *    (`shares.length === 0 → null`). Given every option's goal figure (`goalShares`), it now renders alone.
 *  · ORDER COUNTS AS A SUPERLATIVE: with CEE's licence the goal rows are ranked by chance ONLY under a `highest` form;
 *    under `each` they follow the model's option order (c6: never ranked below the 10-point licence).
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WinGauge, type GoalShare } from '../WinGauge'
import type { GoalChanceLicence } from '../utils/goalChanceLicence'

const GOAL: GoalShare[] = [
  { id: 'a', label: 'Keep £49', goalProbability: 0.41 },
  { id: 'b', label: 'Raise Pro to £59', goalProbability: 0.62 },
  { id: 'c', label: 'Two tiers', goalProbability: 0.2 },
]
const licence = (form: GoalChanceLicence['form']): GoalChanceLicence => ({
  form, optionIds: ['a', 'b', 'c'], pctByOption: { a: 41, b: 62, c: 20 }, withheldOptionIds: [], similarOptionIds: [],
  leaderOptionId: form === 'highest' ? 'b' : null, nextOptionId: form === 'highest' ? 'a' : null,
  target: { comparator: 'at_least', value: 20000, unit: '£' },
})
const rowOrder = () => screen.getAllByTestId(/^goal-row-/).map((el) => el.getAttribute('data-testid')!.replace('goal-row-', ''))

describe('D3 step 2 — the WinGauge goal block', () => {
  it('RENDERS with NO win shares (withheld) when every option\'s goal figure is given; no comparative block is drawn', () => {
    render(<WinGauge shares={[]} goalShares={GOAL} goalChanceLicence={licence('each')} />)
    expect(screen.getByTestId('win-gauge-goal-block')).toBeTruthy()
    expect(screen.queryByTestId('win-gauge-comparative-block')).toBeNull()
  })

  it('CONTROL: no shares and no goal source → nothing, exactly as before', () => {
    const { container } = render(<WinGauge shares={[]} />)
    expect(container.textContent).toBe('')
  })

  it('EACH: the goal rows follow the model\'s option order (a, b, c), never ranked by chance', () => {
    render(<WinGauge shares={[]} goalShares={GOAL} goalChanceLicence={licence('each')} />)
    expect(rowOrder()).toEqual(['a', 'b', 'c'])
  })

  it('HIGHEST: ranked by chance (b, a, c) — the order the licence grants', () => {
    render(<WinGauge shares={[]} goalShares={GOAL} goalChanceLicence={licence('highest')} />)
    expect(rowOrder()).toEqual(['b', 'a', 'c'])
  })
})

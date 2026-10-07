import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { focusEdgeByEndpoints } from '../../../../canvas/utils/focusHelpers'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { GoalChanceRangeLines } from '../GoalChanceRangeLines'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusEdgeByEndpoints: vi.fn(), focusByTarget: vi.fn(),
}))

const LABELS: Record<string, string> = { starter: 'Starter tier', raise: 'Raise prices', price: 'Price', revenue: 'Revenue' }
const labelOf = (id: string) => LABELS[id] ?? null
const ENTRY = {
  low_pct: 23, high_pct: 90, low_rounding: 'whole', high_rounding: 'nearest_5',
  kind: 'link_strength', from: 'price', to: 'revenue', among: 'all',
}
const HORIZON = 'This model doesn’t yet say whether any option gets there within 9 months.'
function range(entry: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) {
  return readGoalChanceRange([{
    code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range',
    option_ids: ['starter'], range_by_option: { starter: { ...ENTRY, ...entry } }, ...fields,
  }])
}

describe('goal-chance range lines: exact CEE-selected words and actions', () => {
  it.each([
    ['link_strength', 'all', 'It depends most on how strongly ‘Price’ affects ‘Revenue’, which isn’t sized in the model yet.', 'Size it to see where it lands'],
    ['link_existence', 'all', 'It depends most on whether ‘Price’ affects ‘Revenue’ at all, which Olumi assumed.', 'Confirm or remove it to see where it lands'],
    ['link_strength', 'unsized_links', 'Of the links not sized yet, it depends most on how strongly ‘Price’ affects ‘Revenue’, which isn’t sized in the model yet.', 'Size it to see where it lands'],
    ['link_existence', 'unsized_links', 'Of the links not sized yet, it depends most on whether ‘Price’ affects ‘Revenue’ at all, which Olumi assumed.', 'Confirm or remove it to see where it lands'],
  ])('%s / %s says the exact line and focuses the record’s endpoints', (kind, among, rest, action) => {
    render(<GoalChanceRangeLines range={range({ kind, among })} labelOf={labelOf} />)
    expect(screen.getByTestId('goal-chance-range-line').textContent).toBe(
      `‘Starter tier’: between about 23% and 90% chance of meeting your goal, in this model. ${rest} ${action}`,
    )
    fireEvent.click(screen.getByRole('button', { name: `Focus on ${action} in model` }))
    expect(focusEdgeByEndpoints).toHaveBeenCalledTimes(1)
    expect(focusEdgeByEndpoints).toHaveBeenCalledWith('price', 'revenue', 'price')
  })

  it('keeps option_ids order, including a later option with a lower low_pct, regardless of map insertion order', () => {
    render(<GoalChanceRangeLines range={range({}, {
      option_ids: ['starter', 'raise'], range_by_option: {
        raise: { ...ENTRY, low_pct: 5, high_pct: 30 }, starter: ENTRY,
      },
    })} labelOf={labelOf} />)
    expect(screen.getAllByTestId('goal-chance-range-line').map((line) => line.getAttribute('data-option-id')))
      .toEqual(['starter', 'raise'])
  })

  it.each(['starter', 'price', 'revenue'])('omits the whole option line and action when %s has no label', (missing) => {
    const { container } = render(<GoalChanceRangeLines range={range()} labelOf={(id) => id === missing ? null : labelOf(id)} />)
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('omits blank labels and still renders a valid sibling', () => {
    render(<GoalChanceRangeLines range={range({}, {
      option_ids: ['starter', 'raise'], range_by_option: { starter: ENTRY, raise: ENTRY },
    })} labelOf={(id) => id === 'starter' ? ' ' : labelOf(id)} />)
    expect(screen.getAllByTestId('goal-chance-range-line').map((line) => line.getAttribute('data-option-id'))).toEqual(['raise'])
  })

  it('uses the existing extreme-percentage words instead of claiming impossibility or certainty', () => {
    render(<GoalChanceRangeLines range={range({ low_pct: 0, high_pct: 100 })} labelOf={labelOf} />)
    expect(screen.getByTestId('goal-chance-range-line').textContent)
      .toContain('between less than 1% and more than 99% chance of meeting your goal')
  })

  it('renders nothing for a null reader result', () => {
    const { container } = render(<GoalChanceRangeLines range={readGoalChanceRange([])} labelOf={labelOf} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the record’s deadline verbatim once, directly after all range lines', () => {
    render(<GoalChanceRangeLines range={range({}, {
      option_ids: ['starter', 'raise'], range_by_option: { starter: ENTRY, raise: ENTRY },
      horizon_untested: true, horizon_line: HORIZON,
    })} labelOf={labelOf} />)
    const parent = screen.getByTestId('goal-chance-range-lines')
    expect(parent.textContent?.split(HORIZON)).toHaveLength(2)
    expect(parent.lastElementChild).toBe(screen.getByTestId('goal-chance-range-horizon'))
  })

  it('does not repeat the deadline when the hero already said it', () => {
    render(<GoalChanceRangeLines range={range({}, { horizon_untested: true, horizon_line: HORIZON })}
      labelOf={labelOf} heroHorizonShown />)
    expect(screen.queryByTestId('goal-chance-range-horizon')).toBeNull()
    expect(screen.getByTestId('goal-chance-range-line')).toBeTruthy()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { DEFAULT_EDGE_DATA } from '../../../../canvas/domain/edges'
import { focusEdgeByEndpoints } from '../../../../canvas/utils/focusHelpers'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { GoalChanceRangeLines } from '../GoalChanceRangeLines'

// Canvas D1's own pattern (`openLinkInspector.spec.tsx`): the REAL opener and store; only camera moves are observed.
vi.mock('../../../../canvas/utils/focusHelpers', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../canvas/utils/focusHelpers')>()),
  focusEdgeById: vi.fn(), focusNodeById: vi.fn(), focusEdgeByEndpoints: vi.fn(), focusByTarget: vi.fn(),
}))

const EDGE = { id: 'e_price_revenue', source: 'price', target: 'revenue', data: { ...DEFAULT_EDGE_DATA } }
const NODES = [
  { id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
  { id: 'revenue', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'Revenue' } },
]
function seed(edges: unknown[] = [EDGE]) {
  useCanvasStore.setState({
    nodes: NODES as never, edges: edges as never, showResultsPanel: true,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
}
function clickWitnessed(name: string) {
  const seen = vi.fn()
  window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, seen)
  try { fireEvent.click(screen.getByRole('button', { name })) } finally { window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, seen) }
  return seen
}
beforeEach(() => { vi.clearAllMocks(); seed() })

/**
 * #2747 re-scope 2 (U2): each line is CEE's served face for the option's range cell, verbatim (`RunView.servedCellOf`),
 * followed by the link's action; the component composes no chance words of its own. These faces are SELF-AUTHORED
 * stand-ins in CEE's words; the bounds, link and dependence are CEE's to say.
 */
const FACES: Record<string, string> = {
  starter: '‘Starter tier’: between about 23% and 90% chance of meeting your goal, in this model.',
  raise: '‘Raise prices’: between about 5% and 30% chance of meeting your goal, in this model.',
}
const faceOf = (id: string) => FACES[id] ?? null
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

describe('goal-chance range lines: CEE\'s served face, verbatim, and the link\'s action', () => {
  it.each([
    ['link_strength', 'all', 'Size it to see where it lands'],
    ['link_existence', 'all', 'Confirm or remove it to see where it lands'],
    ['link_strength', 'unsized_links', 'Size it to see where it lands'],
    ['link_existence', 'unsized_links', 'Confirm or remove it to see where it lands'],
  ])('%s / %s says the served face then the action; ONE click opens that link’s inspector', (kind, among, action) => {
    render(<GoalChanceRangeLines range={range({ kind, among })} faceOf={faceOf} />)
    expect(screen.getByTestId('goal-chance-range-line').textContent).toBe(`${FACES.starter} ${action}`)
    // Nothing of the UI's own: the bounds are never worded from the record, nor the link's dependence.
    expect(screen.getByTestId('goal-chance-range-line').textContent).not.toMatch(/depends most on/)
    // RED at 24830cc4: the click only focused the link (no inspector event, dock left open).
    const seen = clickWitnessed(`Focus on ${action} in model`)
    expect(seen).toHaveBeenCalledTimes(1)
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e_price_revenue'])
    expect(useCanvasStore.getState().showResultsPanel).toBe(false)
    expect(focusEdgeByEndpoints).not.toHaveBeenCalled()
  })

  it.each([
    ['absent', []],
    ['stale (reversed endpoints)', [{ ...EDGE, source: 'revenue', target: 'price' }]],
  ])('CONTRAST: an %s link opens no inspector and keeps the dock; GraphLink only focuses', (_name, edges) => {
    seed(edges)
    render(<GoalChanceRangeLines range={range()} faceOf={faceOf} />)
    const seen = clickWitnessed('Focus on Size it to see where it lands in model')
    expect(seen).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().selection.edgeIds.size).toBe(0)
    expect(useCanvasStore.getState().showResultsPanel).toBe(true)
    expect(focusEdgeByEndpoints).toHaveBeenCalledWith('price', 'revenue', 'price')
  })

  it('keeps option_ids order, including a later option with a lower low_pct, regardless of map insertion order', () => {
    render(<GoalChanceRangeLines range={range({}, {
      option_ids: ['starter', 'raise'], range_by_option: {
        raise: { ...ENTRY, low_pct: 5, high_pct: 30 }, starter: ENTRY,
      },
    })} faceOf={faceOf} />)
    expect(screen.getAllByTestId('goal-chance-range-line').map((line) => line.getAttribute('data-option-id')))
      .toEqual(['starter', 'raise'])
  })

  it('omits the whole option line and its action when CEE served no face for it', () => {
    const { container } = render(<GoalChanceRangeLines range={range()} faceOf={() => null} />)
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('a line with no served face is left out and a sibling with one still renders', () => {
    render(<GoalChanceRangeLines range={range({}, {
      option_ids: ['starter', 'raise'], range_by_option: { starter: ENTRY, raise: ENTRY },
    })} faceOf={(id) => id === 'starter' ? null : faceOf(id)} />)
    expect(screen.getAllByTestId('goal-chance-range-line').map((line) => line.getAttribute('data-option-id'))).toEqual(['raise'])
  })

  // #2747 re-scope 2 (U2): the extreme words (less than 1% / more than 99%) are CEE's, inside its served face.

  it('renders nothing for a null reader result', () => {
    const { container } = render(<GoalChanceRangeLines range={readGoalChanceRange([])} faceOf={faceOf} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the record’s deadline verbatim once, directly after all range lines', () => {
    render(<GoalChanceRangeLines range={range({}, {
      option_ids: ['starter', 'raise'], range_by_option: { starter: ENTRY, raise: ENTRY },
      horizon_untested: true, horizon_line: HORIZON,
    })} faceOf={faceOf} />)
    const parent = screen.getByTestId('goal-chance-range-lines')
    expect(parent.textContent?.split(HORIZON)).toHaveLength(2)
    expect(parent.lastElementChild).toBe(screen.getByTestId('goal-chance-range-horizon'))
  })

  it('does not repeat the deadline when the hero already said it', () => {
    render(<GoalChanceRangeLines range={range({}, { horizon_untested: true, horizon_line: HORIZON })}
      faceOf={faceOf} heroHorizonShown />)
    expect(screen.queryByTestId('goal-chance-range-horizon')).toBeNull()
    expect(screen.getByTestId('goal-chance-range-line')).toBeTruthy()
  })
})

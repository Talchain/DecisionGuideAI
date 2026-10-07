/**
 * P02 (7 Oct): the pre-mortem worksheet is complete. Fixtures are CEE #2773's own v2 worksheets, built from the
 * captured A2-ELIG draw 2 (elig-3, staging d738949, req 3be98169): see `fixtures/premortem-elig3-v2.json`.
 */
import { describe, it, afterEach, beforeEach } from 'vitest'
import assert from 'node:assert/strict'
import elig3 from '../../../../v5/__tests__/fixtures/premortem-elig3-v2.json'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PreMortemWorksheet } from '../sections/PreMortemWorksheet'
import { useCanvasStore } from '../../../../canvas/store'
import { readPremortemWorksheet, storePremortemWorksheet, type PremortemWorksheetV1 } from '../../../../v5/readPremortemWorksheet'
import { ACTIONS_MENU } from '../../../../canvas/components/pre-analysis-v3/constants'
import { QUESTIONS } from '../../../../canvas/conversation/askAiQuestions'

const FIX = elig3 as unknown as {
  existing_risk: PremortemWorksheetV1; server_built: PremortemWorksheetV1
}
const NODES = [
  ['raise_prices_10', 'option', 'Raise prices 10%'], ['launch_starter_tier', 'option', 'Launch starter tier'],
  ['keep_pricing_as_it_is', 'option', 'Keep pricing as it is'], ['price_rise_from_current_price', 'factor', 'Price rise from current price'],
  ['starter_tier_launched', 'factor', 'Starter tier launched'], ['customers_lost_from_price_rise', 'risk', 'Customers lost from price rise'],
  ['monthly_recurring_revenue', 'goal', 'monthly recurring revenue'],
].map(([id, type, label]) => ({ id, type, position: { x: 0, y: 0 }, data: { label } }))
const runOf = (w: PremortemWorksheetV1) => ({ scenarioId: w.scenario_id, graphHashAtRun: w.run.graph_hash_at_run, computedAt: w.run.computed_at })
const base = (w: PremortemWorksheetV1) => ({
  currentScenarioId: w.scenario_id, analysisFreshnessDirty: false, lastServerGraphHash: w.run.graph_hash_at_run, nodes: NODES, edges: [],
  analysisStateV1: { run_state: { kind: 'complete_current', computed_at: w.run.computed_at } } as never,
})
const seed = (w: PremortemWorksheetV1) => useCanvasStore.setState({ ...base(w),
  runMeta: { premortemWorksheet: readPremortemWorksheet({ _premortem_worksheet: w }), premortemRun: runOf(w) } })
const open = (view: ReturnType<typeof render>) => fireEvent.click(view.getByTestId('premortem-worksheet-toggle'))
beforeEach(() => { try { localStorage.clear() } catch { /* none */ } })
afterEach(cleanup)

describe('P02 DGAI rows', () => {
  it('the CEE v2 fixtures parse', () => {
    assert.equal(readPremortemWorksheet({ _premortem_worksheet: FIX.existing_risk }).status, 'available')
    assert.equal(readPremortemWorksheet({ _premortem_worksheet: FIX.server_built }).status, 'available')
  })
  it('ROW 1: a story on an existing risk shows "Already on your map" with Inspect, and no Add; a new risk keeps Add', () => {
    seed(FIX.existing_risk); const view = render(<PreMortemWorksheet />); open(view)
    const [row1, row2] = FIX.existing_risk.rows
    const el1 = view.container.querySelector(`[data-row-id="${row1.row_id}"]`)!
    const el2 = view.container.querySelector(`[data-row-id="${row2.row_id}"]`)!
    assert.match(el1.textContent ?? '', /Already on your map: Inspect ‘Customers lost from price rise’/u)
    assert.doesNotMatch(el1.textContent ?? '', /Add this as a risk/u)
    assert.match(el2.textContent ?? '', /Add this as a risk/u)
    fireEvent.click(view.getByRole('button', { name: 'Inspect ‘Customers lost from price rise’' }))
    assert.deepEqual([...useCanvasStore.getState().selection.nodeIds], ['customers_lost_from_price_rise'])
  })
  it('ROW 2: every row shows its Mitigate line, byte for byte', () => {
    seed(FIX.existing_risk); const view = render(<PreMortemWorksheet />); open(view)
    assert.deepEqual(view.getAllByTestId('premortem-mitigation').map(el => el.textContent), FIX.existing_risk.rows.map(r => `Mitigate: ${r.mitigation}`))
  })
  it('a server-built row is labelled as Olumi’s starting point and offers no Add', () => {
    seed(FIX.server_built); const view = render(<PreMortemWorksheet />); open(view)
    const el = view.container.querySelector(`[data-row-id="${FIX.server_built.rows[0].row_id}"]`)!
    assert.match(el.textContent ?? '', /Olumi’s starting point: for you to challenge/u)
    assert.doesNotMatch(el.textContent ?? '', /Add this as a risk/u)
  })
  it('ROW 3: after a reload the worksheet re-renders for the same Run with no turn sent; another Run gets none', () => {
    storePremortemWorksheet(FIX.existing_risk)
    let fetches = 0
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => { fetches += 1; throw new Error('no network') }) as typeof fetch
    try {
      useCanvasStore.setState({ ...base(FIX.existing_risk), runMeta: {} })
      const view = render(<PreMortemWorksheet />); open(view)
      assert.ok(view.getByText(FIX.existing_risk.rows[0].failure_way))
      assert.equal(fetches, 0)
      cleanup()
      // CONTROL: a different Run (new computed_at) never restores the old worksheet.
      useCanvasStore.setState({ ...base(FIX.existing_risk), runMeta: {},
        analysisStateV1: { run_state: { kind: 'complete_current', computed_at: '2030-01-01T00:00:00.000Z' } } as never })
      const other = render(<PreMortemWorksheet />)
      assert.equal(other.queryByTestId('premortem-worksheet-toggle'), null)
    } finally { globalThis.fetch = realFetch }
  })
  it('ROW 4: no pre-mortem prompt assumes "a year from now"', () => {
    const method = (ACTIONS_MENU as readonly { id: string; prompt?: string }[]).find(m => m.id === 'pre_mortem')!
    assert.doesNotMatch(method.prompt ?? '', /a year/u)
    const ask = QUESTIONS['pre-mortem']({ stage: 'ran-current' } as never)
    assert.doesNotMatch(ask, /a year/u)
  })
})

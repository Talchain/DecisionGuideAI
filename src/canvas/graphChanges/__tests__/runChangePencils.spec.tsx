/**
 * Vision spec §3 (PR G): "Since the last run" is a pencil on each changed card, and its one summary opens beside the
 * pencil. Rows bound by identity (row ids → card ids, the summary's own test ids), every expected string spelled inline.
 *   G1  a node row marks its own card; a link row marks the link's TARGET card, saying so; a row with nothing drawn
 *       marks no card.
 *   G2  with a pencil drawn, there is no strip: the summary opens as one popover beside the pressed pencil and holds
 *       every row, Why, Still uncertain and Open in Compare; Escape closes it.
 *   G3  CONTRAST: with no pencil drawn, the strip is unchanged.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { RunDeltaSchema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { RunChangesSummary } from '../../components/RunChangesSummary'
import { pencilLinesByCard, useRunChangePencilStore } from '../RunChangePencilLayer'
import { displayedRunDeltaView, nodeLabelMap } from '../../../components/results/analysisNew/displayedRunDeltaView'

const NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Keep pricing' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Raise price' } },
  { id: 'fac_churn', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly churn' } },
  { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
  { id: 'out_rev', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
]
const EDGES = [{ id: 'e_price_rev', source: 'fac_price', target: 'out_rev' }]

const value = (id: string, label: string, before: number, after: number) => ({
  entity_kind: 'factor_value', entity_id: id, field: 'value',
  label_before: label, label_after: label, before: { raw: before, unit: '%' }, after: { raw: after, unit: '%' }, change: 'changed',
})
const link = (from: string, to: string) => ({
  entity_kind: 'link', entity_id: `${from}->${to}`, link: { from, to },
  field: 'sizing', before: { raw: 'placeholder' }, after: { raw: 'olumi_accepted' }, change: 'changed',
})

function seed(changes: unknown[]): void {
  const d = {
    attribution_case: 'C2_unpaired',
    pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'unknown', n_equal: true },
    leader: { changed: false, noise_verdict: 'not_noise_qualified' },
    win_probabilities: [
      { option_id: 'opt_a', prior: 0.41, current: 0.43, noise_verdict: 'within_noise' },
      { option_id: 'opt_b', prior: 0.59, current: 0.57, noise_verdict: 'within_noise' },
    ],
    flip_thresholds: [],
    endpoints: { prior: { run_id: 'run-a', computed_at: '2026-10-01T13:02:00.000Z' }, current: { run_id: 'run-b', computed_at: '2026-10-01T13:09:00.000Z' } },
    input_coverage: 'complete',
    input_changes: changes,
  }
  const parsed = RunDeltaSchema.safeParse(d)
  expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true)
  useCanvasStore.setState({
    runDelta: { delta: d as unknown as RunDelta, analysisHash: 'hash-A', scenarioId: 'scn-1' },
    currentScenarioId: 'scn-1',
    nodes: NODES,
    edges: EDGES,
    results: { status: 'complete', hash: 'hash-A', report: {} },
  } as never)
}

function rows() {
  const s = useCanvasStore.getState()
  const v = displayedRunDeltaView(s.runDelta, 'hash-A', 'scn-1', nodeLabelMap(s.nodes))
  expect(v?.inputs?.rows.length, 'the reader must hold rows for the seeded pair').toBeGreaterThan(0)
  return v!.inputs!.rows
}

afterEach(() => {
  cleanup()
  useRunChangePencilStore.setState({ drawn: 0, anchor: null })
})

describe('G1 · which card carries the pencil', () => {
  it('a node row marks its own card; a link row marks the link\'s target card; nothing drawn marks nothing', () => {
    seed([value('fac_churn', 'Monthly churn', 7, 12), link('fac_price', 'out_rev'), value('fac_gone', 'Gone factor', 1, 2)])
    const byCard = pencilLinesByCard(rows(), EDGES)
    expect([...byCard.keys()].sort()).toEqual(['fac_churn', 'out_rev'])
    expect(byCard.get('fac_churn')).toEqual(['Monthly churn: 7% → 12%'])
    expect(byCard.get('out_rev')?.[0]).toMatch(/^A link into this changed: /)
    expect(byCard.has('fac_price')).toBe(false)
  })
})

describe('G2 · a pencil opens the one summary beside it; no strip', () => {
  it('holds every row, Why, Still uncertain and Open in Compare, and closes on Escape', () => {
    seed([value('fac_churn', 'Monthly churn', 7, 12), value('fac_price', 'Price', 10, 15)])
    act(() => { useRunChangePencilStore.setState({ drawn: 2, anchor: null }) })
    const { rerender } = render(<RunChangesSummary />)
    expect(screen.queryByTestId('run-changes-summary'), 'no strip while pencils carry the change').toBeNull()
    act(() => { useRunChangePencilStore.getState().open({ left: 100, top: 100, bottom: 120 }) })
    rerender(<RunChangesSummary />)
    const pop = screen.getByTestId('run-changes-summary')
    expect(pop).toHaveAttribute('data-where', 'card')
    expect(pop.parentElement).toBe(document.body)
    expect(screen.queryByTestId('run-changes-summary-line')).toBeNull()
    expect(screen.getByTestId('run-changes-summary-changed')).toHaveTextContent('Monthly churn: 7% → 12%')
    expect(screen.getByTestId('run-changes-summary-changed')).toHaveTextContent('Price: 10% → 15%')
    expect(screen.getByTestId('run-changes-summary-why')).toBeInTheDocument()
    expect(screen.getByTestId('run-changes-summary-uncertain')).toBeInTheDocument()
    expect(screen.getByTestId('run-changes-summary-open-compare')).toHaveTextContent('Open in Compare')
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })
    expect(screen.queryByTestId('run-changes-summary')).toBeNull()
    expect(useRunChangePencilStore.getState().anchor).toBeNull()
  })
})

describe('G3 · CONTRAST: no pencil drawn → the strip, as before', () => {
  it('renders the pill line in place, not a popover', () => {
    seed([value('fac_churn', 'Monthly churn', 7, 12)])
    render(<RunChangesSummary />)
    expect(screen.getByTestId('run-changes-summary')).not.toHaveAttribute('data-where')
    expect(screen.getByTestId('run-changes-summary-line')).toHaveTextContent('Monthly churn: 7% → 12%')
  })
})

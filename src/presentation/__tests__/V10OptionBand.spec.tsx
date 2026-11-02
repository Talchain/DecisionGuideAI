import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { MemoryRouter } from 'react-router-dom'
import { OptionNode } from '../../canvas/nodes/OptionNode'
import { OptionChanceCellProvider } from '../../canvas/nodes/shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../canvas/store'
import { useResultsSectionData } from '../../components/results/useResultsSectionData'
import { SCORED, seedPaulRun, resetPaulRun } from '../../components/results/__tests__/helpers/paulRun4276f3f9'
import { useCanonicalAnalysisViewStore } from '../../canvas/stores/canonicalAnalysisViewStore'
import { canonicalTestCellsOf } from '../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { PresentationProvider } from '../v10'
import { buildV10OptionBands } from '../V10OptionBand'

const userUnits = vi.hoisted(() => ({ on: false }))
vi.mock('../../components/results/analysisNew/goalBandUnits', () => ({ goalBandIsInUserUnits: () => userUnits.on }))
vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))

afterEach(() => { cleanup(); resetPaulRun(); userUnits.on = false; useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })

/** CEE's served chance cell for every scored option (the headline), seeded as OptionNode.chanceHeadline.spec does. */
function seedServedChance() {
  seedPaulRun(null)
  const state = useCanvasStore.getState()
  const source = state.results.report as unknown as Record<string, unknown>
  const ids = SCORED.map((o) => o.id)
  const licence = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each', option_ids: ids,
    pct_by_option: Object.fromEntries(ids.map((id) => [id, 41])), withheld_option_ids: [],
    target: { comparator: 'at_least', value: 1200000, unit: '£' },
  }
  useCanvasStore.setState({
    results: { ...state.results, report: { ...source, run_id: 'canonical-chance-fixture', inference_warnings: [...((source.inference_warnings ?? []) as unknown[]), licence] } },
    ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
    goalThreshold: 1200000,
  } as never)
  const projection = renderHook(() => useResultsSectionData())
  const canonical = canonicalTestCellsOf(projection.result.current, { run_id: 'canonical-chance-fixture', graph_hash_at_run: null, computed_at: null })
  projection.unmount()
  useCanonicalAnalysisViewStore.getState().adopt(state.currentScenarioId!, canonical)
}

function card(id: string, presentation: 'v10' | 'current' | null) {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === id)!
  const node = (
    <ReactFlowProvider><OptionChanceCellProvider><OptionNode id={id} type="option" data={n.data as never}
      selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable /></OptionChanceCellProvider></ReactFlowProvider>
  )
  return render(presentation === null ? node : <MemoryRouter><PresentationProvider value={presentation}>{node}</PresentationProvider></MemoryRouter>)
}

/** The Analysis tab's own rows for the seeded run: the band must be drawn from these, never from anything else. */
function analysisRows() {
  const rows = renderHook(() => useResultsSectionData()).result.current.recommendation.allOptions
  return rows.filter((o) => typeof o.outcome?.p10 === 'number' && typeof o.outcome?.p90 === 'number')
}
const pct = (el: HTMLElement, prop: 'left' | 'width') => parseFloat(el.style[prop])

describe('v10 option card: the outcome band', () => {
  it('draws one slim band per option on ONE shared axis, from the Analysis tab\'s own ranges', () => {
    seedServedChance()
    const rows = analysisRows()
    expect(rows.length, 'the run has several scored options').toBeGreaterThan(1)
    // The axis, spelt out by hand from the rows' own p10 and p90.
    const min = Math.min(...rows.map((o) => o.outcome.p10 as number))
    const max = Math.max(...rows.map((o) => o.outcome.p90 as number))
    const lefts: number[] = []
    for (const o of rows) {
      const { unmount } = card(o.id, 'v10')
      const range = screen.getByTestId(`v10-option-band-range-${o.id}`)
      expect(pct(range, 'left')).toBeCloseTo((((o.outcome.p10 as number) - min) / (max - min)) * 100, 6)
      expect(pct(range, 'width')).toBeCloseTo((((o.outcome.p90 as number) - (o.outcome.p10 as number)) / (max - min)) * 100, 6)
      expect(pct(screen.getByTestId(`v10-option-band-median-${o.id}`), 'left')).toBeCloseTo((((o.outcome.p50 as number) - min) / (max - min)) * 100, 6)
      // This run's band is a model level, not the person's unit: direction only, no figures, no aim line, and the
      // tooltip says the plain sentence without inventing numbers.
      expect(screen.getByTestId(`v10-option-band-low-${o.id}`).textContent).toBe('Lower')
      expect(screen.getByTestId(`v10-option-band-high-${o.id}`).textContent).toBe('Higher')
      expect(screen.queryByTestId(`v10-option-band-aim-${o.id}`)).toBeNull()
      expect(screen.getByTestId(`v10-option-band-${o.id}`).getAttribute('aria-label')).toBe('8 runs in 10 land inside this range, in this model.')
      // The chance headline is still there, and the band comes after it in the card.
      const headline = screen.getByTestId(`option-share-slot-${o.id}`)
      expect(screen.getByTestId(`option-win-readout-${o.id}`).textContent).not.toBe('')
      expect(headline.compareDocumentPosition(screen.getByTestId(`v10-option-band-${o.id}`)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      lefts.push(pct(range, 'left'))
      unmount()
    }
    // Shared axis, not one axis per card: the cards do not all start at the same place.
    expect(new Set(lefts.map((l) => l.toFixed(3))).size).toBeGreaterThan(1)
    // And exactly one end of the axis is reached by the lowest p10, the other by the highest p90.
    expect(Math.min(...lefts)).toBeCloseTo(0, 6)
  })

  it('draws nothing in the current presentation, with or without the provider (#/canvas is unchanged)', () => {
    seedServedChance()
    const id = analysisRows()[0].id
    for (const presentation of [null, 'current'] as const) {
      const { container, unmount } = card(id, presentation)
      expect(container.querySelector('[data-testid^="v10-option-band"]'), String(presentation)).toBeNull()
      // CONTROL: the same card and run do draw its headline, so the silence above is the gate, not a missing fixture.
      expect(screen.getByTestId(`option-win-readout-${id}`)).toBeTruthy()
      unmount()
    }
    const { container } = card(id, 'v10')
    expect(container.querySelector('[data-testid^="v10-option-band"]')).not.toBeNull()
  })

  it('keeps today\'s card, never blank, for an option with no range', () => {
    seedServedChance()
    // The run scored this option but served it no p10/p90: the band shows nothing new.
    const ids = SCORED.map((o) => o.id)
    const state = useCanvasStore.getState()
    const report = state.results.report as unknown as { option_probabilities: Record<string, Record<string, unknown>> }
    useCanvasStore.setState({ results: { ...state.results, report: { ...report, option_probabilities: Object.fromEntries(
      Object.entries(report.option_probabilities).map(([k, v]) => [k, k === ids[0] ? { ...v, outcome: { mean: null, p10: null, p50: null, p90: null }, bands: undefined } : v])) } } } as never)
    card(ids[0], 'v10')
    expect(screen.queryByTestId(`v10-option-band-${ids[0]}`)).toBeNull()
    expect(screen.getByTestId(`option-win-readout-${ids[0]}`).textContent).not.toBe('')
  })
})

describe('buildV10OptionBands: figures, unit and aim only where the band is in the person\'s units', () => {
  const rec = {
    allOptions: [
      { id: 'a', outcome: { mean: 4400, p10: 4100, p50: 4400, p90: 4700 } },
      { id: 'b', outcome: { mean: 5000, p10: 4500, p50: 5000, p90: 5500 } },
      { id: 'c', outcome: { mean: null, p10: null, p50: null, p90: null } },
    ],
    outcomeUnit: 'currency', outcomeUnitSymbol: '£', isNormalised: false, goalThreshold: 6000,
  } as never

  it('switch on: £ figures at the ends, the sentence names them, the aim is a line on the same axis', () => {
    userUnits.on = true
    const of = buildV10OptionBands(rec)
    const a = of('a')!
    const b = of('b')!
    // Axis reaches the aim (6000) because both ranges fall short of it: 4100 .. 6000.
    expect(a.lowLabel).toBe('£4,100')
    expect(a.highLabel).toBe('£4,700')
    expect(a.sentence).toBe('8 runs in 10 land between £4,100 and £4,700, in this model.')
    expect(a.leftPct).toBeCloseTo(0, 6)
    expect(a.widthPct).toBeCloseTo((600 / 1900) * 100, 6)
    expect(a.medianPct).toBeCloseTo((300 / 1900) * 100, 6)
    expect(a.aimPct).toBeCloseTo(100, 6)
    expect(b.leftPct).toBeCloseTo((400 / 1900) * 100, 6)
    expect(of('c')).toBeNull()
  })

  it('switch off (every run today): direction only, no aim, no figures', () => {
    userUnits.on = false
    const a = buildV10OptionBands(rec)('a')!
    expect([a.lowLabel, a.highLabel, a.aimPct]).toEqual(['Lower', 'Higher', null])
    expect(a.sentence).not.toMatch(/£|4,/)
    // Without the aim the axis is the Analysis tab's own 4100 .. 5500.
    expect(a.widthPct).toBeCloseTo((600 / 1400) * 100, 6)
  })

  it('no option with a full range: no axis, no band', () => {
    userUnits.on = true
    expect(buildV10OptionBands({ ...(rec as object), allOptions: [{ id: 'c', outcome: { mean: null, p10: null, p50: null, p90: null } }] } as never)('c')).toBeNull()
  })
})

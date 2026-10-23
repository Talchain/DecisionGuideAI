/**
 * The option card's one-line chance slot (DL 22 Oct): CEE's face opens with the option's own name, so the card read
 * "Current model ‘Start a loyalty card’: …" and the figure never showed (served 22 Oct, UI b8a4fd79). Through the REAL
 * provider and the served Run + view: the slot says the face from the figure on; the whole face is kept for the tooltip.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OptionChanceCellProvider, faceWithoutOwnLabel } from '../shared/OptionChanceCellProvider'
import { useOptionChanceCell } from '../shared/useOptionChanceCell'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import servedWire from '../../conversation/__tests__/fixtures/core-run-read-after-write-served.json'
import { ReactFlowProvider } from '@xyflow/react'
import { vi } from 'vitest'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))

function Probe({ id }: { id: string }) {
  const cell = useOptionChanceCell(id)
  return <output data-testid={`cell-${id}`}>{JSON.stringify(cell)}</output>
}
const cellOf = (id: string) => JSON.parse(screen.getByTestId(`cell-${id}`).textContent ?? 'null')

describe('the card slot says the chance, not the option\'s own name', () => {
  afterEach(() => { cleanup(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })

  it('⭐ served Run: the slot opens on the figure ("about 39% chance of …"); the tooltip keeps CEE\'s whole face', () => {
    const turn = servedWire.turn as Record<string, any>
    const report = mapV5AnalysisToReport({ type: 'analysis_result', ...turn.analysis_result } as never, { computedAt: turn.analysis_state.run_state.computed_at })
    useCanvasStore.setState({ currentScenarioId: 'scn', results: { ...useCanvasStore.getState().results, status: 'complete', report } } as never)
    useCanonicalAnalysisViewStore.getState().adopt('scn', parseCanonicalAnalysisView(servedWire.read.canonical_analysis_view))
    render(<OptionChanceCellProvider><Probe id="loyalty_card" /><Probe id="status_quo" /></OptionChanceCellProvider>)
    const loyalty = cellOf('loyalty_card')
    expect(loyalty.kind).toBe('figure')
    expect(loyalty.text).toMatch(/^about 39% chance of ‘I want at least 480 customers a week within three months\.’ being at least 480/)
    expect(loyalty.detail).toMatch(/^‘Start a loyalty card’: about 39% chance of /)
    // CONTRAST: a withheld cell is CEE's own face, untouched (no figure, no label to drop).
    const sq = cellOf('status_quo')
    expect(sq.detail).toBeUndefined()
  })

  it('⭐ vision spec row 1 (23 Oct): the cell carries CEE\'s own display, verbatim, as the card\'s headline; a withheld cell has none', () => {
    const turn = servedWire.turn as Record<string, any>
    const report = mapV5AnalysisToReport({ type: 'analysis_result', ...turn.analysis_result } as never, { computedAt: turn.analysis_state.run_state.computed_at })
    useCanvasStore.setState({ currentScenarioId: 'scn', results: { ...useCanvasStore.getState().results, status: 'complete', report } } as never)
    useCanonicalAnalysisViewStore.getState().adopt('scn', parseCanonicalAnalysisView(servedWire.read.canonical_analysis_view))
    render(<OptionChanceCellProvider><Probe id="loyalty_card" /><Probe id="workplace_partnerships" /><Probe id="status_quo" /></OptionChanceCellProvider>)
    expect(cellOf('loyalty_card').display).toBe('about 39%')
    // CEE's boundary display is never re-rounded ("less than 1%", not "0%" or "1%").
    expect(cellOf('workplace_partnerships').display).toBe('less than 1%')
    const sq = cellOf('status_quo')
    expect(sq.kind).toBe('withheld')
    expect(sq.display).toBeUndefined()
    expect(sq.text).toBe('No change, by assumption')
    // The reason stays with the cell, for the card's hover.
    expect(sq.why).toMatch(/^This Run can’t give a chance for carrying on as now/)
  })

  it('⭐ vision spec rows 1–2 on the served card: the headline is CEE\'s display, the sentence and a withheld why are on hover', () => {
    const turn = servedWire.turn as Record<string, any>
    const report = mapV5AnalysisToReport({ type: 'analysis_result', ...turn.analysis_result } as never, { computedAt: turn.analysis_state.run_state.computed_at })
    const nodes = [['loyalty_card', 'Start a loyalty card'], ['status_quo', 'Carry on as now']]
      .map(([id, label]) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label, type: 'option', kind: 'option' } }))
    useCanvasStore.setState({ currentScenarioId: 'scn', nodes, edges: [], viewMode: 'standard',
      results: { ...useCanvasStore.getState().results, status: 'complete', report },
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false } as never)
    useCanonicalAnalysisViewStore.getState().adopt('scn', parseCanonicalAnalysisView(servedWire.read.canonical_analysis_view))
    const card = (id: string) => render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={id} type="option"
      data={nodes.find(n => n.id === id)!.data as never} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
      dragging={false} zIndex={0} deletable selectable draggable /></OptionChanceCellProvider></ReactFlowProvider>)
    card('loyalty_card')
    expect(screen.getByTestId('option-win-readout-loyalty_card').textContent).toBe('about 39%')
    const line = screen.getByTestId('option-analysis-currency-loyalty_card')
    expect(line.textContent).toBe('about 39%')
    expect(line.getAttribute('aria-label')).toMatch(/^Current model · ‘Start a loyalty card’: about 39% chance of ‘I want at least 480 customers a week/)
    cleanup()
    card('status_quo')
    expect(screen.getByTestId('option-win-readout-status_quo').textContent).toBe('No change, by assumption')
    expect(screen.getByTestId('option-analysis-currency-status_quo').getAttribute('aria-label'))
      .toContain('No change, by assumption This Run can’t give a chance for carrying on as now')
  })

  it('only a LEADING quoted label is dropped; a face without one is left as it is', () => {
    expect(faceWithoutOwnLabel('‘Hire two developers’: about 41% chance of meeting your goal, in this model.')).toBe('about 41% chance of meeting your goal, in this model.')
    // A label's own curly apostrophe is part of the label (Codex #2931 r1).
    expect(faceWithoutOwnLabel('‘Increase team’s capacity’: about 39% chance of meeting your goal, in this model.')).toBe('about 39% chance of meeting your goal, in this model.')
    expect(faceWithoutOwnLabel('No change, by assumption')).toBe('No change, by assumption')
    expect(faceWithoutOwnLabel('about 12% chance of ‘X’: in this model')).toBe('about 12% chance of ‘X’: in this model')
  })
})

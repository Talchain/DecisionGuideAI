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

  it('only a LEADING quoted label is dropped; a face without one is left as it is', () => {
    expect(faceWithoutOwnLabel('‘Hire two developers’: about 41% chance of meeting your goal, in this model.')).toBe('about 41% chance of meeting your goal, in this model.')
    // A label's own curly apostrophe is part of the label (Codex #2931 r1).
    expect(faceWithoutOwnLabel('‘Increase team’s capacity’: about 39% chance of meeting your goal, in this model.')).toBe('about 39% chance of meeting your goal, in this model.')
    expect(faceWithoutOwnLabel('No change, by assumption')).toBe('No change, by assumption')
    expect(faceWithoutOwnLabel('about 12% chance of ‘X’: in this model')).toBe('about 12% chance of ‘X’: in this model')
  })
})

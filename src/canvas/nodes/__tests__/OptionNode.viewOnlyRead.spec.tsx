import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import { seedPaulRun, resetPaulRun } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'
import read from '../../runView/__tests__/fixtures/capacity-view-only-read.json'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))
const ID = 'angel_bridge'
// The capacity board's served cell for 'Add one specialist', placed on this board's option id.
const served = read.canonical_analysis_view
const cell = served.options[1].cell
const boundRun = { run_id: 'run-capacity-1', graph_hash_at_run: read.graph_hash, computed_at: '2026-10-23T08:00:00Z' }
const currentStaleness = { ...served.staleness, stale: false, limitation: 'Hash equality cannot detect brief, framing or stage changes.' }

function seed(view: Record<string, unknown>) {
  seedPaulRun(null)
  const state = useCanvasStore.getState()
  // The board read carried no analysis_result: no report, never Results mode.
  useCanvasStore.setState({ results: { ...state.results, report: null, status: 'idle' } } as never)
  const parsed = parseCanonicalAnalysisView({ ...served, ...view, options: [{ ...served.options[1], option_id: ID }] })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(state.currentScenarioId!, parsed)
}
function card() {
  const n = useCanvasStore.getState().nodes.find(n => n.id === ID)!
  return render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={ID} type="option" data={n.data as never}
    selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable /></OptionChanceCellProvider></ReactFlowProvider>)
}
afterEach(() => { cleanup(); resetPaulRun(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })

describe('option card on a view-only board read (canonical_analysis_view, no analysis_result)', () => {
  it('a bound, current view: the card headline is CEE’s display, the whole face on hover', () => {
    seed({ run: boundRun, staleness: currentStaleness })
    expect(useCanvasStore.getState().results.report).toBeNull()
    card()
    const readout = screen.getByTestId(`option-win-readout-${ID}`)
    expect(readout.textContent).toBe('about 50%')
    expect(readout.closest('[aria-label]')?.getAttribute('aria-label')).toContain(cell.face)
  })

  it('the served view (no Run identity): no chance on the card', () => {
    seed({})
    card()
    expect(screen.queryByTestId(`option-win-readout-${ID}`)).toBeNull()
  })

  it('a bound Run CEE marks stale: no figure on the card', () => {
    seed({ run: boundRun, staleness: { ...currentStaleness, stale: true, reason: 'graph_changed' } })
    card()
    expect(screen.queryByTestId(`option-win-readout-${ID}`)).toBeNull()
    expect(document.body.textContent).not.toContain('about 50%')
  })
})

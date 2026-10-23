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
import funding from '../../runView/__tests__/fixtures/pass-funding-72300716-read.json'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))
const ID = 'angel_bridge'
// The capacity board's served cell for 'Add one specialist', placed on this board's option id.
const served = read.canonical_analysis_view
const cell = served.options[1].cell
const boundRun = { run_id: 'run-capacity-1', graph_hash_at_run: read.graph_hash, computed_at: '2026-10-23T08:00:00Z' }
const currentStaleness = { ...served.staleness, stale: false, limitation: 'Hash equality cannot detect brief, framing or stage changes.' }

function seed(view: Record<string, unknown>, option: Record<string, unknown> = served.options[1]) {
  seedPaulRun(null)
  const state = useCanvasStore.getState()
  // The board read carried no analysis_result: no report, never Results mode.
  useCanvasStore.setState({ results: { ...state.results, report: null, status: 'idle' } } as never)
  const parsed = parseCanonicalAnalysisView({ ...served, ...view, options: [{ ...option, option_id: ID }] })
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

  // Gap P0 #1 (23 Oct): the funding board's served withheld cell, placed on this board's option id.
  const withheld = funding.canonical_analysis_view.options[0]
  it('⭐ a withheld chance is a dash and the `withheld` word; CEE\'s face and reason stay on hover and in the name', () => {
    seed({ run: boundRun, staleness: currentStaleness }, withheld)
    card()
    expect(screen.getByTestId(`option-win-readout-${ID}`).textContent).toBe('—')
    const word = screen.getByTestId(`option-chance-withheld-${ID}`)
    expect(word.textContent).toBe('withheld')
    expect(document.body.textContent).not.toContain('Not shown yet: needs your answer')
    const line = screen.getByTestId(`option-analysis-currency-${ID}`)
    expect(line.getAttribute('aria-label')).toContain('Not shown yet: needs your answer')
    expect(line.getAttribute('aria-label')).toContain('The chance waits for your answer: What amount would you seek from angel investors')
    // Focusable, so the tooltip that says CEE's words opens on keyboard focus as well as hover.
    expect(line.getAttribute('tabindex')).toBe('0')
  })

  it('CEE\'s carry-on-as-now cell is a statement, not a withheld chance: it keeps its own words', () => {
    seed({ run: boundRun, staleness: currentStaleness }, { ...withheld, cell: { kind: 'withheld', face: 'No change, by assumption',
      reasons: [{ code: 'status_quo_by_assumption', message: 'No change, by assumption' }] } })
    card()
    expect(screen.getByTestId(`option-win-readout-${ID}`).textContent).toBe('No change, by assumption')
    expect(screen.queryByTestId(`option-chance-withheld-${ID}`)).toBeNull()
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

/**
 * Run-5 judge F4 (DL, 12 Oct): the canvas option card said only "Chance not shown yet", while CEE's served cell carried
 * the specific reason in `why` (hiring's period sentence). The card now says that `why` VERBATIM beneath the face, the
 * same words the Results hero shows, in Layer 2 (inline in the Detailed card; the Standard popover) and in the readout's
 * tooltip and accessible name. The one-line share slot is unchanged, so the card does not grow on a run. No new words.
 *
 * Body: run 5's hiring server read after the reopen (live/runs/2026-10-12T214005Z/hiring/reads/07-18-after-reopen.json;
 * UI 3e3615e5, CEE 551258bb; graph 090ec54a), verbatim, through the real read applier.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import served from './fixtures/run5-hiring-served-read-090ec54a.json'
import { applyRealRead } from '../../../components/results/analysis-hero/__tests__/helpers/realScenarioRead'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusByTarget: vi.fn(), focusModelTarget: vi.fn() }))
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

type Cell = { kind: string; face?: string; why?: string }
const cellOf = (body: typeof served, id: string): Cell =>
  (body.canonical_analysis_view.options as Array<{ option_id: string; cell: Cell }>).find(o => o.option_id === id)!.cell
const ID = 'hire_a_tech_lead'
const SERVED_WHY = cellOf(served, ID).why!

async function card(body: typeof served, id: string, viewMode: 'standard' | 'expert') {
  await applyRealRead({ j: body })
  useCanvasStore.setState({ viewMode } as never)
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)!
  return render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={id} type="option" data={node.data as never}
    selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
  </OptionChanceCellProvider></ReactFlowProvider>)
}

describe("run 5 F4: the canvas option card says CEE's served why, verbatim", () => {
  it('the fixture is the served cell: face "Chance not shown yet" and the period sentence', () => {
    expect(cellOf(served, ID)).toMatchObject({ kind: 'withheld', face: 'Chance not shown yet' })
    expect(SERVED_WHY).toMatch(/^The chance of reaching your target for ‘Productivity’ .* by month three isn’t shown: /)
  })

  it('⭐ Detailed (viewMode \'expert\'): the face, and beneath it the served why, word for word', async () => {
    await card(served, ID, 'expert')
    expect(screen.getByTestId(`option-win-readout-${ID}`).textContent).toBe('Chance not shown yet')
    expect(screen.getByTestId(`option-win-why-${ID}`).textContent).toBe(SERVED_WHY)
  })

  it('⭐ Standard: the one-line slot is unchanged and the why is in the readout\'s tooltip / accessible name', async () => {
    await card(served, ID, 'standard')
    expect(screen.getByTestId(`option-win-readout-${ID}`).textContent).toBe('Chance not shown yet')
    expect(screen.getByTestId(`option-analysis-currency-${ID}`).getAttribute('aria-label')).toContain(SERVED_WHY)
    // Layer 2 sits in the popover in Standard view, so the card body itself does not grow.
    expect(screen.queryByTestId(`option-win-why-${ID}`)).toBeNull()
  })

  it('CONTRAST: an option with no served cell (Continue as now) says no why', async () => {
    expect(cellOf(served, 'continue_as_now').kind).toBe('none')
    await card(served, 'continue_as_now', 'expert')
    expect(screen.queryByTestId('option-win-why-continue_as_now')).toBeNull()
  })

  it('CONTRAST: a why that only repeats the face, or an empty why, draws no second line', async () => {
    for (const why of ['Chance not shown yet', '   ']) {
      const body = JSON.parse(JSON.stringify(served)) as typeof served
      cellOf(body, ID).why = why
      await card(body, ID, 'expert')
      expect(screen.queryByTestId(`option-win-why-${ID}`)).toBeNull()
      expect(screen.getByTestId(`option-win-readout-${ID}`).textContent).toBe('Chance not shown yet')
      cleanup(); vi.unstubAllGlobals()
      useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
    }
  })
})

/**
 * Zoomed out, an option card keeps its chance (vision spec §2a "Far zoom: a card is never blank"; assessment 26 Oct).
 * Served on staging at zoom 0.33, a program board's option cards read "Changes 1 factor" while the same cards at full
 * zoom read "about 10%". The reduced line showed the chance only in the legacy Results mode, which a program board never
 * enters; the card shows it from CEE's bound canonical view. The reduced line now follows the card.
 *
 * Real path: the served read (`served-program-orders-full-read-20261026.json`, its `_source` names the run) through the
 * real `hydrateCanvasFromServer` (only `fetch` stubbed) into the real store, then the real `OptionNode` at each rung.
 * The contrast is the same read with no canonical view, where the card shows no chance and the line stays as it was.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../../../flags', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), isGraphLensEnabled: () => true }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import served from './fixtures/served-program-orders-full-read-20261026.json'

const OPTION = 'launch_referrals'

async function board(read: object, lodRung: 'full' | 'line' | 'quiet') {
  useCanvasStore.setState({ currentScenarioId: served.scenario_id } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  // A repeat read of the same saved graph answers `unchanged`; the read's canonical view is adopted either way.
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(served.scenario_id))
  expect(useCanvasStore.getState().nodes.some((n) => n.id === OPTION)).toBe(true)
  useCanvasStore.setState({ lodRung } as never)
}

function mount() {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === OPTION)!
  // ReactFlow's NodeProps needs fields no assertion here reads; the sibling node specs cast the same way.
  const props = { id: OPTION, type: node.type, data: node.data, position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any
  return render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode {...props} /></OptionChanceCellProvider></ReactFlowProvider>).container
}
/** The one line a zoomed-out card shows (the body is hidden by the rung; jsdom keeps it in the DOM). */
const reducedLine = () => screen.getByTestId('node-lod-line-text').textContent

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/')
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('a program board zoomed out: the option card keeps its chance', () => {
  it('at full zoom the card reads its chance (the precondition)', async () => {
    await board(served, 'full')
    expect(mount().textContent).toContain('about 10%')
    expect(screen.queryByTestId('node-lod-line-text')).toBeNull()
  })

  it('zoomed out the card still reads its chance, never "Changes 1 factor"', async () => {
    await board(served, 'line')
    mount()
    expect(reducedLine()).toBe('Model result · about 10%')
  })
})

describe('CONTRAST: a lens-dimmed card at `quiet` recedes; the chance is the far rung\'s only (DL ruling on #3000)', () => {
  it('a lens sets the option aside at `quiet`: its reduced line stays "Changes 1 factor", never its chance', async () => {
    await board(served, 'quiet')
    const state = useCanvasStore.getState() as any
    useCanvasStore.setState({ lens: { ...state.lens, _dimmedNodeIds: new Set([OPTION]) } } as never)
    mount()
    expect(reducedLine()).toBe('Changes 1 factor')
  })
})

describe('CONTRAST: where the card shows no chance, the zoomed-out line is unchanged', () => {
  it('with no canonical view the line reads "Changes 1 factor"', async () => {
    await board({ ...served, canonical_analysis_view: null }, 'line')
    mount()
    expect(reducedLine()).toBe('Changes 1 factor')
  })

  it('while a held Run report is not the shown result (a Run in progress), the line shows no chance the card does not show', async () => {
    await board(served, 'line')
    // Synthetic, labelled: a report naming the served Run (its own run id and hash), held while a new Run is in progress.
    // The card shows a chance only in Results mode or with no report held, so it shows none here; the line must agree.
    const state = useCanvasStore.getState()
    useCanvasStore.setState({ results: { ...state.results, status: 'running',
      report: { run_id: served.canonical_analysis_view.run.run_id, computed_against_hash: served.graph_hash } } } as never)
    const card = mount()
    expect(card.querySelector('[data-testid="option-win-readout-launch_referrals"]')).toBeNull()
    expect(reducedLine()).toBe('Changes 1 factor')
  })
})

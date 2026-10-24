/**
 * DL, 24 Oct (Paul approved for the alpha): CEE fills `main_driver` for each computed chance on a program board. The
 * board's pre-run slot said each option's chance line and never read it. Now, under each option's line, the slot says
 * CEE's own words verbatim: `main_driver.detail` (through `mainDriverDetailOf`) when available, the `none_licensed`
 * reason when CEE says why none is shown, and nothing when not recorded or when the Run is not current.
 *
 * Fixtures: CEE's served reads of the capacity program board (pass 35463f30, current) and of the same board opened after a
 * deploy (s2, stale). CEE does not serve a `detail` yet, so the driver words below are synthetic and spelled inline.
 * Real path: the real `AnalysisNewTabBody`, the real saved-graph read for the program flag (only `fetch` stubbed).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))
vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { openStrategicChallenge } from './analysisNewFixtures'
import current from '../../../../canvas/runView/__tests__/fixtures/pass-capacity-35463f30-read.json'
import stale from '../../../../canvas/runView/__tests__/fixtures/s2-capacity-stale-after-deploy-read.json'

type Json = Record<string, any>
const KEEP = 'keep_current_staffing'
const ADD = 'add_one_specialist'
const KEEP_DETAIL = 'In this model, the chance is most sensitive to ‘Weekly demand’ (Olumi’s estimate): at the low end of its range (80) it is about 4%; at the high end (120), about 0%.'
const ADD_DETAIL = 'In this model, the chance is most sensitive to ‘Weekly capacity per additional specialist’ (your range): at the low end (10) it is about 40%; at the high end (30), about 95%.'
const NONE_REASON = 'No single input moves this chance enough to name one.'
const STALE_LINE = 'Run the analysis again to see the chance.'

let read: Json = {}
let n = 0
type Driver = Json
const available = (detail: string): Driver => ({ kind: 'available', driver: {}, detail })

/** The program board on screen (pre-run), its saved read served, and the read's view adopted with these drivers. */
async function board(source: Json, drivers: Record<string, Driver>) {
  n += 1
  read = { ...source, graph_hash: `${String(source.graph_hash).slice(0, 12)}${String(n).padStart(4, '0')}` }
  useCanvasStore.setState({
    currentScenarioId: source.scenario_id, lastServerGraphHash: read.graph_hash,
    nodes: source.graph.nodes.map((x: Json, i: number) => ({ id: x.id, type: x.kind, position: { x: 0, y: i * 100 }, data: { label: x.label } })),
    edges: [], goalThreshold: null, results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const served = source.canonical_analysis_view
  const view = parseCanonicalAnalysisView({ ...served, options: served.options.map((o: Json) => ({ ...o, main_driver: drivers[o.option_id] ?? o.main_driver })) })
  expect(view).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(source.scenario_id, view)
  render(<AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const block = () => screen.getByTestId('analysis-view-only-chances')
const drivers = () => [...block().querySelectorAll('[data-testid^="analysis-view-only-driver-"]')].map(e => `${e.getAttribute('data-testid')} | ${e.textContent}`)

beforeEach(() => {
  useStrengthenStore.setState({ records: {} })
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/')
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('a program board’s chance lines say CEE’s main driver words', () => {
  it('available: each option’s detail, exactly, under THAT option’s own chance line', async () => {
    await board(current as Json, { [KEEP]: available(KEEP_DETAIL), [ADD]: available(ADD_DETAIL) })
    expect(drivers()).toEqual([`analysis-view-only-driver-${KEEP} | ${KEEP_DETAIL}`, `analysis-view-only-driver-${ADD} | ${ADD_DETAIL}`])
    // Bound to its option: the detail sits inside that option's line, after its chance words.
    const add = screen.getByTestId(`analysis-view-only-chance-${ADD}`)
    expect(add).toContainElement(screen.getByTestId(`analysis-view-only-driver-${ADD}`))
    expect(add.textContent).toMatch(/^‘Add one specialist’: about 76% chance/)
    expect(add.textContent!.endsWith(ADD_DETAIL)).toBe(true)
  })

  it('none_licensed: CEE’s reason, verbatim; available beside it keeps its own detail', async () => {
    await board(current as Json, { [KEEP]: { kind: 'none_licensed', reason: NONE_REASON }, [ADD]: available(ADD_DETAIL) })
    expect(drivers()).toEqual([`analysis-view-only-driver-${KEEP} | ${NONE_REASON}`, `analysis-view-only-driver-${ADD} | ${ADD_DETAIL}`])
  })

  it('not_recorded: nothing under the line (contrast: the same board with a detail shows it)', async () => {
    await board(current as Json, { [KEEP]: { kind: 'not_recorded' }, [ADD]: available(ADD_DETAIL) })
    expect(drivers()).toEqual([`analysis-view-only-driver-${ADD} | ${ADD_DETAIL}`])
    expect(screen.getByTestId(`analysis-view-only-chance-${KEEP}`).textContent).toMatch(/^‘Keep current staffing’: 0% chance/)
    expect(screen.queryByTestId(`analysis-view-only-driver-${KEEP}`)).toBeNull()
  })

  it('a stale Run: CEE’s not-current line alone, no driver words (the chance gate stands)', async () => {
    await board(stale as Json, { [KEEP]: available(KEEP_DETAIL), [ADD]: { kind: 'none_licensed', reason: NONE_REASON } })
    expect(screen.getByTestId(`analysis-view-only-chance-${KEEP}+${ADD}`).textContent).toBe(STALE_LINE)
    expect(drivers()).toEqual([])
    expect(block().textContent).not.toContain(KEEP_DETAIL)
    expect(block().textContent).not.toContain(NONE_REASON)
  })
})

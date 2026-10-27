/**
 * ROW 19 (DL, 24 Oct; S3 step 0): a program board saved before a deploy opens with its stored Run no longer current. CEE
 * serves that Run marked stale with its own line (`face_when_stale`), and the pre-run slot said nothing of it: setup text,
 * no result, and no way to run but typing (a program board has no Run button). Now, on a PROGRAM board, the slot says
 * CEE's line once for every option, never the old figures (the chance gate stands), with one "Run again" that sends the
 * existing Run press (the conversation's gated runner). It is never counted as a shown result. Paul, 27 Oct (spec: "A
 * historical Run's chances are never hidden"): each option's stored words from that Run follow CEE's line.
 *
 * Fixture: CEE c197dd60's served read of the capacity board opened after that deploy (see its `_capture`). Real path:
 * the real `AnalysisNewTabBody`, the real saved-graph read for the program flag (only `fetch` stubbed).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))
vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useProgramBoardShowsResult } from '../ViewOnlyRunChances'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { openStrategicChallenge } from './analysisNewFixtures'
import stale from '../../../../canvas/runView/__tests__/fixtures/s2-capacity-stale-after-deploy-read.json'

type Json = Record<string, any>
const LINE = 'Run the analysis again to see the chance.'
let read: Json = stale as Json
let n = 0
const runAnalysis = vi.fn()

/** The board as it opens: CEE's read (program or not), its view adopted, pre-run (no report held). */
async function board(opts: { program?: boolean; view?: Json } = {}) {
  n += 1
  const graph = (stale as Json).graph
  read = { ...stale, graph_hash: `${stale.graph_hash.slice(0, 12)}${String(n).padStart(4, '0')}`,
    graph: opts.program === false ? { ...graph, living_model: { aims: [], links: [], factors: [], options: [] } } : graph }
  useCanvasStore.setState({
    currentScenarioId: stale.scenario_id, lastServerGraphHash: read.graph_hash,
    nodes: graph.nodes.map((x: Json) => ({ id: x.id, type: x.kind, data: { label: x.label } })),
    goalThreshold: null, results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const parsed = parseCanonicalAnalysisView({ ...stale.canonical_analysis_view, ...(opts.view ?? {}) })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(stale.scenario_id, parsed)
}
function Counter() { return <span data-testid="shows-result">{String(useProgramBoardShowsResult())}</span> }
async function draw() {
  render(<>
    <AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
      blockedListing={null} canRunAnalysis onReanalyse={() => {}} />
    <Counter />
  </>)
  // The saved-graph read (the program flag) answers before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}

beforeEach(() => {
  runAnalysis.mockClear()
  useStrengthenStore.setState({ records: {} })
  useGuidanceStore.setState({ _runAnalysis: runAnalysis } as never)
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/')
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }); useGuidanceStore.setState({ _runAnalysis: null } as never)
})

describe('a program board whose stored Run is no longer current', () => {
  it('⭐ says CEE’s line once, then each option’s stored chance from that Run, and one "Run again" that sends the Run press', async () => {
    await board()
    await draw()
    const block = screen.getByTestId('analysis-view-only-chances')
    const line = screen.getByTestId('analysis-view-only-chance-keep_current_staffing+add_one_specialist')
    expect(line.textContent).toBe(LINE)
    expect(block.querySelectorAll('[data-testid^="analysis-view-only-chance-"]')).toHaveLength(1)
    // The historical Run's chances are never hidden: each option's own stored words, after the line, in CEE's order.
    const earlier = [...block.querySelectorAll('[data-testid^="analysis-view-only-earlier-chance-"]')]
    expect(earlier.map(e => e.getAttribute('data-testid'))).toEqual([
      'analysis-view-only-earlier-chance-keep_current_staffing', 'analysis-view-only-earlier-chance-add_one_specialist'])
    expect(earlier[0].textContent?.startsWith('‘Keep current staffing’: 0% chance of ‘Weekly support capacity’')).toBe(true)
    expect(earlier[1].textContent?.startsWith('‘Add one specialist’: about 61% chance of ‘Weekly support capacity’')).toBe(true)
    expect(block.textContent?.indexOf(LINE)).toBe(0)
    // No current-Run sentence, driver or "most likely" from a Run that is not current.
    expect(screen.queryByTestId('analysis-view-only-chances-sentence')).toBeNull()
    expect(block.querySelector('[data-testid^="analysis-view-only-driver-"]')).toBeNull()
    expect(screen.queryByTestId('analysis-view-only-most-likely')).toBeNull()
    // One run act: the block's "Run again", and not the slot's own run act beside it.
    const again = screen.getByTestId('analysis-view-only-run-again')
    expect(again.textContent).toBe('Run again')
    expect(screen.queryByTestId('analysis-new-status-pre-run-act')).toBeNull()
    fireEvent.click(again)
    expect(runAnalysis).toHaveBeenCalledTimes(1)
  })

  it('options whose stored words are the same are said once (european 7e3ba3e4, served 27 Oct: three "Not shown yet")', async () => {
    const options = (stale as Json).canonical_analysis_view.options.map((o: Json) => ({ ...o,
      cell: { kind: 'withheld', face: 'Not shown yet: needs your answer', why: 'The chance waits on ‘x’.', reasons: [] } }))
    await board({ view: { options } })
    await draw()
    const earlier = [...screen.getByTestId('analysis-view-only-chances').querySelectorAll('[data-testid^="analysis-view-only-earlier-chance-"]')]
    expect(earlier.map(e => e.getAttribute('data-testid'))).toEqual(['analysis-view-only-earlier-chance-keep_current_staffing+add_one_specialist'])
    expect(earlier[0].textContent).toBe('Not shown yet: needs your answer')
  })

  it('is never counted as a shown result; a current Run still is', async () => {
    await board()
    await draw()
    expect(screen.getByTestId('shows-result').textContent).toBe('false')
    cleanup()
    await board({ view: { staleness: { ...(stale as Json).canonical_analysis_view.staleness, stale: false, reason: 'graph_hash_match' } } })
    await draw()
    expect(screen.queryByTestId('analysis-view-only-run-again')).toBeNull()
    expect(screen.getByTestId('shows-result').textContent).toBe('true')
  })

  it('CONTRAST: no runner registered: CEE’s line, and no control that does nothing', async () => {
    useGuidanceStore.setState({ _runAnalysis: null } as never)
    await board()
    await draw()
    expect(screen.getByTestId('analysis-view-only-chance-keep_current_staffing+add_one_specialist').textContent).toBe(LINE)
    expect(screen.queryByTestId('analysis-view-only-run-again')).toBeNull()
  })

  it('CONTRAST: a board that is not a program board, or a stale Run with no line of CEE’s: no block, the slot as before', async () => {
    await board({ program: false })
    await draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
    expect(screen.getByTestId('analysis-new-status-pre-run-act')).toBeInTheDocument()
    cleanup()
    const { face_when_stale: _none, ...noLine } = (stale as Json).canonical_analysis_view
    await board()
    useCanonicalAnalysisViewStore.getState().adopt(stale.scenario_id, parseCanonicalAnalysisView(noLine))
    await draw()
    expect(screen.queryByTestId('analysis-view-only-chances')).toBeNull()
  })
})

/**
 * S3 option (a), ruled (DL, 24 Oct): a reopened PROGRAM board whose served result is bound and current said "Run a
 * first pass" in the Olumi tab. CEE's legacy read says `analysis_state: never_run` for a program board, so the stage
 * ladder never saw the result; the result itself is CEE's `canonical_analysis_view`. The ladder now reads it through
 * `useProgramBoardShowsResult`, the authority the Analysis and Model tabs already use, so the board's own result is
 * never denied; a view that is not current is never read as current.
 *
 * Fixtures: CEE's served reads of the capacity program board (pass 35463f30, current; s2, after a deploy, stale).
 * Real path: the real stage hook and invitation, the real saved-graph read for the program flag (only `fetch` stubbed).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { EmptyConversationInvitation, INVITATION_TESTID_DOCKED } from '../../components/EmptyConversationInvitation'
import { useConversationStage } from '../useConversationStage'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import current from '../../runView/__tests__/fixtures/pass-capacity-35463f30-read.json'
import stale from '../../runView/__tests__/fixtures/s2-capacity-stale-after-deploy-read.json'

type Json = Record<string, any>
const FIRST_PASS = 'Your model is on the canvas. Run a first pass to see how the options compare, then ask Olumi about any part of it.'
const READY = 'Your analysis is ready. Ask Olumi about any part of it, or say what you would like to change.'
let read: Json = {}
let n = 0

/** The board as it opens: CEE's read (program or not), its view adopted, pre-run (no report held). */
async function board(source: Json, opts: { program?: boolean } = {}) {
  n += 1
  const graph = opts.program === false ? { ...source.graph, living_model: { aims: [], links: [], factors: [], options: [] } } : source.graph
  read = { ...source, graph_hash: `${String(source.graph_hash).slice(0, 12)}${String(n).padStart(4, '0')}`, graph }
  useCanvasStore.setState({
    currentScenarioId: source.scenario_id, lastServerGraphHash: read.graph_hash,
    nodes: source.graph.nodes.map((x: Json, i: number) => ({ id: x.id, type: x.kind, position: { x: 0, y: i * 100 }, data: { label: x.label } })),
    edges: [], goalThreshold: null, analysisFreshness: null, analysisStateV1: null,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const view = parseCanonicalAnalysisView(source.canonical_analysis_view)
  expect(view).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(source.scenario_id, view)
}
function Stage() { return <span data-testid="stage">{useConversationStage()}</span> }
async function draw() {
  render(<><EmptyConversationInvitation testId={INVITATION_TESTID_DOCKED} /><Stage /></>)
  // The saved-graph read (the program flag) answers before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const said = () => screen.getByTestId(INVITATION_TESTID_DOCKED).textContent

beforeEach(() => {
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

describe('the Olumi tab on a reopened program board', () => {
  it('a bound, current served result: the stage is current, and it never says "Run a first pass"', async () => {
    expect((current as Json).analysis_state.run_state.kind).toBe('never_run')
    expect((current as Json).canonical_analysis_view.staleness.stale).toBe(false)
    await board(current as Json)
    await draw()
    expect(screen.getByTestId('stage').textContent).toBe('current')
    expect(said()).toBe(READY)
  })

  it('a stale served result is never read as current: the stage stays where the legacy ladder puts it', async () => {
    expect((stale as Json).canonical_analysis_view.staleness.stale).toBe(true)
    await board(stale as Json)
    await draw()
    expect(screen.getByTestId('stage').textContent).not.toBe('current')
    expect(said()).not.toBe(READY)
  })

  it('CONTROL, not a program board (the café class): the same current view changes nothing, the ladder is as before', async () => {
    await board(current as Json, { program: false })
    await draw()
    expect(screen.getByTestId('stage').textContent).toBe('modelled')
    expect(said()).toBe(FIRST_PASS)
  })
})

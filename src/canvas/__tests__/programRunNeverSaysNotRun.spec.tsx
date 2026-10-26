/**
 * ⭐ A PROGRAM BOARD WITH A CURRENT RUN NEVER SAYS "NOT RUN" (W3b; the design audit on served board 5651fd74). The board's
 * own Run is in `canonical_analysis_view`, bound to the saved graph; the old analysis record it leaves at `never_run` made
 * Summary, the Model tab, the readiness line, the "What would change" lens and Compare say it had not been run. On a
 * program board whether a Run exists now comes from the program's own Run; a surface with no program reading says nothing.
 *
 * Real path: the served program read (`served-program-orders-full-read-20261026.json`: `run_state: never_run`, and a
 * canonical view whose Run is bound to the read's graph hash) through the real `fetchScenarioGraph` and
 * `hydrateCanvasFromServer` (only `fetch` stubbed), then each real surface. Each row has a non-program contrast: the same
 * read with no living model (SYNTHETIC, labelled), where the old record still speaks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'

vi.mock('../../flags', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), isGraphLensEnabled: () => true }))
vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../store'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { useSavedModelProgramState } from '../nodes/shared/savedModelProgram'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { buildDecisionBrief, DECISION_BRIEF_COPY } from '../decisionBrief/buildDecisionBrief'
import { DecisionBriefView } from '../decisionBrief/DecisionBriefView'
import { ReanalyseBar } from '../components/model-tab/ReanalyseBar'
import { AnalysisReadinessBar } from '../components/workspaceShell/AnalysisReadinessBar'
import { useReanalyseBarInputs } from '../components/workspaceShell/rerunControl'
import { LensBar } from '../artefacts/LensBar'
import { CompareRunPairBody } from '../compare-tab/CompareRunPairBody'
import served from '../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

const NOT_ANALYSED = 'This model has not been analysed yet.'
const READINESS_PENDING = 'Readiness not checked yet'
const NO_COMPARISON = 'No comparison yet'
const NON_PROGRAM_ID = '0b4c2d7e-1111-4222-8333-94445555a004'
/** SYNTHETIC, labelled: the served read with no living model, under its own scenario id (a non-program board). */
const nonProgram = (() => {
  const graph = Object.fromEntries(Object.entries(served.graph).filter(([k]) => k !== 'living_model'))
  return { ...served, scenario_id: NON_PROGRAM_ID, graph_hash: `${served.graph_hash}-np`, graph }
})()

const respond = (read: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))

async function board(read: { scenario_id: string }, expected: 'program' | 'not_program') {
  useCanvasStore.setState({ currentScenarioId: read.scenario_id } as never)
  respond(read)
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(read.scenario_id))
  const state = renderHook(() => useSavedModelProgramState())
  await waitFor(() => expect(state.result.current).toBe(expected))
  state.unmount()
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('Summary', () => {
  async function brief(read: { scenario_id: string }) {
    respond(read)
    const result = await fetchScenarioGraph(read.scenario_id, { retryDelayMs: 0 })
    if (result.status !== 'graph') throw new Error(`the served read did not parse: ${result.status}`)
    return buildDecisionBrief(result)
  }

  it('a program board with a current Run: "These figures come from the latest Run…", never "not run yet"', async () => {
    const b = await brief(served)
    expect([b.run.status, b.run.statement]).toEqual(['current', DECISION_BRIEF_COPY.runCurrent])
    render(<DecisionBriefView brief={b} />)
    expect(screen.queryByText(DECISION_BRIEF_COPY.runNeverRun)).toBeNull()
  })

  it('a program board with no program reading says nothing about a Run (no "Latest Run" section)', async () => {
    const { canonical_analysis_view: _view, ...noView } = served
    const b = await brief(noView)
    expect(b.run.statement).toBe('')
    render(<DecisionBriefView brief={b} />)
    expect(screen.queryByTestId('brief-run')).toBeNull()
  })

  it('CONTRAST — a non-program board: the old record still speaks ("This version has not been run yet.")', async () => {
    const b = await brief(nonProgram)
    expect([b.run.status, b.run.statement]).toEqual(['never_run', DECISION_BRIEF_COPY.runNeverRun])
  })
})

describe('the Model tab and the readiness line (the shared run-on-record input)', () => {
  it('a program board: the Model tab bar never says "This model has not been analysed yet."', async () => {
    await board(served, 'program')
    render(<ReanalyseBar canRun blockedReason={undefined} isAnalysing={false} />)
    await settle()
    expect(screen.queryByText(NOT_ANALYSED)).toBeNull()
  })

  it('a program board: no first-Run readiness bar, so never "Readiness not checked yet"', async () => {
    await board(served, 'program')
    const { result } = renderHook(() => useReanalyseBarInputs())
    await settle()
    expect(result.current.preRunWithModel).toBe(false)
    render(<AnalysisReadinessBar preRunWithModel={result.current.preRunWithModel} canRun nothingHasAnswered isAnalysing={false} onAnalyse={() => {}} />)
    expect(screen.queryByText(READINESS_PENDING)).toBeNull()
  })

  it('CONTRAST — a non-program board: "This model has not been analysed yet." and "Readiness not checked yet"', async () => {
    await board(nonProgram, 'not_program')
    render(<ReanalyseBar canRun blockedReason={undefined} isAnalysing={false} />)
    await settle()
    expect(screen.getByText(NOT_ANALYSED)).toBeTruthy()
    const { result } = renderHook(() => useReanalyseBarInputs())
    expect(result.current.preRunWithModel).toBe(true)
    render(<AnalysisReadinessBar preRunWithModel={result.current.preRunWithModel} canRun nothingHasAnswered isAnalysing={false} onAnalyse={() => {}} />)
    expect(screen.getByText(READINESS_PENDING)).toBeTruthy()
  })
})

describe('the "What would change" lens', () => {
  it('a program board: not offered (it reads the old Run report, so it could only say "run the analysis first")', async () => {
    await board(served, 'program')
    render(<LensBar />)
    await settle()
    expect(screen.queryByTestId('lens-bar-what_changes')).toBeNull()
  })

  it('CONTRAST — a non-program board: offered, waiting for a Run', async () => {
    await board(nonProgram, 'not_program')
    render(<LensBar />)
    await settle()
    expect(screen.getByTestId('lens-bar-what_changes').getAttribute('aria-disabled')).toBe('true')
  })
})

describe('Compare', () => {
  it('a program board: no "No comparison yet"', async () => {
    await board(served, 'program')
    render(<CompareRunPairBody responseHash={null} />)
    await settle()
    expect(screen.queryByText(NO_COMPARISON)).toBeNull()
  })

  it('CONTRAST — a non-program board: "No comparison yet"', async () => {
    await board(nonProgram, 'not_program')
    render(<CompareRunPairBody responseHash={null} />)
    await settle()
    expect(screen.getByText(NO_COMPARISON)).toBeTruthy()
  })
})

/**
 * A PROGRAM GRAPH HAS NO RUN BUTTON — NOT A DISABLED ONE. Its analysis is run by the host on every change, and CEE
 * says `analysis_ready.may_run: false` there, so the button could only ever sit disabled. Recognised by the field CEE
 * sets on the saved model, `living_model.model_program`. Real `useSavedGraph` read, only `fetch` stubbed; both Run
 * surfaces (the shell's readiness bar and the Analysis footer). The café board, a core model without the field, keeps
 * today's button.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

import { AnalysisReadinessBar } from '../AnalysisReadinessBar'
import { PanelFooter } from '../../pre-analysis-v3/footer/PanelFooter'
import { RESTING_AVAILABLE } from '../../pre-analysis-v3/footer/readinessDisplay'
import { useCanvasStore } from '../../../store'

type Rec = Record<string, unknown>
const read = (scenarioId: string, graphHash: string, livingModel: Rec): Rec => ({
  schema: 'scenario_graph.v1', scenario_id: scenarioId, graph_present: true, graph_hash: graphHash,
  graph: { nodes: [], edges: [], living_model: livingModel },
})
// smoke-alpha2 capacity-r1: a program (`model_program: "v1"`), `may_run: false`.
const CAPACITY = read('de719c71-d0d4-471d-b4a0-1b173d75fa0c', '811b509a0cfe1deb', { model_program: 'v1', canonical: { version: 'canonical.v1' } })
// option-card-probe-2011 reads[6]: the café board, a core model with no `model_program`.
const CAFE = read('99088c3e-308e-4c56-a963-3ce47d048a7b', 'fe61868e9e12f9f4', { aims: [], links: [], factors: [], options: [] })

let served: Rec = CAFE
// The saved-graph read is cached per scenario and hash, so each test reads its own hash and the fetch is its own.
let n = 0
function seed(template: Rec) {
  n += 1
  const body: Rec = { ...template, graph_hash: `${String(template.graph_hash)}${n}` }
  served = body
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    currentScenarioId: body.scenario_id as string,
    lastServerGraphHash: body.graph_hash as string,
  } as never)
}
// The read has answered (its graph route was fetched and the microtasks drained) before a CONTROL asserts.
const settle = async (scenarioId = '99088c3e-308e-4c56-a963-3ce47d048a7b') => {
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith(`/scenarios/${scenarioId}/graph`))).toBe(true)
}

const surfaces = (canRun: boolean) => (
  <>
    <AnalysisReadinessBar preRunWithModel canRun={canRun} isAnalysing={false} nothingHasAnswered={false} onAnalyse={() => {}} />
    <PanelFooter footer={RESTING_AVAILABLE as never} onAnalyse={() => {}} isAnalysing={false} canRun={canRun} />
  </>
)

beforeEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/?ai=core-route')
  useCanvasStore.setState(useCanvasStore.getState(), true)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('(d) a program graph: no Run button on either surface, enabled or disabled', () => {
  for (const canRun of [false, true]) {
    it(`canRun=${String(canRun)}`, async () => {
      seed(CAPACITY)
      render(surfaces(canRun))
      await vi.waitFor(() => expect(screen.queryByTestId('analysis-readiness-bar-analyse')).toBeNull())
      expect(screen.queryByTestId('pre-analysis-v3-analyse')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Run analysis' })).toBeNull()
      // The bar's own words stay; only the button goes.
      expect(screen.getByTestId('analysis-readiness-bar')).toBeTruthy()
    })
  }
})

describe('(e) CONTROL: the café board keeps the Run button as today', () => {
  it('enabled when the gate is open', async () => {
    seed(CAFE)
    render(surfaces(true))
    await settle()
    expect((screen.getByTestId('analysis-readiness-bar-analyse') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('pre-analysis-v3-analyse') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('analysis-readiness-bar-analyse').textContent).toBe('Run analysis')
  })
  it('disabled when the gate is shut', async () => {
    seed(CAFE)
    render(surfaces(false))
    await settle()
    expect((screen.getByTestId('analysis-readiness-bar-analyse') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('pre-analysis-v3-analyse') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('(e) CONTROL: an unknown program version keeps the Run button as today (Codex r1 on #2950)', () => {
  it('the capacity read under model_program "v2", gate open: both surfaces keep their enabled button', async () => {
    seed(read(CAPACITY.scenario_id as string, '811b509a0cfe1dee', { model_program: 'v2', canonical: { version: 'canonical.v1' } }))
    render(surfaces(true))
    await settle(CAPACITY.scenario_id as string)
    expect((screen.getByTestId('analysis-readiness-bar-analyse') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('pre-analysis-v3-analyse') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('analysis-readiness-bar-analyse').textContent).toBe('Run analysis')
  })
})

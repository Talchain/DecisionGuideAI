/**
 * ON A PROGRAM BOARD THE TABS NEVER DENY A RESULT THE BOARD SHOWS (DL, 23 Oct; served on-screen pass, capacity brief).
 * The board showed "Add one specialist … about 76%" (CEE's bound, current Run, mp_run_2), while the Reasoning tab ended
 * with a "Run the analysis" action and the Model tab's card said "Run analysis to see confidence and reproducibility
 * data". A program's analysis is run by the host on every change, so on a program board showing that Run's result:
 *   · the Reasoning body offers no "Run the analysis" (`analysis-new-status-pre-run-act`);
 *   · the Model card makes no "Run analysis …" promise.
 * The same read on a board that is not a program board keeps both, as before.
 *
 * Real path: the real saved-graph read (only `fetch` stubbed, answering with CEE's served reads from the pass, trimmed),
 * the read's served `canonical_analysis_view` adopted as hydration adopts it, the real `AnalysisNewTabBody` and
 * `ModelTabBody`. Fixtures: capacity (a figure, run 2) and funding (withheld, needs two answers).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true), focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ModelTabBody } from '../../../../canvas/components/ModelTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { openStrategicChallenge } from './analysisNewFixtures'
import capacity from '../../../../canvas/runView/__tests__/fixtures/pass-capacity-35463f30-read.json'
import funding from '../../../../canvas/runView/__tests__/fixtures/pass-funding-72300716-read.json'

type Json = Record<string, any>
const RUN_ACT = 'analysis-new-status-pre-run-act'
const MODEL_CARD_PROMISE = 'Run analysis to see confidence and reproducibility data'
let read: Json = {}
let n = 0
/** The board on screen (pre-run: no report held), its saved read served as given, and the read's view adopted. */
function board(source: Json, program: boolean) {
  n += 1
  const living = program ? source.graph.living_model : { aims: [], links: [], factors: [], options: [] }
  read = { ...source, graph_hash: `${String(source.graph_hash).slice(0, 12)}${String(n).padStart(4, '0')}`, graph: { ...source.graph, living_model: living } }
  useCanvasStore.setState({
    currentScenarioId: source.scenario_id,
    lastServerGraphHash: read.graph_hash,
    nodes: source.graph.nodes.map((x: Json, i: number) => ({ id: x.id, type: x.kind, position: { x: 0, y: i * 100 }, data: { label: x.label } })),
    edges: [],
    goalThreshold: null,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const view = parseCanonicalAnalysisView(source.canonical_analysis_view)
  expect(view).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(source.scenario_id, view)
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })
async function reasoning() {
  render(<AnalysisNewTabBody resultsSectionData={openStrategicChallenge()} isPreRun isRunning={false} isStale={false}
    blockedListing={null} canRunAnalysis onReanalyse={() => {}} />)
  await settle()
  expect(vi.mocked(fetch).mock.calls.some(([u]) => /\/scenarios\/[^/]+\/graph$/.test(String(u)))).toBe(true)
}
async function modelTab() {
  render(<ModelTabBody showDebug={false} hasDiagnostics={false} diagnostics={null} hasTrim={false} effectiveCorrelationId={null}
    correlationMismatch={false} correlationIdHeader={null} nodes={useCanvasStore.getState().nodes} edges={[]} robustness={null} />)
  await settle()
}

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

describe('the Reasoning body on a program board showing its Run', () => {
  it('capacity (run 2, about 76%): the served chance shows and no "Run the analysis"', async () => {
    board(capacity, true)
    await reasoning()
    expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist')).toHaveTextContent('about 76% chance')
    expect(screen.queryByTestId(RUN_ACT)).toBeNull()
  })

  it('funding (withheld until two answers): CEE’s face shows and no "Run the analysis"', async () => {
    board(funding, true)
    await reasoning()
    expect(screen.getByTestId('analysis-view-only-chances')).toHaveTextContent('Not shown yet: needs your answer')
    expect(screen.queryByTestId(RUN_ACT)).toBeNull()
  })

  it('CONTROL: the same capacity read on a board that is not a program board keeps "Run the analysis"', async () => {
    board(capacity, false)
    await reasoning()
    expect(screen.getByTestId(RUN_ACT)).toHaveTextContent('Run analysis')
  })
})

describe('the Model card on a program board showing its Run', () => {
  it('capacity: the card makes no "Run analysis …" promise', async () => {
    board(capacity, true)
    await modelTab()
    expect(screen.getByTestId('model-card-pre-analysis')).toBeInTheDocument()
    expect(screen.getByTestId('model-card-pre-analysis')).not.toHaveTextContent(MODEL_CARD_PROMISE)
  })

  it('CONTROL: the same read on a board that is not a program board keeps the promise', async () => {
    board(capacity, false)
    await modelTab()
    expect(screen.getByTestId('model-card-pre-analysis')).toHaveTextContent(MODEL_CARD_PROMISE)
  })
})

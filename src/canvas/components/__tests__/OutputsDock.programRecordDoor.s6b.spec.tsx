/**
 * P1 S6b (30 Oct, integrated witness 06:09Z): the person reads a program Run's chances on the dock's "Analysis" tab
 * ('results'), which on a program board mounts only the view-only Run block; S6's record door lived on "Reasoning" only,
 * so the served journey found no door where the chances are. The door now sits under those chances too, on S6's own gate
 * (`useProgramBoardShowsResult() && !isViewer`), opening the same modal. Every row drives the MOUNTED OutputsDock tab,
 * never a component in isolation (that isolation is how S6 missed this tab).
 * Program recognised through the real saved-graph read (`useSavedGraph`), only `fetch` stubbed.
 * Fixture: CEE's served capacity read (S3 smoke-alpha2 r1, trimmed).
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
  // The saved-graph read asks for the session first; a guest has none.
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isAiPanelV2Enabled: () => true, isJourneyTabEnabled: () => false, isTelemetryEnabled: () => false }
})
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return { ...actual, useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }) }
})
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="stub-pre-run" /> }))
vi.mock('../pre-analysis-v3', () => ({ default: () => <div data-testid="stub-pre-run-v3" /> }))

import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import capacity from '../../runView/__tests__/fixtures/alpha2-capacity-r1-read.json'
import { setViewerScenario } from '../../../lib/viewerMode'

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      }),
    })
  }
}

type Rec = Record<string, unknown>
let served: Rec = {}
// The saved-graph read is cached per scenario and hash, so each test reads its own hash.
let n = 0
/** The capacity board on the canvas, pre-run, with its saved model's living_model and CEE's served view (as served, changed, or none). */
function board(livingModel: Rec, view: Rec | null) {
  n += 1
  const graphHash = `${capacity.graph_hash}${n}`
  served = { schema: 'scenario_graph.v1', scenario_id: capacity.scenario_id, graph_present: true, graph_hash: graphHash,
    graph: { nodes: capacity.graph.nodes, edges: [], living_model: livingModel } }
  useCanvasStore.setState({
    currentScenarioId: capacity.scenario_id,
    lastServerGraphHash: graphHash,
    nodes: capacity.graph.nodes.map((node, i) => ({ id: node.id, type: node.kind, position: { x: 0, y: i * 100 }, data: { label: node.label } })) as never,
    edges: [] as never,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  if (view === null) return
  const parsed = parseCanonicalAnalysisView({ ...capacity.canonical_analysis_view, ...view })
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(capacity.scenario_id, parsed)
}

async function openAnalysisTab() {
  render(<ConversationProvider><OutputsDock /></ConversationProvider>)
  // A populated canvas ends first use, so the dock is already open.
  fireEvent.click(await screen.findByTestId('outputs-dock-tab-results'))
  await waitFor(() => expect(screen.getByTestId('outputs-dock-body')).toBeInTheDocument())
  // The saved-graph read has answered (its route was fetched and the microtasks drained) before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith(`/scenarios/${capacity.scenario_id}/graph`))).toBe(true)
}
const PROGRAM = { model_program: 'v1' }
// The café board's living model: a core model with no `model_program` (option-card-probe-2011 reads[6]).
const NOT_PROGRAM = { aims: [], links: [], factors: [], options: [] }
const prePanel = () => screen.queryByTestId('stub-pre-run') ?? screen.queryByTestId('stub-pre-run-v3')

beforeEach(() => {
  cleanup()
  ensureMatchMedia()
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
  sessionStorage.clear()
  localStorage.clear()
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0, outputSurfaceOrigin: null, outputSurfaceOriginSeq: 0, outputSurfaceOriginAt: null })
  useFloatingPanelState.getState().close()
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  act(() => setViewerScenario(null))
})

const DOOR = 'analysis-results-record-open'
const LABELS = [['keep_current_staffing', 'Keep current staffing'], ['add_one_specialist', 'Add one specialist']]
const optionsOffered = () => Array.from((screen.getByTestId('decision-record-option') as HTMLSelectElement).options)
  .filter(o => o.value !== '').map(o => [o.value, o.textContent])
/** Every option's chance waits on a figure: the Run is bound and current, and names no chance (the served journey's Run). */
const WAITING = {
  leader_licence: 'withheld', leader: undefined,
  options: capacity.canonical_analysis_view.options.map((o) => ({ ...o,
    cell: { kind: 'withheld', face: 'The chance waits on ‘Weekly capacity per additional specialist’.', reasons: [{ code: 'waits_on', message: null }] } })),
}

describe('S6b: the record door sits under a program Run’s chances on the Analysis tab', () => {
  it('(a) bound and current Run: the door under the chances opens the record form on the Run’s own options', async () => {
    board(PROGRAM, {})
    await openAnalysisTab()
    const slot = await screen.findByTestId('outputs-pre-run-view-only')
    const door = screen.getByTestId(DOOR)
    expect(slot).toContainElement(door)
    fireEvent.click(door)
    expect(await screen.findByTestId('decision-record-modal')).toBeInTheDocument()
    expect(optionsOffered()).toEqual(LABELS)
  })

  it('(a2) a bound, current Run whose every chance waits on a figure: the door still opens on that Run’s options', async () => {
    board(PROGRAM, WAITING)
    await openAnalysisTab()
    const slot = await screen.findByTestId('outputs-pre-run-view-only')
    expect(slot).toHaveTextContent('The chance waits on')
    fireEvent.click(screen.getByTestId(DOOR))
    expect(await screen.findByTestId('decision-record-modal')).toBeInTheDocument()
    expect(optionsOffered()).toEqual(LABELS)
  })

  it('(b) contrast: a stale Run says its not-current line and earlier chances, and offers no door', async () => {
    board(PROGRAM, { staleness: { ...capacity.canonical_analysis_view.staleness, stale: true, reason: 'graph_changed' },
      face_when_stale: 'Run the analysis again to see the chance.' })
    await openAnalysisTab()
    expect(await screen.findByTestId('outputs-pre-run-view-only')).toHaveTextContent('Run the analysis again to see the chance.')
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })

  it('(c) contrast: once the session is a viewer of the board, the chances stay and the door goes', async () => {
    board(PROGRAM, {})
    await openAnalysisTab()
    expect(await screen.findByTestId(DOOR)).toBeInTheDocument()
    // Set after the read: the viewer belt wraps `fetch`, which the harness above asserts on.
    act(() => setViewerScenario(capacity.scenario_id))
    expect(screen.getByTestId('outputs-pre-run-view-only')).toBeInTheDocument()
    expect(screen.queryByTestId(DOOR)).toBeNull()
  })

  it('(d) contrast: a board known not to be a program keeps its Analysis tab as before, with no such door', async () => {
    board(NOT_PROGRAM, {})
    await openAnalysisTab()
    expect(prePanel()).not.toBeNull()
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()
    expect(screen.queryByTestId('analysis-results-record')).toBeNull()
  })
})

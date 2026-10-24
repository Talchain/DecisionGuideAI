/**
 * DL ruling A (23 Oct), the Analysis tab's pre-run slot: on a PROGRAM board (`living_model.model_program === 'v1'`,
 * whose Run is automatic) read with a bound, current canonical view, the slot says CEE's served words and does not
 * mount the pre-analysis panel, whose lines ("No goal selected", "You can run a first pass now", "Analyse anyway") say
 * no result exists. A non-program board keeps that panel unchanged, even with the same view; so do stale or unbound
 * views. The panels are markers here (they need a toast provider); what is pinned is which one the slot mounts.
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

const SENTENCE = 'In this model, on current information, each option’s chance of ‘Weekly support capacity’ being at least 100 ticket / week at 1 week from now:'
const ADD_FACE = '‘Add one specialist’: about 50% chance of ‘Weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread, held within those bounds.'

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
})

describe('the Analysis tab pre-run slot on a board read with a canonical view', () => {
  it('a program board, bound and current as served: CEE’s words, and no pre-analysis panel', async () => {
    board(PROGRAM, {})
    await openAnalysisTab()
    const slot = await screen.findByTestId('outputs-pre-run-view-only')
    expect(screen.getByTestId('analysis-view-only-chances-sentence').textContent).toBe(SENTENCE)
    expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist').textContent).toBe(ADD_FACE)
    expect(slot).not.toHaveTextContent(/run a first pass|No goal selected|Analyse anyway/i)
    expect(prePanel()).toBeNull()
  })

  it('CONTRAST: a non-program board with the same bound, current view keeps the pre-analysis panel unchanged', async () => {
    board(NOT_PROGRAM, {})
    await openAnalysisTab()
    expect(prePanel()).not.toBeNull()
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()
  })

  // ⛔ CHANGED CONTRACT (row 19, DL 24 Oct): this row pinned that a stale program Run mounted the panel, whose lines say no
  // result exists, with no way to run. It now says CEE's own not-current line, once, and never the old figures.
  it('a program board whose bound Run is stale (CEE’s stale face served): CEE’s line once, no figure, not the panel', async () => {
    // CEE's served stale face (hydrate/__tests__/fixtures/founder-blocked-reopen-247ae5b4.read.json).
    board(PROGRAM, { staleness: { ...capacity.canonical_analysis_view.staleness, stale: true, reason: 'graph_changed' },
      face_when_stale: 'Run the analysis again to see the chance.' })
    await openAnalysisTab()
    expect(prePanel()).toBeNull()
    const slot = screen.getByTestId('outputs-pre-run-view-only')
    expect(slot.querySelectorAll('[data-testid^="analysis-view-only-chance-"]')).toHaveLength(1)
    expect(slot.querySelector('[data-testid^="analysis-view-only-chance-"]')?.textContent).toBe('Run the analysis again to see the chance.')
    expect(slot.textContent).not.toMatch(/\d+%/)
  })

  it('CONTRAST: a program board whose bound Run is stale with no line of CEE’s: the panel, no served words', async () => {
    board(PROGRAM, { staleness: { ...capacity.canonical_analysis_view.staleness, stale: true, reason: 'graph_changed' } })
    await openAnalysisTab()
    expect(prePanel()).not.toBeNull()
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()
  })

  it('CONTRAST: a program board with no canonical view: the panel', async () => {
    board(PROGRAM, null)
    await openAnalysisTab()
    expect(prePanel()).not.toBeNull()
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()
  })
})

/**
 * A PROGRAM BOARD STAYS ONE ACROSS ITS RE-READ (old-code census, 27 Oct, DGAI staging 2b8306bf). Every program turn moves
 * the saved hash and bumps the saved-graph epoch (`applyCoreTurn.ts`), so the shared saved-graph read starts again and is
 * `pending` until it answers, or `failed` for good when it errors or answers another save. The board was read as "not a
 * program" in that window, and the dock's Analysis slot mounted the legacy pre-analysis panel ("No goal selected",
 * "Analyse anyway") in place of the program's chances.
 *   · after a program turn, while the read is reloading, the pre-analysis panel is not mounted and the chances stay;
 *   · a failed re-read keeps the board a program (`useSavedModelProgramState`) and the panel unmounted;
 *   · CONTRAST: a board that is not a program keeps its pre-analysis panel, after a turn too.
 * Real path: the real saved-graph read (only `fetch` stubbed), the real core-turn applier, the real dock. The panels are
 * markers (they need a toast provider); what is pinned is which one the slot mounts.
 * Fixture: CEE's served capacity read (S3 smoke-alpha2 r1, trimmed), each row on its own scenario id.
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
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
import { useSavedModelProgramState } from '../../nodes/shared/savedModelProgram'
import { applyCoreTurnState } from '../../../v5/applyCoreTurn'
import capacity from '../../runView/__tests__/fixtures/alpha2-capacity-r1-read.json'

const ADD_FACE = '‘Add one specialist’: about 50% chance of ‘Weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread, held within those bounds.'
const PROGRAM = { model_program: 'v1' }
// The café board's living model: a core model with no `model_program` (option-card-probe-2011 reads[6]).
const NOT_PROGRAM = { aims: [], links: [], factors: [], options: [] }

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
type Answer = 'serve' | 'hang' | 'error' | 'another_save'
/** How the graph route answers the NEXT read: as saved, never (still reloading), a server error, or another save's graph. */
let answer: Answer = 'serve'
let served: Rec = {}
let scenarioId = ''
let n = 0
const nextHash = () => { n += 1; return `${capacity.graph_hash}${String(n).padStart(4, '0')}` }

/** The capacity board on the canvas, pre-run, its saved read answering with this living model and CEE's served view adopted. */
function board(livingModel: Rec) {
  scenarioId = crypto.randomUUID()
  const graphHash = nextHash()
  served = { schema: 'scenario_graph.v1', scenario_id: scenarioId, graph_present: true, graph_hash: graphHash,
    graph: { nodes: capacity.graph.nodes, edges: [], living_model: livingModel } }
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    lastServerGraphHash: graphHash,
    nodes: capacity.graph.nodes.map((node, i) => ({ id: node.id, type: node.kind, position: { x: 0, y: i * 100 }, data: { label: node.label } })) as never,
    edges: [] as never,
    results: { ...useCanvasStore.getState().results, report: null, status: 'idle' },
  } as never)
  const parsed = parseCanonicalAnalysisView(capacity.canonical_analysis_view)
  expect(parsed).not.toBeNull()
  useCanonicalAnalysisViewStore.getState().adopt(scenarioId, parsed)
}

/** A core turn that saved a new revision, through the real applier: the saved hash moves and the read starts again. */
async function programTurn(next: Answer) {
  answer = next
  const revision = nextHash()
  served = { ...served, graph_hash: revision }
  act(() => {
    applyCoreTurnState({ model: { revision, graph: { nodes: [] } }, notes: [], analysis_state: null } as never, useCanvasStore.getState() as never)
  })
  expect(useCanvasStore.getState().lastServerGraphHash).toBe(revision)
  await settle()
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })
const graphReads = () => vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith(`/scenarios/${scenarioId}/graph`)).length

async function openAnalysisTab() {
  render(<ConversationProvider><OutputsDock /></ConversationProvider>)
  fireEvent.click(await screen.findByTestId('outputs-dock-tab-results'))
  await waitFor(() => expect(screen.getByTestId('outputs-dock-body')).toBeInTheDocument())
  await settle()
  expect(graphReads()).toBe(1)
}
const prePanel = () => screen.queryByTestId('stub-pre-run') ?? screen.queryByTestId('stub-pre-run-v3')

beforeEach(() => {
  cleanup()
  ensureMatchMedia()
  answer = 'serve'
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!/\/scenarios\/[^/]+\/graph$/.test(String(url))) return new Response('{}', { status: 404 })
    if (answer === 'hang') return new Promise<Response>(() => {})
    if (answer === 'error') return new Response('{}', { status: 500 })
    const body = answer === 'another_save' ? { ...served, graph_hash: 'f'.repeat(16) } : served
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
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

describe('the Analysis slot on a program board across the re-read after a turn', () => {
  it('while the read is reloading after a program turn: no pre-analysis panel, and the program’s chances stay', async () => {
    board(PROGRAM)
    await openAnalysisTab()
    expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist').textContent).toBe(ADD_FACE)
    expect(prePanel()).toBeNull()

    await programTurn('hang')
    // The read did start again and has not answered.
    expect(graphReads()).toBe(2)
    expect(prePanel()).toBeNull()
    expect(screen.getByTestId('outputs-pre-run-view-only')).not.toHaveTextContent(/No goal selected|Analyse anyway/i)
    expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist').textContent).toBe(ADD_FACE)
  })

  it.each([['a server error', 'error'], ['another save’s graph', 'another_save']] as const)(
    'a re-read that fails (%s) keeps the board a program: no pre-analysis panel, the chances stay', async (_, failure) => {
      board(PROGRAM)
      await openAnalysisTab()
      const state = renderHook(() => useSavedModelProgramState())
      await settle()
      expect(state.result.current).toBe('program')

      await programTurn(failure)
      expect(graphReads()).toBeGreaterThanOrEqual(2)
      expect(state.result.current).toBe('program')
      expect(prePanel()).toBeNull()
      expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist').textContent).toBe(ADD_FACE)
    })

  it('CONTRAST: a board that is not a program keeps its pre-analysis panel, before and after a turn', async () => {
    board(NOT_PROGRAM)
    await openAnalysisTab()
    expect(prePanel()).not.toBeNull()
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()

    await programTurn('serve')
    expect(graphReads()).toBe(2)
    expect(prePanel()).not.toBeNull()
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()
  })
})

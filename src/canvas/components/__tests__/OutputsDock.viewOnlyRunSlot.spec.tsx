/**
 * DL ruling A (23 Oct), the Analysis tab's pre-run slot: on a program board read whose canonical view is bound and
 * current, the slot says CEE's served words and does not mount the pre-analysis panel, whose lines ("No goal
 * selected", "You can run a first pass now", "Analyse anyway") say no result exists. Stale or unbound views, and a
 * board with no view, keep today's panel. The panels are markers here (they need a toast provider); what is pinned is
 * which one the slot mounts. Fixture: CEE's served capacity read (S3 smoke-alpha2 r1, trimmed).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
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

/** The capacity board on the canvas, pre-run, with CEE's served view (as served, changed, or none). */
function board(view: Record<string, unknown> | null) {
  useCanvasStore.setState({
    currentScenarioId: capacity.scenario_id,
    nodes: capacity.graph.nodes.map((n, i) => ({ id: n.id, type: n.kind, position: { x: 0, y: i * 100 }, data: { label: n.label } })) as never,
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
}

beforeEach(() => {
  cleanup()
  ensureMatchMedia()
  sessionStorage.clear()
  localStorage.clear()
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0, outputSurfaceOrigin: null, outputSurfaceOriginSeq: 0, outputSurfaceOriginAt: null })
  useFloatingPanelState.getState().close()
})
afterEach(() => { vi.clearAllMocks(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })

describe('the Analysis tab pre-run slot on a program board read', () => {
  it('bound and current as served: CEE’s words, and no pre-analysis panel', async () => {
    board({})
    await openAnalysisTab()
    const slot = await screen.findByTestId('outputs-pre-run-view-only')
    expect(screen.getByTestId('analysis-view-only-chances-sentence').textContent).toBe(SENTENCE)
    expect(screen.getByTestId('analysis-view-only-chance-add_one_specialist').textContent).toBe(ADD_FACE)
    expect(slot).not.toHaveTextContent(/run a first pass|No goal selected|Analyse anyway/i)
    expect(screen.queryByTestId('stub-pre-run')).toBeNull()
    expect(screen.queryByTestId('stub-pre-run-v3')).toBeNull()
  })

  it('CONTRAST: the bound Run is stale: today’s panel, no served words', async () => {
    // With CEE's served stale face (hydrate/__tests__/fixtures/founder-blocked-reopen-247ae5b4.read.json).
    board({ staleness: { ...capacity.canonical_analysis_view.staleness, stale: true, reason: 'graph_changed' },
      face_when_stale: 'Run the analysis again to see the chance.' })
    await openAnalysisTab()
    await waitFor(() => expect(screen.queryByTestId('stub-pre-run') ?? screen.queryByTestId('stub-pre-run-v3')).not.toBeNull())
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()
  })

  it('CONTRAST: no canonical view (a non-program board): today’s panel', async () => {
    board(null)
    await openAnalysisTab()
    await waitFor(() => expect(screen.queryByTestId('stub-pre-run') ?? screen.queryByTestId('stub-pre-run-v3')).not.toBeNull())
    expect(screen.queryByTestId('outputs-pre-run-view-only')).toBeNull()
  })
})

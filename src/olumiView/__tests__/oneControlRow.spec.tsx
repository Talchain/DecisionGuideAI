/**
 * ONE CONTROL ROW (Paul, 18 Nov: "one control row, no foot panel"; UI lead, 19 Nov). The team's Views and Compare views were two buttons at the
 * canvas foot; they are icons on the top row, inside the lens bar (ViewLensBar `extra`), outside the lenses' radio group. A control with
 * nothing to show is not drawn: neither before a reveal; Views not at Simple, where the cards draw no reveal marks (CoreCard).
 * Each row mounts the real canvas on the reveal fixture.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-router-dom')>()), useNavigate: vi.fn(() => vi.fn()) }))
vi.mock('../../flags', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../flags')>()), isAiPanelV2Enabled: () => true, isJourneyTabEnabled: vi.fn(() => false) }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../canvas/components/pre-analysis/hooks/usePreAnalysisData', () => ({ usePreAnalysisData: () => ({}) }))
vi.mock('../../canvas/hooks/useGraphReadiness', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../canvas/hooks/useGraphReadiness')>()), useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../../canvas/components/pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" /> }))
vi.mock('../../components/results/ResultsBody', () => ({ ResultsBody: () => <div data-testid="mock-results-body" /> }))
vi.mock('../../components/results/analysisNew/AnalysisNewTabBody', () => ({ AnalysisNewTabBody: () => <div /> }))
vi.mock('../../canvas/components/model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => <div /> }))
vi.mock('../../canvas/components/workspaceShell/AnalysisReadinessBar', () => ({ AnalysisReadinessBar: () => <div /> }))

import type { View } from '../client'
import { ViewCanvas } from '../ViewCanvas'
import { ConversationProvider } from '../../canvas/conversation/ConversationContext'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useCanvasStore } from '../../canvas/store'
import { setLevel, useSimpleLevel } from '../v12/simpleStore'
import { useViewsMarks } from '../v12/views/viewsMarks'
import { useCompare } from '../v12/views/useCompare'
import { COMPARE_WORDS } from '../v12/views/WhereWeDiffer'

const revealed: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1', 'strategy-reveal-split.core-261df1d4.view3.json'), 'utf8'))
const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'

function mount(view: View): void {
  useViewStore.setState({ uuid: UUID, sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  render(<ConversationProvider><div style={{ width: 1232, height: 704 }}><ViewCanvas /></div></ConversationProvider>)
}
const bar = () => screen.getByTestId('lens-bar')
const lenses = () => screen.getByTestId('lens-bar-lenses')

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  try { localStorage.clear(); sessionStorage.clear() } catch { /* unavailable */ }
  lane.on = true
  if (typeof window.DOMMatrixReadOnly !== 'function') Object.defineProperty(window, 'DOMMatrixReadOnly', { writable: true, value: class { m22 = 1; constructor(_t?: string) {} } })
  useSimpleLevel.setState({ levels: {} })
  useViewsMarks.setState({ on: true }); useCompare.setState({ open: false })
  useCanvasStore.setState({ currentScenarioId: UUID, nodes: [{ id: 'a', type: 'viewCard', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [], lodRung: 'full' } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); useCompare.setState({ open: false }); useViewsMarks.setState({ on: true })
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
})
const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

describe('the team\'s two controls sit on the top row, never at the canvas foot', () => {
  it('OR1 revealed, Detailed: both are icons inside the lens bar, outside its radio group; the foot holds neither; each press does what it did', async () => {
    setLevel('working', revealed.id)
    mount(revealed)
    await settle()
    const views = screen.getByTestId('views-toggle'), compare = screen.getByTestId('views-compare')
    expect([bar().contains(views), bar().contains(compare)]).toEqual([true, true])
    expect([lenses().contains(views), lenses().contains(compare)]).toEqual([false, false])
    expect(screen.queryByTestId('view-foot-toggle')).toBeNull()
    // Icons from the registry, named by their existing words.
    expect([views.textContent, views.getAttribute('aria-label'), compare.textContent, compare.getAttribute('aria-label')]).toEqual(['', 'Views', '', COMPARE_WORDS.control])
    expect([views.querySelector('svg') !== null, compare.querySelector('svg') !== null]).toEqual([true, true])
    expect(views.getAttribute('aria-pressed')).toBe('true')
    // A pressed control keeps its pressed colour on hover; an unpressed one takes the hover colour (as the lens buttons do).
    expect([views.className.includes('hover:text-text-body'), compare.className.includes('hover:text-text-body')]).toEqual([false, true])
    fireEvent.click(views)
    expect(useViewsMarks.getState().on).toBe(false)
    expect(screen.getByTestId('views-toggle').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByTestId('views-compare'))
    expect(useCompare.getState().open).toBe(true)
    expect(await screen.findByTestId('compare-stage')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('views-compare'))
    expect(useCompare.getState().open).toBe(false)
  })

  it('OR2 revealed, Simple: the cards draw no reveal marks, so Views is not drawn; Compare views is, on the top row', async () => {
    setLevel('simple', revealed.id)
    mount(revealed)
    await settle()
    expect(screen.queryByTestId('views-toggle')).toBeNull()
    expect(bar().contains(screen.getByTestId('views-compare'))).toBe(true)
    expect(screen.queryByTestId('view-foot-toggle')).toBeNull()
  })

  it('OR3 solo (nothing revealed): neither is drawn. CONTRAST: the lens bar and its lenses are', async () => {
    mount({ ...revealed, gated: false, collab: { ...revealed.collab, shared: [] } })
    await settle()
    expect([screen.queryByTestId('views-toggle'), screen.queryByTestId('views-compare'), screen.queryByTestId('view-foot-toggle')]).toEqual([null, null, null])
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
    expect(bar()).toBeInTheDocument()
  })
})

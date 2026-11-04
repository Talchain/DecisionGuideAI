/**
 * OWN VIEW FIRST (PILOT-PACK 1.1; DL 4 Nov): on the lane a member who joined by a colleague's link, and has not yet given or skipped
 * their view, lands on the Team tab with the private-view box focused, and no Olumi note is drawn until they have. The creator, and a
 * member who has given or skipped, land as before: the tab they left, and Olumi's note beside its card.
 * Fixture: core's whatif golden (three members: Ada 1, Bea 5, Cy 18), with the person on the page and their own views set per row.
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-router-dom')>()), useNavigate: vi.fn(() => vi.fn()) }))
vi.mock('../../../flags', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../flags')>()), isAiPanelV2Enabled: () => true, isJourneyTabEnabled: vi.fn(() => false) }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({ usePreAnalysisData: () => ({}) }))
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../hooks/useGraphReadiness')>()), useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" /> }))
vi.mock('../../../components/results/ResultsBody', () => ({ ResultsBody: () => <div data-testid="mock-results-body" /> }))
vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({ AnalysisNewTabBody: () => <div /> }))
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => <div /> }))
vi.mock('../workspaceShell/AnalysisReadinessBar', () => ({ AnalysisReadinessBar: () => <div /> }))

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useViewStore } from '../../../olumiView/store'
import { useMe } from '../../../olumiCore/me'
import { setTeamFetch } from '../../../olumiCore/team/api'
import type { View } from '../../../olumiView/client'

const golden = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.view.json'), 'utf8')) as View
const SID = golden.id
/** core's scenario id in its UUID form (src/olumiCore/team/sid.ts). */
const UUID = `00000000-0000-4000-8000-${SID.slice(2)}`
const NAMES: Record<string, string> = { 1: 'Ada', 5: 'Bea', 18: 'Cy' }
/** Bea and Cy joined by a link Ada made; Ada made the scenario. */
const INVITED = ['5', '18']

/** The page as `you` sees it: nothing revealed yet, and their own views in this round as given. */
const viewFor = (you: string, mine: View['collab']['mine'] = []): View =>
  ({ ...golden, you_id: you, you: NAMES[you], collab: { ...golden.collab, shared: [], mine } }) as View

let invites: string[] | null = INVITED
/** Set to hold core's answer to the invitations read until the row lets it go. */
let held: Promise<void> | null = null
beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  // On the lane as the lane build is (every lane check inside lane.ts included, so the Team tab is a surface the dock shows).
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  invites = INVITED
  held = null
  // The tab this session last left the dock on.
  sessionStorage.clear()
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: false, olumiAttention: null } as never)
  const answer = vi.fn(async (input: RequestInfo | URL) => {
    const p = new URL(String(input), window.location.href).pathname
    if (p === `/api/scenarios/${SID}/invites`) {
      if (held) await held
      return invites === null ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ invites: invites.map((id) => ({ id, name: NAMES[id], by: 'Ada', made: '2026-11-04T09:00:00Z', expires: null, status: 'live', revocable: false })) }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', answer)
  setTeamFetch(answer as unknown as typeof fetch)
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setTeamFetch(null); useMe.setState({ me: null, status: 'none' }) })

const land = async (view: View) => {
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready' } as never)
  render(<ConversationProvider><OutputsDock /></ConversationProvider>)
  await act(async () => { await new Promise((r) => setTimeout(r, 80)) })
}
const fronted = () => document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid') ?? null
const note = () => useCanvasStore.getState().olumiAttention?.turnId ?? null
/** The card the newest reply's next step sits beside, as the View canvas draws it. */
const cardOnCanvas = () => useCanvasStore.setState({ nodes: [{ id: 'per_specialist', type: 'viewCard', position: { x: 0, y: 0 }, data: { label: 'Per specialist' } }] } as never)

describe('a member who joined by a link gives their own view first', () => {
  it('Bea, invited and with no view yet: the Team tab, the private-view box focused, and no Olumi note', async () => {
    cardOnCanvas()
    await land(viewFor('5'))
    expect(fronted()).toBe('outputs-dock-tab-team')
    expect(document.activeElement?.getAttribute('data-testid')).toBe('team-view-text')
    expect(note()).toBeNull()
  })

  it('once Bea has given her view: Olumi\'s note is drawn, and her tab is not moved again', async () => {
    cardOnCanvas()
    await land(viewFor('5'))
    expect(note()).toBeNull()
    await act(async () => { useViewStore.setState({ view: viewFor('5', [{ id: 40, text: 'Hire in March', shared: false, skip: false }]) } as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(note()).toMatch(/^olumi-view-next:/)
    expect(fronted()).toBe('outputs-dock-tab-team')
  })

  it('while core\'s invitations are still being read, no Olumi note; then Bea lands on her view', async () => {
    let release = () => {}
    held = new Promise<void>((r) => { release = r })
    cardOnCanvas()
    await land(viewFor('5'))
    expect(note()).toBeNull()
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 50)) })
    expect(fronted()).toBe('outputs-dock-tab-team')
    expect(note()).toBeNull()
  })

  it('the landing is once: after she has given and gone to another tab, a new round asking again does not move her, and holds the note', async () => {
    cardOnCanvas()
    await land(viewFor('5'))
    await act(async () => { useViewStore.setState({ view: viewFor('5', [{ id: 40, text: 'Hire in March', shared: false, skip: false }]) } as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(note()).toMatch(/^olumi-view-next:/)
    await act(async () => { fireEvent.click(screen.getByTestId('outputs-dock-tab-olumi')) })
    await act(async () => { useViewStore.setState({ view: viewFor('5') } as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    // Olumi's note drawn after her first view is taken down again while this round's view is owed.
    expect(note()).toBeNull()
  })
})

describe('everyone else lands as before', () => {
  it('Ada, who made the scenario (nobody invited her): her own tab, and Olumi\'s note', async () => {
    cardOnCanvas()
    await land(viewFor('1'))
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('Bea once she has given her view: her own tab, and Olumi\'s note', async () => {
    cardOnCanvas()
    await land(viewFor('5', [{ id: 40, text: 'Hire in March', shared: false, skip: false }]))
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('Bea once she has skipped: her own tab, and Olumi\'s note', async () => {
    cardOnCanvas()
    await land(viewFor('5', [{ id: 40, text: '', shared: false, skip: true }]))
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('Bea once her view has been revealed: her own tab, and Olumi\'s note', async () => {
    cardOnCanvas()
    await land({ ...viewFor('5'), collab: { ...viewFor('5').collab, shared: [{ id: 40, by: 'Bea', by_id: '5', text: 'Hire in March', skip: false }] } } as View)
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('Bea when core\'s invitations could not be read: as before, never held on a guess', async () => {
    invites = null
    cardOnCanvas()
    await land(viewFor('5'))
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })
})

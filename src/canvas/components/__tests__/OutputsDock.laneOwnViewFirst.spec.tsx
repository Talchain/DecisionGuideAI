/**
 * OWN VIEW FIRST (PILOT-PACK 1.1; DL 4 Nov): on the lane a member core holds for their own view (the View's `gated`, core's one rule,
 * the same its page uses) lands on the Team tab with the private-view box focused, and no Olumi note is drawn until core no longer holds
 * them. Everyone core does not hold lands as before: the tab they left, and Olumi's note beside its card.
 * Fixture: core's whatif golden (three members: Ada 1, Bea 5, Cy 18), with the person on the page, their own views and `gated` set per
 * row as core would say them.
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

/** The page as `you` sees it: nothing revealed yet, their own views in this round, and whether core holds them. */
const viewFor = (you: string, gated: boolean, mine: View['collab']['mine'] = []): View =>
  ({ ...golden, you_id: you, you: NAMES[you], gated, collab: { ...golden.collab, shared: [], mine } }) as View

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  // On the lane as the lane build is (every lane check inside lane.ts included, so the Team tab is a surface the dock shows).
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  // The tab this session last left the dock on.
  sessionStorage.clear()
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: false, olumiAttention: null } as never)
  // Core's invitations name Bea alone (Ada invited her); Cy's link was the admin's. The Team tab's own list reads it.
  const answer = vi.fn(async (input: RequestInfo | URL) => {
    const p = new URL(String(input), window.location.href).pathname
    if (p === `/api/scenarios/${SID}/invites`) return new Response(JSON.stringify({ invites: [{ id: '5', name: 'Bea', by: 'Ada', made: '2026-11-04T09:00:00Z', expires: null, status: 'live', revocable: false }] }), { status: 200 })
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
// UI restore 11 Nov (Paul withdrew Model · Explore · Team): on the lane Team is a tab again, as the shell contract defines it; what is in
// front is the selected tab.
const fronted = () => document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid') ?? null
const note = () => useCanvasStore.getState().olumiAttention?.turnId ?? null
/** The card the newest reply's next step sits beside, as the View canvas draws it. */
const cardOnCanvas = () => useCanvasStore.setState({ nodes: [{ id: 'per_specialist', type: 'viewCard', position: { x: 0, y: 0 }, data: { label: 'Per specialist' } }] } as never)

const given = [{ id: 40, text: 'Hire in March', shared: false, skip: false, figures: [], can_share: false }]

describe('a member core holds gives their own view first', () => {
  it('Bea, held: the Team tab, the private-view box focused, and no Olumi note', async () => {
    cardOnCanvas()
    await land(viewFor('5', true))
    expect(fronted()).toBe('outputs-dock-tab-team')
    expect(document.activeElement?.getAttribute('data-testid')).toBe('team-view-text')
    expect(note()).toBeNull()
  })

  it('once core no longer holds her: Olumi\'s note is drawn, and her tab is not moved again', async () => {
    cardOnCanvas()
    await land(viewFor('5', true))
    expect(note()).toBeNull()
    await act(async () => { useViewStore.setState({ view: viewFor('5', false, given) } as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(note()).toMatch(/^olumi-view-next:/)
    expect(fronted()).toBe('outputs-dock-tab-team')
  })

  it('the landing is once: if core holds her again after she has gone to another tab, she is not moved, and the note is held', async () => {
    cardOnCanvas()
    await land(viewFor('5', true))
    await act(async () => { useViewStore.setState({ view: viewFor('5', false, given) } as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(note()).toMatch(/^olumi-view-next:/)
    // She leaves the Team tab by pressing the Olumi tab, which returns the dock to Olumi.
    await act(async () => { fireEvent.click(screen.getByTestId('outputs-dock-tab-olumi')) })
    await act(async () => { useViewStore.setState({ view: viewFor('5', true) } as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    expect(note()).toBeNull()
  })

  it('who is held is core\'s word alone: Cy, whose link the admin made (not in core\'s invitations), is held too', async () => {
    cardOnCanvas()
    await land(viewFor('18', true))
    expect(fronted()).toBe('outputs-dock-tab-team')
    expect(note()).toBeNull()
  })

  it('held before there is a model: the Team tab, not the brief box (the brief is not hers to write)', async () => {
    await land({ ...viewFor('5', true), model: null, version: null, proposal: null } as View)
    expect(fronted()).toBe('outputs-dock-tab-team')
  })
})

describe('everyone core does not hold lands as before', () => {
  it('Ada, who wrote the brief: her own tab, and Olumi\'s note', async () => {
    cardOnCanvas()
    await land(viewFor('1', false))
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('Bea once she has given her view: her own tab, and Olumi\'s note', async () => {
    cardOnCanvas()
    await land(viewFor('5', false, given))
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('Bea in a new round, having given a view in an earlier one (core no longer holds her): her own tab, and Olumi\'s note', async () => {
    cardOnCanvas()
    await land(viewFor('5', false))
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('a View from a core without the field holds nobody', async () => {
    cardOnCanvas()
    const v = viewFor('5', true) as unknown as Record<string, unknown>
    delete v.gated
    await land(v as unknown as View)
    expect(fronted()).toBe('outputs-dock-tab-results')
    expect(note()).toMatch(/^olumi-view-next:/)
  })

  it('a page opened for another person than the browser now holds: not landed for them', async () => {
    cardOnCanvas()
    useMe.setState({ me: { id: '1', name: 'Ada' }, status: 'ready' })
    useViewStore.setState({ uuid: UUID, sid: SID, view: viewFor('5', true), error: null, status: 'ready' } as never)
    render(<ConversationProvider><OutputsDock /></ConversationProvider>)
    await act(async () => { await new Promise((r) => setTimeout(r, 80)) })
    expect(fronted()).toBe('outputs-dock-tab-results')
  })
})

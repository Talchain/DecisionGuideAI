/**
 * A revealed detail never takes over returning work (Codex 008, 18 Nov: native journey finding 2). The detail opens only on a press (a chip),
 * and while it is open the dock's tab strip stays visible and usable; Close returns to the tab and camera it was opened from.
 * RN1 mounts the real canvas on an approved, revealed model with nothing in storage: nothing opens by itself.
 * RN2 and RN3 press a real chip beside the real dock.
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
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../../canvas/components/OutputsDock'
import { ConversationProvider } from '../../canvas/conversation/ConversationContext'
import { CardViewChips } from '../RevealMarks'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useUIStore } from '../../stores/uiStore'
import { useCanvasStore } from '../../canvas/store'
import { useReveal } from '../reveal'
import { forgetLanded } from '../revealReturn'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1', 'strategy-reveal-split.core-261df1d4.view3.json'), 'utf8'))
const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const CARD = 'cross_team_adoption'
const tab = (id: string) => screen.getByTestId(`outputs-dock-tab-${id}`)
const fronted = () => document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid') ?? null

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  try { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'olumi' })) } catch { /* unavailable */ }
  lane.on = true
  if (typeof window.DOMMatrixReadOnly !== 'function') Object.defineProperty(window, 'DOMMatrixReadOnly', { writable: true, value: class { m22 = 1; constructor(_t?: string) {} } })
  useViewStore.setState({ uuid: UUID, sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  useCanvasStore.setState({ currentScenarioId: UUID, nodes: [{ id: 'a', type: 'viewCard', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [], lodRung: 'full' } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); forgetLanded()
  useReveal.setState({ selected: null, evidence: null, card: null, chip: null })
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
})

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

describe('a revealed detail opens only on a press', () => {
  it('RN1 catch: a fresh mount (nothing in storage) of an approved, revealed model opens no detail and leaves the tab strip', async () => {
    render(<ConversationProvider><div style={{ width: 1232, height: 704 }}><ViewCanvas /></div><OutputsDock /></ConversationProvider>)
    // Long enough for the old landing's settle window (800 ms) to have fired in a canvas that settles.
    await settle(1500)
    expect(useReveal.getState().selected).toBeNull()
    expect(screen.queryByTestId('reveal-dock')).toBeNull()
    expect(screen.getAllByTestId('outputs-dock-tablist').length).toBeGreaterThan(0)
    expect(fronted()).toBe('outputs-dock-tab-olumi')
  })

  it('RN2 catch: pressing the chip opens the detail AND the tab strip stays; a tab press works', async () => {
    render(<ConversationProvider><CardViewChips card={CARD} /><OutputsDock /></ConversationProvider>)
    await settle()
    const chip = document.querySelector<HTMLElement>(`[data-reveal-card-chip="${CARD}"]:not([data-reveal-kind="evidence"])`)!
    expect(chip).not.toBeNull()
    fireEvent.click(chip)
    await settle()
    expect(screen.getByTestId('reveal-dock')).toBeInTheDocument()
    expect(screen.getAllByTestId('outputs-dock-tablist').length).toBeGreaterThan(0)
    fireEvent.click(tab('olumi'))
    await settle()
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    expect(screen.getAllByTestId('outputs-dock-tablist').length).toBeGreaterThan(0)
  })

  it('RN3 catch: Close returns to the tab the detail was opened from', async () => {
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    render(<ConversationProvider><CardViewChips card={CARD} /><OutputsDock /></ConversationProvider>)
    await settle()
    fireEvent.click(document.querySelector<HTMLElement>(`[data-reveal-card-chip="${CARD}"]:not([data-reveal-kind="evidence"])`)!)
    await settle()
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    expect(fronted()).toBe('outputs-dock-tab-team')
    fireEvent.click(screen.getByTestId('reveal-dock-close'))
    await settle()
    expect(screen.queryByTestId('reveal-dock')).toBeNull()
    expect(fronted()).toBe('outputs-dock-tab-olumi')
  })
})

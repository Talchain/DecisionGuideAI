/**
 * The Reasoning tab is back on the olumi-core lane (DL brief, 4 Nov), drawn from core's View (src/olumiView/ViewReasoning.tsx): the dock
 * offers it, and fronting it draws the View's Run, never the CEE-fed `AnalysisNewTabBody`, and no Run control. Off the lane the tab
 * keeps its legacy body.
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({ AnalysisNewTabBody: () => <div data-testid="stub-legacy-reasoning" /> }))
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => <div data-testid="stub-reanalyse-bar" /> }))
vi.mock('../workspaceShell/AnalysisReadinessBar', () => ({ AnalysisReadinessBar: () => <div data-testid="stub-readiness-bar" /> }))

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useMe } from '../../../olumiCore/me'
import { useViewStore } from '../../../olumiView/store'
import { setTeamFetch } from '../../../olumiCore/team/api'

const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const view = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')), gated: false }

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  const reply = (async () => new Response(JSON.stringify(view), { status: 200 })) as unknown as typeof fetch
  vi.stubGlobal('fetch', reply)
  setTeamFetch(reply)
  sessionStorage.clear()
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'analysisNew' } as never)
  useCanvasStore.setState({ nodes: [{ id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } }], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: true } as never)
  // Not a held member (`gated`, which the synthetic golden reads true): a held member lands on the Team panel, which on the lane has no
  // tabs (DL ruling 9 Nov), and this row is about the Reasoning tab.
  useViewStore.setState({ uuid: UUID, sid: view.id, view: { ...view, gated: false }, error: null, stale: false, status: 'ready' } as never)
})
afterEach(() => { useMe.setState({ me: null, status: 'none' }); useViewStore.setState({ explanationTarget: null, explanationReturn: null, panelLevels: { reasoning: 'glance' }, expandedRests: {}, reasoningFigure: null }); vi.unstubAllGlobals(); vi.unstubAllEnvs(); setTeamFetch(null) })

const dockOn = async (tab: string) => {
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: tab }))
  const r = render(<ConversationProvider><OutputsDock /></ConversationProvider>)
  await act(async () => { await new Promise((res) => setTimeout(res, 30)) })
  return r
}

describe('the Reasoning tab on the olumi-core lane', () => {
  it('is offered, and pressed it draws core\'s Run from the View: no legacy body, no run cover, no Run control', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    await dockOn('analysisNew')
    fireEvent.click(screen.getByTestId('outputs-dock-tab-analysisNew'))
    const body = screen.getByTestId('view-reasoning')
    expect(screen.getByRole('button', { name: 'Glance' })).toHaveAttribute('aria-pressed', 'true')
    expect(body.querySelectorAll('[data-testid="reasoning-share-bar"]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Detail' }))
    expect(body.querySelectorAll('[data-testid="reasoning-share-bar"]')).toHaveLength(2)
    // Each option's chance and core's driver line live in Analysis only: Reasoning draws neither (no duplicate).
    expect(body.querySelector('[data-view="run.lead"]')).toBeNull()
    expect(body.querySelectorAll('[data-view$=".driver.text"], [data-view-label$=".driver.text"]').length).toBe(0)
    expect(screen.queryByTestId('stub-legacy-reasoning')).toBeNull()
    expect(document.querySelectorAll('[data-testid="stub-reanalyse-bar"], [data-testid="stub-readiness-bar"]').length).toBe(0)
  })

  it('reopens the exact explanation with the keyboard, then restores Reasoning, Detail and the remounted trigger', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    await dockOn('analysisNew')
    const user = userEvent.setup()
    const tab = screen.getByTestId('outputs-dock-tab-analysisNew')
    await user.click(tab)
    const detail = screen.getByRole('button', { name: 'Detail' })
    const glance = screen.getByRole('button', { name: 'Glance' })
    act(() => glance.focus())
    await user.tab()
    expect(detail).toHaveFocus()
    await user.keyboard('{Enter}')
    const row = document.querySelector<HTMLButtonElement>('[data-rest-figure] .ok-loop-chart-row')!
    act(() => row.focus())
    await user.tab()
    const trigger = row.parentElement!.querySelector<HTMLButtonElement>('[data-explain-trigger]')!
    expect(trigger).toHaveFocus()
    const name = trigger.getAttribute('aria-label')!
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByTestId('model-explanations')).toBeVisible())
    expect(document.activeElement).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement?.closest('[data-explanation-passage]')).not.toBeNull()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name })).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Detail' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('off the lane the tab keeps its legacy body', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    await dockOn('analysisNew')
    fireEvent.click(screen.getByTestId('outputs-dock-tab-analysisNew'))
    expect(screen.getByTestId('stub-legacy-reasoning')).toBeInTheDocument()
    expect(screen.queryByTestId('view-reasoning')).toBeNull()
  })
})

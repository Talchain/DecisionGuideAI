/**
 * The Reasoning tab is back on the olumi-core lane (DL brief, 4 Nov), drawn from core's View (src/olumiView/ViewReasoning.tsx): the dock
 * offers it, and fronting it draws the View's Run, never the CEE-fed `AnalysisNewTabBody`, and no Run control. Off the lane the tab
 * keeps its legacy body.
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
vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({ AnalysisNewTabBody: () => <div data-testid="stub-legacy-reasoning" /> }))
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => <div data-testid="stub-reanalyse-bar" /> }))
vi.mock('../workspaceShell/AnalysisReadinessBar', () => ({ AnalysisReadinessBar: () => <div data-testid="stub-readiness-bar" /> }))

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useViewStore } from '../../../olumiView/store'
import { setTeamFetch } from '../../../olumiCore/team/api'

const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8'))

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  const reply = (async () => new Response(JSON.stringify(view), { status: 200 })) as unknown as typeof fetch
  vi.stubGlobal('fetch', reply)
  setTeamFetch(reply)
  sessionStorage.clear()
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'analysisNew' } as never)
  useCanvasStore.setState({ nodes: [{ id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } }], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: true } as never)
  useViewStore.setState({ uuid: UUID, sid: view.id, view, error: null, stale: false, status: 'ready' } as never)
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setTeamFetch(null) })

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
    expect(body.querySelector('[data-view="run.lead"]')?.textContent).toBe(view.model.run.lead)
    // Core's driver line, drawn once: as the text, or (the design lead's v10 marker, when the driver carries low/high) as the marker's
    // label and hover, its path in `data-view-label` (ViewChances.tsx DriverRange).
    const driver = view.model.cards.find((c: { id: string }) => c.id === 'second_oven').driver
    const asText = body.querySelector('[data-view="second_oven.driver.text"]'), asMarker = body.querySelector('[data-view-label="second_oven.driver.text"]')
    expect([asText, asMarker].filter((e) => e !== null).length, 'core\'s driver line drawn exactly once').toBe(1)
    if (asMarker !== null) expect([asMarker.getAttribute('aria-label'), asMarker.getAttribute('title')]).toEqual([driver.text, driver.title])
    else expect(asText?.textContent).toBe(driver.text)
    expect(screen.queryByTestId('stub-legacy-reasoning')).toBeNull()
    expect(document.querySelectorAll('[data-testid="stub-reanalyse-bar"], [data-testid="stub-readiness-bar"]').length).toBe(0)
  })

  it('off the lane the tab keeps its legacy body', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    await dockOn('analysisNew')
    fireEvent.click(screen.getByTestId('outputs-dock-tab-analysisNew'))
    expect(screen.getByTestId('stub-legacy-reasoning')).toBeInTheDocument()
    expect(screen.queryByTestId('view-reasoning')).toBeNull()
  })
})

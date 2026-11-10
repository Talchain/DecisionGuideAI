/**
 * The Analysis tab on the olumi-core lane draws the crafted components ported onto olumi.view/3 (src/olumiView/port/PortAnalysisTab.tsx),
 * on the real dock mount path: core's lead as the headline, each option's chance per aim, core's own likely mark, the evidence disclosure
 * and "What to act on next" in core's words; the earlier plain block (`view-chances`) is gone. Off the lane, neither mounts.
 * Fixture: the real-AI hiring board (fixtures/real), two aims per option.
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
import { drawnByRows, driverCardsOf } from '../../../olumiView/port/pick'

const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real/hiring.view3.json'), 'utf8'))

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  const reply = (async () => new Response(JSON.stringify(view), { status: 200 })) as unknown as typeof fetch
  vi.stubGlobal('fetch', reply)
  setTeamFetch(reply)
  sessionStorage.clear()
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
  useCanvasStore.setState({ nodes: [{ id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } }], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: false } as never)
  useViewStore.setState({ uuid: UUID, sid: view.id, view, error: null, stale: false, status: 'ready' } as never)
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); setTeamFetch(null) })

const dockOn = async (tab: string) => {
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: tab }))
  const r = render(<ConversationProvider><OutputsDock /></ConversationProvider>)
  await act(async () => { await new Promise((res) => setTimeout(res, 30)) })
  return r
}

describe('the Analysis tab on the olumi-core lane draws the ported components', () => {
  it('mounts the ported hero in the dock: core\'s lead, both aims\' groups, core\'s likely marks; not the earlier plain block', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    await dockOn('results')
    fireEvent.click(screen.getByTestId('outputs-dock-tab-results'))
    const slot = screen.getByTestId('outputs-pre-run-view-only')
    const hero = slot.querySelector('[data-testid="port-analysis-hero"]')!
    expect(hero).not.toBeNull()
    expect(hero.querySelector('[data-view="run.lead"]')!.textContent).toBe(view.model.run.lead)
    expect([...hero.querySelectorAll<HTMLElement>('[data-testid="port-aim-group"]')].map((g) => g.dataset['aim'])).toEqual(['boost_productivity', 'meet_launch_deadline'])
    expect(hero.querySelectorAll('[data-leader="true"]').length).toBe(2)
    expect(slot.querySelector('[data-testid="view-chances"]')).toBeNull()
    // the coach's newest next step, in core's words at its chat path (its move tap is the conversation's own control, in the slot)
    const k = view.chat.findIndex((t: { answer: { next: { newest: boolean } } | null }) => t.answer?.next.newest === true)
    // Build 2b: the next step is said once, in the restored "Focus now" section (SC-02), no longer in the hero; same path, same words.
    expect(hero.querySelector(`[data-view="chat.${k}.answer.next.label"]`)).toBeNull()
    expect(slot.querySelectorAll(`[data-view="chat.${k}.answer.next.label"]`)).toHaveLength(1)
    expect(slot.querySelector(`[data-testid="port-focus-next"] [data-view="chat.${k}.answer.next.label"]`)!.textContent).toBe(view.chat[k].answer.next.label)
    // The lower sections hold only what no row says (SC-02, 502cb476: say each thing once). On this board each option's driver line is
    // said under its row and core sends no tipping, rests, failure or trade-off lines, so the disclosure has nothing left and is not drawn.
    const said = drawnByRows(view.model)
    expect(driverCardsOf(view.model).map((c: { id: string }) => said.drivers.has(c.id))).toEqual(driverCardsOf(view.model).map(() => true))
    expect(['tipping', 'rests', 'failure', 'compared'].map((k) => view.model.run[k] ?? null)).toEqual([null, null, null, null])
    expect(hero.querySelector('[data-testid="port-evidence-disclosure"]')).toBeNull()
  })

  it('off the lane neither the ported hero nor the plain block mounts', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    await dockOn('results')
    fireEvent.click(screen.getByTestId('outputs-dock-tab-results'))
    expect(screen.queryByTestId('port-analysis-hero')).toBeNull()
    expect(screen.queryByTestId('view-chances')).toBeNull()
  })
})

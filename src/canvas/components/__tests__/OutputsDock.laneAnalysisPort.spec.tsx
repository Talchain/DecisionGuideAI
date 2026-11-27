/**
 * The Analysis tab on the olumi-core lane draws the crafted components ported onto olumi.view/3 (src/olumiView/port/PortAnalysisTab.tsx),
 * on the real dock mount path: core's lead as the headline, each option's chance per aim, core's own likely mark, the evidence disclosure
 * and "What to act on next" in core's words; the earlier plain block (`view-chances`) is gone. Off the lane, neither mounts.
 * Fixture: the real-AI hiring board (fixtures/real), two aims per option.
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
import { chartGroupsOf } from '../../../olumiView/port/pick'

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

describe('the Analysis tab on the olumi-core lane draws what the model implies (redesign, 18 Nov)', () => {
  it('shows the lead aim in the dock and switches the chart and its heading to the other aim', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    await dockOn('results')
    fireEvent.click(screen.getByTestId('outputs-dock-tab-results'))
    const slot = screen.getByTestId('outputs-pre-run-view-only')
    expect(slot.querySelector('[data-testid="port-analysis-tab"]')).toHaveAttribute('data-analysis-state', 'chance')
    const lead = slot.querySelector('[data-view="run.lead"]')
    expect(lead?.textContent).toBe(view.model.run.lead)
    const control = within(slot).getByRole('group', { name: 'Aim' })
    const groups = chartGroupsOf(view.model)
    expect(groups.map((g) => g.aimId)).toEqual(['boost_productivity', 'meet_launch_deadline'])
    const [first, second] = groups
    const showOnly = (group: (typeof groups)[number]) => {
      const chart = within(slot).getByTestId('analysis-chance-chart')
      expect(chart).toHaveAccessibleName(group.aim.text)
      expect([...chart.querySelectorAll('[data-chart-aim]')].map((el) => el.getAttribute('data-chart-aim'))).toEqual([group.aimId])
      expect([...chart.querySelectorAll('[data-chart-option]')].map((el) => el.getAttribute('data-chart-option'))).toEqual(group.rows.map(({ card }) => card.id))
      for (const { card, row, i } of group.rows) {
        const path = `${card.id}.rows.${i}`
        expect(chart.querySelector(`[data-view="${path}.value"]`)?.textContent).toBe(row.value)
        expect(chart.querySelector(`[data-view="${path}.likely.glyph"]`)?.textContent).toBe(row.likely?.glyph)
      }
      return chart
    }
    expect(first!.rows.length).toBeGreaterThan(1)
    expect(first!.rows.some(({ row }) => row.likely != null)).toBe(true)
    expect(within(control).getByRole('button', { name: first!.aim.text })).toHaveAttribute('aria-pressed', 'true')
    expect(showOnly(first!).querySelector('[data-view="run.lead"]')).toBeNull()
    const other = within(control).getByRole('button', { name: second!.aim.text })
    fireEvent.click(other)
    expect(other).toHaveAttribute('aria-pressed', 'true')
    const chart = showOnly(second!)
    expect(within(chart).getByRole('heading', { name: second!.aim.text })).toHaveAttribute('data-view', second!.aim.at)
    expect(lead?.textContent).toBe(view.model.run.lead)
    expect(lead!.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(slot.querySelector('[data-testid="view-chances"]')).toBeNull()
    // The old hero and its repeats are gone.
    expect(slot.querySelector('[data-testid="port-analysis-hero"]')).toBeNull()
  })

  it('off the lane neither the chart nor the plain block mounts', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    await dockOn('results')
    fireEvent.click(screen.getByTestId('outputs-dock-tab-results'))
    expect(screen.queryByTestId('analysis-chance-chart')).toBeNull()
    expect(screen.queryByTestId('view-chances')).toBeNull()
  })
})

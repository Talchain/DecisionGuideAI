/**
 * DL ruling 3 Nov (lane audit 12): core runs the analysis on every save, so on the olumi-core lane a Run control is a dead control and
 * none is offered: no Analyse beside the composer (this reverses review 00052 #3's keep), no readiness or Re-analyse bar in any tab's
 * footer, and Cmd+Enter runs nothing and posts nothing. Off the lane the footer bars are as before.
 */
import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-router-dom')>()), useNavigate: vi.fn(() => vi.fn()) }))
vi.mock('../../../flags', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../flags')>()), isAiPanelV2Enabled: () => true, isJourneyTabEnabled: vi.fn(() => false) }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('../pre-analysis/hooks/usePreAnalysisData', () => ({ usePreAnalysisData: () => ({}) }))
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../hooks/useGraphReadiness')>()), useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => <div data-testid="pre-analysis-stub" /> }))
vi.mock('../../../components/results/ResultsBody', () => ({ ResultsBody: () => <div data-testid="mock-results-body" /> }))
vi.mock('../../../components/results/analysisNew/AnalysisNewTabBody', () => ({ AnalysisNewTabBody: () => <div /> }))
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => <div data-testid="stub-reanalyse-bar" /> }))
vi.mock('../workspaceShell/AnalysisReadinessBar', () => ({ AnalysisReadinessBar: () => <div data-testid="stub-readiness-bar" /> }))

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useViewStore } from '../../../olumiView/store'
import { setTeamFetch } from '../../../olumiCore/team/api'
import { useCanvasKeyboardShortcuts } from '../../hooks/useCanvasKeyboardShortcuts'

const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
let posts: string[] = []

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  posts = []
  const record = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') !== 'GET') posts.push(new URL(String(input), window.location.href).pathname)
    return new Response(JSON.stringify(view), { status: 200 })
  }) as unknown as typeof fetch
  vi.stubGlobal('fetch', record)
  setTeamFetch(record)
  sessionStorage.clear()
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
  useCanvasStore.setState({ nodes: [{ id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } }], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: false } as never)
  useViewStore.setState({ uuid: UUID, sid: 's_000000000001', view: { ...view, proposal: null }, error: null, status: 'ready' } as never)
})
afterEach(() => { vi.unstubAllGlobals(); setTeamFetch(null); lane.on = true })

const runControls = () => [
  ...document.querySelectorAll('[data-testid="view-composer-analyse"], [data-testid="stub-reanalyse-bar"], [data-testid="stub-readiness-bar"]'),
].map((e) => e.getAttribute('data-testid'))
const dockOn = async (tab: string) => {
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: tab }))
  const r = render(<ConversationProvider><OutputsDock /></ConversationProvider>)
  await act(async () => { await new Promise((res) => setTimeout(res, 30)) })
  return r
}

describe('no Run control on the lane (DL ruling, lane audit 12)', () => {
  for (const tab of ['olumi', 'results', 'diagnostics', 'team']) {
    it(`the ${tab} tab offers no Run control`, async () => {
      const { unmount } = await dockOn(tab)
      expect(runControls()).toEqual([])
      unmount()
    })
  }

  it('after a Run on record, the Olumi tab offers no Analyse beside its composer', async () => {
    useCanvasStore.setState({ hasCompletedFirstRun: true } as never)
    const { unmount } = await dockOn('olumi')
    expect(document.querySelector('[data-testid="view-composer"]')).not.toBeNull()
    expect(runControls()).toEqual([])
    unmount()
  })

  it('Cmd+Enter runs nothing and posts nothing on the lane', async () => {
    const run = vi.fn()
    const { unmount } = renderHookShortcuts(run)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
    await act(async () => { await new Promise((res) => setTimeout(res, 30)) })
    expect(run).not.toHaveBeenCalled()
    expect(posts).toEqual([])
    unmount()
  })

  it("off the lane: Cmd+Enter runs, and a tab's footer offers its Run bar, as before", async () => {
    lane.on = false
    const run = vi.fn()
    const { unmount } = renderHookShortcuts(run)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
    expect(run).toHaveBeenCalledTimes(1)
    unmount()
    await dockOn('diagnostics')
    expect(runControls().length).toBeGreaterThan(0)
  })
})

function Shortcuts({ run }: { run: () => void }) { useCanvasKeyboardShortcuts({ onRunSimulation: run }); return null }
const renderHookShortcuts = (run: () => void) => render(<Shortcuts run={run} />)

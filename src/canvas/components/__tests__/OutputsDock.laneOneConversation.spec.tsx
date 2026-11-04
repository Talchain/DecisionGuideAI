/**
 * Lane audit (openers 14, 16, 24, 43; empty 5.4, 5.7): on the olumi-core lane every send reaches core through the Olumi tab's writer,
 * whichever surface makes it and whether or not the Olumi tab is showing. The old conversation's sends (Team's "Ask Olumi where we
 * differ", the Model tab's discuss buttons, hand-offs) say their words to core; its system events send nothing; the canvas's asks are
 * answered with the dock on another tab, and front the Olumi tab. While Olumi answers, the composer says so; a re-read that fails after
 * a good View says so. Requests are recorded at the page's fetch: none goes to /bff or /proxy.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => <div /> }))
vi.mock('../workspaceShell/AnalysisReadinessBar', () => ({ AnalysisReadinessBar: () => <div /> }))

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { ConversationProvider, useConversationContext } from '../../conversation/ConversationContext'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useViewStore } from '../../../olumiView/store'
import { useViewChat } from '../../../olumiView/ViewChat'
import { setTeamFetch } from '../../../olumiCore/team/api'

const UUID = '00000000-0000-4000-8000-000000000001', SID = 's_000000000001'
const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
// The person here wrote the brief, whom core never holds for their own view (`gated`); the golden, a synthetic fixture with no first
// turn, reads it true.
let seen: { method: string; path: string; body?: unknown }[] = []
let conversation: ReturnType<typeof useConversationContext> | null = null
function Probe() { conversation = useConversationContext(); return null }

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  seen = []
  const record = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ method: init?.method ?? 'GET', path: new URL(String(input), window.location.href).pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify(view), { status: 200 })
    return new Response(JSON.stringify({ proposal: null }), { status: 201 })
  }) as unknown as typeof fetch
  vi.stubGlobal('fetch', record)
  setTeamFetch(record)
  sessionStorage.clear()
  sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
  useCanvasStore.setState({ nodes: [{ id: 'cups_now', type: 'viewCard', position: { x: 0, y: 0 }, data: { label: 'cups now' } }], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: false, selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } } as never)
  useViewStore.setState({ uuid: UUID, sid: SID, view: { ...view, proposal: null, gated: false }, error: null, status: 'ready' } as never)
})
afterEach(() => { vi.unstubAllGlobals(); setTeamFetch(null); lane.on = true; useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null }) })

const dock = async () => {
  render(<ConversationProvider><Probe /><OutputsDock /></ConversationProvider>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const fronted = () => document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid') ?? null
const posts = () => seen.filter((r) => r.method === 'POST')
const old = () => seen.filter((r) => r.path.startsWith('/bff/') || r.path.startsWith('/proxy/'))

describe('every send on the lane reaches core', () => {
  it('the canvas\'s asks are answered with the dock collapsed, and open it on the Olumi tab', async () => {
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: false, activeTab: 'results' }))
    await dock()
    expect(document.querySelector('[data-testid="view-chat"]')).toBeNull()
    expect(useGuidanceStore.getState()._sendMessage).not.toBeNull()
    await act(async () => { useGuidanceStore.getState()._sendMessage!('What drives the price?') })
    await waitFor(() => expect(posts().map((r) => r.path)).toEqual([`/api/scenarios/${SID}/messages`]))
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    expect(old()).toEqual([])
  })

  it('the old conversation\'s message (Team, the Model tab, hand-offs) is said to core', async () => {
    await dock()
    await act(async () => { await conversation!.sendMessage('Where do we differ?') })
    await waitFor(() => expect(posts().map((r) => [r.path, (r.body as { text?: string }).text])).toEqual([[`/api/scenarios/${SID}/messages`, 'Where do we differ?']]))
    expect(old()).toEqual([])
  })

  it('the old conversation\'s chip press goes to core (a challenge on one card to its challenge route)', async () => {
    await dock()
    useCanvasStore.setState({ selection: { nodeIds: new Set(['cups_now']), edgeIds: new Set(), anchorPosition: null } } as never)
    await act(async () => { await conversation!.dispatchAction({ id: 'ask:challenge', label: 'Challenge', message: 'Challenge this', source: 'chip' } as never) })
    await waitFor(() => expect(posts().map((r) => r.path)).toEqual([`/api/scenarios/${SID}/challenge`]))
    expect(old()).toEqual([])
  })

  it('the old conversation\'s system events send nothing', async () => {
    await dock()
    await act(async () => { await conversation!.sendSystemEvent({ event_type: 'direct_graph_edit', timestamp: new Date(0).toISOString(), details: {} } as never) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(posts()).toEqual([])
    expect(old()).toEqual([])
  })
})

describe('the composer says what is happening', () => {
  it('while a write is in flight it says Olumi is thinking', async () => {
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'olumi' }))
    await dock()
    expect(screen.queryByTestId('view-chat-working')).toBeNull()
    await act(async () => { useViewChat.setState({ busy: true }) })
    expect(screen.getByTestId('view-chat-working')).toHaveTextContent('Olumi is thinking…')
  })

  it('a re-read that fails after a good View says so beside the conversation', async () => {
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'olumi' }))
    await dock()
    await act(async () => { useViewStore.setState({ error: 'Olumi could not be reached. Reload the page.' } as never) })
    expect(screen.getByTestId('view-chat-unread')).toHaveTextContent('Olumi could not be reached. Reload the page.')
  })
})

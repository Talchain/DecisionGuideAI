/**
 * Canvas A S6 D6 (DL 2 Nov): on the olumi-core lane an empty scenario opens the dock on the Olumi tab with the brief box focused
 * (the lane mounts no first-use composer, so the collapsed first-use rail would leave the empty canvas looking dead). Off the lane
 * the first-use rail keeps the dock collapsed, as before.
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useViewStore } from '../../../olumiView/store'
import { useViewChat } from '../../../olumiView/ViewChat'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { focusDockedOlumi } from '../../conversation/dockedOlumiFocus'

const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
/** core's s_000000000001 in its UUID form (src/olumiCore/team/sid.ts): the address of a scenario core holds. */
const PAIRED = '00000000-0000-4000-8000-000000000001'

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
  }
  sessionStorage.clear()
  useUIStore.setState({ activeRightPanel: null, activeOutputTab: 'results' } as never)
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: UUID, hasCompletedFirstRun: false } as never)
  useViewStore.setState({ uuid: UUID, sid: null, view: null, error: null, status: 'none' })
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
})
afterEach(() => { vi.unstubAllGlobals(); lane.on = true })

const dock = async () => {
  render(<ConversationProvider><OutputsDock /></ConversationProvider>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const fronted = () => document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid') ?? null

describe('an empty scenario on the lane opens on the brief', () => {
  it('on the lane: the dock is open on the Olumi tab and the brief box has focus', async () => {
    lane.on = true
    await dock()
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    expect(screen.getByLabelText('Your brief')).toBe(document.activeElement)
  })

  it('on the lane: even when this session last left the dock closed on another tab', async () => {
    lane.on = true
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: false, activeTab: 'results' }))
    await dock()
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    expect(screen.getByLabelText('Your brief')).toBe(document.activeElement)
  })

  it('off the lane: the first-use rail keeps the dock collapsed, as before', async () => {
    lane.on = false
    await dock()
    expect(document.querySelector('#view-chat-text')).toBeNull()
  })
})

describe('on the lane every way to Olumi leads to the dock\'s Olumi tab (review 00065)', () => {
  beforeEach(() => { lane.on = true; useFloatingPanelState.setState({ isOpen: false, isMinimised: false } as never) })
  afterEach(() => useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null }))

  it('"Open Olumi" from another tab fronts the Olumi tab with its composer focused, and opens no floating panel', async () => {
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
    const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
    useCanvasStore.setState({ currentScenarioId: PAIRED } as never)
    // The person here wrote the brief, whom core never holds for their own view (`gated`; the synthetic golden reads it true).
    useViewStore.setState({ uuid: PAIRED, sid: 's_000000000001', view: { ...view, proposal: null, gated: false }, error: null, status: 'ready' } as never)
    useCanvasStore.setState({ nodes: [{ id: 'a', type: 'viewCard', position: { x: 0, y: 0 }, data: { label: 'A' } }] } as never)
    await dock()
    expect(fronted()).toBe('outputs-dock-tab-results')
    await act(async () => { fireEvent.click(screen.getByTestId('persistent-strip-composer-redirect')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    expect(document.activeElement?.id).toBe('view-chat-text')
  })

  it('a floating panel this session left open never puts "Olumi is open" in place of the composer', async () => {
    useFloatingPanelState.setState({ isOpen: true, isMinimised: false } as never)
    await dock()
    expect(screen.queryByTestId('persistent-strip-status')).toBeNull()
    expect(document.querySelector('#view-chat-text')).not.toBeNull()
  })

  it('the docked focus channel focuses the composer', async () => {
    await dock()
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(focusDockedOlumi()).toBe(true)
    expect(document.activeElement?.id).toBe('view-chat-text')
  })

  it('the brief box takes focus once Olumi has answered, when it was waiting on a write', async () => {
    useViewChat.setState({ busy: true })
    await dock()
    expect(document.activeElement?.id).not.toBe('view-chat-text')
    await act(async () => { useViewChat.setState({ busy: false }) })
    expect(document.activeElement?.id).toBe('view-chat-text')
  })
})

describe('on the lane nothing opens a floating panel, an empty scenario included (review 00066)', () => {
  beforeEach(() => { lane.on = true; useFloatingPanelState.setState({ isOpen: false, isMinimised: false } as never) })
  afterEach(() => useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null }))

  it('an empty scenario, then another tab: the footer offers "Open Olumi", which fronts the Olumi tab with its brief box focused', async () => {
    await dock()
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    await act(async () => { fireEvent.click(screen.getByTestId('outputs-dock-tab-results')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    expect(screen.queryByTestId('persistent-strip-status')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('persistent-strip-composer-redirect')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    expect(document.activeElement?.id).toBe('view-chat-text')
  })

  it('the floating panel\'s own open and toggle do nothing on the lane, and open it off the lane', () => {
    useFloatingPanelState.getState().open('user')
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    useFloatingPanelState.getState().toggle()
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    lane.on = false
    useFloatingPanelState.getState().open('user')
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
  })

  it('"Open Olumi" on a scenario with a model focuses the message box', async () => {
    const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
    useCanvasStore.setState({ currentScenarioId: PAIRED } as never)
    useViewStore.setState({ uuid: PAIRED, sid: 's_000000000001', view: { ...view, proposal: null, gated: false }, error: null, status: 'ready' })
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
    useCanvasStore.setState({ nodes: [{ id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } }] } as never)
    await dock()
    await act(async () => { fireEvent.click(screen.getByTestId('persistent-strip-composer-redirect')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(document.activeElement?.id).toBe('view-chat-text')
  })
})

describe('only a scenario waiting for its brief opens on the brief (lane audit 1.1)', () => {
  beforeEach(() => { lane.on = true })
  it('reloading a paired scenario keeps the person\'s tab while its View loads, and after it lands', async () => {
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
    useCanvasStore.setState({ currentScenarioId: PAIRED } as never)
    useViewStore.setState({ uuid: PAIRED, sid: 's_000000000001', view: null, error: null, status: 'loading' } as never)
    await dock()
    expect(fronted()).toBe('outputs-dock-tab-results')
    const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
    await act(async () => { useViewStore.setState({ view: { ...view, proposal: null, gated: false }, status: 'ready' } as never) })
    expect(fronted()).toBe('outputs-dock-tab-results')
  })

  it('two scenarios in a row that wait for their brief: the second opens on the brief, after the person left the first\'s', async () => {
    await dock()
    expect(fronted()).toBe('outputs-dock-tab-olumi')
    await act(async () => { fireEvent.click(screen.getByTestId('outputs-dock-tab-results')) })
    expect(fronted()).toBe('outputs-dock-tab-results')
    await act(async () => { useCanvasStore.setState({ currentScenarioId: '2c5f39cb-3ab2-42e3-994f-1127e4ddb538' } as never) })
    expect(fronted()).toBe('outputs-dock-tab-olumi')
  })

  it('moving to another scenario that waits for its brief opens on the brief again', async () => {
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
    useCanvasStore.setState({ currentScenarioId: PAIRED } as never)
    useViewStore.setState({ uuid: PAIRED, sid: 's_000000000001', view: null, error: null, status: 'loading' } as never)
    await dock()
    expect(fronted()).toBe('outputs-dock-tab-results')
    await act(async () => { useCanvasStore.setState({ currentScenarioId: '2c5f39cb-3ab2-42e3-994f-1127e4ddb538' } as never) })
    expect(fronted()).toBe('outputs-dock-tab-olumi')
  })
})

describe('a cold reload keeps the remembered tab (review 00067)', () => {
  beforeEach(() => { lane.on = true })
  it('a saved scenario reloaded while the View store names no scenario yet keeps the tab the person left it on', async () => {
    // core's s_000000000001 in its UUID form: a scenario core holds. A cold reload: the View store exactly as the page loads it, unset.
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'results' }))
    useCanvasStore.setState({ currentScenarioId: '00000000-0000-4000-8000-000000000001' } as never)
    useViewStore.setState(useViewStore.getInitialState(), true)
    await dock()
    expect(useViewStore.getState().sid).toBe('s_000000000001')
    expect(fronted()).toBe('outputs-dock-tab-results')
  })
})

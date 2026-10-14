/** Real read/hydration -> deployed dock and floating chat routing -> real ReanalyseBar. */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { AnalysisResultBlock, AnalysisStateV1 } from '@talchain/schemas/boundary'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({ renderMarkdown: (s: string) => s, sanitiseMarkdown: (s: string) => s }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})
// Unrelated bodies are irrelevant to the footer mount. Reasoning stays real to verify its shared run owner.
vi.mock('../../components/pre-analysis', () => ({ PreAnalysisPanel: () => null }))
vi.mock('../../components/ModelTabBody', () => ({ ModelTabBody: () => null }))
vi.mock('../../components/OlumiTabBody', () => ({ OlumiTabBody: () => null }))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({ useStageAwarePlaceholder: () => 'Ask Olumi…' }))
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isCompareTabEnabled: () => false,
    isJourneyTabEnabled: () => false,
    isOrchestratorV2Enabled: () => false,
    isV5CanonicalAnalysisEnabled: () => false,
    isPreAnalysisV3Enabled: () => true,
  }
})
const conversation = {
  messages: [], isThinking: false, longRunningHint: null, lastSendFailure: null,
  sendMessage: vi.fn(), sendSystemEvent: vi.fn(), sendChip: vi.fn(), dispatchAction: vi.fn(),
  cancelTurn: vi.fn(), startNewDraft: vi.fn(), clearHistory: vi.fn(), retryLast: vi.fn(),
  patchBlockStates: new Map(), setPatchBlockState: vi.fn(), settledSourceBlockKeys: new Set(),
  patchRejections: new Map(), setPatchRejection: vi.fn(),
}
vi.mock('../../conversation/useConversation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/useConversation')>()
  return { ...actual, useConversation: () => conversation }
})

import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useCanvasStore } from '../../store'
import { useChangedSinceRunStore } from '../../changes/changedSinceRun'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../../components/OutputsDock'
import { FloatingOlumiPanel } from '../../components/FloatingOlumiPanel'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { ToastProvider } from '../../ToastContext'
import { useReadinessStore } from '../../stores/readinessStore'
import { useDeclinedSavedRunStore } from '../../stores/declinedSavedRunStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useUIStore } from '../../../stores/uiStore'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { ANALYSIS_NEW_COPY as COPY } from '../../../components/results/analysisNew/analysisNewCopy'
import run1Block from './fixtures/served-6b2b94dd-run1.block.json'

const SID = '11111111-2222-4333-8444-555555555555'
const USER = '99999999-2222-4333-8444-555555555555'
const stale: AnalysisStateV1 = {
  run_state: { kind: 'complete_stale', computed_at: '2026-10-08T09:00:00.000Z', cause: 'graph_changed' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
  robustness: {}, usable_for_prose: false, usable_for_chips: false, usable_for_followup: false,
  requires_rerun: true, blocked_unusable: false, contradictions: [],
}
const changed = {
  version: 1, since_run_id: 'run_b', node_ids: ['f'], links: [{ from: 'f', to: 'o' }],
  unattributed_changes: 0, complete: true,
}
const body = {
  schema: 'scenario_graph.v1', scenario_id: SID, graph_present: true,
  graph: {
    nodes: [{ id: 'f', kind: 'factor', label: 'Price' }, { id: 'o', kind: 'outcome', label: 'Revenue' }],
    edges: [{ id: 'e', from: 'f', to: 'o' }],
  },
  graph_identity_hash: {
    kind: 'graph_identity_hash', value: 'a'.repeat(64), algorithm: 'sha256', projection_version: 'identity.v1',
    graph_schema_version: 'graph_v3', normaliser_version: '1',
  },
  analysis_state: stale, analysis_result: null, conversation_turns: [], changed_since_run: changed,
}
const SUMMARY = 'Changed since your last Run: ‘Price’ and the link from ‘Price’ to ‘Revenue’.'
const fetchSpy = vi.fn()
type Host = 'diagnostics' | 'analysisNew' | 'olumi' | 'floating'
const HOSTS: Host[] = ['diagnostics', 'analysisNew', 'olumi', 'floating']
type ReloadMode = 'signed-in reportless' | 'guest report-drop'
const RELOAD_MODES: ReloadMode[] = ['signed-in reportless', 'guest report-drop']
const NEVER_RUN_HOSTS: Host[] = ['analysisNew', 'floating']

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider><ConversationProvider>{children}</ConversationProvider></ToastProvider>
}

async function mountHost(host: Host) {
  if (host === 'floating') {
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: false, activeTab: 'diagnostics' }))
    useFloatingPanelState.setState({
      isOpen: true, isMinimised: false, source: 'user', position: { x: 100, y: 100 }, size: { width: 400, height: 550 },
    } as never)
    render(<Wrapper><FloatingOlumiPanel onDock={vi.fn()} /></Wrapper>)
    return screen.getByTestId('floating-olumi-panel')
  }
  render(<Wrapper><OutputsDock /></Wrapper>)
  const tab = await screen.findByTestId(`outputs-dock-tab-${host}`, {}, { timeout: 20_000 })
  fireEvent.click(tab)
  return screen.getByTestId('shell-surface-footer-bar')
}

async function hydrate(mode: ReloadMode) {
  if (mode === 'guest report-drop') {
    const report = mapV5AnalysisToReport(run1Block as unknown as AnalysisResultBlock)
    useCanvasStore.setState({
      hasCompletedFirstRun: true, results: { status: 'complete', report, hash: report.model_card.response_hash },
      analysisFreshness: { freshness: 'fresh', currentGraphHash: 'old', graphHashAtRun: 'old' },
    } as never)
  }
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }))
  let outcome: Awaited<ReturnType<typeof hydrateCanvasFromServer>> | undefined
  await act(async () => {
    outcome = await hydrateCanvasFromServer(SID, {
      includeConversationTurns: true,
      ...(mode === 'signed-in reportless' ? { userId: USER, accessToken: 'signed-in-test-token' } : {}),
    })
  })
  expect(outcome).toBe('merged')
  const [, request] = fetchSpy.mock.calls[0]
  expect(request.headers.Authorization).toBe(mode === 'signed-in reportless' ? 'Bearer signed-in-test-token' : undefined)
  expect(JSON.parse(request.body).include_conversation_turns).toBe(true)
  expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_stale')
  expect(useCanvasStore.getState().results.report ?? null).toBeNull()
  expect(useCanvasStore.getState().hasCompletedFirstRun).toBe(false)
}

async function laterRead(over: Record<string, unknown> = {}, includeConversationTurns = false) {
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ...body, ...over }), { status: 200 }))
  let outcome: Awaited<ReturnType<typeof hydrateCanvasFromServer>> | undefined
  await act(async () => {
    outcome = await hydrateCanvasFromServer(SID, {
      includeConversationTurns, userId: USER, accessToken: 'signed-in-test-token',
    })
  })
  return outcome
}

function expectGenericRerun(host: HTMLElement) {
  const bar = within(host).getByTestId('reanalyse-bar')
  expect(within(host).queryByText(/since your last Run/i)).toBeNull()
  expect(within(bar).getByText('Model changed. Results may be out of date.')).toBeInTheDocument()
  expect(within(bar).getByRole('button', { name: 'Re-analyse' })).toBeInTheDocument()
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.setItem('feature.aiPanelV2', 'true')
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockReset().mockImplementation(() => new Promise(() => {}))
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.scrollTo = () => {}
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: () => true,
      }),
    })
  }
  window.history.replaceState({}, '', '/')
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 } as never)
  useFloatingPanelState.getState().reset()
  useReadinessStore.getState().reset()
  useCanvasStore.setState({
    currentScenarioId: SID, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, ceeAnalysisReady: null, lastServerGraphHash: null,
    bootAdmittedRevision: null, analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    graphEditedSinceLastRun: false, v5AnalysisFact: null, hasCompletedFirstRun: false,
    results: { status: 'idle', report: null }, showDraftChat: false,
    graphHealth: { status: 'healthy', score: 100, issues: [] },
  } as never)
  useChangedSinceRunStore.setState({ scenarioId: null, value: null })
  useDeclinedSavedRunStore.getState().clear()
})
afterEach(() => {
  cleanup()
  useReadinessStore.getState().reset()
  vi.unstubAllGlobals()
  localStorage.removeItem('feature.aiPanelV2')
})

describe('Reasoning has one run owner', () => {
  it('a signed-in reportless stale reload leaves Re-analyse as the only run control', async () => {
    await hydrate('signed-in reportless')
    await mountHost('analysisNew')
    const dock = within(screen.getByTestId('outputs-dock'))
    const status = dock.getByTestId('analysis-new-status-pre-run')
    expect(status).toHaveTextContent(COPY.status.savedRunStale)
    expect(status).not.toHaveTextContent(COPY.status.preRun)
    const bar = within(dock.getByTestId('reanalyse-bar'))
    expect(dock.getAllByRole('button', { name: /^(Re-analyse|Run the analysis|Re-run|Rerun analysis|Analyse)$/ }))
      .toEqual([bar.getByRole('button', { name: 'Re-analyse' })])
    expect(dock.queryByTestId('analysis-new-status-pre-run-act')).toBeNull()
  }, 30_000)

  it('a truly never-run model keeps the body run action', async () => {
    useCanvasStore.setState({
      nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Price' } }],
      analysisStateV1: { ...stale, run_state: { kind: 'never_run' }, requires_rerun: false },
    } as never)
    await mountHost('analysisNew')
    const dock = within(screen.getByTestId('outputs-dock'))
    expect(dock.getByTestId('analysis-new-status-pre-run')).toHaveTextContent(COPY.status.preRun)
    const action = dock.getByTestId('analysis-new-status-pre-run-act')
    expect(action).toHaveTextContent('Run the analysis')
    expect(action).toBeEnabled()
    expect(dock.getAllByRole('button', { name: /^(Re-analyse|Run the analysis|Re-run|Rerun analysis|Analyse)$/ }))
      .toEqual([action])
    expect(dock.queryByTestId('reanalyse-bar')).toBeNull()
  }, 30_000)
})

describe.each(RELOAD_MODES)('real hosts after %s stale hydration', mode => {
  it.each(HOSTS)('%s mounts one named summary beside Re-analyse', async host => {
    await hydrate(mode)
    const hostElement = await mountHost(host)
    const bar = within(hostElement).getByTestId('reanalyse-bar')
    expect(within(hostElement).getAllByTestId('reanalyse-bar')).toHaveLength(1)
    expect(within(bar).getAllByText(SUMMARY)).toHaveLength(1)
    expect(within(bar).getByRole('button', { name: 'Re-analyse' })).toBeInTheDocument()
    expect(bar).not.toHaveTextContent('This model has not been analysed yet.')
    expect(bar).not.toHaveTextContent('Model changed. Results may be out of date.')
    expect(bar.textContent).not.toMatch(/findings|results|analysis complete/i)
    expect(within(hostElement).queryByTestId('analysis-readiness-bar')).toBeNull()
  }, 30_000)
})

describe('Run binding through the real Olumi dock host', () => {
  it('a later accepted non-conversation read of the same stale Run retains the exact words', async () => {
    await hydrate('signed-in reportless')
    const host = await mountHost('olumi')
    const held = useChangedSinceRunStore.getState().value
    const verdict = useCanvasStore.getState().analysisStateV1
    expect(within(host).getAllByText(SUMMARY)).toHaveLength(1)

    expect(await laterRead()).toBe('unchanged')
    expect(useCanvasStore.getState().analysisStateV1).not.toBe(verdict)
    expect(useCanvasStore.getState().analysisStateV1?.run_state).toEqual(verdict?.run_state)
    expect(useChangedSinceRunStore.getState().value).toBe(held)
    const bar = within(host).getByTestId('reanalyse-bar')
    expect(within(bar).getAllByText(SUMMARY)).toHaveLength(1)
    expect(within(bar).getByRole('button', { name: 'Re-analyse' })).toBeInTheDocument()
  }, 30_000)

  it('a newer stale Run hides the old words while preserving generic copy and Re-analyse', async () => {
    await hydrate('signed-in reportless')
    const host = await mountHost('olumi')
    const held = useChangedSinceRunStore.getState().value
    expect(within(host).getAllByText(SUMMARY)).toHaveLength(1)

    act(() => useCanvasStore.getState().setAnalysisStateV1({
      ...stale,
      run_state: { kind: 'complete_stale', computed_at: '2026-10-08T10:00:00.000Z', cause: 'graph_changed' },
    }))
    expect(useChangedSinceRunStore.getState().value).toBe(held)
    expectGenericRerun(host)
  }, 30_000)

  it('a refused different-Run graph read cannot bind its new held set to the retained old verdict', async () => {
    await hydrate('signed-in reportless')
    const host = await mountHost('olumi')
    const held = useChangedSinceRunStore.getState().value
    const verdict = useCanvasStore.getState().analysisStateV1
    expect(within(host).getAllByText(SUMMARY)).toHaveLength(1)

    expect(await laterRead({
      graph_identity_hash: { ...body.graph_identity_hash, value: 'b'.repeat(64) },
      graph: { nodes: [{ id: 'foreign', kind: 'factor', label: 'Another model' }], edges: [] },
      analysis_state: {
        ...stale,
        run_state: { kind: 'complete_stale', computed_at: '2026-10-08T10:00:00.000Z', cause: 'graph_changed' },
      },
      changed_since_run: { ...changed, since_run_id: 'run_c', node_ids: ['o'], links: [] },
    }, true)).toBe('mergeRefused')
    expect(useCanvasStore.getState().analysisStateV1).toBe(verdict)
    expect(useChangedSinceRunStore.getState().value).not.toBe(held)
    expect(useChangedSinceRunStore.getState().value?.sinceRunId).toBe('run_c')
    expect([...useChangedSinceRunStore.getState().value!.nodeIds]).toEqual(['o'])
    expectGenericRerun(host)
  }, 30_000)
})

describe('true never-run contrast through real hosts', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Price' } }],
    } as never)
  })
  it('Model says not analysed yet and offers Analyse', async () => {
    const host = await mountHost('diagnostics')
    const bar = within(host).getByTestId('reanalyse-bar')
    expect(within(bar).getByText('This model has not been analysed yet.')).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: /^Analyse$/ })).toBeInTheDocument()
    expect(within(bar).queryByText(SUMMARY)).toBeNull()
  }, 30_000)
  it('Olumi uses readiness, not a rerun bar', async () => {
    const host = await mountHost('olumi')
    expect(within(host).getByTestId('analysis-readiness-bar')).toBeInTheDocument()
    expect(within(host).queryByTestId('reanalyse-bar')).toBeNull()
  }, 30_000)
  it.each(NEVER_RUN_HOSTS)('%s does not mount a rerun bar', async name => {
    const host = await mountHost(name)
    expect(within(host).queryByTestId('reanalyse-bar')).toBeNull()
    expect(within(host).queryByText(SUMMARY)).toBeNull()
  }, 30_000)
})

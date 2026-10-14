/** Real conversation adapter → hydration → ReanalyseBar. No report or first-Run flag is required. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import type { AnalysisResultBlock, AnalysisStateV1 } from '@talchain/schemas/boundary'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useCanvasStore } from '../../store'
import { useChangedSinceRunStore } from '../../changes/changedSinceRun'
import { ReanalyseBar } from '../../components/model-tab/ReanalyseBar'
import { BLOCKED_REASON_COPY } from '../../utils/composeBlockedReason'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import run1Block from './fixtures/served-6b2b94dd-run1.block.json'

const SID = '11111111-2222-4333-8444-555555555555'
const USER = '99999999-2222-4333-8444-555555555555'
const OTHER = '77777777-2222-4333-8444-555555555555'
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
const identity = (value = 'a'.repeat(64)) => ({
  kind: 'graph_identity_hash', value, algorithm: 'sha256', projection_version: 'identity.v1',
  graph_schema_version: 'graph_v3', normaliser_version: '1',
})
const body = (over: Record<string, unknown> = {}) => ({
  schema: 'scenario_graph.v1', scenario_id: SID, graph_present: true,
  graph: {
    nodes: [{ id: 'f', kind: 'factor', label: 'Price' }, { id: 'o', kind: 'outcome', label: 'Revenue' }],
    edges: [{ id: 'e', from: 'f', to: 'o' }],
  },
  graph_identity_hash: identity(),
  analysis_state: stale, analysis_result: null, conversation_turns: [], changed_since_run: changed, ...over,
})
const SUMMARY = 'Changed since your last Run: ‘Price’ and the link from ‘Price’ to ‘Revenue’.'
const GENERIC = 'Model changed. Results may be out of date.'
const fetchSpy = vi.fn()
function mount(blockedReason?: string) {
  return render(<ReanalyseBar onReanalyse={vi.fn()} canRun={!blockedReason} blockedReason={blockedReason} isAnalysing={false} />)
}
async function read(over: Record<string, unknown> = {}, includeConversationTurns = true) {
  fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(over)), { status: 200 }))
  let outcome: Awaited<ReturnType<typeof hydrateCanvasFromServer>> | undefined
  await act(async () => { outcome = await hydrateCanvasFromServer(SID, { includeConversationTurns }) })
  return outcome
}
async function namedReload() {
  expect(await read()).toBe('merged')
  mount()
  expect(screen.getAllByText(SUMMARY)).toHaveLength(1)
}
function expectGeneric() {
  expect(screen.queryByText(/since your last Run/i)).not.toBeInTheDocument()
  expect(screen.getByText(GENERIC)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Re-analyse' })).toBeInTheDocument()
}
beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockResolvedValue(new Response(JSON.stringify(body()), { status: 200 }))
  useCanvasStore.setState({
    currentScenarioId: SID, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, ceeAnalysisReady: null, lastServerGraphHash: null,
    bootAdmittedRevision: null, analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    graphEditedSinceLastRun: false, v5AnalysisFact: null, hasCompletedFirstRun: false,
    results: { status: 'idle', report: null },
  } as never)
  useChangedSinceRunStore.setState({ scenarioId: null, value: null })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('changed-since-Run words after reload', () => {
  it('FIRST RED: signed-in reportless cold reload shows one named sentence beside Re-analyse', async () => {
    expect(await hydrateCanvasFromServer(SID, {
      includeConversationTurns: true, userId: USER, accessToken: 'signed-in-test-token',
    })).toBe('merged')
    const [, request] = fetchSpy.mock.calls[0]
    expect(request.headers.Authorization).toBe('Bearer signed-in-test-token')
    expect(JSON.parse(request.body).include_conversation_turns).toBe(true)
    const s = useCanvasStore.getState()
    expect(s.analysisStateV1?.run_state.kind).toBe('complete_stale')
    expect(s.results.report).toBeNull()
    expect(s.hasCompletedFirstRun).toBe(false)
    mount()
    const bar = screen.getByTestId('reanalyse-bar')
    expect(within(bar).getAllByText(SUMMARY)).toHaveLength(1)
    expect(within(bar).getByRole('button', { name: 'Re-analyse' })).toBeEnabled()
    expect(bar).not.toHaveTextContent('This model has not been analysed yet.')
    expect(bar).not.toHaveTextContent('Model changed. Results may be out of date.')
    expect(bar.textContent).not.toMatch(/findings|results|analysis complete/i)
  })

  it('guest reload drops the restored report and shows the same named sentence', async () => {
    const report = mapV5AnalysisToReport(run1Block as unknown as AnalysisResultBlock)
    useCanvasStore.setState({
      results: { status: 'complete', report, hash: report.model_card.response_hash }, hasCompletedFirstRun: true,
      analysisFreshness: { freshness: 'fresh', currentGraphHash: 'old', graphHashAtRun: 'old' },
    } as never)
    expect(await read()).toBe('merged')
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBeUndefined()
    expect(useCanvasStore.getState().results.report ?? null).toBeNull()
    expect(useCanvasStore.getState().hasCompletedFirstRun).toBe(false)
    mount()
    expect(screen.getAllByText(SUMMARY)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Re-analyse' })).toBeInTheDocument()
    expect(screen.getByTestId('reanalyse-bar').textContent).not.toMatch(/not been analysed|findings|results/i)
  })

  it('unchanged accepted read replaces the held set and uses CURRENT canvas labels', async () => {
    await namedReload()
    const verdict = useCanvasStore.getState().analysisStateV1
    act(() => useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
      n.id === 'f' ? { ...n, data: { ...n.data, label: 'Current price' } } : n,
    ) }))
    expect(screen.getByText('Changed since your last Run: ‘Current price’ and the link from ‘Current price’ to ‘Revenue’.')).toBeInTheDocument()
    expect(await read({ changed_since_run: { ...changed, node_ids: ['o'], links: [] } })).toBe('unchanged')
    expect(useCanvasStore.getState().analysisStateV1).not.toBe(verdict)
    expect(screen.getByText('Changed since your last Run: ‘Revenue’.')).toBeInTheDocument()
    expect(screen.queryByText(SUMMARY)).not.toBeInTheDocument()
  })

  it('a later accepted non-conversation read of the SAME stale Run keeps the words', async () => {
    await namedReload()
    const adopted = useCanvasStore.getState().analysisStateV1
    const held = useChangedSinceRunStore.getState().value
    expect(await read({}, false)).toBe('unchanged')
    expect(JSON.parse(fetchSpy.mock.calls.at(-1)![1].body).include_conversation_turns).not.toBe(true)
    expect(useCanvasStore.getState().analysisStateV1).not.toBe(adopted)
    expect(useCanvasStore.getState().analysisStateV1?.run_state).toEqual(adopted?.run_state)
    expect(useChangedSinceRunStore.getState().value).toBe(held)
    expect(screen.getAllByText(SUMMARY)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Re-analyse' })).toBeInTheDocument()
  })

  it('a refused merge with a different Run cannot attach a new set to the previously adopted stale verdict', async () => {
    await namedReload()
    const adopted = useCanvasStore.getState().analysisStateV1
    expect(await read({
      analysis_state: { ...stale, run_state: { kind: 'complete_stale', computed_at: '2026-10-08T10:00:00.000Z', cause: 'graph_changed' } },
      graph_identity_hash: identity('b'.repeat(64)),
      graph: { nodes: [{ id: 'foreign', kind: 'factor', label: 'Another model' }], edges: [] },
      changed_since_run: { ...changed, node_ids: ['o'], links: [] },
    })).toBe('mergeRefused')
    expect(useCanvasStore.getState().analysisStateV1).toBe(adopted)
    expectGeneric()
  })

  it('a read whose verdict is not accepted cannot attach its set to an older changed verdict', async () => {
    await namedReload()
    const adopted = useCanvasStore.getState().analysisStateV1
    expect(await read({
      analysis_state: { ...stale, run_state: { kind: 'complete_current', computed_at: '2026-10-08T10:00:00.000Z' } },
      changed_since_run: { ...changed, node_ids: ['o'], links: [] },
    })).toBe('unchanged')
    expect(useCanvasStore.getState().analysisStateV1).toBe(adopted)
    expectGeneric()
  })

  it('held changes for a foreign scenario never show on the current canvas', async () => {
    await namedReload()
    act(() => useChangedSinceRunStore.setState({ scenarioId: OTHER }))
    expectGeneric()
  })

  it('a foreign response cannot replace the held words for the accepted Run', async () => {
    await namedReload()
    const held = useChangedSinceRunStore.getState().value
    expect(await read({ scenario_id: OTHER, changed_since_run: { ...changed, node_ids: ['o'], links: [] } })).toBe('unchanged')
    expect(useChangedSinceRunStore.getState().value).toBe(held)
    expect(screen.getAllByText(SUMMARY)).toHaveLength(1)
    expect(screen.queryByText('Changed since your last Run: ‘Revenue’.')).not.toBeInTheDocument()
  })

  it.each([
    ['null since_run_id', { ...changed, since_run_id: null }],
    ['empty set', { ...changed, node_ids: [], links: [] }],
    ['invalid held wire value', { ...changed, version: 2 }],
    ['absent wire value', undefined],
  ])('%s keeps the generic headline', async (_name, raw) => {
    await namedReload()
    expect(await read({ changed_since_run: raw })).toBe('unchanged')
    expectGeneric()
  })

  it('partial and unattributed changes keep their exact qualification', async () => {
    expect(await read({ changed_since_run: { ...changed, node_ids: ['f'], links: [], unattributed_changes: 2, complete: false } })).toBe('merged')
    mount()
    expect(screen.getByText('Changed since your last Run: ‘Price’ and 2 other changes. This list may be incomplete.')).toBeInTheDocument()
  })

  it('only unattributed changes use the exact count sentence', async () => {
    expect(await read({ changed_since_run: { ...changed, node_ids: [], links: [], unattributed_changes: 2 } })).toBe('merged')
    mount()
    expect(screen.getByText('2 changes since your last Run.')).toBeInTheDocument()
  })

  it('capping and missing labels retain every element count without ids', async () => {
    expect(await read({ changed_since_run: { ...changed, node_ids: ['f', 'o', 'deleted_1', 'deleted_2', 'deleted_3'], unattributed_changes: 2 } })).toBe('merged')
    mount()
    expect(screen.getByText('Changed since your last Run: ‘Price’, ‘Revenue’, the link from ‘Price’ to ‘Revenue’, 3 more, and 2 other changes.')).toBeInTheDocument()
    expect(screen.getByTestId('reanalyse-bar')).not.toHaveTextContent('deleted_')
  })

  it('a newer Run invalidates the old binding immediately and its empty read clears the set', async () => {
    await namedReload()
    act(() => useCanvasStore.getState().setAnalysisStateV1({
      ...stale, run_state: { kind: 'complete_stale', computed_at: '2026-10-08T10:00:00.000Z', cause: 'graph_changed' },
    }))
    expectGeneric()
    expect(await read({ changed_since_run: { ...changed, since_run_id: 'run_c', node_ids: [], links: [] } })).toBe('unchanged')
    expect(useChangedSinceRunStore.getState().value?.sinceRunId).toBe('run_c')
    expectGeneric()
  })

  it('current and cannot-confirm semantics cannot show held changed words', async () => {
    await namedReload()
    const verdict = useCanvasStore.getState().analysisStateV1!
    // Reuse the verdict object: the recorded kind and timestamp must remain an adoption-time snapshot.
    act(() => {
      verdict.run_state = { kind: 'complete_current', computed_at: '2026-10-08T09:00:00.000Z' }
      verdict.requires_rerun = false
      useCanvasStore.setState({ hasCompletedFirstRun: true, analysisFreshnessDirty: false })
    })
    expect(screen.queryByTestId('reanalyse-bar')).not.toBeInTheDocument()
    act(() => {
      verdict.run_state = { kind: 'refused', reason_code: 'analysis_declined_this_turn' }
      useCanvasStore.setState({ importPendingServerRegistration: true })
    })
    expect(screen.getByText("Can't confirm this analysis matches the current model.")).toBeInTheDocument()
    expect(screen.queryByText(/since your last Run/i)).not.toBeInTheDocument()
  })

  it('the named headline replaces generic copy and preserves the gate explanation once', async () => {
    expect(await read()).toBe('merged')
    mount(BLOCKED_REASON_COPY.staleRecheck)
    expect(screen.getAllByText(SUMMARY)).toHaveLength(1)
    expect(screen.queryByText(GENERIC)).not.toBeInTheDocument()
    const reason = BLOCKED_REASON_COPY.staleRecheck.split('. ').slice(1).join('. ')
    expect(screen.getByTestId('reanalyse-blocked-reason')).toHaveTextContent(reason)
    expect(screen.getByRole('button', { name: 'Re-analyse' })).toBeDisabled()
    expect(screen.getByTestId('reanalyse-bar')).not.toHaveTextContent(BLOCKED_REASON_COPY.staleRecheck.split('. ')[0])
  })
})

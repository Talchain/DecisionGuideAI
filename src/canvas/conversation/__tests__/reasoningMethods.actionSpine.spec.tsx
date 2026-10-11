/** SYS9: real UI → dispatchAction → payload builder → adapter/parser → existing chat renderer.
 * Fetch is stubbed (no network). Replies are contract fixtures, not backend/live acceptance evidence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'
import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { ActionBar } from '../actionBar/ActionBar'
import { pressOffer, resetPressOfferClocks } from '../actionBar/pressOffer'
import { type ActionBarV1, type ActionOffer } from '../actionBar/actionBarContract'
import { useActionBarStore } from '../actionBar/actionBarStore'
import { ACTION_REGISTRY, ACTION_IDS, actionOfMethod, registeredPressId, methodIsAvailable, actionIsAvailable, type ActionId } from '../actionRegistry'
import { buildAskAiQuestion } from '../askAi'
import { pressAction } from '../pressAction'
import { MethodStrip } from '../../../components/results/analysisNew/sections/MethodStrip'
import { ReasoningActionBar } from '../../../components/results/analysisNew/sections/ReasoningActionBar'
import { METHOD_CATALOGUE } from '../../../components/results/decision-overview/actionsCatalogue'
import { runMethod } from '../../../components/results/analysisNew/runMethod'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { AskOlumiDrawer } from '../../../components/results/coaching/AskOlumiDrawer'
import { useCanvasStore } from '../../store'
import { setCurrentScenarioId } from '../../store/scenarios'
import { useResultsStore } from '../../stores/resultsStore'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

const SID = '561548c3-acd6-4488-b088-399c7cc15631'
const REVISION = { graph_hash: '0123456789abcdef', run_key: 'run-1' }
const SUPPORTED = ['review', 'what_changes', 'strengthen', 'pre_mortem', 'more_options', 'bias_check'] as const
const PROSE = ['reframe_problem', 'consider_opposite', 'outside_view', 'explore_tradeoffs'] as const
const PROSE_IDS: Record<typeof PROSE[number], string> = {
  reframe_problem: 'ask:method-reframe', consider_opposite: 'ask:method-opposite',
  outside_view: 'ask:method-outside-view', explore_tradeoffs: 'ask:compare-options',
}
const WIRE_IDS: Record<typeof SUPPORTED[number], string> = {
  review: 'agent-next-review-decision', what_changes: 'agent-next-what-would-change',
  strengthen: 'agent-next-strengthen', pre_mortem: 'agent-next-pre-mortem', more_options: 'agent-next-widen', bias_check: 'act:bias_check',
}
const fetchSpy = vi.fn()
let conversation: UseConversationReturn
function Harness({ bar }: { bar?: ActionBarV1 }) {
  conversation = useConversation()
  return <>
    {bar ? <><ReasoningActionBar bar={bar} canRerun={false} /><ActionBar bar={bar} surface="chat" compact={false} /></>
      : <MethodStrip activeMethodId={null} onSelectMethod={id => runMethod(METHOD_CATALOGUE.find(m => m.id === id)!)} />}
    <ConversationPanel conversation={conversation} onCollapse={() => {}} onAttach={() => {}} hideComposer />
  </>
}
function offer(action: ActionId, index = 1): ActionOffer {
  return { action_id: action, press_id: registeredPressId(action) ?? `ask:${ACTION_REGISTRY[action].ask}`,
    label: action, user_line: buildAskAiQuestion({ intent: ACTION_REGISTRY[action].ask }).question, icon: 'ClipboardList',
    group: 'method', enabled: true, why_now: 'A current model is available.', offer_key: index.toString(16).padStart(16, '0') }
}
function barOf(offers: ActionOffer[]): ActionBarV1 {
  return { v: 1, state_key: '0123456789abcdef', revision: REVISION, priority: [], standard: offers.slice(0, 4), more: offers.slice(4) }
}
function request() {
  const call = fetchSpy.mock.calls.find(([url]) => url === 'https://cee.test/proxy/v5/turn')!
  expect(call, 'existing V5 route was reached').toBeDefined()
  const payload = JSON.parse(call[1].body)
  expect(call[1].method).toBe('POST')
  expect(() => OrchestratorTurnPayloadSchema.parse(payload)).not.toThrow()
  return payload
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  __resetTranscriptTombstonesForTests(); __resetPersistenceSessionForTests(); resetPressOfferClocks()
  vi.stubEnv('VITE_FEATURE_THREAD_PERSIST', 'false'); vi.stubEnv('VITE_FEATURE_THREAD_HYDRATE', 'false')
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.getState().resetCanvas(); setCurrentScenarioId(SID)
  useCanvasStore.setState({ currentScenarioId: SID, scenarioPersistedToDb: false, _hydratedThread: null,
    nodes: [{ id: 'g', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Growth' } }], edges: [] })
  useResultsStore.setState(s => ({ results: { ...s.results, status: 'idle', lastSnapshotId: null, analysisSummary: undefined } }))
  useServerConversationTurnsStore.setState({ offer: null })
  useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] })
  useAskOlumiStore.getState().close()
  fetchSpy.mockReset()
  fetchSpy.mockImplementation(async (url: string, init: RequestInit) => {
    if (url === '/bff/cee/graph-readiness') return new Response('{}', { status: 503 })
    if (url !== 'https://cee.test/proxy/v5/turn') throw new Error(`Unexpected fetch: ${url}`)
    const id = JSON.parse(init.body as string).chip.id
    return new Response(JSON.stringify({ response_version: 2, assistant_text: `Answered method ${id}.`,
      blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] }) })

describe('SYS9 method registry and action spine', () => {
  it('guard: every catalogue method maps to exactly one existing, available action with its typed or interim prose press', () => {
    const mapped = METHOD_CATALOGUE.map(m => actionOfMethod(m.id))
    expect(new Set(mapped).size).toBe(METHOD_CATALOGUE.length)
    for (const [i, id] of mapped.entries()) {
      expect(ACTION_IDS).toContain(id)
      expect(methodIsAvailable(METHOD_CATALOGUE[i].id)).toBe(true)
      expect(actionIsAvailable(id!)).toBe(true)
      if (ACTION_REGISTRY[id!].handler.kind === 'typed') expect(registeredPressId(id!)).toBe(WIRE_IDS[id! as keyof typeof WIRE_IDS])
      else expect(registeredPressId(id!)).toBeUndefined()
    }
  })
  it.each(SUPPORTED)('%s: Reasoning and chat use the existing typed route and render the reply', async action => {
    const o = offer(action)
    const bar = barOf([o])
    useActionBarStore.getState().setBar(SID, bar)
    render(<Harness bar={bar} />)
    // Both surfaces resolve the same registry row and offered identity.
    for (const tid of ['reasoning-action-bar', 'action-bar']) {
      await act(async () => { fireEvent.click(screen.getByTestId(`${tid}-icon-${action}`)) })
      await waitFor(() => expect(conversation.isThinking).toBe(false))
      const sent = request()
      expect(sent.chip).toEqual({ id: WIRE_IDS[action], parameters: { offer_key: o.offer_key, revision: REVISION } })
      expect(sent.source).toBe('chip')
      expect(sent.scenario_id).toBe(SID)
      expect(screen.getAllByText(`Answered method ${WIRE_IDS[action]}.`).length).toBeGreaterThan(0)
      resetPressOfferClocks(); fetchSpy.mockClear()
    }
  })
  it.each(['pre_mortem', 'review_bias', 'different_option'])('%s: catalogue press before Run keeps the typed handler and renders its reply', async methodId => {
    render(<Harness />)
    const icon = screen.queryByTestId(`analysis-new-method-strip-method-${methodId}`)
    if (!icon) fireEvent.click(screen.getByTestId('analysis-new-method-strip-more'))
    await act(async () => { fireEvent.click(icon ?? screen.getByTestId(`analysis-new-method-strip-menu-method-${methodId}`)) })
    await waitFor(() => expect(conversation.isThinking).toBe(false))
    const id = WIRE_IDS[actionOfMethod(methodId)! as keyof typeof WIRE_IDS]
    expect(request().chip).toEqual({ id })
    expect(screen.getByText(`Answered method ${id}.`)).toBeInTheDocument()
  })
  it.each(PROSE)('%s: enabled strip, Reasoning overflow and chat presses send the same interim prose family and render its reply', async methodId => {
    const action = actionOfMethod(methodId)!
    const o = offer(action)
    const expectedQuestion = buildAskAiQuestion({ intent: ACTION_REGISTRY[action].ask }).question
    for (const surface of ['strip', 'strip-menu', 'reasoning', 'chat'] as const) {
      const bar = barOf(surface === 'chat' ? [o] : [])
      useActionBarStore.getState().setBar(SID, bar)
      render(<Harness bar={surface.startsWith('strip') ? undefined : bar} />)
      let control: HTMLElement | null = null
      if (surface === 'strip') control = screen.queryByTestId(`analysis-new-method-strip-method-${methodId}`)
      if (surface === 'strip-menu' || (surface === 'strip' && !control)) {
        fireEvent.click(screen.getByTestId('analysis-new-method-strip-more'))
        control = screen.getByTestId(`analysis-new-method-strip-menu-method-${methodId}`)
      } else if (surface === 'reasoning') {
        fireEvent.click(screen.getByTestId('reasoning-action-bar-more'))
        control = screen.getByTestId(`reasoning-action-bar-menu-host-${methodId}`)
      } else if (surface === 'chat') control = screen.getByTestId(`action-bar-icon-${action}`)
      expect(control).toBeEnabled()
      expect(control).not.toHaveAttribute('aria-disabled', 'true')
      await act(async () => { fireEvent.click(control!) })
      await waitFor(() => expect(conversation.isThinking).toBe(false))
      const sent = request()
      expect(fetchSpy.mock.calls.filter(([url]) => url === 'https://cee.test/proxy/v5/turn')).toHaveLength(1)
      expect(sent.chip.id).toBe(PROSE_IDS[methodId])
      expect(sent.chip.id).not.toMatch(/^(agent-next-|act:)/)
      expect(sent.chip).not.toHaveProperty('action_type')
      expect(sent.chip).not.toHaveProperty('intent')
      expect(sent.message).toBe(expectedQuestion)
      expect(sent.source).toBe('chip')
      expect(sent.scenario_id).toBe(SID)
      // Only an actual CEE offer carries its existing identity metadata.
      expect(sent.chip).toEqual(surface === 'chat'
        ? { id: PROSE_IDS[methodId], parameters: { offer_key: o.offer_key, revision: REVISION } }
        : { id: PROSE_IDS[methodId] })
      expect(screen.getByText(`Answered method ${PROSE_IDS[methodId]}.`)).toBeInTheDocument()
      expect(useAskOlumiStore.getState().isOpen).toBe(false)
      cleanup(); resetPressOfferClocks(); fetchSpy.mockClear()
    }
  })
  it('CONTRAST: a prose press carries the base ask identity; a typed press carries the CEE handler identity', async () => {
    render(<Harness />)
    const shapes = []
    for (const methodId of ['outside_view', 'pre_mortem']) {
      await act(async () => { fireEvent.click(screen.getByTestId(`analysis-new-method-strip-method-${methodId}`)) })
      await waitFor(() => expect(conversation.isThinking).toBe(false))
      shapes.push(request().chip)
      fetchSpy.mockClear()
    }
    // Base askAi also sends chip.id. Prose has no typed selector, not an absent generic chip identity.
    expect(shapes).toEqual([{ id: PROSE_IDS.outside_view }, { id: WIRE_IDS.pre_mortem }])
    expect(registeredPressId('outside_view')).toBeUndefined()
    expect(registeredPressId('pre_mortem')).toBe(WIRE_IDS.pre_mortem)
  })
  it('catalogue and chat share offer identity, disabled state, scenario isolation and double-press clock', async () => {
    const o = offer('pre_mortem'); const bar = barOf([o])
    useActionBarStore.getState().setBar(SID, bar)
    render(<Harness bar={bar} />)
    await act(async () => {
      expect(pressAction('pre_mortem')).toBe('sent')
      expect(pressOffer(o, REVISION)).toBe('refire')
    })
    await waitFor(() => expect(conversation.isThinking).toBe(false))
    expect(request().chip.parameters).toEqual({ offer_key: o.offer_key, revision: REVISION })
    expect(fetchSpy.mock.calls.filter(([url]) => url === 'https://cee.test/proxy/v5/turn')).toHaveLength(1)
    resetPressOfferClocks()
    useActionBarStore.getState().setBar(SID, barOf([{ ...o, enabled: false, disabled_reason: 'Needs a current analysis.' }]))
    expect(pressAction('pre_mortem')).toBe('disabled')
    useActionBarStore.getState().setBar('other-scenario', bar)
    await act(async () => { expect(pressAction('pre_mortem')).toBe('sent') })
    await waitFor(() => expect(fetchSpy.mock.calls.filter(([url]) => url === 'https://cee.test/proxy/v5/turn')).toHaveLength(2))
    expect(request().chip.id).toBe(WIRE_IDS.pre_mortem)
    const last = JSON.parse(fetchSpy.mock.calls.filter(([url]) => url === 'https://cee.test/proxy/v5/turn').at(-1)![1].body)
    expect(last.chip).not.toHaveProperty('parameters')
  })
  it.each(['pre_mortem', 'outside_view', 'unregistered'])('%s: an unmounted conversation retains the base drawer and free-text fallback', methodId => {
    const freeText = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: freeText })
    const method = METHOD_CATALOGUE.find(m => m.id === methodId)
      ?? { ...METHOD_CATALOGUE.find(m => m.id === 'pre_mortem')!, id: methodId }
    expect(runMethod(method)).toBe('drawer')
    expect(useAskOlumiStore.getState().parameters).toEqual({ method_id: methodId })
    render(<AskOlumiDrawer />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(freeText).toHaveBeenCalledWith(method.prompt)
  })
})

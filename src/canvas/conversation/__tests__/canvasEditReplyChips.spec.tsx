/**
 * ⭐ DL (15 Oct, SESSION4 S5): after a CANVAS edit, CEE answers the forwarded system_event with a reply that can carry a
 * card as `suggested_actions` (the "Rename it" card when the edit's figure contradicts the option's name). Does the UI
 * render it? This row drives the REAL path: `sendSystemEvent({ type: 'direct_graph_edit' })` through the buffered V5
 * transport, parser and live mapper, then the real `ChatThread`. Only the network and auth are stubbed.
 *
 * The reply body is the recorded live T1 turn (CEE bdf5716) with its `suggested_actions` replaced by ONE card in the
 * contract's chip shape (`id`, `label`, `message`). The card's words are a STAND-IN: CEE's S5 card had no open PR when
 * this was written; the UI path is what is under test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import liveJson from './fixtures/t1/live-recorded.json?raw'
import requestJson from './fixtures/t1/live-request.json?raw'
import { useConversation } from '../useConversation'
import { ChatThread } from '../zones/ChatThread'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { rpc: vi.fn(async () => ({ data: 'persisted-reply', error: null })),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))
// As deployed (netlify.toml VITE_ENABLE_ORCHESTRATOR_V2 = "true"): a canvas edit reaches CEE only with orchestrator V2 on.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()), isOrchestratorV2Enabled: () => true,
}))

const SCENARIO: string = JSON.parse(requestJson).request_body.scenario_id
const ENDPOINT = 'https://cee.test/proxy/v5/turn'
const RENAME_CARD = { id: 'rename-option:opt_hire_two', label: 'Rename it', message: 'Rename ‘Hire two developers’ to ‘Hire three developers’.' }
const fetchSpy = vi.fn()
// The canvas emitter's batch shape (`useGraphEditEvents`): which node changed, the verb, the field, a summary.
const EDIT = { type: 'direct_graph_edit' as const, payload: { changed_node_ids: ['opt_hire_two'], changed_edge_ids: [],
  operations: ['update'], fields_changed: { opt_hire_two: ['interventions'] }, summary: 'Changed ‘Hire two developers’' } }

function replyWith(actions: unknown[]) {
  const body = JSON.parse(liveJson)
  body.assistant_text = 'You set ‘Hire two developers’ to 3 people.'
  body.suggested_actions = actions
  return new Response(JSON.stringify(body), { status: 200 })
}

function renderThread(messages: ReturnType<typeof useConversation>['messages']) {
  return render(
    <ChatThread messages={messages} isThinking={false} longRunningHint={null} nodeCount={1}
      patchBlockStates={new Map()} patchRejections={new Map()} onChipClick={vi.fn(async () => {})}
      onPatchAccept={vi.fn()} onPatchDismiss={vi.fn()} onFeedback={vi.fn()} onRetry={vi.fn()} />,
  )
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); __resetTranscriptTombstonesForTests(); __resetPersistenceSessionForTests()
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  vi.stubEnv('VITE_V5_ENDPOINT', ENDPOINT)
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockReset()
  useServerConversationTurnsStore.setState({ offer: null })
  scenarios.setCurrentScenarioId(SCENARIO)
  useCanvasStore.setState({ nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
    // The option the edit changed (its figure now contradicts its name).
    { id: 'opt_hire_two', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Hire two developers' } }],
    edges: [], currentScenarioId: SCENARIO, serverGraphIdentity: null, lastAuthoritativeGraph: null,
    scenarioPersistedToDb: true, _hydratedThread: null } as never)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('a canvas edit’s reply renders the card CEE sends with it', () => {
  it('⭐ the edit’s reply carries ONE "Rename it" chip, and the chat thread shows it under that reply', async () => {
    fetchSpy.mockImplementation(async () => replyWith([RENAME_CARD]))
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendSystemEvent(EDIT)
    })
    // The request really was the canvas edit's system_event.
    const post = fetchSpy.mock.calls.find((c) => String(c[0]) === ENDPOINT && c[1]?.method === 'POST')!
    const sent = JSON.parse(String(post[1].body))
    expect(sent.kind).toBe('system_event')
    expect(sent.event).toMatchObject({ kind: 'direct_graph_edit', target_id: 'opt_hire_two' })

    const replies = result.current.messages.filter((m) => m.role === 'assistant' && !m.synthetic)
    expect(replies).toHaveLength(1)
    expect(replies[0].actionChips?.map((c) => [c.id, c.label])).toEqual([[RENAME_CARD.id, RENAME_CARD.label]])

    renderThread(result.current.messages)
    expect(screen.getByRole('button', { name: 'Rename it' })).toBeTruthy()
    expect(screen.getAllByTestId('response-chip-group')).toHaveLength(1)
  })

  it('CONTROL: the same edit with no card renders no chip row', async () => {
    fetchSpy.mockImplementation(async () => replyWith([]))
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendSystemEvent(EDIT)
    })
    renderThread(result.current.messages)
    expect(screen.queryByRole('button', { name: 'Rename it' })).toBeNull()
    expect(screen.queryByTestId('response-chip-group')).toBeNull()
  })
})

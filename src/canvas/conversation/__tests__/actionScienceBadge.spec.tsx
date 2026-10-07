import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, within } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { ChatThread } from '../zones/ChatThread'
import { actionGlyph, ACTION_BAR_FALLBACK_ICON } from '../actionBar/actionBarIcons'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'

import liveJson from './fixtures/t1/live-recorded.json?raw'
import requestJson from './fixtures/t1/live-request.json?raw'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { rpc: async () => ({ data: 'persisted-reply', error: null }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

const SCENARIO = '66666666-8888-4999-aaaa-bbbbbbbbbbbb'
const CLAIM = { claim_id: 'DSK-B-003', claim_title: 'Anchoring', evidence_strength: 'strong', protocol_id: 'DSK-P-002' }
const fetchSpy = vi.fn()

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  __resetTranscriptTombstonesForTests(); __resetPersistenceSessionForTests()
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  vi.stubEnv('VITE_V5_ENDPOINT', 'https://cee.test/proxy/v5/turn')
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockReset()
  useServerConversationTurnsStore.setState({ offer: null })
  scenarios.setCurrentScenarioId(SCENARIO)
  useCanvasStore.setState({ nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } }],
    edges: [], currentScenarioId: SCENARIO, serverGraphIdentity: null, lastAuthoritativeGraph: null,
    scenarioPersistedToDb: true, _hydratedThread: null })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

async function reply(science?: unknown) {
  // The CAPTURED live turn (t1, also used by the same-browser spec), plus the receipt under test: a hand-made body
  // is not a wire this hook accepts.
  const live = JSON.parse(liveJson) as Record<string, unknown>
  if (science !== undefined) live._action = { ...(live._action as object | undefined), science }
  fetchSpy.mockImplementation(async () => new Response(JSON.stringify(live), { status: 200 }))
  const hook = renderHook(() => useConversation())
  await act(async () => { await hook.result.current.sendMessage(JSON.parse(requestJson).request_body.message) })
  const answer = hook.result.current.messages.find(m => m.role === 'assistant' && !m.synthetic)!
  expect(answer?.content, 'precondition: the live turn produced its reply').toBe(String(live.assistant_text))
  render(<ChatThread
    messages={[...hook.result.current.messages, { id: 'later', role: 'assistant', content: 'A later reply.', timestamp: new Date() }]}
    isThinking={false} longRunningHint={null} nodeCount={1}
    patchBlockStates={new Map()} patchRejections={new Map()}
    onChipClick={vi.fn()} onPatchAccept={vi.fn()} onPatchDismiss={vi.fn()}
    onFeedback={vi.fn()} onRetry={vi.fn()}
  />)
  return answer
}

describe('live action science receipt', () => {
  it('renders the validated triple under its owning reply, even after a later reply', async () => {
    const answer = await reply(CLAIM)
    expect(answer).toHaveProperty('actionScience', CLAIM)
    const badge = screen.getByTestId('chat-action-science')
    expect(badge).toHaveAttribute('data-dsk-claim-id', CLAIM.claim_id)
    expect(badge).toHaveAttribute('data-dsk-evidence-strength', 'strong')
    expect(badge).toHaveAttribute('data-dsk-protocol-id', CLAIM.protocol_id)
    // Bound by identity, not by prose: the badge's wrapper holds exactly one reply, the first assistant one.
    const replies = screen.getAllByTestId('chat-message-assistant')
    expect(badge.parentElement!.contains(replies[0])).toBe(true)
    expect(badge.parentElement!.contains(replies[replies.length - 1])).toBe(false)
    expect(within(badge.parentElement!).queryByText('A later reply.')).toBeNull()
  })
  it('CONTROL: absent receipt renders no badge', async () => {
    const answer = await reply()
    expect(answer).not.toHaveProperty('actionScience')
    expect(screen.queryByTestId('chat-action-science')).toBeNull()
  })
  it('rejects a partial triple without claim_title', async () => {
    const answer = await reply({ claim_id: CLAIM.claim_id, evidence_strength: 'strong' })
    expect(answer).not.toHaveProperty('actionScience')
    expect(screen.queryByTestId('chat-action-science')).toBeNull()
  })
  it('resolves Anchor to a registered glyph', () => {
    expect(actionGlyph('Anchor')).not.toBe(ACTION_BAR_FALLBACK_ICON)
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, fireEvent, waitFor } from '@testing-library/react'

const { runCanvasUndo, listModelVersions, fetchSpy } = vi.hoisted(() => ({
  runCanvasUndo: vi.fn(async () => 'done'),
  listModelVersions: vi.fn(),
  fetchSpy: vi.fn(),
}))
vi.mock('../undoCommand', () => ({ runCanvasUndo }))
vi.mock('../../../adapters/cee/modelVersions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listModelVersions,
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: 'u-1', accessToken: 'tok' }),
  supabase: { rpc: async () => ({ data: 'persisted-reply', error: null }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

import { AiChangeUndoButton, AI_CHANGE_UNDO_WORDS } from '../AiChangeUndoButton'
import { useUndoJournalStore } from '../captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, recordEditReceipt } from '../undoJournal'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { useConversation } from '../../conversation/useConversation'
import { MessageBubble } from '../../conversation/MessageBubble'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { useResultsStore } from '../../stores/resultsStore'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { __resetTranscriptTombstonesForTests, loadTranscript, TRANSCRIPT_STORAGE_KEY } from '../../conversation/utils/transcriptStore'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const ENDPOINT = 'https://cee.test/proxy/v5/turn'
const V4 = '44444444-4444-4444-8444-444444444444'
const V5 = '55555555-5555-4555-8555-555555555555'
const step = (gestureId: string) => recordEditReceipt(EMPTY_UNDO_JOURNAL, { scenarioId: S, gestureId, label: "Olumi's change",
  receipt: { mutationId: `m-${gestureId}`, versionId: '66666666-6666-4666-8666-666666666666', fullHash: '6'.repeat(64), undoVersionId: '55555555-5555-4555-8555-555555555555' } })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetTranscriptTombstonesForTests()
  __resetPersistenceSessionForTests()
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  vi.stubEnv('VITE_V5_ENDPOINT', ENDPOINT)
  vi.stubGlobal('fetch', fetchSpy)
  runCanvasUndo.mockClear()
  fetchSpy.mockReset()
  listModelVersions.mockReset()
  useServerConversationTurnsStore.setState({ offer: null })
  scenarios.setCurrentScenarioId(S)
  useCanvasStore.setState({ nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } }],
    edges: [], currentScenarioId: S, serverGraphIdentity: null, lastAuthoritativeGraph: null,
    scenarioPersistedToDb: true, _hydratedThread: null })
  useResultsStore.setState(state => ({ results: { ...state.results, lastSnapshotId: null } }))
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('AiChangeUndoButton', () => {
  it('B1: the real live reply carries its journal gesture id and renders Undo this change, with no button after reload', async () => {
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify({
      response_version: 2,
      assistant_text: 'I added the risk to the model.',
      blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame',
      _agent: { turn_id: '99999999-9999-4999-8999-999999999999', durability: 'recorded',
        receipts: [{ version: 5, version_id: V5, mutation_id: 'm-live' }] },
    }), { status: 200 }))
    listModelVersions.mockResolvedValue({ status: 'list', currentVersionId: V5, requestId: null,
      versions: [{ id: V5, versionNumber: 5, label: null, provenance: 'committed_mutation',
        restoredFromVersionId: null, createdAt: '2026-10-08T10:00:00Z',
        graphIdentityHash: '5'.repeat(64), parentVersionId: V4 }] })

    const first = renderHook(() => useConversation())
    await act(async () => { await first.result.current.sendMessage('Add a risk for lower demand.') })
    await waitFor(() => expect(useUndoJournalStore.getState().journal.undo).toHaveLength(1))
    const journalStep = useUndoJournalStore.getState().journal.undo[0]
    if (journalStep.kind !== 'step') throw new Error('Expected the live Agent turn to record a step')
    const outgoing = JSON.parse(fetchSpy.mock.calls.find(call => String(call[0]) === ENDPOINT && call[1]?.method === 'POST')![1].body)
    expect(journalStep.gestureId).toBe(outgoing.turn_id)
    expect(journalStep.first).toEqual({ mutationId: 'm-live', versionId: V5, fullHash: '5'.repeat(64), undoVersionId: V4 })
    expect(journalStep.last).toBe(journalStep.first)
    const reply = first.result.current.messages.find(m => m.role === 'assistant' && !m.synthetic)!
    expect(reply.content).toBe('I added the risk to the model.')
    expect(reply.clientTurnId).toBeUndefined()
    const bubble = render(<MessageBubble message={reply} onChipClick={async () => {}} />)
    expect.soft(reply.undoTurnId).toBe(journalStep.gestureId)
    expect(screen.getByRole('button', { name: "Undo Olumi's change to the model" }).textContent).toBe('Undo this change')

    await waitFor(() => expect(loadTranscript(S)?.messages.find(m => m.id === reply.id)?.content).toBe(reply.content))
    expect(loadTranscript(S)?.messages.find(m => m.id === reply.id)?.undoTurnId).toBeUndefined()
    bubble.unmount()
    first.unmount()
    const saved = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    saved[S].pageLoadId = 'previous-page-load'
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(saved))
    const reloaded = renderHook(() => useConversation())
    const restored = reloaded.result.current.messages.find(m => m.id === reply.id)!
    expect(restored.content).toBe(reply.content)
    expect(restored.undoTurnId).toBeUndefined()
    render(<MessageBubble message={restored} onChipClick={async () => {}} />)
    expect(screen.queryByTestId('ai-change-undo')).toBeNull()
  })

  it('shows "Undo this change" on the reply whose change is the next undo, and the press is ⌘Z\'s own command', async () => {
    useUndoJournalStore.setState({ journal: step('turn-ai') })
    render(<AiChangeUndoButton turnId="turn-ai" />)
    fireEvent.click(screen.getByRole('button', { name: AI_CHANGE_UNDO_WORDS.aria }))
    expect(screen.getByTestId('ai-change-undo').textContent).toBe('Undo this change')
    await waitFor(() => expect(runCanvasUndo).toHaveBeenCalledWith('undo', 'turn-ai'))
  })
  it('is absent on any other reply, and when there is nothing to undo', () => {
    useUndoJournalStore.setState({ journal: step('turn-ai') })
    const { rerender } = render(<AiChangeUndoButton turnId="turn-other" />)
    expect(screen.queryByTestId('ai-change-undo')).toBeNull()
    useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
    rerender(<AiChangeUndoButton turnId="turn-ai" />)
    expect(screen.queryByTestId('ai-change-undo')).toBeNull()
  })
})

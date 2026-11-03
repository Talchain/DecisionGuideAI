/**
 * v10 chat: a quiet "Version N" under each reply, and a one-line receipt when the person's own edit is saved.
 * Both appear in #/canvas2 (`PresentationProvider value="v10"`) and in neither place in the current presentation.
 * No version known, no chip. No save in this session, no receipt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ChatThread } from '../zones/ChatThread'
import { PresentationProvider } from '../../../presentation/v10'
import type { ConversationMessage } from '../types'
import { captureTurnForUndo, useUndoJournalStore } from '../../undo/captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL } from '../../undo/undoJournal'
import {
  noteSavedVersion,
  plainChangeWords,
  resetModelVersionStamp,
  versionAtTime,
} from '../../versions/modelVersionStamp'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'

const canvasState = vi.hoisted(() => ({
  current: { nodes: [], edges: [], currentScenarioId: null as string | null, lastServerGraphHash: null as string | null },
}))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => any) => selector(canvasState.current),
    { getState: () => canvasState.current, setState: vi.fn(), subscribe: vi.fn() },
  ),
}))
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => any) => selector({}),
    { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() },
  ),
}))
vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ guidanceItems: [], _dispatchAction: vi.fn() }),
    { getState: () => ({ guidanceItems: [], _dispatchAction: vi.fn(), dismissItem: vi.fn() }) },
  ),
}))

const identity = vi.hoisted(() => ({ current: { userId: null as string | null, accessToken: null as string | null } }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => identity.current }))
const listModelVersions = vi.hoisted(() => vi.fn())
vi.mock('../../../adapters/cee/modelVersions', () => ({ listModelVersions }))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  resetModelVersionStamp()
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
  canvasState.current = { nodes: [], edges: [], currentScenarioId: SCENARIO, lastServerGraphHash: null }
  identity.current = { userId: null, accessToken: null }
  listModelVersions.mockReset()
})

let seq = 0
function reply(at: number, content = 'Here is what the model says.'): ConversationMessage {
  seq += 1
  return { id: `r-${seq}`, role: 'assistant', content, timestamp: new Date(at) } as ConversationMessage
}

const noop = vi.fn().mockResolvedValue(undefined)

function thread(messages: ConversationMessage[], presentation: 'v10' | 'current') {
  const props = {
    messages, isThinking: false, longRunningHint: null, nodeCount: 1,
    patchBlockStates: new Map(), patchRejections: new Map(),
    onChipClick: noop, onPatchAccept: vi.fn(), onPatchDismiss: vi.fn(), onFeedback: vi.fn(), onRetry: vi.fn(),
  }
  return (
    <MemoryRouter>
      <PresentationProvider value={presentation}>
        <ChatThread {...props} />
      </PresentationProvider>
    </MemoryRouter>
  )
}

const chips = () => screen.queryAllByTestId('model-version-chip')
const receipts = () => screen.queryAllByTestId('saved-version-receipt')

describe('version chip under a reply', () => {
  it('v10 shows "Version N" for the version current when the reply arrived; the current design shows none', () => {
    noteSavedVersion({ scenarioId: SCENARIO, versionId: 'v3', number: 3, what: 'your change', at: 1000 })
    const messages = [reply(1500)]

    const { unmount } = render(thread(messages, 'v10'))
    expect(chips()).toHaveLength(1)
    expect(chips()[0]).toHaveTextContent('Version 3')
    unmount()

    render(thread(messages, 'current'))
    expect(chips()).toHaveLength(0)
  })

  it('shows no chip when no version is known (never invented)', () => {
    render(thread([reply(1500)], 'v10'))
    expect(chips()).toHaveLength(0)
  })

  it('shows no chip for a reply that arrived before any version was known, nor for a notice', () => {
    noteSavedVersion({ scenarioId: SCENARIO, versionId: 'v3', number: 3, what: 'your change', at: 1000 })
    const notice = { ...reply(1500, 'The latest state could not be refreshed.'), synthetic: true }
    render(thread([reply(500), notice], 'v10'))
    expect(chips()).toHaveLength(0)
  })

  it('each reply keeps the version it read when the model later moves on', () => {
    noteSavedVersion({ scenarioId: SCENARIO, versionId: 'v3', number: 3, what: 'your change', at: 1000 })
    noteSavedVersion({ scenarioId: SCENARIO, versionId: 'v4', number: 4, what: 'your change', at: 2000 })
    render(thread([reply(1500), reply(2500)], 'v10'))
    expect(chips().map((c) => c.textContent)).toEqual(['Version 3', 'Version 4'])
  })

  it('reads another scenario’s versions as unknown', () => {
    noteSavedVersion({ scenarioId: 'another-scenario', versionId: 'v9', number: 9, what: 'your change', at: 1000 })
    render(thread([reply(1500)], 'v10'))
    expect(chips()).toHaveLength(0)
  })

  it('a signed-in reader gets the head version read when the server model moves; a guest gets none', async () => {
    canvasState.current = { ...canvasState.current, lastServerGraphHash: 'h1' }
    listModelVersions.mockResolvedValue({
      status: 'list', requestId: null, currentVersionId: 'vv',
      versions: [{ id: 'vv', versionNumber: 12, label: null }],
    })

    identity.current = { userId: null, accessToken: null }
    const guest = render(thread([], 'v10'))
    await new Promise((r) => setTimeout(r, 20))
    expect(listModelVersions).not.toHaveBeenCalled()
    guest.unmount()

    identity.current = { userId: '3f1b8a52-6c0e-4d7a-9d57-0a1c2b3d4e5f', accessToken: 'token' }
    const later = Date.now() + 5000
    const view = render(thread([reply(later)], 'v10'))
    await waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(chips()).toHaveLength(1))
    expect(chips()[0]).toHaveTextContent('Version 12')
    view.unmount()
  })
})

describe('save receipt in the thread', () => {
  const valueEdit = { type: 'factor_value_edit', payload: {} }
  const savedResponse = (sequence: number) => ({
    model_version_receipt: {
      schema: 'model_version_mutation_receipt.v1',
      mutation_id: `m-${sequence}`,
      version_id: `ver-${sequence}`,
      full_hash: 'a'.repeat(64),
      undo_version_id: null,
      sequence,
    },
  })

  it('a saved edit adds a check line "Version N saved: …" in v10 only', () => {
    captureTurnForUndo({ scenarioId: SCENARIO, turnId: 't1', systemEvent: valueEdit, response: savedResponse(7) })

    const { unmount } = render(thread([reply(Date.now() + 5000)], 'v10'))
    expect(receipts()).toHaveLength(1)
    expect(receipts()[0]).toHaveTextContent('Version 7 saved: your value change')
    // The reply that comes after the save read that version.
    expect(within(screen.getByTestId('chat-thread')).getAllByTestId('model-version-chip')[0]).toHaveTextContent('Version 7')
    unmount()

    render(thread([reply(Date.now() + 5000)], 'current'))
    expect(receipts()).toHaveLength(0)
  })

  it('says "your change" when the event states nothing more, and names an addition by its label', () => {
    expect(plainChangeWords({ type: 'something_new' })).toBe('your change')
    expect(plainChangeWords({ type: 'structural_add', payload: { label: 'Raise to £60' } })).toBe('your addition of "Raise to £60"')
  })

  it('is placed after the messages that had already arrived and before the ones that came later', () => {
    const now = Date.now()
    noteSavedVersion({ scenarioId: SCENARIO, versionId: 'v5', number: 5, what: 'your value change', at: now })
    render(thread([reply(now - 1000, 'Earlier reply'), reply(now + 1000, 'Later reply')], 'v10'))
    const thread_ = screen.getByTestId('chat-thread')
    const text = thread_.textContent ?? ''
    expect(text.indexOf('Earlier reply')).toBeLessThan(text.indexOf('Version 5 saved'))
    expect(text.indexOf('Version 5 saved')).toBeLessThan(text.indexOf('Later reply'))
  })

  it('shows nothing on load: no save in this session, no receipt', () => {
    render(thread([reply(Date.now())], 'v10'))
    expect(receipts()).toHaveLength(0)
  })

  it('an edit with no version receipt (a guest, a refusal) leaves no receipt', () => {
    captureTurnForUndo({ scenarioId: SCENARIO, turnId: 't1', systemEvent: valueEdit, response: { blocks: [] } })
    render(thread([], 'v10'))
    expect(receipts()).toHaveLength(0)
  })

  it('a replayed receipt for the same version shows once', () => {
    captureTurnForUndo({ scenarioId: SCENARIO, turnId: 't1', systemEvent: valueEdit, response: savedResponse(7) })
    captureTurnForUndo({ scenarioId: SCENARIO, turnId: 't1b', systemEvent: valueEdit, response: savedResponse(7) })
    render(thread([], 'v10'))
    expect(receipts()).toHaveLength(1)
  })
})

describe('versionAtTime', () => {
  it('is null with no scenario, no entry, or an entry whose number was never read', () => {
    expect(versionAtTime([], SCENARIO, 100)).toBeNull()
    expect(versionAtTime([{ scenarioId: SCENARIO, at: 50, number: null }], SCENARIO, 100)).toBeNull()
    expect(versionAtTime([{ scenarioId: SCENARIO, at: 50, number: 2 }], null, 100)).toBeNull()
    expect(versionAtTime([{ scenarioId: SCENARIO, at: 50, number: 2 }], SCENARIO, Number.NaN)).toBeNull()
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'

const { listModelVersions, getSessionIdentity, restoreModelVersion, hydrateCanvasFromServer } = vi.hoisted(() => ({
  listModelVersions: vi.fn(),
  getSessionIdentity: vi.fn(),
  restoreModelVersion: vi.fn(),
  hydrateCanvasFromServer: vi.fn(),
}))
vi.mock('../../../adapters/cee/modelVersions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listModelVersions,
  restoreModelVersion,
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {}, getSessionIdentity }))
vi.mock('../../hydrate/serverGraphHydration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hydrateCanvasFromServer,
}))

import { ADDITIVE_EXTENSIONS_KEY } from '../../../v5/responseParser'
import { setPersistenceSessionActive } from '../../../lib/persistenceSession'
import { useCanvasStore } from '../../store'
import { beginModelEditDelivery } from '../../registration/editDeliveryHold'
import { AiChangeUndoButton, AI_CHANGE_UNDO_WORDS } from '../AiChangeUndoButton'
import { runCanvasUndo, UNDO_NOTICE } from '../undoCommand'
import {
  AI_CHANGE_UNDO_LABEL,
  captureAgentTurnForUndo,
  isNextUndoThisTurn,
  readAgentTurnReceipts,
} from '../captureAgentTurnForUndo'
import { captureTurnForUndo, useUndoJournalStore } from '../captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, nextUndo, recordEditReceipt } from '../undoJournal'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const S2 = 'b7ddf6df-bbc1-4f12-b99a-f1e7d183178d'
const h = (c: string) => c.repeat(64)
const V4 = '44444444-4444-4444-8444-444444444444'
const V5 = '55555555-5555-4555-8555-555555555555'
const V6 = '66666666-6666-4666-8666-666666666666'
const V7 = '77777777-7777-4777-8777-777777777777'
const V8 = '88888888-8888-4888-8888-888888888888'

/** An agent response as the parser hands it over: `_agent` lives on the NON-enumerable additive sidecar. */
function agentResponse(receipts: unknown[]): Record<string, unknown> {
  const response: Record<string, unknown> = { assistant_text: 'Done: I added the risk and its link.' }
  Object.defineProperty(response, ADDITIVE_EXTENSIONS_KEY, { value: { _agent: { receipts } }, enumerable: false })
  return response
}
const receipt = (version: number, versionId: string) => ({ version, version_id: versionId, mutation_id: `m-${version}`, source_turn_id: 'srv' })
const row = (id: string, n: number, hash: string, parent: string | null) => ({
  id, versionNumber: n, label: null, provenance: 'committed_mutation', restoredFromVersionId: null, createdAt: '2026-10-07T21:00:00Z',
  graphIdentityHash: hash, parentVersionId: parent,
})
const listed = (current: string, rows = [row(V5, 5, h('5'), V4), row(V6, 6, h('6'), V5)]) =>
  ({ status: 'list', versions: rows, currentVersionId: current, requestId: null })

const journal = () => useUndoJournalStore.getState().journal
const toasts: string[] = []
window.addEventListener('topbar:show-toast', (event) => toasts.push((event as CustomEvent).detail.message))

function restored() {
  return {
    status: 'restored', graph: { nodes: [], edges: [] }, deduped: false,
    version: { versionId: V7, versionNumber: 7, deduped: false },
    undoVersionId: V6, fullHash: h('4'), requestId: 'req',
  }
}

beforeEach(() => {
  toasts.length = 0
  setPersistenceSessionActive(true)
  useCanvasStore.setState({ currentScenarioId: S, nodes: [], edges: [] } as never)
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
  listModelVersions.mockReset()
  getSessionIdentity.mockReset()
  restoreModelVersion.mockReset()
  hydrateCanvasFromServer.mockResolvedValue('merged')
  getSessionIdentity.mockResolvedValue({ userId: 'u-1', accessToken: 'tok' })
})

describe('readAgentTurnReceipts', () => {
  it('reads the sidecar, oldest version first, rejecting the whole malformed set', () => {
    const r = readAgentTurnReceipts(agentResponse([receipt(6, V6), receipt(5, V5)]))
    expect(r?.map((x) => x.versionId)).toEqual([V5, V6])
    expect(readAgentTurnReceipts(agentResponse([receipt(6, V6), { version: 'x' }, receipt(5, V5)]))).toBeNull()
  })
  it('a response without the sidecar names none', () => {
    expect(readAgentTurnReceipts({ _agent: { receipts: [receipt(5, V5)] } })).toEqual([])
  })
})

describe('an AI-applied change becomes ONE undo step', () => {
  it('two versions in one turn → one step whose undo restores the version before the first, against the head', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-ai', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })).toBe('recorded')
    const next = nextUndo(journal())
    expect(next).toMatchObject({ kind: 'restore', targetVersionId: V4, expectedFullHash: h('6'), label: `Undo: ${AI_CHANGE_UNDO_LABEL}` })
    expect(journal().undo).toHaveLength(1)
    expect(isNextUndoThisTurn(journal(), S, 'turn-ai')).toBe(true)
    expect(isNextUndoThisTurn(journal(), S, 'turn-other')).toBe(false)
    expect(isNextUndoThisTurn(journal(), 'another-scenario', 'turn-ai')).toBe(false)
  })

  it('a guest records nothing (no versions to undo)', async () => {
    getSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse([receipt(5, V5)]) })).toBe('none')
    expect(listModelVersions).not.toHaveBeenCalled()
    expect(journal()).toBe(EMPTY_UNDO_JOURNAL)
  })

  it('the head moved past the turn (someone wrote since) → the journal is cleared, never a step', async () => {
    useUndoJournalStore.setState({ journal: recordEditReceipt(EMPTY_UNDO_JOURNAL, { scenarioId: S, gestureId: 'old', label: 'Change value',
      receipt: { mutationId: 'm-3', versionId: V4, fullHash: h('4'), undoVersionId: '33333333-3333-4333-8333-333333333333' } }) })
    listModelVersions.mockResolvedValue(listed(V7, [row(V5, 5, h('5'), V4), row(V6, 6, h('6'), V5), row(V7, 7, h('7'), V6)]))
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })).toBe('cleared')
    expect(journal().undo).toEqual([])
    expect(journal().head).toBeNull()
  })

  it('r1 P1: a canvas edit that settles while the list is on the wire KEEPS its step (compare-and-set, never a clear)', async () => {
    const canvasEdit = recordEditReceipt(EMPTY_UNDO_JOURNAL, { scenarioId: S, gestureId: 'canvas-gesture', label: 'Change value',
      receipt: { mutationId: 'm-canvas', versionId: V7, fullHash: h('7'), undoVersionId: V6 } })
    listModelVersions.mockImplementation(async () => {
      useUndoJournalStore.setState({ journal: canvasEdit })
      return listed(V6)
    })
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })).toBe('superseded')
    expect(journal()).toBe(canvasEdit)
    expect(nextUndo(journal())).toMatchObject({ kind: 'restore', targetVersionId: V6, expectedFullHash: h('7') })
  })

  it('r1 P1: a repeated mutation id across two versions fails closed (no step, no button)', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    const dup = [receipt(5, V5), { ...receipt(6, V6), mutation_id: 'm-5' }]
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse(dup) })).toBe('cleared')
    expect(isNextUndoThisTurn(journal(), S, 't')).toBe(false)
  })

  it('r1 P1: versions that are not one chain are not one gesture', async () => {
    listModelVersions.mockResolvedValue(listed(V6, [row(V5, 5, h('5'), V4), row(V6, 6, h('6'), V4)]))
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })).toBe('cleared')
  })

  it('r1 P2: a malformed identity hash on the list fails closed', async () => {
    listModelVersions.mockResolvedValue(listed(V6, [row(V5, 5, h('5'), V4), row(V6, 6, 'not-a-hash', V5)]))
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })).toBe('cleared')
  })

  it('a version with no known parent is a barrier, never a guessed target', async () => {
    listModelVersions.mockResolvedValue(listed(V5, [row(V5, 1, h('5'), null)]))
    await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse([receipt(1, V5)]) })
    expect(nextUndo(journal())).toEqual({ kind: 'barrier', reason: 'no_undo_version' })
    expect(isNextUndoThisTurn(journal(), S, 't')).toBe(false)
  })

  it('P1: a multi-version turn with no first parent records ONE barrier for the whole gesture, with no reply button', async () => {
    listModelVersions.mockResolvedValue(listed(V6, [row(V5, 5, h('5'), null), row(V6, 6, h('6'), V5)]))

    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-no-parent', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })).toBe('recorded')

    expect(journal().undo).toEqual([{ kind: 'barrier', reason: 'no_undo_version' }])
    expect(journal().head).toEqual({ versionId: V6, fullHash: h('6') })
    expect(journal().seenMutationIds).toEqual(['m-5', 'm-6'])
    expect(nextUndo(journal())).toEqual({ kind: 'barrier', reason: 'no_undo_version' })
    expect(isNextUndoThisTurn(journal(), S, 'turn-no-parent')).toBe(false)
    render(createElement(AiChangeUndoButton, { turnId: 'turn-no-parent' }))
    expect(screen.queryByRole('button', { name: "Undo Olumi's change to the model" })).toBeNull()
  })

  it('r2 P1: two captures in flight are applied in turn order — the newer turn is the step, whichever list answers first', async () => {
    const V8 = '88888888-8888-4888-8888-888888888888'
    let releaseA!: () => void
    const aGate = new Promise<void>((r) => { releaseA = r })
    listModelVersions
      .mockImplementationOnce(async () => { await aGate; return listed(V6) })
      .mockImplementationOnce(async () => listed(V8, [row(V5, 5, h('5'), V4), row(V6, 6, h('6'), V5), row(V7, 7, h('7'), V6), row(V8, 8, h('8'), V7)]))
    const a = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-a', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    const b = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-b', response: agentResponse([receipt(7, V7), receipt(8, V8)]) })
    releaseA()
    expect(await a).toBe('recorded')
    expect(await b).toBe('recorded')
    expect(isNextUndoThisTurn(journal(), S, 'turn-b')).toBe(true)
    expect(nextUndo(journal())).toMatchObject({ targetVersionId: V6, expectedFullHash: h('8') })
  })

  it.each(['malformed receipts', 'moved head'])('P2: queued capture B with %s cannot erase human edit C after capture A stands down', async (failure) => {
    let releaseA!: () => void
    const aGate = new Promise<void>((r) => { releaseA = r })
    listModelVersions
      .mockImplementationOnce(async () => { await aGate; return listed(V6) })
      .mockResolvedValueOnce(listed(V8, [row(V7, 7, h('7'), V6), row(V8, 8, h('8'), V7)]))
    const a = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-queued-a', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    await vi.waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))
    const response = failure === 'malformed receipts'
      ? agentResponse([receipt(7, V7), { version: 8, version_id: V8 }])
      : agentResponse([receipt(7, V7)])
    const b = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-queued-b', response })
    captureTurnForUndo({ scenarioId: S, turnId: 'human-edit-c', systemEvent: { type: 'factor_value_edit' },
      response: { model_version_receipt: { mutation_id: 'm-human-c', version_id: V8, full_hash: h('8'), undo_version_id: V7 } } })
    const newer = journal()
    const writes = vi.fn()
    const unsubscribe = useUndoJournalStore.subscribe(writes)
    releaseA()
    const outcomes = await Promise.all([a, b])
    unsubscribe()

    expect(outcomes).toEqual(['superseded', 'superseded'])
    expect(writes).not.toHaveBeenCalled()
    expect(journal()).toBe(newer)
    expect(nextUndo(journal())).toMatchObject({ step: { gestureId: 'human-edit-c' }, targetVersionId: V7, expectedFullHash: h('8') })
    expect(listModelVersions).toHaveBeenCalledTimes(1)
    expect(listModelVersions).toHaveBeenCalledWith(S, { userId: 'u-1', accessToken: 'tok', limit: 50 })
  })

  it('P2: captures queued for an old scenario never replace the new scenario human receipt', async () => {
    let releaseA!: () => void
    const aGate = new Promise<void>((r) => { releaseA = r })
    listModelVersions
      .mockImplementationOnce(async () => { await aGate; return listed(V6) })
      .mockResolvedValueOnce(listed(V7, [row(V7, 7, h('7'), V6)]))
    const a = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-old-scenario-a', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    await vi.waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))
    const b = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-old-scenario-b', response: agentResponse([receipt(7, V7)]) })
    useCanvasStore.setState({ currentScenarioId: S2 })
    captureTurnForUndo({ scenarioId: S2, turnId: 'human-edit-scenario-2', systemEvent: { type: 'factor_value_edit' },
      response: { model_version_receipt: { mutation_id: 'm-human-scenario-2', version_id: V8, full_hash: h('8'), undo_version_id: V7 } } })
    const newer = journal()
    const writes = vi.fn()
    const unsubscribe = useUndoJournalStore.subscribe(writes)
    releaseA()
    const outcomes = await Promise.all([a, b])
    unsubscribe()

    expect(outcomes).toEqual(['superseded', 'superseded'])
    expect(writes).not.toHaveBeenCalled()
    expect(journal()).toBe(newer)
    expect(journal().scenarioId).toBe(S2)
    expect(nextUndo(journal())).toMatchObject({ step: { gestureId: 'human-edit-scenario-2' }, targetVersionId: V7 })
    expect(listModelVersions).toHaveBeenCalledTimes(1)
  })

  it.each(['switch', 'round trip'])('P2: a scenario %s with no journal write fences both the in-flight and queued captures', async (change) => {
    const before = journal()
    let releaseA!: () => void
    const aGate = new Promise<void>((r) => { releaseA = r })
    listModelVersions
      .mockImplementationOnce(async () => { await aGate; return listed(V6) })
      .mockResolvedValueOnce(listed(V7, [row(V7, 7, h('7'), V6)]))
    const a = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-scenario-fence-a', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    await vi.waitFor(() => expect(listModelVersions).toHaveBeenCalledTimes(1))
    const b = captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-scenario-fence-b', response: agentResponse([receipt(7, V7)]) })
    useCanvasStore.setState({ currentScenarioId: S2 })
    if (change === 'round trip') useCanvasStore.setState({ currentScenarioId: S })
    const writes = vi.fn()
    const unsubscribe = useUndoJournalStore.subscribe(writes)
    releaseA()
    const outcomes = await Promise.all([a, b])
    unsubscribe()

    expect(outcomes).toEqual(['superseded', 'superseded'])
    expect(writes).not.toHaveBeenCalled()
    expect(journal()).toBe(before)
    expect(useCanvasStore.getState().currentScenarioId).toBe(change === 'round trip' ? S : S2)
    expect(listModelVersions).toHaveBeenCalledTimes(1)
  })

  it('r2 P1: a judgement the journal cannot undo stays a barrier even when agent receipts ride with it', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    captureTurnForUndo({ scenarioId: S, turnId: 't', systemEvent: { type: 'prior_range_edit', payload: {} }, response: agentResponse([receipt(6, V6)]) })
    expect(nextUndo(journal())).toEqual({ kind: 'barrier', reason: 'not_undoable' })
    expect(listModelVersions).not.toHaveBeenCalled()
  })

  it('r1 P1: a repeated version id fails closed', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    expect(await captureAgentTurnForUndo({ scenarioId: S, turnId: 't', response: agentResponse([receipt(5, V6), receipt(6, V6)]) })).toBe('cleared')
  })

  it('r1 P1: a turn with a model-changing system event AND agent receipts (no model_version_receipt) is captured, named by the event', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    captureTurnForUndo({ scenarioId: S, turnId: 'turn-both', undoGestureId: 'add-intent-1', systemEvent: { type: 'structural_add', payload: { label: 'Oven breaks down' } },
      response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    await vi.waitFor(() => expect(isNextUndoThisTurn(journal(), S, 'turn-both')).toBe(true))
    expect(nextUndo(journal())).toMatchObject({ label: 'Undo: Add "Oven breaks down"' })
  })

  it('captureTurnForUndo routes an Agent turn (no system event, no model_version_receipt) to the capture', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    captureTurnForUndo({ scenarioId: S, turnId: 'turn-ai', systemEvent: undefined, response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    await vi.waitFor(() => expect(isNextUndoThisTurn(journal(), S, 'turn-ai')).toBe(true))
  })

  it('N2: one good and one malformed receipt cancel the whole turn, leaving no step or button', async () => {
    useUndoJournalStore.setState({ journal: recordEditReceipt(EMPTY_UNDO_JOURNAL, { scenarioId: S, gestureId: 'older-edit', label: 'Change value',
      receipt: { mutationId: 'm-4', versionId: V4, fullHash: h('4'), undoVersionId: '33333333-3333-4333-8333-333333333333' } }) })
    listModelVersions.mockResolvedValue(listed(V5, [row(V5, 5, h('5'), V4)]))
    captureTurnForUndo({ scenarioId: S, turnId: 'turn-partial', systemEvent: undefined,
      response: agentResponse([receipt(5, V5), { version: 6, version_id: V6 }]) })

    await vi.waitFor(() => expect(journal().undo).toEqual([]))
    expect(isNextUndoThisTurn(journal(), S, 'turn-partial')).toBe(false)
    render(createElement(AiChangeUndoButton, { turnId: 'turn-partial' }))
    expect(screen.queryByTestId('ai-change-undo')).toBeNull()
  })
})

describe('the reply undo command stays bound to its turn', () => {
  it('preserves the AI step’s base hash and retries an unknown outcome once with the same mutation id', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    await captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-ai', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    restoreModelVersion.mockResolvedValueOnce({ status: 'unavailable' }).mockResolvedValueOnce(restored())
    render(createElement(AiChangeUndoButton, { turnId: 'turn-ai' }))
    fireEvent.click(screen.getByRole('button', { name: AI_CHANGE_UNDO_WORDS.aria }))

    await waitFor(() => expect(toasts).toEqual(["Undone: Olumi's change."]))

    expect(restoreModelVersion).toHaveBeenCalledTimes(2)
    expect(restoreModelVersion.mock.calls[0][1]).toMatchObject({ versionId: V4, expectedGraphIdentityHash: h('6'), label: `Undo: ${AI_CHANGE_UNDO_LABEL}` })
    expect(restoreModelVersion.mock.calls[1][1]).toEqual(restoreModelVersion.mock.calls[0][1])
    expect(journal().undo).toEqual([])
    expect(journal().redo).toHaveLength(1)
    expect(screen.queryByTestId('ai-change-undo')).toBeNull()
  })

  it('N1: a newer edit between render and press is refused without a restore request', async () => {
    listModelVersions.mockResolvedValue(listed(V6))
    await captureAgentTurnForUndo({ scenarioId: S, turnId: 'turn-ai', response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    render(createElement(AiChangeUndoButton, { turnId: 'turn-ai' }))
    const button = screen.getByRole('button', { name: AI_CHANGE_UNDO_WORDS.aria })
    const newer = recordEditReceipt(journal(), { scenarioId: S, gestureId: 'newer-human-edit', label: 'Change value',
      receipt: { mutationId: 'm-7', versionId: V7, fullHash: h('7'), undoVersionId: V6 } })
    restoreModelVersion.mockResolvedValue(restored())

    act(() => {
      useUndoJournalStore.setState({ journal: newer })
      fireEvent.click(button)
    })

    await waitFor(() => expect(toasts).toEqual(["Olumi's change is no longer the next change to undo. Nothing was changed."]))
    expect(restoreModelVersion).not.toHaveBeenCalled()
    expect(journal()).toBe(newer)
  })

  it('N1: a newer step while the session read waits is refused without a restore request', async () => {
    const turnId = 'turn-ai-session-step'
    listModelVersions.mockResolvedValue(listed(V6))
    await captureAgentTurnForUndo({ scenarioId: S, turnId, response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    let releaseSession!: () => void
    const sessionGate = new Promise<void>((r) => { releaseSession = r })
    getSessionIdentity.mockImplementationOnce(async () => { await sessionGate; return { userId: 'u-1', accessToken: 'tok' } })
    const undo = runCanvasUndo('undo', turnId)
    expect(getSessionIdentity).toHaveBeenCalledTimes(2)
    const newer = recordEditReceipt(journal(), { scenarioId: S, gestureId: 'human-edit-session-step', label: 'Change value',
      receipt: { mutationId: 'm-human-session-step', versionId: V7, fullHash: h('7'), undoVersionId: V6 } })
    useUndoJournalStore.setState({ journal: newer })
    releaseSession()

    await expect(undo).resolves.toBe('refused_changed')

    expect(restoreModelVersion).not.toHaveBeenCalled()
    expect(journal()).toBe(newer)
    expect(nextUndo(journal())).toMatchObject({ step: { gestureId: 'human-edit-session-step' }, targetVersionId: V6 })
    expect(toasts).toEqual(["Olumi's change is no longer the next change to undo. Nothing was changed."])
  })

  it('N1: a factor edit starting while the session read waits keeps its optimistic canvas and journal', async () => {
    const turnId = 'turn-ai-session-factor'
    const factorId = 'factor-session-churn'
    listModelVersions.mockResolvedValue(listed(V6))
    await captureAgentTurnForUndo({ scenarioId: S, turnId, response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    const before = journal()
    let releaseSession!: () => void
    const sessionGate = new Promise<void>((r) => { releaseSession = r })
    getSessionIdentity.mockImplementationOnce(async () => { await sessionGate; return { userId: 'u-1', accessToken: 'tok' } })
    restoreModelVersion.mockResolvedValue(restored())
    const undo = runCanvasUndo('undo', turnId)
    expect(getSessionIdentity).toHaveBeenCalledTimes(2)
    const nodes = [{ id: factorId, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Churn', observedState: { value: 0.77 } } }]
    useCanvasStore.setState({ nodes } as never)
    const releaseEdit = beginModelEditDelivery('factor_value_edit')
    releaseSession()

    try {
      await expect(undo).resolves.toBe('busy')

      expect(restoreModelVersion).not.toHaveBeenCalled()
      expect(useCanvasStore.getState().nodes).toBe(nodes)
      expect(useCanvasStore.getState().nodes.map((node) => node.id)).toEqual([factorId])
      expect(journal()).toBe(before)
      expect(isNextUndoThisTurn(journal(), S, turnId)).toBe(true)
      expect(toasts).toEqual(['A change is still being saved. Try again in a moment.'])
    } finally {
      releaseEdit()
    }
  })

  it('N1: overlapping session reads send only the first restore while its reply is pending', async () => {
    const turnId = 'turn-ai-session-overlap'
    listModelVersions.mockResolvedValue(listed(V6))
    await captureAgentTurnForUndo({ scenarioId: S, turnId, response: agentResponse([receipt(5, V5), receipt(6, V6)]) })
    let releaseFirstSession!: () => void
    let releaseSecondSession!: () => void
    let releaseRestore!: () => void
    const firstSession = new Promise<void>((r) => { releaseFirstSession = r })
    const secondSession = new Promise<void>((r) => { releaseSecondSession = r })
    const restoreGate = new Promise<void>((r) => { releaseRestore = r })
    getSessionIdentity
      .mockImplementationOnce(async () => { await firstSession; return { userId: 'u-1', accessToken: 'tok' } })
      .mockImplementationOnce(async () => { await secondSession; return { userId: 'u-1', accessToken: 'tok' } })
    restoreModelVersion
      .mockImplementationOnce(async () => { await restoreGate; return restored() })
      .mockResolvedValueOnce(restored())
    const first = runCanvasUndo('undo', turnId)
    const second = runCanvasUndo('undo', turnId)
    expect(getSessionIdentity).toHaveBeenCalledTimes(3)
    releaseFirstSession()
    await vi.waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    releaseSecondSession()
    const secondOutcome = await second
    releaseRestore()
    await expect(first).resolves.toBe('done')

    expect(secondOutcome).toBe('busy')
    expect(restoreModelVersion).toHaveBeenCalledTimes(1)
    expect(restoreModelVersion.mock.calls[0]).toEqual([S, expect.objectContaining({
      versionId: V4, expectedGraphIdentityHash: h('6'), label: `Undo: ${AI_CHANGE_UNDO_LABEL}`,
    })])
    expect(journal().redo.map((step) => step.gestureId)).toEqual([turnId])
    expect(toasts).toEqual(['A change is still being saved. Try again in a moment.', "Undone: Olumi's change."])
  })

  it.each([
    { label: AI_CHANGE_UNDO_LABEL, wording: "The model changed since Olumi's change, so Undo can't step back safely. Version history can restore an earlier version." },
    { label: 'Change value', wording: "The model changed since your last edit, so Undo can't step back safely. Version history can restore an earlier version." },
  ])('N3: a 409 keeps the canvas untouched and names the stale step: $label', async ({ label, wording }) => {
    useUndoJournalStore.setState({ journal: recordEditReceipt(EMPTY_UNDO_JOURNAL, { scenarioId: S, gestureId: 'stale-turn', label,
      receipt: { mutationId: 'm-6', versionId: V6, fullHash: h('6'), undoVersionId: V4 } }) })
    const nodes = useCanvasStore.getState().nodes
    restoreModelVersion.mockResolvedValue({ status: 'conflict' })

    await expect(runCanvasUndo('undo')).resolves.toBe('refused_stale')

    expect(restoreModelVersion).toHaveBeenCalledTimes(1)
    expect(restoreModelVersion.mock.calls[0][1]).toMatchObject({ versionId: V4, expectedGraphIdentityHash: h('6') })
    expect(useCanvasStore.getState().nodes).toBe(nodes)
    expect(journal().undo).toEqual([])
    expect(journal().head).toBeNull()
    expect(hydrateCanvasFromServer).not.toHaveBeenCalled()
    expect(toasts).toEqual([wording])
    if (label !== AI_CHANGE_UNDO_LABEL) expect(UNDO_NOTICE.stale).toBe(wording)
  })
})

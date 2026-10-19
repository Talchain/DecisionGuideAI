/**
 * The canvas undo / redo COMMAND: a saved restore of the edit's own pre-edit
 * version, applied through the one restore path — or an honest refusal.
 * Network and session are mocked; the journal, the reconcile and the store
 * are real.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { ANALYSE_AFTER_CHANGE_SOURCE, useAnalyseAfterCommittedChange } from '../../analysis/useAnalyseAfterCommittedChange'

const restoreModelVersion = vi.fn()
const listModelVersions = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  restoreModelVersion: (...args: unknown[]) => restoreModelVersion(...args),
  listModelVersions: (...args: unknown[]) => listModelVersions(...args),
}))
const identity = { userId: 'u-1' as string | null, accessToken: 'tok' as string | null }
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => identity,
}))
const hydrateCanvasFromServer = vi.fn()
vi.mock('../../hydrate/serverGraphHydration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hydrateCanvasFromServer: (...args: unknown[]) => hydrateCanvasFromServer(...args),
}))

import { useCanvasStore } from '../../store'
import { setPersistenceSessionActive } from '../../../lib/persistenceSession'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { useUndoJournalStore } from '../captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, recordBarrier, recordEditReceipt, type UndoJournalState } from '../undoJournal'
import { runCanvasUndo, UNDO_NOTICE } from '../undoCommand'
import { selectRunAffirmedCurrent } from '../../state/analysisStateSelector'
import { report } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const h = (c: string) => c.repeat(64)
const V0 = '00000000-0000-4000-8000-000000000000'
const V1 = '11111111-1111-4111-8111-111111111111'
const R1 = 'rrrrrrrr-1111-4111-8111-111111111111'
const OPT = 'opt_raise_60'
const FAC = 'fac_churn'

const toasts: string[] = []
window.addEventListener('topbar:show-toast', (e) => toasts.push((e as CustomEvent).detail.message))

/** The user added option OPT (v0 → v1). */
function journalWithAdd(): UndoJournalState {
  return recordEditReceipt(EMPTY_UNDO_JOURNAL, {
    scenarioId: S,
    receipt: { mutationId: 'm-1', versionId: V1, fullHash: h('1'), undoVersionId: V0 },
    gestureId: 'sa-1',
    label: 'Add "Raise to £60"',
  })
}

function seedCanvasWithOption() {
  const nodes = [
    { id: FAC, kind: 'factor', label: 'Churn' },
    { id: OPT, kind: 'option', label: 'Raise to £60' },
  ].map((n) => mapDraftNodeToCanvas(n))
  useCanvasStore.setState({
    currentScenarioId: S,
    nodes,
    edges: [],
    lastAuthoritativeGraph: { nodeIds: [FAC, OPT], edgePairs: [] },
  } as never)
}

function restored(fullHash: string | null) {
  return {
    status: 'restored',
    graph: { nodes: [{ id: FAC, kind: 'factor', label: 'Churn' }], edges: [] },
    deduped: false,
    version: { versionId: R1, versionNumber: 3, deduped: false },
    undoVersionId: V1,
    fullHash,
    requestId: 'req',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  toasts.length = 0
  identity.userId = 'u-1'
  setPersistenceSessionActive(true)
  hydrateCanvasFromServer.mockResolvedValue('merged')
  listModelVersions.mockResolvedValue({ status: 'unavailable' })
  useUndoJournalStore.setState({ journal: journalWithAdd() })
  seedCanvasWithOption()
})

describe('undo is a SAVED restore of the edit’s own pre-edit version', () => {
  it('restores the add’s undo version, stating the head identity, and applies it to the canvas', async () => {
    restoreModelVersion.mockResolvedValue(restored(h('0')))

    await expect(runCanvasUndo('undo')).resolves.toBe('done')

    expect(restoreModelVersion).toHaveBeenCalledTimes(1)
    const [scenarioId, opts] = restoreModelVersion.mock.calls[0]
    expect(scenarioId).toBe(S)
    expect(opts).toMatchObject({
      versionId: V0,
      expectedGraphIdentityHash: h('1'),
      label: 'Undo: Add "Raise to £60"',
      userId: 'u-1',
    })
    expect(opts.mutationId).toMatch(/^[0-9a-f-]{36}$/)
    // The option is gone from the canvas — the server no longer holds it.
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual([FAC])
    // It settles through the cold-open read.
    expect(hydrateCanvasFromServer).toHaveBeenCalledWith(S, { userId: 'u-1', accessToken: 'tok' })
    // Redo is now available, from the restore's head.
    const j = useUndoJournalStore.getState().journal
    expect(j.redo).toHaveLength(1)
    expect(j.head).toEqual({ versionId: R1, fullHash: h('0') })
  })

  it('redo restores the undone version itself, against the restore’s head', async () => {
    restoreModelVersion.mockResolvedValue(restored(h('0')))
    await runCanvasUndo('undo')
    restoreModelVersion.mockResolvedValue({
      ...restored(h('1')),
      graph: { nodes: [{ id: FAC, kind: 'factor', label: 'Churn' }, { id: OPT, kind: 'option', label: 'Raise to £60' }], edges: [] },
      version: { versionId: 'rrrrrrrr-2222-4222-8222-222222222222', versionNumber: 4, deduped: false },
    })

    await expect(runCanvasUndo('redo')).resolves.toBe('done')

    expect(restoreModelVersion.mock.calls[1][1]).toMatchObject({
      versionId: V1,
      expectedGraphIdentityHash: h('0'),
      label: 'Redo: Add "Raise to £60"',
    })
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain(OPT)
  })
})

describe('the restored model gets its own fresh analysis (Paul 14 Oct)', () => {
  it('Undo and Redo each run the analysis once, through the canonical runner, after the restore', async () => {
    const run = vi.fn(async () => ({ status: 'dispatched' as const }))
    function Host() {
      useAnalyseAfterCommittedChange({ run, idle: true, hasRunOnRecord: true })
      return null
    }
    render(createElement(Host))
    restoreModelVersion.mockResolvedValue(restored(h('0')))
    await act(async () => { await runCanvasUndo('undo') })
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({ source: ANALYSE_AFTER_CHANGE_SOURCE })
    restoreModelVersion.mockResolvedValue({
      ...restored(h('1')),
      version: { versionId: 'rrrrrrrr-2222-4222-8222-222222222222', versionNumber: 4, deduped: false },
    })
    await act(async () => { await runCanvasUndo('redo') })
    expect(run).toHaveBeenCalledTimes(2)
    cleanup()
  })

  // ⛔ STALE RESULT SHOWN AS CURRENT (J5a investigation, 14 Oct). An Undo pressed while a Run is in flight: that Run
  // was dispatched on the edited model, and CEE composes its verdict against the graph it loaded at turn start
  // (turn-executor.ts currentAnalysisGraphHashForTurn), so its own turn says "current" about the model the Undo just
  // replaced. Its writers clear the restore's dirty mark, and the deliver check then accepted that Run as current for
  // the restored model: no Run, and "Analysis reflects the current model." over a model it never analysed.
  it('an Undo that lands while a Run is in flight: that Run is never presented as current for the restored model, and the restored model is run', async () => {
    const run = vi.fn(async () => ({ status: 'dispatched' as const }))
    function Host({ idle }: { idle: boolean }) {
      useAnalyseAfterCommittedChange({ run, idle, hasRunOnRecord: true })
      return null
    }
    const view = render(createElement(Host, { idle: false }))
    restoreModelVersion.mockResolvedValue(restored(h('0')))
    await act(async () => { await runCanvasUndo('undo') })
    expect(useCanvasStore.getState().analysisFreshnessDirty, 'the restore marks the model changed').toBe(true)
    // The in-flight Run's own turn lands, through the store's real writers (as applyV5State calls them): ITS result,
    // with CEE's "fresh" verdict about the graph that Run loaded before the Undo.
    const IN_FLIGHT_RUN = 'run-on-the-edited-model'
    await act(async () => {
      useCanvasStore.setState({
        results: { status: 'complete', hash: IN_FLIGHT_RUN, report },
        v5AnalysisFact: { scenarioId: S, analysisHash: IN_FLIGHT_RUN, hasRunAnalysisFact: true },
        hasCompletedFirstRun: true, analysisStateV1: null, importPendingServerRegistration: false,
      } as never)
      useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match', computed_at: '2026-10-14T12:00:00.000Z' })
      useCanvasStore.getState().clearAnalysisFreshnessDirty()
    })
    await act(async () => { view.rerender(createElement(Host, { idle: true })) })
    // By identity: the Run on screen is still the in-flight one, and it is NOT affirmed current for the restored model.
    expect(useCanvasStore.getState().results?.hash).toBe(IN_FLIGHT_RUN)
    expect(selectRunAffirmedCurrent(useCanvasStore.getState()), `${IN_FLIGHT_RUN} is presented as current for the restored model`).toBe(false)
    expect(run, 'the restored model got no Run of its own').toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({ source: ANALYSE_AFTER_CHANGE_SOURCE })
    cleanup()
  })

  it('CONTRAST: a refused restore (409) runs nothing', async () => {
    const run = vi.fn(async () => ({ status: 'dispatched' as const }))
    function Host() {
      useAnalyseAfterCommittedChange({ run, idle: true, hasRunOnRecord: true })
      return null
    }
    render(createElement(Host))
    restoreModelVersion.mockResolvedValue({ status: 'conflict' })
    await act(async () => { await runCanvasUndo('undo') })
    expect(run).not.toHaveBeenCalled()
    cleanup()
  })
})

describe('stale means refuse, never merge', () => {
  it('a 409 empties the journal, leaves the canvas untouched and says why', async () => {
    restoreModelVersion.mockResolvedValue({ status: 'conflict' })

    await expect(runCanvasUndo('undo')).resolves.toBe('refused_stale')

    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual([FAC, OPT])
    expect(useUndoJournalStore.getState().journal.undo).toHaveLength(0)
    expect(toasts).toContain(UNDO_NOTICE.stale)
    expect(hydrateCanvasFromServer).not.toHaveBeenCalled()
  })

  it('an unknown outcome is retried ONCE with the SAME mutation id (replay-safe)', async () => {
    restoreModelVersion.mockResolvedValueOnce({ status: 'unavailable' }).mockResolvedValueOnce(restored(h('0')))

    await expect(runCanvasUndo('undo')).resolves.toBe('done')

    expect(restoreModelVersion).toHaveBeenCalledTimes(2)
    expect(restoreModelVersion.mock.calls[0][1].mutationId).toBe(restoreModelVersion.mock.calls[1][1].mutationId)
  })
})

describe('refusals that never call the server', () => {
  it('a guest (no signed-in user) is told why; nothing is sent', async () => {
    identity.userId = null
    setPersistenceSessionActive(false)
    await expect(runCanvasUndo('undo')).resolves.toBe('sign_in_required')
    expect(restoreModelVersion).not.toHaveBeenCalled()
    expect(toasts).toContain(UNDO_NOTICE.signInRequired)
  })

  it('S5: a guest who just edited (EMPTY journal — versions are owned-only) is told to sign in, never "Nothing to undo."', async () => {
    setPersistenceSessionActive(false)
    useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
    await expect(runCanvasUndo('undo')).resolves.toBe('sign_in_required')
    expect(toasts).toEqual([UNDO_NOTICE.signInRequired])
  })

  it('S5: signed in on a model that is not saved is told so — not asked to sign in again', async () => {
    useCanvasStore.setState({ currentScenarioId: 'local-scratch-graph' } as never)
    await expect(runCanvasUndo('undo')).resolves.toBe('sign_in_required')
    expect(toasts).toEqual([UNDO_NOTICE.notSaved])
  })

  it('nothing to undo says so', async () => {
    useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
    await expect(runCanvasUndo('undo')).resolves.toBe('nothing')
    expect(restoreModelVersion).not.toHaveBeenCalled()
    expect(toasts).toContain(UNDO_NOTICE.nothingToUndo)
  })

  it('a barrier is answered, not stepped past', async () => {
    useUndoJournalStore.setState({
      journal: recordBarrier(journalWithAdd(), { scenarioId: S, reason: 'not_undoable' }),
    })
    await expect(runCanvasUndo('undo')).resolves.toBe('barrier')
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })

  it('an edit still being saved makes undo wait', async () => {
    useCanvasStore.setState({ pendingStructuralAdds: [{ id: 'x' }] } as never)
    await expect(runCanvasUndo('undo')).resolves.toBe('busy')
    expect(restoreModelVersion).not.toHaveBeenCalled()
    useCanvasStore.setState({ pendingStructuralAdds: [] } as never)
  })
})

/** CEE's version list after the approval: v1 is current, written over v0. */
function listAfterApproval(provenance: string, parentVersionId: string | null = V0) {
  return {
    status: 'list',
    currentVersionId: V1,
    requestId: 'req-list',
    versions: [
      { id: V1, versionNumber: 2, label: null, parentVersionId, provenance, restoredFromVersionId: null, createdAt: '2026-10-19T07:55:00Z', graphIdentityHash: h('1'), sourceTurnId: 't-approve' },
      { id: V0, versionNumber: 1, label: null, parentVersionId: null, provenance: 'initial', restoredFromVersionId: null, createdAt: '2026-10-19T07:53:00Z', graphIdentityHash: h('0'), sourceTurnId: null },
    ],
  }
}

describe('after a reopen, Undo rebuilds its step from CEE\'s version list (DL-3 ruling (b), staging 1e37799f C2 step 8)', () => {
  beforeEach(() => {
    // A cold reopen: this visit's journal holds nothing for the model.
    useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
  })

  it('approve → reopen → Undo sends ONE restore to the version the approval was written over, and the canvas reads it back', async () => {
    listModelVersions.mockResolvedValue(listAfterApproval('committed_mutation'))
    restoreModelVersion.mockResolvedValue(restored(h('0')))

    await expect(runCanvasUndo('undo')).resolves.toBe('done')

    expect(listModelVersions).toHaveBeenCalledTimes(1)
    expect(restoreModelVersion).toHaveBeenCalledTimes(1)
    expect(restoreModelVersion.mock.calls[0][0]).toBe(S)
    expect(restoreModelVersion.mock.calls[0][1]).toMatchObject({ versionId: V0, expectedGraphIdentityHash: h('1') })
    // The restored (pre-approval) graph is what the canvas holds.
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual([FAC])
  })

  it('a second Undo press writes nothing', async () => {
    listModelVersions.mockResolvedValue(listAfterApproval('committed_mutation'))
    restoreModelVersion.mockResolvedValue(restored(h('0')))
    await runCanvasUndo('undo')
    toasts.length = 0

    await expect(runCanvasUndo('undo')).resolves.toBe('nothing')
    expect(restoreModelVersion).toHaveBeenCalledTimes(1)
    expect(toasts).toEqual([UNDO_NOTICE.nothingToUndo])
  })

  it('CONTRAST: the current version is a restore → never stepped back past, nothing is written', async () => {
    listModelVersions.mockResolvedValue(listAfterApproval('restore'))
    await expect(runCanvasUndo('undo')).resolves.toBe('nothing')
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })

  it('CONTRAST: CEE does not know what the current version replaced → nothing is written', async () => {
    listModelVersions.mockResolvedValue(listAfterApproval('committed_mutation', null))
    await expect(runCanvasUndo('undo')).resolves.toBe('nothing')
    expect(restoreModelVersion).not.toHaveBeenCalled()
  })

  it('CONTRAST: a journal this visit already holds is never replaced by the list', async () => {
    useUndoJournalStore.setState({ journal: journalWithAdd() })
    restoreModelVersion.mockResolvedValue(restored(h('0')))
    await runCanvasUndo('undo')
    expect(listModelVersions).not.toHaveBeenCalled()
  })
})

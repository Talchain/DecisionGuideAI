import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { selectRunAffirmedCurrent } from '../../state/analysisStateSelector'
import { SERVED_STAMP, resetPaulRun, seedPaulRun } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'
import { captureTurnForUndo, useUndoJournalStore } from '../../undo/captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, nextUndo } from '../../undo/undoJournal'
import { ANALYSE_AFTER_CHANGE_SOURCE, useAnalyseAfterCommittedChange } from '../useAnalyseAfterCommittedChange'
import type { CanonicalRunOptions, CanonicalRunOutcome } from '../canonicalRunRegistry'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const h = (c: string) => c.repeat(64)
const edit = { type: 'factor_value_edit', payload: { node_id: 'fac_price', value: 59 } }

/** CEE's `model_version_receipt`, as `captureTurnForUndo` reads it from a real turn response. */
function receipt(versionId: string, undoVersionId: string | null, fullHash = h(versionId.slice(-1)), mutationId = `m-${versionId}`) {
  return { model_version_receipt: { schema: 'model_version_mutation_receipt.v1', mutation_id: mutationId,
    version_id: versionId, full_hash: fullHash, undo_version_id: undoVersionId } }
}

type Run = (opts?: CanonicalRunOptions) => Promise<CanonicalRunOutcome>
let run: ReturnType<typeof vi.fn<Parameters<Run>, ReturnType<Run>>>
const journal = () => useUndoJournalStore.getState().journal
const canvasEdit = (turnId: string, response: unknown) =>
  act(async () => { captureTurnForUndo({ scenarioId: S, turnId, systemEvent: edit, response }) })

function Host({ idle, hasRunOnRecord = true }: { idle: boolean; hasRunOnRecord?: boolean }) {
  useAnalyseAfterCommittedChange({ run, idle, hasRunOnRecord })
  return null
}


beforeEach(() => {
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: true, analysisStateV1: null } as never)
  run = vi.fn<Parameters<Run>, ReturnType<Run>>(async () => ({ status: 'dispatched' }))
})
afterEach(() => { cleanup(); resetPaulRun() })

describe('a canvas-local commit is analysed once, on the saved version, through the canonical runner', () => {
  it('a direct canvas edit CEE saved (its receipt) runs the analysis once, with the after-change source', async () => {
    render(<Host idle />)
    await canvasEdit('t1', receipt('v1', 'v0'))
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({ source: ANALYSE_AFTER_CHANGE_SOURCE })
  })

  it('waits while a turn, an edit or a Run is in flight, then runs once when it settles', async () => {
    const view = render(<Host idle={false} />)
    await canvasEdit('t1', receipt('v1', 'v0'))
    expect(run).not.toHaveBeenCalled()
    await act(async () => { view.rerender(<Host idle />) })
    expect(run).toHaveBeenCalledTimes(1)
    await act(async () => { view.rerender(<Host idle={false} />) })
    await act(async () => { view.rerender(<Host idle />) })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('DELIVER, DON’T RE-RUN: when the commit’s own turn already carried a current Run, nothing runs again', async () => {
    // The served capture's Run: CEE's fresh verdict for the model on screen.
    seedPaulRun(SERVED_STAMP)
    expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(true)
    render(<Host idle />)
    await canvasEdit('t1', receipt('v1', 'v0'))
    expect(run).not.toHaveBeenCalled()
  })

  it('CEE OWNS a change made through a CEE turn: a chat turn’s receipt (no canvas edit) runs nothing', async () => {
    render(<Host idle />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: undefined, response: receipt('v1', 'v0') }) })
    expect(run).not.toHaveBeenCalled()
  })

  it('a replayed receipt is not a second commit; an edit with no receipt (refused) runs nothing', async () => {
    render(<Host idle />)
    await canvasEdit('t1', receipt('v1', 'v0'))
    await canvasEdit('t1-replay', receipt('v1', 'v0'))
    await canvasEdit('t2', { blocks: [] })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('before the first Run, nothing runs (the readiness review owns it)', async () => {
    render(<Host idle hasRunOnRecord={false} />)
    await canvasEdit('t1', receipt('v1', 'v0'))
    expect(run).not.toHaveBeenCalled()
  })

  it('a Run already in flight keeps the change pending until it settles', async () => {
    run.mockResolvedValueOnce({ status: 'already-running' })
    const view = render(<Host idle />)
    await canvasEdit('t1', receipt('v1', 'v0'))
    expect(run).toHaveBeenCalledTimes(1)
    await act(async () => { view.rerender(<Host idle={false} />) })
    await act(async () => { view.rerender(<Host idle />) })
    expect(run).toHaveBeenCalledTimes(2)
  })
})

describe('Undo keeps working across a Run', () => {
  it('a Run’s own receipt (the same model) keeps the undo step; a different model is still a foreign write', async () => {
    await canvasEdit('t1', receipt('v1', 'v0'))
    captureTurnForUndo({ scenarioId: S, turnId: 't2', systemEvent: undefined, response: receipt('v9', 'v1', h('1')) })
    expect(nextUndo(journal())).toMatchObject({ kind: 'restore', targetVersionId: 'v0', expectedFullHash: h('1') })
    expect(journal().head).toEqual({ versionId: 'v9', fullHash: h('1') })
    captureTurnForUndo({ scenarioId: S, turnId: 't3', systemEvent: undefined, response: receipt('v2', 'v9') })
    expect(nextUndo(journal()).kind).toBe('nothing')
  })
})

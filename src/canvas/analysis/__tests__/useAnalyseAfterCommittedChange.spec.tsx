import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { captureTurnForUndo, useUndoJournalStore } from '../../undo/captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, nextRedo, nextUndo, redoSucceeded, undoSucceeded } from '../../undo/undoJournal'
import { ANALYSE_AFTER_CHANGE_SOURCE, committedChangeVersion, useAnalyseAfterCommittedChange } from '../useAnalyseAfterCommittedChange'
import type { CanonicalRunOptions, CanonicalRunOutcome } from '../canonicalRunRegistry'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const h = (c: string) => c.repeat(64)
const edit = { type: 'factor_value_edit', payload: { node_id: 'fac_price', value: 59 } }

/** CEE's `model_version_receipt`, as `captureTurnForUndo` reads it from a real turn response. */
function receipt(versionId: string, undoVersionId: string | null, fullHash = h(versionId.slice(-1))) {
  return { model_version_receipt: { schema: 'model_version_mutation_receipt.v1', mutation_id: `m-${versionId}`,
    version_id: versionId, full_hash: fullHash, undo_version_id: undoVersionId } }
}

const journal = () => useUndoJournalStore.getState().journal
type Run = (opts?: CanonicalRunOptions) => Promise<CanonicalRunOutcome>
let run: ReturnType<typeof vi.fn<Parameters<Run>, ReturnType<Run>>>

function Host({ idle, hasRunOnRecord = true }: { idle: boolean; hasRunOnRecord?: boolean }) {
  useAnalyseAfterCommittedChange({ run, idle, hasRunOnRecord })
  return null
}

beforeEach(() => {
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
  run = vi.fn<Parameters<Run>, ReturnType<Run>>(async () => ({ status: 'dispatched' }))
})
afterEach(cleanup)

describe('every committed change is analysed once, on the saved version, through the canonical runner', () => {
  it('a saved edit (its own receipt) runs the analysis once, with the after-change source', async () => {
    render(<Host idle />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: edit, response: receipt('v1', 'v0') }) })
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({ source: ANALYSE_AFTER_CHANGE_SOURCE })
  })

  it('waits while a turn or Run is in flight, then runs once when it settles', async () => {
    const view = render(<Host idle={false} />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: edit, response: receipt('v1', 'v0') }) })
    expect(run).not.toHaveBeenCalled()
    await act(async () => { view.rerender(<Host idle />) })
    expect(run).toHaveBeenCalledTimes(1)
    await act(async () => { view.rerender(<Host idle={false} />) })
    await act(async () => { view.rerender(<Host idle />) })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('Undo and Redo each analyse the restored model', async () => {
    render(<Host idle />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: edit, response: receipt('v1', 'v0') }) })
    const undo = nextUndo(journal())
    expect(undo.kind).toBe('restore')
    if (undo.kind !== 'restore') return
    await act(async () => { useUndoJournalStore.setState({ journal: undoSucceeded(journal(), undo.step, { versionId: 'v2', fullHash: h('0') }) }) })
    expect(run).toHaveBeenCalledTimes(2)
    const redo = nextRedo(journal())
    if (redo.kind !== 'restore') throw new Error('redo expected')
    await act(async () => { useUndoJournalStore.setState({ journal: redoSucceeded(journal(), redo.step, { versionId: 'v3', fullHash: h('1') }) }) })
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('a Run’s own receipt (the same model) never re-triggers, and the Undo step survives it', async () => {
    render(<Host idle />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: edit, response: receipt('v1', 'v0') }) })
    expect(run).toHaveBeenCalledTimes(1)
    // The Run's turn: no system event, a new version id holding the SAME model identity hash.
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't2', systemEvent: undefined, response: receipt('v9', 'v1', h('1')) }) })
    expect(run).toHaveBeenCalledTimes(1)
    const undo = nextUndo(journal())
    expect(undo).toMatchObject({ kind: 'restore', targetVersionId: 'v0', expectedFullHash: h('1') })
    expect(journal().head).toEqual({ versionId: 'v9', fullHash: h('1') })
  })

  it('CONTRAST: another writer’s change (a different model) is a foreign write — no Run, nothing undoable', async () => {
    render(<Host idle />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: edit, response: receipt('v1', 'v0') }) })
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't2', systemEvent: undefined, response: receipt('v2', 'v1') }) })
    expect(run).toHaveBeenCalledTimes(1)
    expect(nextUndo(journal()).kind).toBe('nothing')
  })

  it('an edit with no receipt (refused, unapproved, typing) runs nothing; before the first Run, nothing runs', async () => {
    const view = render(<Host idle hasRunOnRecord={false} />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: edit, response: { blocks: [] } }) })
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't2', systemEvent: edit, response: receipt('v1', 'v0') }) })
    view.rerender(<Host idle hasRunOnRecord={false} />)
    expect(run).not.toHaveBeenCalled()
  })

  it('a Run already in flight keeps the change pending until it settles', async () => {
    run.mockResolvedValueOnce({ status: 'already-running' })
    const view = render(<Host idle />)
    await act(async () => { captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: edit, response: receipt('v1', 'v0') }) })
    expect(run).toHaveBeenCalledTimes(1)
    await act(async () => { view.rerender(<Host idle={false} />) })
    await act(async () => { view.rerender(<Host idle />) })
    expect(run).toHaveBeenCalledTimes(2)
  })
})

describe('committedChangeVersion', () => {
  it('names the new version only when the model identity moved by this canvas’s own change', () => {
    const before = { ...EMPTY_UNDO_JOURNAL, scenarioId: S, head: { versionId: 'v1', fullHash: h('1') } }
    const step = { kind: 'step' as const, gestureId: 'g', label: 'Change value',
      first: { mutationId: 'm', versionId: 'v2', fullHash: h('2'), undoVersionId: 'v1' },
      last: { mutationId: 'm', versionId: 'v2', fullHash: h('2'), undoVersionId: 'v1' } }
    expect(committedChangeVersion(before, { ...before, head: { versionId: 'v2', fullHash: h('2') }, undo: [step] })).toBe('v2')
    expect(committedChangeVersion(before, { ...before, head: { versionId: 'v2', fullHash: h('1') }, undo: [step] })).toBeNull()
    expect(committedChangeVersion(before, { ...before, head: { versionId: 'v2', fullHash: h('2') } })).toBeNull()
    expect(committedChangeVersion(before, { ...before, head: null, undo: [step] })).toBeNull()
  })
})

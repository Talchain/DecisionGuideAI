import { describe, it, expect, beforeEach } from 'vitest'
import { captureTurnForUndo, readUndoReceipt, undoLabelFor, useUndoJournalStore } from '../captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, nextUndo } from '../undoJournal'

const S = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const h = (c: string) => c.repeat(64)

/** The receipt shape CEE puts on `OlumiResponse.model_version_receipt` (the four fields read). */
function response(versionId: string, undoVersionId: string | null, mutationId = `m-${versionId}`) {
  return {
    model_version_receipt: {
      schema: 'model_version_mutation_receipt.v1',
      mutation_id: mutationId,
      version_id: versionId,
      full_hash: h(versionId.slice(-1)),
      undo_version_id: undoVersionId,
    },
  }
}

const addOption = { type: 'structural_add', payload: { node_id: 'opt_60', node_kind: 'option', label: 'Raise to £60' } }
const addLink = { type: 'structural_add_edge', payload: { from: 'opt_60', to: 'fac_churn' } }
const rename = { type: 'structural_rename', payload: { node_id: 'opt_60', label: 'Raise to £59' } }

beforeEach(() => useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL }))

const journal = () => useUndoJournalStore.getState().journal

describe('capture: only this canvas’s own versioned edits become undo steps', () => {
  it('a canvas edit with a receipt becomes a step whose undo target is its own pre-edit version', () => {
    captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: rename, response: response('v1', 'v0') })
    const next = nextUndo(journal())
    expect(next.kind).toBe('restore')
    if (next.kind === 'restore') {
      expect(next.targetVersionId).toBe('v0')
      expect(next.label).toBe('Undo: Rename to "Raise to £59"')
    }
  })

  it('a canvas edit with NO receipt (refused, guest, versions off) changes nothing', () => {
    captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: rename, response: { blocks: [] } })
    expect(journal()).toBe(EMPTY_UNDO_JOURNAL)
  })

  it('a chat or Agent turn carrying a receipt is a FOREIGN write: nothing before it is undoable', () => {
    captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: rename, response: response('v1', 'v0') })
    captureTurnForUndo({ scenarioId: S, turnId: 't2', systemEvent: undefined, response: response('v2', 'v1') })
    expect(nextUndo(journal()).kind).toBe('nothing')
    expect(journal().head?.versionId).toBe('v2')
  })

  it('a prior-range judgement is a barrier, not a silent step past it', () => {
    captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: rename, response: response('v1', 'v0') })
    captureTurnForUndo({ scenarioId: S, turnId: 't2', systemEvent: { type: 'prior_range_edit' }, response: {} })
    expect(nextUndo(journal())).toEqual({ kind: 'barrier', reason: 'not_undoable' })
  })

  it('"+ Add option" and its chained link are ONE step when the link carries the node add’s gesture id', () => {
    captureTurnForUndo({
      scenarioId: S, turnId: 't1', systemEvent: addOption, response: response('v1', 'v0'), undoGestureId: 'add-intent-1',
    })
    captureTurnForUndo({
      scenarioId: S, turnId: 't2', systemEvent: addLink, response: response('v2', 'v1'), undoGestureId: 'add-intent-1',
    })
    const next = nextUndo(journal())
    expect(next.kind === 'restore' && next.targetVersionId).toBe('v0')
    expect(journal().undo).toHaveLength(1)
  })

  it('without the gesture id the link is its own step (the control for the grouping above)', () => {
    captureTurnForUndo({ scenarioId: S, turnId: 't1', systemEvent: addOption, response: response('v1', 'v0'), undoGestureId: 'add-intent-1' })
    captureTurnForUndo({ scenarioId: S, turnId: 't2', systemEvent: addLink, response: response('v2', 'v1') })
    expect(journal().undo).toHaveLength(2)
  })
})

describe('reading the receipt', () => {
  it('reads the four fields and refuses a malformed receipt', () => {
    expect(readUndoReceipt(response('v1', null))).toEqual({
      mutationId: 'm-v1', versionId: 'v1', fullHash: h('1'), undoVersionId: null,
    })
    expect(readUndoReceipt({ model_version_receipt: { version_id: 'v1' } })).toBeNull()
    expect(readUndoReceipt({ model_version_receipt: null })).toBeNull()
  })

  it('labels name the gesture plainly', () => {
    expect(undoLabelFor(addOption)).toBe('Add "Raise to £60"')
    expect(undoLabelFor({ type: 'structural_delete', payload: { removed_node_ids: ['x'] } })).toBe('Delete')
    expect(undoLabelFor({ type: 'structural_delete', payload: { removed_node_ids: [], removed_edges: [{}] } })).toBe('Remove link')
  })
})

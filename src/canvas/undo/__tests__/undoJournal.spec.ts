/**
 * The canvas undo journal: which saved version ⌘Z / ⌘⇧Z restores, and the
 * identity the server must still hold for that restore to be safe.
 * Every assertion binds by version / mutation identity, never by position alone.
 */

import { describe, it, expect } from 'vitest'
import {
  EMPTY_UNDO_JOURNAL,
  nextRedo,
  nextUndo,
  recordBarrier,
  recordEditReceipt,
  recordForeignWrite,
  redoSucceeded,
  restoreRefused,
  undoSucceeded,
  type UndoJournalState,
  type UndoReceipt,
} from '../undoJournal'

const S = 'scn-1'
const h = (c: string) => c.repeat(64)

/** v0 → vA (edit A) → vB (edit B): a contiguous chain of receipts. */
const A: UndoReceipt = { mutationId: 'm-a', versionId: 'vA', fullHash: h('a'), undoVersionId: 'v0' }
const B: UndoReceipt = { mutationId: 'm-b', versionId: 'vB', fullHash: h('b'), undoVersionId: 'vA' }

function edit(state: UndoJournalState, receipt: UndoReceipt, gestureId = receipt.mutationId, label = gestureId) {
  return recordEditReceipt(state, { scenarioId: S, receipt, gestureId, label })
}

function restoreOf(state: UndoJournalState) {
  const next = nextUndo(state)
  if (next.kind !== 'restore') throw new Error(`expected a restore, got ${next.kind}`)
  return next
}

describe('undo targets the edit’s own pre-edit version, stated against the head', () => {
  it('undoing the newest edit restores ITS undo version, expecting the head the journal last saw', () => {
    const s = edit(edit(EMPTY_UNDO_JOURNAL, A), B)
    const next = restoreOf(s)
    expect(next.targetVersionId).toBe('vA')
    expect(next.expectedFullHash).toBe(h('b'))
    expect(next.step.first.mutationId).toBe('m-b')
  })

  it('two undos walk back through both edits; the second expects the FIRST restore’s head', () => {
    let s = edit(edit(EMPTY_UNDO_JOURNAL, A), B)
    const first = restoreOf(s)
    s = undoSucceeded(s, first.step, { versionId: 'r1', fullHash: h('a') })
    const second = restoreOf(s)
    expect(second.targetVersionId).toBe('v0')
    expect(second.expectedFullHash).toBe(h('a'))
  })

  it('redo restores the undone edit’s own version against the restore’s head, then undo works again', () => {
    let s = edit(edit(EMPTY_UNDO_JOURNAL, A), B)
    const u = restoreOf(s)
    s = undoSucceeded(s, u.step, { versionId: 'r1', fullHash: h('a') })
    const r = nextRedo(s)
    if (r.kind !== 'restore') throw new Error('expected redo')
    expect(r.targetVersionId).toBe('vB')
    expect(r.expectedFullHash).toBe(h('a'))
    s = redoSucceeded(s, r.step, { versionId: 'r2', fullHash: h('b') })
    const again = restoreOf(s)
    expect(again.targetVersionId).toBe('vA')
    expect(again.expectedFullHash).toBe(h('b'))
  })

  it('an edit after an undo continues from the restore’s head and clears redo', () => {
    let s = edit(edit(EMPTY_UNDO_JOURNAL, A), B)
    s = undoSucceeded(s, restoreOf(s).step, { versionId: 'r1', fullHash: h('a') })
    const C: UndoReceipt = { mutationId: 'm-c', versionId: 'vC', fullHash: h('c'), undoVersionId: 'r1' }
    s = edit(s, C)
    expect(nextRedo(s).kind).toBe('nothing')
    expect(restoreOf(s).targetVersionId).toBe('r1')
    // A is still reachable beneath C: the chain r1 is contiguous with the head.
    s = undoSucceeded(s, restoreOf(s).step, { versionId: 'r2', fullHash: h('a') })
    expect(restoreOf(s).targetVersionId).toBe('v0')
  })
})

describe('never step back past a write the journal did not see', () => {
  it('a receipt whose undo version is not the head drops the older steps', () => {
    const X: UndoReceipt = { mutationId: 'm-x', versionId: 'vX', fullHash: h('x'), undoVersionId: 'vAgent' }
    const s = edit(edit(EMPTY_UNDO_JOURNAL, A), X)
    expect(restoreOf(s).targetVersionId).toBe('vAgent')
    const after = undoSucceeded(s, restoreOf(s).step, { versionId: 'r1', fullHash: h('g') })
    expect(nextUndo(after).kind).toBe('nothing')
  })

  it('a foreign write (Agent / chat / registration) empties the journal and moves the head', () => {
    const s = recordForeignWrite(edit(EMPTY_UNDO_JOURNAL, A), { scenarioId: S, head: { versionId: 'vAgent', fullHash: h('g') } })
    expect(nextUndo(s).kind).toBe('nothing')
    expect(s.head?.versionId).toBe('vAgent')
  })

  it('a stale refusal empties the journal (nothing in it is safe any more)', () => {
    const s = restoreRefused(edit(edit(EMPTY_UNDO_JOURNAL, A), B))
    expect(nextUndo(s).kind).toBe('nothing')
    expect(nextRedo(s).kind).toBe('nothing')
    expect(s.head).toBeNull()
  })
})

describe('replays, barriers, gestures and scenarios', () => {
  it('a replayed receipt (same mutation id) is the same write, not a second step', () => {
    const s = edit(edit(edit(EMPTY_UNDO_JOURNAL, A), B), B)
    expect(s.undo).toHaveLength(2)
  })

  it('a barrier is answered, never stepped past', () => {
    const s = recordBarrier(edit(EMPTY_UNDO_JOURNAL, A), { scenarioId: S, reason: 'not_undoable' })
    expect(nextUndo(s)).toEqual({ kind: 'barrier', reason: 'not_undoable' })
  })

  it('the first edit on an empty model (no undo version) is a barrier', () => {
    const first: UndoReceipt = { mutationId: 'm-0', versionId: 'v0', fullHash: h('0'), undoVersionId: null }
    expect(nextUndo(edit(EMPTY_UNDO_JOURNAL, first))).toEqual({ kind: 'barrier', reason: 'no_undo_version' })
  })

  it('a link chained to a node add is undone WITH it: one restore, to the node add’s undo version', () => {
    const node: UndoReceipt = { mutationId: 'm-node', versionId: 'vN', fullHash: h('n'), undoVersionId: 'v0' }
    const link: UndoReceipt = { mutationId: 'm-link', versionId: 'vL', fullHash: h('l'), undoVersionId: 'vN' }
    const s = edit(edit(EMPTY_UNDO_JOURNAL, node, 'add-1', 'Add option'), link, 'add-1', 'Add option')
    expect(s.undo).toHaveLength(1)
    const next = restoreOf(s)
    expect(next.targetVersionId).toBe('v0')
    expect(next.expectedFullHash).toBe(h('l'))
    expect(next.label).toBe('Undo: Add option')
  })

  it('a separately drawn link is its own step', () => {
    const node: UndoReceipt = { mutationId: 'm-node', versionId: 'vN', fullHash: h('n'), undoVersionId: 'v0' }
    const link: UndoReceipt = { mutationId: 'm-link', versionId: 'vL', fullHash: h('l'), undoVersionId: 'vN' }
    const s = edit(edit(EMPTY_UNDO_JOURNAL, node, 'add-1'), link, 'link-2')
    expect(s.undo).toHaveLength(2)
    expect(restoreOf(s).targetVersionId).toBe('vN')
  })

  it('switching scenario starts an empty journal', () => {
    const s = recordEditReceipt(edit(EMPTY_UNDO_JOURNAL, A), {
      scenarioId: 'scn-2',
      receipt: { mutationId: 'm-z', versionId: 'vZ', fullHash: h('z'), undoVersionId: 'vY' },
      gestureId: 'g',
      label: 'g',
    })
    expect(s.scenarioId).toBe('scn-2')
    expect(s.undo).toHaveLength(1)
    expect(restoreOf(s).targetVersionId).toBe('vY')
  })

  it('an outcome for a step that is no longer on top is ignored', () => {
    const s = edit(edit(EMPTY_UNDO_JOURNAL, A), B)
    const stale = restoreOf(s).step
    const moved = edit(s, { mutationId: 'm-c', versionId: 'vC', fullHash: h('c'), undoVersionId: 'vB' })
    expect(undoSucceeded(moved, stale, { versionId: 'r', fullHash: h('r') })).toBe(moved)
  })
})

/**
 * `batchUpdateNodes` must push an UNLABELLED history entry.
 *
 * ── WHY THIS EXISTS SEPARATELY FROM THE TOAST PIN ───────────────────────────
 * `useHistoryToast.noUndoAction.spec.tsx` pins the CONSUMER: whatever label
 * arrives, no Undo action is offered. It cannot pin the PRODUCER, because it
 * mocks `../../store` wholesale — so restoring the labelled push in `store.ts`
 * leaves it, and every other `batchUpdateNodes`-touching spec, fully green.
 * A reviewer demonstrated exactly that with a mutant, and demonstrated the
 * non-equivalence rather than asserting it: a throwaway pin against the real
 * store failed with `expected 'backfill-interventions' to be undefined`.
 *
 * ⭐ THE GENERAL SHAPE, WORTH REMEMBERING: a spec that mocks the module it is
 * reasoning about can only ever pin the seam it kept. Half the change lived on
 * the other side of that mock and was unguarded.
 *
 * WHAT IS BEING PROTECTED: `batchUpdateNodes` is, per its own note in
 * `store.ts`, exclusively the CEE intervention-backfill producer and NOT a user
 * model edit. Its second parameter is an internal `sourceTag`. While that tag
 * was passed through as the history LABEL, `useHistoryToast` displayed it to
 * users verbatim — a toast reading `backfill-interventions`, with an Undo
 * button, on the main draft-apply path.
 *
 * This spec uses the REAL store deliberately. Do not mock it here.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

function seedTwoNodes() {
  useCanvasStore.setState({
    nodes: [
      { id: 'n1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'n2', type: 'option', position: { x: 100, y: 0 }, data: { label: 'B' } },
    ],
    edges: [],
    history: { past: [], future: [] },
  } as never)
}

describe('batchUpdateNodes pushes an unlabelled history entry', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    seedTwoNodes()
  })

  it('does not carry the caller sourceTag into the history label', () => {
    const before = useCanvasStore.getState().history.past.length

    const result = useCanvasStore.getState().batchUpdateNodes(
      [{ id: 'n1', data: { is_baseline: true } as never }],
      'backfill-interventions',
    )

    // PRECONDITION, in-test: the write actually landed and actually pushed a
    // history entry. Without this the label assertion could pass because
    // nothing happened at all.
    expect(result.updatedCount).toBe(1)
    const past = useCanvasStore.getState().history.past
    expect(past.length - before).toBe(1)

    expect(past[past.length - 1].label).toBeUndefined()
  })

  it('carries no label even when the caller passes none', () => {
    const result = useCanvasStore.getState().batchUpdateNodes([
      { id: 'n2', data: { is_baseline: false } as never },
    ])

    expect(result.updatedCount).toBe(1)
    const past = useCanvasStore.getState().history.past
    expect(past[past.length - 1].label).toBeUndefined()
  })

  /**
   * The entry must still EXIST — the fix removes the label, never the history.
   * A mutant that skipped the push entirely would otherwise satisfy both
   * assertions above by leaving `past` empty.
   */
  it('still records the change in history so it undoes as one step', () => {
    seedTwoNodes()
    const before = useCanvasStore.getState().history.past.length

    useCanvasStore.getState().batchUpdateNodes(
      [
        { id: 'n1', data: { is_baseline: true } as never },
        { id: 'n2', data: { is_baseline: false } as never },
      ],
      'backfill-interventions',
    )

    expect(useCanvasStore.getState().history.past.length - before).toBe(1)
  })
})

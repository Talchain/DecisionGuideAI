/**
 * useHistoryToast — the history toast must offer NO Undo action, on any path.
 *
 * ── WHY THE ACTION WAS REMOVED ──────────────────────────────────────────────
 * The toast offered an "Undo" button wired straight to the local zustand stack
 * (`useCanvasStore.getState().undo()`), gated by nothing. Every sibling path is
 * correctly inert — ⌘Z and the sidebar buttons are gated on
 * `hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)`,
 * which is `'disabled'`, and the context menu filters its local-semantic
 * entries out entirely. The toast was the exception, not the rule.
 *
 * It could not be canonicalised. A canvas semantic edit creates NO canonical
 * version — `ServerVersionsSection` is the only consumer of the model-versions
 * API, and versions come from an explicit save or a server-side commit. So the
 * history entry this toast announces has no canonical counterpart, and routing
 * its Undo to `restoreModelVersion` would restore the last SERVER version — a
 * different object — which "overwrites the working model for everyone with
 * access". A worse claim, and a destructive write.
 *
 * ⚠⚠ A SECOND REASON WAS OFFERED HERE AND IS WITHDRAWN AS FALSE. It claimed
 * `undo()` reaches a REAL server write for a signed-in user, via
 * `useScenario`'s subscription and `isPersistenceActive`. It does not:
 * `persistGraphNow` checks `clientCanWriteReadableGraph()` before calling
 * `saveGraphViaGatedPath`, which checks it again before the
 * `apply_patch_and_log` RPC — the declared choke point — and
 * `clientGraphWritePolicy.ts` returns a hard `false`. **No client graph write
 * happens for anyone**, so undo is local for every caller. The chain was traced
 * correctly and stopped one hop short, and the claim asserted the client can
 * persist the graph, which is the belief behind the 13 Aug P0 — so it is
 * corrected in place rather than quietly deleted.
 *
 * The removal rests on the canonical-counterpart reason above, which that
 * correction leaves untouched.
 *
 * ── WHY THIS PIN ENUMERATES ELEVEN PATHS ────────────────────────────────────
 * The over-wide DISPLAY CONDITION is the defect. A pin scoped to the deletion
 * case that prompted this work would leave the other paths free to regress, so
 * every labelled `pushToHistory` shape in `store.ts` is driven here, plus the
 * redo replay (`redo()` restores a future entry carrying its label) and the
 * AI-driven `backfill-interventions` write.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { act } from 'react'

type HistoryEntry = { nodes: unknown[]; edges: unknown[]; label?: string }
type Listener = (state: { history: { past: HistoryEntry[] } }) => void

const showToast = vi.fn()
let listener: Listener | null = null
let past: HistoryEntry[] = []

vi.mock('../../store', () => ({
  useCanvasStore: {
    subscribe: (fn: Listener) => {
      listener = fn
      return () => {
        listener = null
      }
    },
    getState: () => ({ history: { past }, undo: vi.fn() }),
  },
}))

vi.mock('../../ToastContext', () => ({
  useShowToast: () => showToast,
}))

/** Sibling notice, composed by the hook; irrelevant to this pin. */
vi.mock('../useDurableDeletionToast', () => ({
  useDurableDeletionToast: () => undefined,
}))

// Imported after the mocks are registered.
const { useHistoryToast } = await import('../useHistoryToast')

function Harness() {
  useHistoryToast()
  return null
}

/** Push one labelled entry and return the arguments the toast was called with. */
function pushLabelled(label: string): unknown[] {
  past = []
  showToast.mockClear()
  render(<Harness />)
  const entry: HistoryEntry = { nodes: [], edges: [], label }
  act(() => {
    listener?.({ history: { past: [entry] } })
  })
  return showToast.mock.calls[0] ?? []
}

/**
 * Every labelled `pushToHistory` shape in `store.ts`, plus the redo replay and
 * the AI-driven write. Derived from the call sites, not from memory.
 */
const LABELLED_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['add node (store.ts:2138)', 'Added factor'],
  ['add connected node (store.ts:2151)', 'Added connected factor'],
  // ⚠ NO LIVE PRODUCER — retained deliberately, and labelled as such so nobody
  // reads it as one. `batchUpdateNodes` used to default to this shape and now
  // pushes UNLABELLED, because its only caller is the AI backfill and its tag
  // is internal. Kept because the hook is producer-agnostic: it must offer no
  // action for ANY label reaching it, including one a future caller reintroduces.
  ['batch update default shape (no live producer since this change)', 'Batch updated 3 nodes'],
  // Likewise historical: the internal tag that used to reach users verbatim.
  ['AI backfill tag, formerly shown verbatim (applyDraftResult.ts:610)', 'backfill-interventions'],
  ['connect (store.ts:2578)', 'Connected Price → Demand'],
  ['delete selection (store.ts:2676)', 'Deleted 1 element'],
  ['delete node (store.ts:2734)', 'Deleted Price'],
  ['delete connection (store.ts:2768)', 'Deleted connection'],
  ['delete connection, second site (store.ts:3498)', 'Deleted connection'],
  ['duplicate (store.ts:2783)', 'Duplicated 2 elements'],
  ['paste (store.ts:2829)', 'Pasted 4 elements'],
]

describe('history toast offers no Undo action on any labelled path', () => {
  beforeEach(() => {
    listener = null
    past = []
    showToast.mockClear()
  })

  it.each(LABELLED_PATHS)('%s offers no action', (_path, label) => {
    const call = pushLabelled(label)

    // The action is showToast's THIRD argument. Absent or undefined, never an
    // object carrying a label/onClick.
    expect(call[2]).toBeUndefined()
  })

  it('the redo replay path offers no action either', () => {
    // `redo()` restores a future entry carrying the label of the entry it
    // replays, so the toast fires again on the same wire shape.
    const call = pushLabelled('Deleted 1 element')

    expect(call[2]).toBeUndefined()
  })

  /**
   * PRECONDITION. Without this the assertions above would also hold on a build
   * where the toast had stopped firing altogether, or where the hook never
   * subscribed — i.e. they would be asserting nothing about the action.
   */
  it('PRECONDITION: the toast still fires, still naming what happened', () => {
    const call = pushLabelled('Deleted 1 element')

    expect(showToast).toHaveBeenCalledTimes(1)
    expect(call[0]).toBe('Deleted 1 element')
    expect(call[1]).toBe('info')
  })

  it('an unlabelled history push still fires no toast at all', () => {
    past = []
    showToast.mockClear()
    render(<Harness />)
    act(() => {
      listener?.({ history: { past: [{ nodes: [], edges: [] }] } })
    })

    expect(showToast).not.toHaveBeenCalled()
  })
})

/**
 * V12 UNDO ON THE LANE: two different things behind one control, never confused (proposal 005 v2, "Layout undo is separate").
 *
 *  · A LAYOUT move (dragging a card) is local: a stack of the places the cards were in, with its own redo. It writes nothing; core never hears of it.
 *  · A SAVED reasoning edit is core's, ONE level, no redo in this slice (the delivery lead's contract, z1-undo-scope.md §4): when the View carries
 *    `model.undo = { available, version, n, label, why_not }`, a press posts `POST …/undo { base, undoes, op }` (`./editRoutes.ts`) and core writes a
 *    NEW version that restores the original authorship. Core refuses (409, in its own words) when someone else changed the shared model since;
 *    `label` and `why_not` are core's words, drawn as given. The UI never replays an old value as a fresh figure by the person.
 *
 * Which one a press undoes: the newer of the two acts (a move made after the last saved version is undone first). With no `model.undo`
 * (a core before it) Undo covers moves only, and its tooltip says saved edits cannot be undone yet.
 */
import { create } from 'zustand'
import { useCanvasStore } from '../../../canvas/store'
import { TeamApiError } from '../../../olumiCore/team/api'
import { runWrite } from '../../../olumiCore/team/writes'
import { isViewNode } from '../../canvas'
import { useViewStore } from '../../store'
import { editGateNow } from './editGate'
import { laneWrites, viewUndoOf, type ViewUndo } from './editRoutes'

export const UNDO_WORDS = {
  move: 'Undo move', redoMove: 'Redo move', undo: 'Undo', redo: 'Redo',
  savedNotYet: "Saved edits can't be undone yet.", nothingToUndo: 'Nothing to undo.', nothingToRedo: 'Nothing to redo.',
  notShown: 'Undone, but Olumi could not show the model just now. Reload the page to see it.',
} as const

type Place = { readonly x: number; readonly y: number }
type Places = Readonly<Record<string, Place>>
type Move = { readonly seq: number; readonly sid: string | null; readonly places: Places }
export type LayoutUndoState = {
  readonly undo: readonly Move[]
  readonly redo: readonly Move[]
  /** A counter that orders layout moves against saved versions. */
  readonly seq: number
  /** `seq` when the saved model last changed (a version landed). */
  readonly savedSeq: number
  /** What the last Undo or Redo pressed acted on, so Redo goes back the way Undo came. */
  readonly last: 'layout' | 'saved' | null
}
const EMPTY: LayoutUndoState = { undo: [], redo: [], seq: 0, savedSeq: 0, last: null }
export const useLayoutUndo = create<LayoutUndoState>()(() => EMPTY)
const MAX_MOVES = 50

/** For specs, and for a scenario change or Auto-arrange (the person's places are let go: nothing earlier can be put back). */
export const clearLayoutUndo = (): void => useLayoutUndo.setState({ ...EMPTY, seq: useLayoutUndo.getState().seq })

/** A drag finished: `before` is where each card that moved had been. */
export function recordLayoutMove(sid: string | null, before: Places): void {
  if (Object.keys(before).length === 0) return
  useLayoutUndo.setState((s) => ({ undo: [...s.undo, { seq: s.seq + 1, sid, places: before }].slice(-MAX_MOVES), redo: [], seq: s.seq + 1, last: null }))
}
/** The saved model moved to a new version (ours or anyone's): a move made before it is older than it. */
export function noteSavedVersion(): void { useLayoutUndo.setState((s) => ({ seq: s.seq + 1, savedSeq: s.seq + 1 })) }

export type UndoChoice =
  | { readonly kind: 'layout'; readonly label: string; readonly note: string | null }
  | { readonly kind: 'saved'; readonly undoes: number; readonly label: string; readonly note: null }
  | { readonly kind: 'none'; readonly label: string; readonly note: string }

/** The saved edit core offers, if it offers one now: available, and it names the version it undoes. */
const offered = (vu: ViewUndo | null): { undoes: number; label: string } | null =>
  vu !== null && vu.available && vu.version !== null ? { undoes: vu.version, label: vu.label ?? UNDO_WORDS.undo } : null

/** What Undo would do now. Pure. */
export function chooseUndo(s: Pick<LayoutUndoState, 'undo' | 'savedSeq'>, vu: ViewUndo | null): UndoChoice {
  const top = s.undo[s.undo.length - 1], offer = offered(vu)
  const unsaved = vu === null ? UNDO_WORDS.savedNotYet : null
  if (top !== undefined && (offer === null || top.seq > s.savedSeq)) return { kind: 'layout', label: UNDO_WORDS.move, note: unsaved }
  if (offer !== null) return { kind: 'saved', undoes: offer.undoes, label: offer.label, note: null }
  return { kind: 'none', label: UNDO_WORDS.undo, note: vu === null ? UNDO_WORDS.savedNotYet : vu.why_not ?? UNDO_WORDS.nothingToUndo }
}
/** What Redo would do now: only a dragged card can be put back (a saved edit has no redo in this slice). Pure. */
export function chooseRedo(s: Pick<LayoutUndoState, 'redo'>): UndoChoice {
  return s.redo[s.redo.length - 1] !== undefined ? { kind: 'layout', label: UNDO_WORDS.redoMove, note: null } : { kind: 'none', label: UNDO_WORDS.redo, note: UNDO_WORDS.nothingToRedo }
}

/** The two choices for the scenario on screen, redrawn as the stacks or the View change. */
export function useUndoChoices(): { readonly undo: UndoChoice; readonly redo: UndoChoice } {
  const undo = useLayoutUndo((s) => s.undo), redo = useLayoutUndo((s) => s.redo), savedSeq = useLayoutUndo((s) => s.savedSeq)
  const view = useViewStore((s) => s.view)
  return { undo: chooseUndo({ undo, savedSeq }, viewUndoOf(view)), redo: chooseRedo({ redo }) }
}
/** The same, at a press (outside a render). */
export function undoChoicesNow(): { readonly undo: UndoChoice; readonly redo: UndoChoice } {
  const s = useLayoutUndo.getState(), vu = viewUndoOf(useViewStore.getState().view)
  return { undo: chooseUndo(s, vu), redo: chooseRedo(s) }
}

/** Put cards back where a move says. Returns false when none of its cards is on the canvas any more (the move is dropped). */
export function applyLayoutUndo(dir: 'undo' | 'redo'): boolean {
  const st = useLayoutUndo.getState(), from = dir === 'undo' ? st.undo : st.redo, move = from[from.length - 1]
  if (move === undefined) return false
  const nodes = useCanvasStore.getState().nodes
  const now: Record<string, Place> = {}
  for (const n of nodes) if (move.places[n.id] !== undefined && isViewNode(n)) now[n.id] = { x: n.position.x, y: n.position.y }
  const rest = from.slice(0, -1)
  if (Object.keys(now).length === 0) { useLayoutUndo.setState(dir === 'undo' ? { undo: rest } : { redo: rest }); return false }
  useCanvasStore.setState((s) => ({ nodes: s.nodes.map((n) => (now[n.id] === undefined ? n : { ...n, position: { ...move.places[n.id]! } })) }))
  const other: Move = { seq: st.seq + 1, sid: move.sid, places: now }
  useLayoutUndo.setState(dir === 'undo'
    ? { undo: rest, redo: [...st.redo, other], seq: st.seq + 1, last: 'layout' }
    : { redo: rest, undo: [...st.undo, other], seq: st.seq + 1, last: 'layout' })
  return true
}

export type UndoResult = { readonly ok: true; readonly kind: 'layout' | 'saved'; readonly warning?: string } | { readonly ok: false; readonly words: string }

/**
 * Core's undo of the person's own last saved edit. Posted on the View's own `edit_base` (what the gate hands out) and the version row id
 * core's `model.undo` names, with a fresh idempotency key that a re-send of the same press repeats (`runWrite`). Core's refusal (409, a
 * colleague has changed the shared model since) is its own words and nothing is changed. Afterwards the View is read again: the version
 * core wrote is what is drawn.
 */
export async function runSavedUndo(undoes: number): Promise<UndoResult> {
  const gate = editGateNow()
  if (!gate.ok) return { ok: false, words: gate.why }
  const { sid, base } = gate
  try {
    await runWrite(`${sid}:undo`, { op: true }, { base, undoes }, (op) => laneWrites.undo(sid, { base, undoes, op: op! }))
    useLayoutUndo.setState({ last: 'saved' })
    return (await useViewStore.getState().modelChanged()) ? { ok: true, kind: 'saved' } : { ok: true, kind: 'saved', warning: UNDO_WORDS.notShown }
  } catch (e) {
    return { ok: false, words: e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was changed.' }
  }
}

/** One press of Undo or Redo, wherever it comes from (the control, the menu, the keys). */
export async function pressUndo(dir: 'undo' | 'redo'): Promise<UndoResult> {
  const c = undoChoicesNow()[dir]
  if (c.kind === 'layout') return applyLayoutUndo(dir) ? { ok: true, kind: 'layout' } : { ok: false, words: dir === 'undo' ? UNDO_WORDS.nothingToUndo : UNDO_WORDS.nothingToRedo }
  if (c.kind === 'saved') return runSavedUndo(c.undoes)
  return { ok: false, words: c.note }
}

// ── Seeing the person's own drags (the lane's canvas is not ours: nothing there is touched) ────────────────────────────────
/**
 * Watches the canvas store: when a card starts to be dragged, the places before it are kept; when the drag ends and a card is somewhere
 * new, that is one layout move. A layout run, a re-read or an Auto-arrange moves cards with no drag in progress, so none is recorded.
 * Returns the stop function.
 */
export function trackLayoutMoves(): () => void {
  let pending: Record<string, Place> | null = null
  const places = (nodes: ReadonlyArray<{ id: string; type?: string; position: Place }>): Record<string, Place> => {
    const o: Record<string, Place> = {}
    for (const n of nodes) if (isViewNode(n)) o[n.id] = { x: n.position.x, y: n.position.y }
    return o
  }
  return useCanvasStore.subscribe((state, prev) => {
    if (state.nodes === prev.nodes) return
    const dragging = state.nodes.some((n) => n.dragging === true && isViewNode(n))
    if (dragging && pending === null) { pending = places(prev.nodes as never); return }
    if (!dragging && pending !== null) {
      const now = places(state.nodes as never), moved: Record<string, Place> = {}
      for (const id of Object.keys(pending)) { const a = pending[id]!, b = now[id]; if (b !== undefined && (a.x !== b.x || a.y !== b.y)) moved[id] = a }
      pending = null
      recordLayoutMove(useViewStore.getState().sid, moved)
    }
  })
}

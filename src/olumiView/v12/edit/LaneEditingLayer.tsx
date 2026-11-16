/**
 * THE LANE'S EDITING LAYER: the one thing the lane's canvas mounts for hand editing beyond its right-click menu.
 *   - watches the person's own card drags, so a move can be undone (./undo.ts);
 *   - notes when the saved model moves to a new version, so Undo knows which act is newer;
 *   - ⌘Z (undo) and ⇧⌘Z (put a moved card back) (Ctrl on Windows), never while typing in a field;
 *   - the details panel (./LaneInspector.tsx).
 * Mount it once inside the lane's canvas, within its ToastProvider: `<LaneEditingLayer />`.
 */
import { useEffect, useRef } from 'react'
import { useShowToast } from '../../../canvas/ToastContext'
import { useViewStore } from '../../store'
import { LaneInspector } from './LaneInspector'
import { clearLayoutUndo, noteSavedVersion, pressUndo, trackLayoutMoves, undoChoicesNow } from './undo'

/** Is the keyboard's target a place text is typed? ⌘Z there is the field's own undo. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (el === null || typeof el.closest !== 'function') return false
  return el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null
}

export function LaneEditingLayer(): JSX.Element {
  const showToast = useShowToast()
  const sid = useViewStore((s) => s.sid), n = useViewStore((s) => s.view?.version?.n ?? null)
  useEffect(() => trackLayoutMoves(), [])
  // Another scenario: nothing of the last one's moves can be put back.
  useEffect(() => { clearLayoutUndo() }, [sid])
  const seen = useRef<{ sid: string | null; n: number | null }>({ sid, n })
  useEffect(() => {
    if (seen.current.sid === sid && seen.current.n !== null && n !== null && n !== seen.current.n) noteSavedVersion()
    seen.current = { sid, n }
  }, [sid, n])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || isTypingTarget(e.target)) return
      // Nothing to undo or redo: the key does nothing (no error toast for a stray press; the control's tooltip carries core's words).
      if (undoChoicesNow()[e.shiftKey ? 'redo' : 'undo'].kind === 'none') return
      e.preventDefault()
      void pressUndo(e.shiftKey ? 'redo' : 'undo').then((r) => { if (!r.ok) showToast(r.words, 'error'); else if (r.kind === 'saved' && r.warning !== undefined) showToast(r.warning, 'warning') })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showToast])
  return <LaneInspector />
}

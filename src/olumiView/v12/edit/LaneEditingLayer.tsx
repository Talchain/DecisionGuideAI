/**
 * THE LANE'S EDITING LAYER: the one thing the lane's canvas mounts for hand editing beyond its right-click menu.
 *   - watches the person's own card drags, so a move can be undone (./undo.ts);
 *   - notes when the saved model moves to a new version, so Undo knows which act is newer;
 *   - ⌘Z (undo) and ⇧⌘Z (put a moved card back) (Ctrl on Windows), never while typing in a field;
 *   - the details panel (./LaneInspector.tsx) and the one small edit form (./EditForm.tsx), each shown through the one surface store (./inspectorStore.ts);
 *   - the open canvas surface as an Escape layer (./escapeLayers.ts): it closes on an Escape nothing else handled.
 * Mount it once inside the lane's canvas, within its ToastProvider: `<LaneEditingLayer />`.
 */
import { useEffect, useRef } from 'react'
import { useShowToast } from '../../../canvas/ToastContext'
import { useViewStore } from '../../store'
import { LaneEditForm } from './EditForm'
import { LaneInspector } from './LaneInspector'
import { useCanvasStore } from '../../../canvas/store'
import { useLaneInspector } from './inspectorStore'
import { useEscapeLayer } from './escapeLayers'
import { RangeBar } from '../scale/RangeBar'
import { clearLayoutUndo, noteSavedVersion, pressUndo, trackLayoutMoves, undoChoicesNow } from './undo'

/** Is the keyboard's target a place text is typed? ⌘Z there is the field's own undo. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (el === null || typeof el.closest !== 'function') return false
  return el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null
}

/**
 * The canvas's open surface as an Escape layer (escapeLayers.ts: newest layer first, so a Record form opened earlier never takes a press meant for a details
 * box opened after it). A press that a menu, a dialog or a field of another surface handled never gets here. A canvas surface is open: it closes (unless it is
 * saving). The right-click menu's own key handler (its open submenu closes first) marks its press handled, so that press does not get here.
 */
function escapeSurface(): void {
  const store = useLaneInspector.getState(), open = store.current
  if (open === null) return
  // Escape puts the form away and keeps what was typed in it (the draft store): pressing the form's own Cancel is what forgets it.
  const closed = store.dismiss(false)
  // The card's details box and its selection chip go together (Paul's bar: nothing is left standing in the composer after Escape).
  if (closed && open.kind === 'details') useCanvasStore.getState().clearSelection()
}

/** The one small edit form, wherever it was asked for (a right-click row or the details panel). A form opened again starts from its own words. */
function SurfaceForm(): JSX.Element | null {
  const open = useLaneInspector((s) => s.current), close = useLaneInspector((s) => s.close)
  if (open === null || open.kind !== 'form') return null
  return <LaneEditForm key={open.n} spec={open.spec} anchor={open.anchor} beside={open.beside} onClose={() => close('form')} />
}

export function LaneEditingLayer(): JSX.Element {
  const showToast = useShowToast()
  const sid = useViewStore((s) => s.sid), n = useViewStore((s) => s.view?.version?.n ?? null)
  useEffect(() => trackLayoutMoves(), [])
  // Another scenario: nothing of the last one's moves can be put back.
  useEffect(() => { clearLayoutUndo() }, [sid])
  // Another scenario: nothing of the last one's is left open (a form, an editor, the details panel, a menu).
  const lastSid = useRef(sid)
  useEffect(() => { if (lastSid.current !== sid) { lastSid.current = sid; useLaneInspector.setState({ current: null }) } }, [sid])
  // The canvas going away leaves nothing open over the next one.
  useEffect(() => () => useLaneInspector.setState({ current: null }), [])
  const shown = useLaneInspector((st) => st.current)
  useEscapeLayer(shown !== null, escapeSurface, shown?.n)
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
  const view = useViewStore((s) => s.view)
  return (
    <>
      <LaneInspector range={(card) => (view === null ? null : <RangeBar card={card} view={view} />)} />
      <SurfaceForm />
    </>
  )
}

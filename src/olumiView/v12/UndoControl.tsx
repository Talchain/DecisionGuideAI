/**
 * UNDO, a small control for the left pill (V12 manual editing; mount: see the report). It is labelled by what it will undo: "Undo move" for a
 * dragged card, core's own label for a saved edit (`model.undo.label`, as given), and with no `model.undo` from core its tooltip says saved
 * edits cannot be undone yet. A card move that was undone can be put back ("Redo move", shown only then: a saved edit has no redo in this slice).
 * A press goes through `pressUndo` (./edit/undo.ts), so the pill, the right-click menu and ⌘Z are one path.
 */
import { OkIcon } from '../look/icons'
import { useShowToast } from '../../canvas/ToastContext'
import styles from '../../components/layout/CanvasFloatingToolbar.module.css'
import { pressUndo, UNDO_WORDS, useUndoChoices, type UndoChoice } from './edit/undo'

const tip = (c: UndoChoice): string => (c.kind === 'none' ? c.note : c.note === null ? c.label : `${c.label}. ${c.note}`)

/** The two answers core's reason can be when nothing of the person's is there to undo, said as the board does. */
export const NOTHING_TO_UNDO = 'Undo: nothing of yours to undo yet'
/**
 * The control's accessible name carries its reason, as the hover does: "Undo: <core's label>" for a saved edit (core's `model.undo.label`, as given),
 * the plain "Undo move" for a dragged card, and for a disabled one why it is (core's `why_not` when it gave one, else the board's words).
 * Redo keeps its own plain name (it is drawn only when there is something to put back).
 */
export function undoNameOf(c: UndoChoice, dir: 'undo' | 'redo' = 'undo'): string {
  if (dir === 'redo') return c.label
  if (c.kind === 'layout') return c.label
  if (c.kind === 'saved') return c.label === UNDO_WORDS.undo ? c.label : `Undo: ${c.label}`
  return c.note === UNDO_WORDS.nothingToUndo || c.note === UNDO_WORDS.savedNotYet ? NOTHING_TO_UNDO : `Undo: ${c.note}`
}

export function UndoControl({ className }: { className?: string }): JSX.Element {
  const { undo, redo } = useUndoChoices()
  const showToast = useShowToast()
  const press = (dir: 'undo' | 'redo') => { void pressUndo(dir).then((r) => { if (!r.ok) showToast(r.words, 'error'); else if (r.kind === 'saved' && r.warning !== undefined) showToast(r.warning, 'warning') }) }
  const button = (dir: 'undo' | 'redo', c: UndoChoice, alt?: 'alt') => (
    <button type="button" className={styles.iconButton} aria-label={undoNameOf(c, dir)} title={tip(c)} aria-disabled={c.kind === 'none' || undefined} data-testid={`lane-${dir}`}
      onClick={() => { if (c.kind !== 'none') press(dir) }}>
      <OkIcon id="undo" variant={alt} decorative inherit />
    </button>
  )
  return <div className={`nodrag nopan ${className ?? ''}`} role="group" aria-label="Undo" data-testid="lane-undo-control">{button('undo', undo)}{redo.kind === 'none' ? null : button('redo', redo, 'alt')}</div>
}

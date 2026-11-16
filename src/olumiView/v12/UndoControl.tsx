/**
 * UNDO, a small control for the left pill (V12 manual editing; mount: see the report). It is labelled by what it will undo: "Undo move" for a
 * dragged card, core's own label for a saved edit (`model.undo.label`, as given), and with no `model.undo` from core its tooltip says saved
 * edits cannot be undone yet. A card move that was undone can be put back ("Redo move", shown only then: a saved edit has no redo in this slice).
 * A press goes through `pressUndo` (./edit/undo.ts), so the pill, the right-click menu and ⌘Z are one path.
 */
import { Redo2, Undo2 } from 'lucide-react'
import { useShowToast } from '../../canvas/ToastContext'
import styles from '../../components/layout/CanvasFloatingToolbar.module.css'
import { pressUndo, useUndoChoices, type UndoChoice } from './edit/undo'

const tip = (c: UndoChoice): string => (c.kind === 'none' ? c.note : c.note === null ? c.label : `${c.label}. ${c.note}`)

export function UndoControl({ className }: { className?: string }): JSX.Element {
  const { undo, redo } = useUndoChoices()
  const showToast = useShowToast()
  const press = (dir: 'undo' | 'redo') => { void pressUndo(dir).then((r) => { if (!r.ok) showToast(r.words, 'error'); else if (r.kind === 'saved' && r.warning !== undefined) showToast(r.warning, 'warning') }) }
  const button = (dir: 'undo' | 'redo', c: UndoChoice, Icon: typeof Undo2) => (
    <button type="button" className={styles.iconButton} aria-label={c.label} title={tip(c)} aria-disabled={c.kind === 'none' || undefined} data-testid={`lane-${dir}`}
      onClick={() => { if (c.kind !== 'none') press(dir) }}>
      <Icon className={styles.icon} aria-hidden="true" />
    </button>
  )
  return <div className={`nodrag nopan ${className ?? ''}`} role="group" aria-label="Undo" data-testid="lane-undo-control">{button('undo', undo, Undo2)}{redo.kind === 'none' ? null : button('redo', redo, Redo2)}</div>
}

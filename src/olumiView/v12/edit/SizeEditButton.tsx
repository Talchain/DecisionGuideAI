/**
 * THE FIX FOR A SIZE EDIT POSTED TO /edit. Core offers a risk's chance and size, and a link's strength, as `edit.route === 'size'`
 * (`POST …/size`, the View's `SizeEdit`). The legacy figure editor (`../../FigureEdit.tsx`) posts every edit it is given to `…/edit` with the card's id
 * as the quantity, which core refuses for a risk (it is not a figure): the possible bug named on 16 Nov is REAL for a risk card. A surface that
 * draws core's `figure.edit` mounts this button when `isSizeEdit(edit)` and keeps its own editor for a plain figure edit.
 */
import { EditIcon } from '../../ds/icons'
import { useRef, type ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import { useMe } from '../../../olumiCore/me'
import { useViewStore } from '../../store'
import { editGateNow } from './editGate'
import { writeKeyOf, type SizeEdit, type EditSpec } from './EditForm'
import { useLaneInspector } from './inspectorStore'

/** `glyph` draws the quiet ✎ cue (the label is then its accessible name); `children` are another card's own words that open this editor (an aim's question). */
export function SizeEditButton({ edit, subject, label, className, glyph, children }: { edit: SizeEdit; subject: string; label: string; className?: string; glyph?: boolean; children?: ReactNode }): JSX.Element {
  const ref = useRef<HTMLButtonElement | null>(null)
  // Redrawn when the model, the page's person or the version on screen changes, so the title and aria-disabled never go stale.
  useViewStore((st) => st.view?.model?.edit_base ?? null); useViewStore((st) => st.at); useViewStore((st) => st.view); useMe((st) => st.me)
  const gate = editGateNow()
  const at = () => { const r = ref.current?.getBoundingClientRect(); return { x: (r?.right ?? 200) + 8, y: r?.top ?? 120 } }
  // The size form is one of the surfaces the one store holds (surfaces step 2): the lane's layer draws it, Escape and any other surface close it.
  return (
      <button ref={ref} type="button" title={gate.ok ? edit.prompt : gate.why} aria-disabled={!gate.ok || undefined} data-testid="lane-size-edit" className={className ?? `${typography.viewPanelMeta} cursor-pointer underline underline-offset-2`}
        aria-label={glyph !== undefined || children !== undefined ? label : undefined}
        onClick={() => { const g = editGateNow(); if (g.ok) { const spec: EditSpec = { kind: 'size', sid: g.sid, base: g.base, edit, subject }; useLaneInspector.getState().show({ kind: 'form', spec, anchor: at(), busyKey: writeKeyOf(spec) }) } }}>{children ?? (glyph !== undefined ? <EditIcon /> : label)}</button>
  )
}

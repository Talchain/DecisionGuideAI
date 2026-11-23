/**
 * THE VALUE ROW: THE ONE PLACE A FIGURE IS CHANGED ON THE LANE (surfaces step 5, 18 Nov). A quantity's figure (ranges as core reads them), a risk's chance and
 * size, and a link's strength are each changed in this row of the details panel, whichever control opened it (a card's pencil, the right-click row, the Model
 * tab, an aim's question): they all ask the one surface store to show these details with this row's field focused (`openFigure`).
 *
 * It is the editors it replaces, unchanged underneath: the same core route and body (`setFigure` for a figure, `submitEdit`'s size case for a chance, a size or a
 * strength), the same write keys (so a save in flight is never cut off and is one write wherever it is pressed), core's own words for every label, ask, note and
 * refusal, and the base the field opened on (a newer version never takes the typing silently; one press moves it onto the latest). The typing is kept per
 * item in the surface store whatever else is shown. "Try without saving" (core's what-if, on a copy) stays where it was, on a figure.
 */
import { useEffect, useRef, useState } from 'react'
import { typography } from '../../../styles/typography'
import { Hover } from '../../look/Hover'
import { VIEW_EDIT_CHIP_CLASS, VIEW_EDIT_CHIP_PRIMARY_CLASS } from '../../../v5/blocks/chipClass'
import { useUIStore } from '../../../stores/uiStore'
import { TeamApiError } from '../../../olumiCore/team/api'
import { useWriteSending } from '../../../olumiCore/team/writes'
import { isForThisPage, useMe } from '../../../olumiCore/me'
import { ASIDE_WORDS, MOVED_ON, SAVED_NOT_SHOWN, USE_LATEST, setFigure } from '../../FigureEdit'
import { useViewStore } from '../../store'
import { tryWhatIf } from '../../whatif'
import { FORM_WORDS, isSizeEdit, submitEdit, type CoreEdit, type EditSpec } from '../edit/EditForm'
import { editGateNow } from '../edit/editGate'
import { useLaneInspector } from '../edit/inspectorStore'

export const VALUE_WORDS = { change: 'Change figure', changeOlumi: "Change to your figure (was Olumi's estimate)", save: FORM_WORDS.save, tryIt: 'Try without saving', saved: 'Saved.' } as const

/** What the row changes: a card's figure (a quantity, or a risk's size) or a link's strength, in core's words. `olumis`: the figure is Olumi's estimate. */
export type ValueItem = { readonly kind: 'card' | 'link'; readonly id: string; readonly edit: CoreEdit; readonly subject: string; readonly olumis?: boolean }

type Field = { readonly key: 'typed' | 'chance' | 'change'; readonly label: string; readonly hint: string; readonly optional: boolean }
const fieldsOf = (edit: NonNullable<CoreEdit>): Field[] => (isSizeEdit(edit)
  ? edit.fields.map((f) => ({ key: f.key, label: f.prompt, hint: f.ask, optional: edit.fields.length > 1 }))
  // The label is core's own prompt, whole and said once. Whose figure it is stands on the Value row above it (core's source line), so no chrome word is prefixed.
  : [{ key: 'typed', label: edit.prompt, hint: edit.ask, optional: false }])

const BASE_KEY = 'base'

export function ValueRow({ item }: { item: ValueItem }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid), view = useViewStore((s) => s.view), me = useMe((s) => s.me)
  const { kind, id } = item
  const live = view?.model?.edit_base ?? null
  // Core stopped offering the edit while this row held typing (Olumi's change is held): the field and the typing stay, core says why, nothing is sent.
  const seen = useRef<NonNullable<CoreEdit> | null>(null)
  if (item.edit != null) seen.current = item.edit
  const edit = item.edit ?? seen.current
  const sizeEdit = edit != null && isSizeEdit(edit) ? edit : null
  const size = sizeEdit !== null
  // The typing is kept per item in the one surface store while this row is open or another surface takes its place, until it saves; it carries the version it opened on.
  const draftKey = sizeEdit !== null ? `${sid}:size:${sizeEdit.record}` : `${sid}:inspector-figure:${id}`
  const kept = useLaneInspector.getState().drafts[draftKey]
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...kept }))
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [trying, setTrying] = useState(false)
  const key = sizeEdit !== null ? `${sid}:size:${sizeEdit.record}` : `${sid}:edit:${id}`
  const sending = useWriteSending(key)
  const first = useRef<HTMLInputElement | null>(null)
  const typedAny = Object.entries(values).some(([k, v]) => k !== BASE_KEY && v.trim() !== '')
  const pinned = values[BASE_KEY] === undefined ? null : Number(values[BASE_KEY])
  const store = (next: Record<string, string>): void => {
    setValues(next)
    if (Object.entries(next).every(([k, v]) => k === BASE_KEY || v === '')) useLaneInspector.getState().forgetDraft(draftKey)
    else useLaneInspector.getState().setDraft(draftKey, next)
  }
  // A control asked for this field (`openFigure`): it takes focus, and opens on the latest version unless the person already has typing here, which keeps its own.
  const asked = useLaneInspector((s) => (s.current !== null && s.current.kind === 'details' && (s.current.edit === 'value' || s.current.edit === 'aside') && s.current.target.kind === kind && s.current.target.id === id ? s.current : null))
  const askedN = asked?.n ?? 0
  const fresh = asked?.edit === 'aside'
  // The control that opened this row says what Enter does and where a try is drawn (the old editor's `primary` and `tab`); kept while the row is open on it.
  const primary = asked?.primary ?? 'set', tab = asked?.tab ?? 'results'
  useEffect(() => {
    if (askedN === 0) return
    if (!typedAny && live !== null) store({ [BASE_KEY]: String(live) })
    first.current?.focus({ preventScroll: true })
    // preventScroll keeps the board still, but the field sits in the panel's own scrolling body: bring it into view there, never moving the page.
    first.current?.scrollIntoView?.({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askedN])
  if (edit == null || sid === null || view === null || !isForThisPage(view, me)) return null
  const withdrawn = item.edit == null
  if (withdrawn && !typedAny) return null
  const fields = fieldsOf(edit)
  const base = pinned ?? live
  const spec = (b: number): EditSpec | null => (sizeEdit === null ? null : { kind: 'size', sid, base: b, edit: sizeEdit, subject: item.subject })
  const ready = fields.every((f) => f.optional || (values[f.key] ?? '').trim() !== '') && fields.some((f) => (values[f.key] ?? '').trim() !== '')
  const can = ready && !sending && !trying && !withdrawn && live !== null && base !== null
  const set = (k: string, x: string): void => { store({ ...values, [k]: x, ...(pinned === null && live !== null ? { [BASE_KEY]: String(live) } : {}) }); if (error !== null) setError(null); if (note !== null) setNote(null) }
  const done = (): void => { store({}) }
  const save = async (): Promise<void> => {
    if (!can || base === null) return
    setError(null); setNote(null)
    try {
      const sized = spec(base)
      const shown = sized !== null ? (await submitEdit(sized, values), await useViewStore.getState().modelChanged()) : await setFigure(sid, base, id, values['typed'] ?? '')
      if (shown) { done(); setNote(VALUE_WORDS.saved) } else setError(SAVED_NOT_SHOWN)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : FORM_WORDS.failed)
    }
  }
  /** The same figure on a copy, nothing saved (core's what-if); its answer is drawn over the chances, so the panel lets go of the board. What was typed is kept for a second look. */
  const tryIt = async (): Promise<void> => {
    if (!can || base === null || size) return
    setError(null); setTrying(true)
    const showing = useLaneInspector.getState().current
    try {
      await tryWhatIf(sid, base, id, values['typed'] ?? '')
      if (useLaneInspector.getState().current === showing) {
        useUIStore.getState().forceActivateOutputTab(tab)
        useLaneInspector.getState().close('details')
      }
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was tried.')
    } finally { setTrying(false) }
  }
  // No version to edit (Olumi's change is held, or an earlier version is drawn): the field says so in core's words and sends nothing.
  const gate = editGateNow()
  const heldNote = live === null ? view.model_words?.withdrawnHeld ?? (gate.ok ? null : gate.why) : null
  const moved = pinned !== null && live !== null && pinned !== live
  const note2 = sizeEdit === null ? null : sizeEdit.note

  return (
    <form className="grid gap-2" data-testid="inspector-your-figure" data-value-row={`${kind}:${id}`} aria-busy={sending || undefined}
      onSubmit={(e) => { e.preventDefault(); void (primary === 'try' && !size ? tryIt() : save()) }} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}>
      {fresh ? <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="inspector-figure-aside">{ASIDE_WORDS.done}</p> : null}
      {fields.map((f, i) => (
        <div key={f.key} className="grid gap-2">
          <Hover as="label" focusable={false} {...{ htmlFor: `inspector-figure-${kind}-${id}-${f.key}` }} className={`${typography.viewPanelMeta} font-medium text-text-header`} words={f.hint}>{f.label}</Hover>
          <input id={`inspector-figure-${kind}-${id}-${f.key}`} ref={i === 0 ? first : undefined} data-testid={`inspector-figure-${f.key}`} autoComplete="off" spellCheck={false} value={values[f.key] ?? ''} readOnly={sending} placeholder={size ? f.hint : undefined}
            onChange={(e) => set(f.key, e.target.value)}
            className="rounded-sm border border-field bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header" />
        </div>
      ))}
      {note2 === null ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="inspector-figure-core-note">{note2}</p>}
      {error !== null ? <p role="alert" data-testid="inspector-figure-note" className={`${typography.viewPanelMeta} text-danger`}>{error}</p>
        : note === null ? null : <p role="status" data-testid="inspector-figure-note" className={`${typography.viewPanelMeta} text-text-body`}>{note}</p>}
      {heldNote === null ? null : <p role="status" className={`${typography.viewPanelMeta} text-text-body`} data-testid="inspector-figure-held" data-view="model_words.withdrawnHeld">{heldNote}</p>}
      {moved ? (
        <p className={`${typography.viewPanelMeta} text-text-body`} data-testid="inspector-figure-moved">{MOVED_ON}{' '}
          <button type="button" disabled={sending} data-testid="inspector-figure-rebase" className="nodrag inline-flex min-h-[24px] items-center underline underline-offset-2 hover:text-text-header"
            onClick={() => { store({ ...values, [BASE_KEY]: String(live) }); setError(null) }}>{USE_LATEST}</button></p>
      ) : null}
      {/* The buttons are drawn once there is something to send: a Set (or Try) beside an empty field is a control dimmed at rest with no reason. Enter in the field still submits. */}
      {!typedAny ? null : (
        <div className="flex flex-wrap gap-2">
          <button type={primary === 'try' && !size ? 'button' : 'submit'} data-testid="inspector-figure-set" disabled={!can} onClick={primary === 'try' && !size ? () => void save() : undefined} className={primary === 'try' && !size ? VIEW_EDIT_CHIP_CLASS : VIEW_EDIT_CHIP_PRIMARY_CLASS}>
            {size ? VALUE_WORDS.save : item.olumis === true ? VALUE_WORDS.changeOlumi : VALUE_WORDS.change}</button>
          {size ? null : <button type={primary === 'try' ? 'submit' : 'button'} data-testid="inspector-figure-try" disabled={!can} onClick={primary === 'try' ? undefined : () => void tryIt()} className={primary === 'try' ? `order-first ${VIEW_EDIT_CHIP_PRIMARY_CLASS}` : VIEW_EDIT_CHIP_CLASS}>{VALUE_WORDS.tryIt}</button>}
        </div>
      )}
    </form>
  )
}

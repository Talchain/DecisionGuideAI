/**
 * The shared draft form for adding a figure, option, risk, claim or question and confirming link removal.
 * The older look also uses it for rename, figure and size edits.
 *
 * Each submit calls the real core route (`submitEdit`), on the version the form OPENED on (a newer one never takes the person's words
 * silently: core refuses in its own words, shown as it says them). Nothing is parsed, rounded or converted here: core reads what was typed.
 * The words that ask are core's where core sends them (`edit.prompt`, `edit.ask`, a size field's `prompt` and `ask`, `edit.note`); the
 * rest are chrome: button and field names.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../../../v5/blocks/chipClass'
import { LinkRemovalSummary } from './LinkRemovalSummary'
import type { ViewLink } from '../../client'
import { useDialogFocus } from '../../look/useDialogFocus'
import { typography } from '../../../styles/typography'
import { controls } from '../../../styles/controls'
import { CANVAS_LAYER_CLASS } from '../../../canvas/layers'
import { TeamApiError } from '../../../olumiCore/team/api'
import { runWrite, useWriteSending } from '../../../olumiCore/team/writes'
import { readAfterSave } from '../../model/editing'
import { writes } from '../../client'
import { useViewStore } from '../../store'
import { noteEditSaved } from '../../notice'
import { ADD_FIGURE_WORDS, focusWhenDrawn } from '../../AddFigure'
import { REMOVE_LINK_WORDS } from '../../LinkRemove'
import { editGateNow } from './editGate'
import { laneWrites, savedVersion, type ItemKind, type RiskGiven } from './editRoutes'
import { draftKeyOf, useLaneInspector, type DetailsTarget, type Point } from './inspectorStore'
import { FORM_MIN_SHOWN, stayBeside } from './placeBeside'

/** Where and how core takes a link's or a risk's size (the View's `SizeEdit`). */
export type SizeEdit = { readonly prompt: string; readonly ask: string; readonly route: 'size'; readonly record: string; readonly note: string | null; readonly fields: ReadonlyArray<{ readonly key: 'typed' | 'chance' | 'change'; readonly prompt: string; readonly ask: string }> }
/** A card's or link's edit as core offers it: a plain figure edit, or a size. */
export type CoreEdit = { readonly prompt: string; readonly ask: string; readonly route?: 'size'; readonly record?: string; readonly note?: string | null; readonly fields?: SizeEdit['fields'] } | null | undefined
export const isSizeEdit = (e: CoreEdit): e is SizeEdit => e != null && e.route === 'size' && typeof e.record === 'string' && Array.isArray(e.fields)

type Opened = { readonly sid: string; readonly base: number }
export type EditSpec = Opened & (
  | { readonly kind: 'rename'; readonly record: string; readonly current: string }
  | { readonly kind: 'figure-add' }
  | { readonly kind: 'item'; readonly item: Exclude<ItemKind, 'assumption'>; readonly concerns: readonly string[]; readonly about: string | null; readonly pickFigure: ReadonlyArray<{ readonly id: string; readonly heading: string }> | null }
  | { readonly kind: 'figure-edit'; readonly record: string; readonly edit: { readonly prompt: string; readonly ask: string } }
  | { readonly kind: 'size'; readonly edit: SizeEdit; readonly subject: string }
  | { readonly kind: 'remove-link'; readonly remove: { readonly record: string; readonly part?: string | null }; readonly link?: ViewLink }
)

export const FORM_WORDS = {
  rename: 'Rename', name: 'Name', save: 'Save', add: 'Add', cancel: 'Cancel', change: 'Change figure', figure: 'Figure',
  addFigure: 'Add a factor', option: 'Add an option', risk: 'Add a risk', claim: 'Add a claim', question: 'Add an open question',
  optionField: 'Option', riskField: 'Risk', claimField: 'Claim', questionField: 'Question', onFigure: 'On which figure', pick: 'Choose a figure',
  setStrength: 'Set strength', size: 'Set chance and size', notAdded: 'Nothing was added to the model.', stanceNotModel: 'Your doubt is noted, but it is not part of the model.',
  notShown: 'Saved, but Olumi could not show it just now. Reload the page to see it.', failed: 'That did not go through. Nothing was saved.',
} as const

type Field = { readonly key: string; readonly label: string; readonly hint?: string; readonly initial?: string; readonly optional?: boolean }
const ITEM_FIELD: Record<Exclude<ItemKind, 'assumption'>, string> = { choice: FORM_WORDS.optionField, risk: FORM_WORDS.riskField, claim: FORM_WORDS.claimField, question: FORM_WORDS.questionField }
const ITEM_TITLE: Record<Exclude<ItemKind, 'assumption'>, string> = { choice: FORM_WORDS.option, risk: FORM_WORDS.risk, claim: FORM_WORDS.claim, question: FORM_WORDS.question }

export function fieldsOf(spec: EditSpec): Field[] {
  switch (spec.kind) {
    case 'rename': return [{ key: 'label', label: FORM_WORDS.name, initial: spec.current }]
    case 'figure-add': return [
      { key: 'label', label: ADD_FIGURE_WORDS.name }, { key: 'typed', label: ADD_FIGURE_WORDS.figure, hint: ADD_FIGURE_WORDS.figureHint },
      { key: 'unit', label: ADD_FIGURE_WORDS.unit, optional: true }]
    case 'item': return [{ key: 'text', label: ITEM_FIELD[spec.item] }]
    case 'figure-edit': return [{ key: 'typed', label: spec.edit.prompt, hint: spec.edit.ask }]
    case 'size': return spec.edit.fields.map((f) => ({ key: f.key, label: f.prompt, hint: f.ask, optional: spec.edit.fields.length > 1 }))
    case 'remove-link': return []
  }
}
export const titleOf = (spec: EditSpec): string => {
  switch (spec.kind) {
    case 'rename': return FORM_WORDS.rename
    case 'figure-add': return FORM_WORDS.addFigure
    case 'item': return ITEM_TITLE[spec.item]
    case 'figure-edit': return FORM_WORDS.change
    case 'size': return spec.edit.fields.some((f) => f.key === 'typed') ? FORM_WORDS.setStrength : FORM_WORDS.size
    case 'remove-link': return REMOVE_LINK_WORDS.ask
  }
}
const goLabel = (spec: EditSpec): string => (spec.kind === 'remove-link' ? REMOVE_LINK_WORDS.remove : spec.kind === 'figure-add' || spec.kind === 'item' ? FORM_WORDS.add : FORM_WORDS.save)

/** The write key the existing editors use for the same write, so one write is one write wherever it is pressed (`model/editing.ts` editKey). */
export const writeKeyOf = (spec: EditSpec): string => {
  switch (spec.kind) {
    case 'rename': return `${spec.sid}:rename:${spec.record}`
    case 'figure-add': return `${spec.sid}:add-figure`
    case 'item': return `${spec.sid}:item:${spec.item}`
    case 'figure-edit': return `${spec.sid}:edit:${spec.record}`
    case 'size': return `${spec.sid}:size:${spec.edit.record}`
    case 'remove-link': return `${spec.sid}:remove-link:${spec.remove.part == null ? spec.remove.record : `${spec.remove.record}.${spec.remove.part}`}`
  }
}

/**
 * Send one edit to core's route, on the version the form opened on. Resolves with the new card's record where the edit made one.
 * Throws `TeamApiError` in core's words; a strategy question that saved no version (held on a range, or a stance) throws `FORM_WORDS.notAdded`.
 */
export async function submitEdit(spec: EditSpec, v: Readonly<Record<string, string>>): Promise<{ readonly record: string | null }> {
  const gate = editGateNow()
  if (!gate.ok) throw new TeamApiError(0, gate.why)
  if (gate.sid !== spec.sid) throw new TeamApiError(0, 'The page has moved to another scenario, so nothing was saved.')
  const { sid, base } = spec, key = writeKeyOf(spec), t = (k: string) => (v[k] ?? '').trim()
  switch (spec.kind) {
    case 'rename': {
      const label = t('label')
      noteEditSaved(await runWrite(key, { op: true }, { base, record: spec.record, label }, (op) => writes.rename(sid, base, spec.record, label, op!)))
      return { record: null }
    }
    case 'figure-add': {
      const label = t('label'), typed = t('typed'), unit = t('unit')
      const saved = await runWrite(key, { op: true }, { base, label, typed, unit }, (op) => writes.addFigure(sid, base, label, typed, unit === '' ? null : unit, op!))
      noteEditSaved(saved)
      return { record: saved.record }
    }
    case 'item': {
      const text = t('text'), concerns = [...spec.concerns, ...(t('concern') === '' ? [] : [t('concern')])]
      const kind: ItemKind = spec.item
      const saved = await runWrite(key, { op: true }, { base, kind, text, concerns }, (op) => laneWrites.addItem(sid, base, { kind, text, concerns }, op!))
      if (!savedVersion(saved)) throw new TeamApiError(0, 'stance' in saved ? FORM_WORDS.stanceNotModel : FORM_WORDS.notAdded)
      noteEditSaved(saved)
      return { record: saved.record }
    }
    case 'figure-edit': {
      const typed = t('typed')
      noteEditSaved(await runWrite(key, { op: true }, { base, quantity: spec.record, typed }, (op) => writes.edit(sid, base, spec.record, typed, op!)))
      return { record: null }
    }
    case 'size': {
      const record = spec.edit.record
      if (spec.edit.fields.some((f) => f.key === 'typed')) {
        const typed = t('typed')
        noteEditSaved(await runWrite(key, { op: true }, { base, record, typed }, (op) => laneWrites.sizeLink(sid, base, record, typed, op!)))
      } else {
        const given: { chance?: string; change?: string } = {}
        if (t('chance') !== '') given.chance = t('chance')
        if (t('change') !== '') given.change = t('change')
        const g: RiskGiven = given
        noteEditSaved(await runWrite(key, { op: true }, { base, record, ...g }, (op) => laneWrites.sizeRisk(sid, base, record, g, op!)))
      }
      return { record: null }
    }
    case 'remove-link': {
      const remove = spec.remove
      noteEditSaved(await runWrite(key, { op: true }, { base, ...remove }, (op) => writes.removeLink(sid, base, remove, op!)))
      return { record: null }
    }
  }
}

const inputClass = `${typography.viewPanelBody} w-full min-h-[44px] rounded-sm border border-field bg-panel px-2 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`

/** `beside`: the lane's card or link the form stands next to (never over it, inside the free canvas, following it); without it the lane centres the form and the older look uses its anchor. */
export function LaneEditForm({ spec, anchor, beside, onClose }: { spec: EditSpec; anchor?: Point; beside?: DetailsTarget; onClose: () => void }): JSX.Element {
  const lane = isOlumiCoreLane()
  const fields = fieldsOf(spec)
  // The typed words are kept in the one surface store while this form is open (and when another surface takes its place), until it saves or is cancelled.
  const draftKey = draftKeyOf(spec)
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])), ...useLaneInspector.getState().drafts[draftKey] }))
  const [error, setError] = useState<string | null>(null)
  const sending = useWriteSending(writeKeyOf(spec))
  const first = useRef<HTMLInputElement | null>(null)
  const concern = useRef<HTMLSelectElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  // LaneEditingLayer owns Escape for the store's open surface.
  const { dialogRef: box, onKeyDown } = useDialogFocus<HTMLFormElement>({
    initialFocus: () => first.current ?? (lane ? concern.current ?? cancelButton.current : null),
    opener: () => {
      const open = useLaneInspector.getState().current
      return open?.kind === 'form' && open.spec === spec ? open.opener : undefined
    },
    selectInput: true,
    containFocus: lane,
    restoreFocus: lane,
  })
  const stand = beside === undefined ? '' : `${beside.kind}:${beside.id}`
  useLayoutEffect(() => {
    if (beside === undefined) return
    return stayBeside(() => box.current, beside, { x: '--lane-form-x', y: '--lane-form-y', h: '--lane-form-h' }, undefined, FORM_MIN_SHOWN)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand])
  const set = (k: string, x: string) => { const next = { ...values, [k]: x }; setValues(next); useLaneInspector.getState().setDraft(draftKey, next); if (error) setError(null) }
  const cancel = () => { useLaneInspector.getState().forgetDraft(draftKey); onClose() }
  const needsFigure = spec.kind === 'item' && spec.item === 'risk' && spec.concerns.length === 0
  const ready = fields.every((f) => f.optional === true || (values[f.key] ?? '').trim() !== '')
    && (spec.kind !== 'size' || fields.some((f) => (values[f.key] ?? '').trim() !== ''))
    && (!needsFigure || (values['concern'] ?? '') !== '')
  const go = async () => {
    if (sending || !ready) return
    setError(null)
    try {
      const done = await submitEdit(spec, values)
      const shown = lane ? await readAfterSave(spec.sid) : await useViewStore.getState().modelChanged() ? 'shown' : 'failed'
      if (shown === 'failed') { setError(FORM_WORDS.notShown); return }
      if (shown === 'moved') return
      useLaneInspector.getState().forgetDraft(draftKey)
      onClose()
      if (done.record !== null) focusWhenDrawn(done.record)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : FORM_WORDS.failed)
    }
  }
  const position = !lane && beside === undefined && anchor !== undefined ? {
    left: Math.max(8, Math.min(anchor.x, window.innerWidth - 300)),
    top: Math.max(8, Math.min(anchor.y, window.innerHeight - 260)),
  } : undefined
  const fieldClass = lane ? `${typography.viewPanelBody} min-h-7 w-full rounded-sm border border-field bg-panel px-2 text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header` : inputClass
  const title = lane && spec.kind === 'figure-add' ? 'Add a figure' : titleOf(spec)
  const note = spec.kind === 'size' ? spec.edit.note : null
  return createPortal(
    <form ref={box} tabIndex={lane ? -1 : undefined} role="dialog" aria-label={title} data-testid="lane-edit-form" data-kind={spec.kind}
      className={`fixed ${CANVAS_LAYER_CLASS.contextMenu} nodrag nopan flex w-[280px] flex-col ${lane ? 'ok-float' : 'gap-3 rounded-lg border border-panel-border bg-panel p-3 shadow-2'} ${typography.viewPanelBody}${beside === undefined ? (lane ? ' left-1/2 top-24 max-h-[70vh] -translate-x-1/2 overflow-hidden' : '') : ' left-[var(--lane-form-x,8px)] top-[var(--lane-form-y,8px)] max-h-[var(--lane-form-h,100vh)] overflow-hidden'}`}
      style={position} onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); void go() }}>
      <div className="min-h-0 space-y-3 overflow-y-auto">
      {lane ? <h2 className={`${typography.panelHeader} text-text-header`}>{title}</h2> : null}
      {!lane || spec.kind === 'size' || (spec.kind === 'item' && spec.about !== null) ? (
        <p className={`${typography.viewPanelMeta} text-text-light`}>{spec.kind === 'size' ? spec.subject : spec.kind === 'item' && spec.about !== null ? spec.about : titleOf(spec)}</p>
      ) : null}
      {lane && spec.kind === 'remove-link' && spec.link !== undefined ? <LinkRemovalSummary link={spec.link} /> : null}
      {needsFigure ? (
        <label className="block space-y-2"><span className={typography.viewPanelMeta}>{FORM_WORDS.onFigure}</span>
          <select ref={concern} data-testid="lane-edit-concern" value={values['concern'] ?? ''} disabled={sending} onChange={(e) => set('concern', e.target.value)} className={fieldClass}>
            <option value="">{FORM_WORDS.pick}</option>
            {(spec.kind === 'item' ? spec.pickFigure ?? [] : []).map((f) => <option key={f.id} value={f.id}>{f.heading}</option>)}
          </select></label>
      ) : null}
      {fields.map((f, i) => (
        <label key={f.key} className="block space-y-2"><span className={typography.viewPanelMeta}>{f.label}</span>
          <input ref={i === 0 && !needsFigure ? first : undefined} autoComplete="off" value={values[f.key] ?? ''} disabled={sending} placeholder={f.hint} data-testid={`lane-edit-${f.key}`}
            onChange={(e) => set(f.key, e.target.value)} className={fieldClass} /></label>
      ))}
      {note === null ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="lane-edit-note">{note}</p>}
      </div>
      {error === null ? null : <p role="alert" className={lane ? 'text-warning-ink' : 'text-danger'} data-testid="lane-edit-error">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={sending || !ready} data-testid="lane-edit-go"
          className={lane ? VIEW_CHIP_PRIMARY_CLASS : `${typography.viewPanelBody} min-h-[44px] cursor-pointer rounded-sm ${controls.actColours} px-3 disabled:cursor-not-allowed disabled:border-panel-border disabled:bg-panel-border disabled:text-text-light`}>{goLabel(spec)}</button>
        <button ref={cancelButton} type="button" disabled={sending} onClick={cancel} data-testid="lane-edit-cancel" className={lane ? VIEW_CHIP_CLASS : `${typography.viewPanelBody} min-h-[44px] cursor-pointer px-2 text-text-light underline underline-offset-2`}>
          {spec.kind === 'remove-link' ? REMOVE_LINK_WORDS.keep : FORM_WORDS.cancel}</button>
      </div>
    </form>,
    document.body,
  )
}

/**
 * ADDING AND TAKING AWAY, FROM THE MODEL TAB (Paul 7 Nov: edit the model here by hand). Two direct writes core takes with no AI call, each
 * the canvas control's own (route, body, write key, base rule): add a figure card in the person's words (`AddFigure.tsx`, `POST …/figures`)
 * and remove a link core marks removable (`LinkRemove.tsx`, `POST …/links/remove`, its `remove` object posted verbatim). Everything else
 * structural (an option, a risk, a link) is Olumi's to propose and the person's to approve, so the tab hands it to the chat with a draft
 * the person can change before sending (`requestAsk`, the inspector's hand-off), and says it goes there.
 */
import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import { TeamApiError } from '../../olumiCore/team/api'
import { runWrite, useWriteSending } from '../../olumiCore/team/writes'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { requestAsk } from '../../canvas/ui/inspector-v2/askSemantic'
import { focusWhenDrawn } from '../AddFigure'
import type { ViewLink } from '../client'
import { writes } from '../client'
import { useViewStore } from '../store'
import { noteEditSaved } from '../notice'
import { editKey, useModelWords, readAfterSave, useModelEdit } from './editing'
import { focusIsWith, RECIPE, sayReceipt, sayUnseen, useFocusOnDraw } from './editors'
import { ADD_TAG, FACTORS_ROW, RELATIONSHIPS_ROW, useModelTab } from './state'

/** Is this control still on screen? A refusal that lands after it left (its group closed, a filter typed) is said on its group instead. */
export function useMounted() {
  const on = useRef(true)
  useEffect(() => { on.current = true; return () => { on.current = false } }, [])
  return on
}

/** What a form opened on: the scenario and core's version at the press that opened it (base-at-open; a later one never takes it). */
type Opened = { readonly sid: string; readonly base: number }
/**
 * Add a figure card, in place at the foot of Factors: name, figure as typed, unit if they give one; core reads the figure and its unit.
 * The form's typing and what it opened on live with the tab's state (`adding`), so a View read on its way, a group closed or a filter typed
 * never drops them.
 */
export function AddFigureRow(): JSX.Element | null {
  const W = useModelWords()!
  const { sid, base: live } = useModelEdit()
  const adding = useModelTab((s) => (s.adding !== null && s.adding.sid === sid ? s.adding : null))
  const [error, setError] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const nameField = useRef<HTMLInputElement>(null)
  useFocusOnDraw(nameField, adding !== null ? ADD_TAG : null)
  const mounted = useMounted()
  const key = editKey.addFigure(adding?.sid ?? sid)
  const sending = useWriteSending(key)
  const pending = useModelTab((s) => s.busy === key) || sending
  const other = useModelTab((s) => s.busy !== null && s.busy !== key)
  const inert = pending || other
  if (sid === null || (adding === null && live === null)) return null
  const close = () => { useModelTab.getState().closeAdding(); setError(null); setTimeout(() => opener.current?.focus(), 0) }
  const add = async () => {
    const a = useModelTab.getState().adding
    if (a === null || a.sid !== sid || inert || useModelTab.getState().busy !== null) return
    const name = a.label.trim(), figure = a.typed.trim(), u = a.unit.trim()
    if (name === '' || figure === '') return
    const { sid: at, base } = a
    const here = () => useViewStore.getState().sid === at
    const fail = (words: string) => { if (mounted.current) setError(words); else useModelTab.getState().say({ row: FACTORS_ROW, words, tone: 'failed' }) }
    setError(null); useModelTab.getState().setBusy(key)
    try {
      const saved = await runWrite(key, { op: true }, { base, label: name, typed: figure, unit: u }, (op) => writes.addFigure(at, base, name, figure, u === '' ? null : u, op!))
      if (!here()) return
      noteEditSaved(saved)
      const shown = await readAfterSave(at)
      if (shown === 'moved') return
      useModelTab.getState().closeAdding()
      // Saved, not shown: nothing of it is to be sent again, so the form closes, and Factors says so until a later View shows the card.
      if (shown === 'failed') { sayUnseen(FACTORS_ROW, saved); return }
      sayReceipt(at, saved.record, saved)
      focusWhenDrawn(saved.record) // the new card, theirs, in front on the canvas once drawn
    } catch (e) {
      if (here()) fail(e instanceof TeamApiError ? e.message : W.failed)
    } finally {
      if (useModelTab.getState().busy === key) useModelTab.getState().setBusy(null)
    }
  }
  if (adding === null) return (
    <li className="px-2 pt-1">
      <button ref={opener} type="button" onClick={() => { if (live !== null) { useModelTab.getState().openAdding(sid, live); setError(null) } }} className={`${RECIPE.action} gap-1.5`} data-model-add-figure="open">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" /><span>{W.addFigure}</span>
      </button>
    </li>
  )
  const { label, typed, unit } = adding
  const type = (patch: Partial<{ label: string; typed: string; unit: string }>) => { useModelTab.getState().typeAdding(patch); if (error) setError(null) }
  return (
    <li className="px-2 pt-1">
      <form className="space-y-2 rounded-lg border border-panel-border bg-panel p-3" data-model-add-figure="form" aria-busy={pending || undefined}
        onSubmit={(e) => { e.preventDefault(); void add() }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !pending) close() }}>
        <label className="block space-y-1"><span className={RECIPE.label}>{W.name}</span>
          <input ref={nameField} autoComplete="off" value={label} readOnly={pending} data-model-add-figure="name" onChange={(e) => type({ label: e.target.value })} className={RECIPE.input} /></label>
        <label className="block space-y-1"><span className={RECIPE.label}>{W.figure}</span>
          <input autoComplete="off" value={typed} readOnly={pending} placeholder={W.figureHint} data-model-add-figure="typed" onChange={(e) => type({ typed: e.target.value })} className={`${RECIPE.input} tabular-nums`} /></label>
        <label className="block space-y-1"><span className={RECIPE.label}>{W.unit}</span>
          <input autoComplete="off" value={unit} readOnly={pending} data-model-add-figure="unit" onChange={(e) => type({ unit: e.target.value })} className={RECIPE.input} /></label>
        {error === null ? null : <p role="alert" className={RECIPE.error} data-model-add-figure="error">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={label.trim() === '' || typed.trim() === ''} aria-disabled={inert || undefined} className={RECIPE.primary} data-model-add-figure="add">{W.add}</button>
          <button type="button" aria-disabled={pending || undefined} onClick={() => { if (!pending) close() }} className={RECIPE.quiet} data-model-add-figure="cancel">{W.cancel}</button>
        </div>
        {pending ? <p role="status" className={RECIPE.status} data-model-add-figure="sending">{W.saving}</p>
          : other ? <p role="status" className={RECIPE.status} data-model-add-figure="waiting">{W.savingOther}</p> : null}
      </form>
    </li>
  )
}

/**
 * Remove a link core marks removable: asked once, then core's `remove` object posted verbatim; core names what depends on it if it
 * refuses. Once the View shows it gone, its detail closes (only if it is still the one open) and the Relationships group says core's
 * version, since the link's own row is gone; focus goes to that group's heading if it was here.
 */
export function RemoveLink({ link, row }: { link: ViewLink; row: string }): JSX.Element | null {
  const W = useModelWords()!
  const { sid, base: live } = useModelEdit()
  const remove = link.remove
  const [opened, setOpened] = useState<Opened | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useMounted()
  const key = remove == null ? '' : editKey.removeLink(opened?.sid ?? sid, remove)
  const sending = useWriteSending(key)
  const pending = useModelTab((s) => s.busy === key && key !== '') || sending
  const other = useModelTab((s) => s.busy !== null && s.busy !== key)
  const inert = pending || other
  if (remove == null || sid === null || (opened === null && live === null)) return null
  const take = async () => {
    if (inert || opened === null || useModelTab.getState().busy !== null) return
    const { sid: at, base } = opened
    const here = () => useViewStore.getState().sid === at
    const fail = (words: string) => { if (mounted.current) setError(words); else useModelTab.getState().say({ row: RELATIONSHIPS_ROW, words, tone: 'failed' }) }
    setError(null); useModelTab.getState().setBusy(key)
    try {
      const saved = await runWrite(key, { op: true }, { base, ...remove }, (op) => writes.removeLink(at, base, remove, op!))
      if (!here()) return
      noteEditSaved(saved)
      const shown = await readAfterSave(at)
      if (shown === 'moved') return
      setOpened(null)
      useModelTab.getState().close(row)
      // Saved, not shown: nothing of it is to be sent again, so the ask closes, and Relationships says so until a later View shows it gone.
      if (shown === 'failed') { sayUnseen(RELATIONSHIPS_ROW, saved); return }
      useModelTab.getState().setBusy(null)
      sayReceipt(at, RELATIONSHIPS_ROW, saved)
      // Focus that was here (now gone with its row) goes to the group's heading, where core's version is said; focus elsewhere stays.
      setTimeout(() => { if (focusIsWith(null)) document.querySelector<HTMLElement>('[data-model-group-toggle="relationships"]')?.focus() }, 0)
    } catch (e) {
      if (here()) fail(e instanceof TeamApiError ? e.message : W.failed)
    } finally {
      if (useModelTab.getState().busy === key) useModelTab.getState().setBusy(null)
    }
  }
  return (
    <div className="space-y-2" data-model-remove-link={row} onClick={(e) => e.stopPropagation()}>
      {opened !== null ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={W.removeAsk}>
          <span className="text-text-body">{W.removeAsk}</span>
          <button type="button" autoFocus aria-disabled={inert || undefined} onClick={() => void take()} className={RECIPE.secondary} data-model-remove-link-yes={row}>{W.remove}</button>
          <button type="button" aria-disabled={pending || undefined} onClick={() => { if (!pending) { setOpened(null); setError(null) } }} className={RECIPE.quiet} data-model-remove-link-keep={row}>{W.keep}</button>
        </div>
      ) : (
        <button type="button" onClick={() => { if (live !== null) { setOpened({ sid, base: live }); setError(null) } }} className={RECIPE.action} data-model-remove-link-open={row}>{W.removeLink}</button>
      )}
      {pending ? <p role="status" className={RECIPE.status} data-model-remove-link-sending={row}>{W.saving}</p>
        : other && opened !== null ? <p role="status" className={RECIPE.status} data-model-remove-link-waiting={row}>{W.savingOther}</p> : null}
      {error === null ? null : <p role="alert" className={RECIPE.error} data-model-remove-link-error={row}>{error}</p>}
    </div>
  )
}

/** Hand a structural change to the chat: a draft in the composer the person can change before sending; Olumi proposes, they approve. */
export function AskOlumi({ draft, label, at }: { draft: string; label: string; at: string }): JSX.Element | null {
  const can = useGuidanceStore((s) => s._prefillChat !== null || s._sendMessage !== null || s._dispatchAction !== null)
  if (!can) return null
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); requestAsk({ text: draft, label, source: 'model-tab' }) }}
      className={RECIPE.olumi} data-model-ask={at}>
      <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 flex-none" /><span>{label}</span>
    </button>
  )
}

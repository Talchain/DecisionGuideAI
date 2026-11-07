/**
 * ADDING AND TAKING AWAY, FROM THE MODEL TAB (Paul 7 Nov: edit the model here by hand). Two direct writes core takes with no AI call, each
 * the canvas control's own (route, body, write key, base rule): add a figure card in the person's words (`AddFigure.tsx`, `POST …/figures`)
 * and remove a link core marks removable (`LinkRemove.tsx`, `POST …/links/remove`, its `remove` object posted verbatim). Everything else
 * structural (an option, a risk, a link) is Olumi's to propose and the person's to approve, so the tab hands it to the chat with a draft
 * the person can change before sending (`requestAsk`, the inspector's hand-off), and says it goes there.
 */
import { useRef, useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TeamApiError } from '../../olumiCore/team/api'
import { runWrite, useWriteSending } from '../../olumiCore/team/writes'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { requestAsk } from '../../canvas/ui/inspector-v2/askSemantic'
import { focusWhenDrawn } from '../AddFigure'
import type { ViewLink } from '../client'
import { writes } from '../client'
import { useViewStore } from '../store'
import { noteEditSaved } from '../notice'
import { editKey, MODEL_EDIT_WORDS as W, useModelEdit } from './editing'
import { RECIPE, sayReceipt } from './editors'
import { useModelTab } from './state'

/** Add a figure card, in place at the foot of Factors: name, figure as typed, unit if they give one; core reads the figure and its unit. */
export function AddFigureRow(): JSX.Element | null {
  const { sid, base: live } = useModelEdit()
  const [open, setOpen] = useState(false)
  const [base, setBase] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [typed, setTyped] = useState('')
  const [unit, setUnit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const key = editKey.addFigure(sid)
  const sending = useWriteSending(key)
  if (sid === null || (!open && live === null)) return null
  const close = () => { setOpen(false); setError(null); setTimeout(() => opener.current?.focus(), 0) }
  const add = async () => {
    const name = label.trim(), figure = typed.trim(), u = unit.trim()
    if (name === '' || figure === '' || sending || base === null) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, label: name, typed: figure, unit: u }, (op) => writes.addFigure(sid, base, name, figure, u === '' ? null : u, op!))
      noteEditSaved(saved)
      if (await useViewStore.getState().modelChanged()) {
        setLabel(''); setTyped(''); setUnit(''); setOpen(false)
        sayReceipt(saved.record, saved)
        focusWhenDrawn(saved.record) // the new card, theirs, in front on the canvas once drawn
      } else setError(W.savedNotShown)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : W.failed)
    }
  }
  if (!open) return (
    <li className="px-2 pt-1">
      <button ref={opener} type="button" onClick={() => { setBase(live); setError(null); setOpen(true) }} className={`${RECIPE.action} gap-1.5`} data-model-add-figure="open">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" /><span>{W.addFigure}</span>
      </button>
    </li>
  )
  return (
    <li className="px-2 pt-1">
      <form className="space-y-2 rounded-lg border border-panel-border bg-panel p-3" data-model-add-figure="form"
        onSubmit={(e) => { e.preventDefault(); void add() }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) close() }}>
        <label className="block space-y-1"><span className={RECIPE.label}>{W.name}</span>
          <input autoFocus autoComplete="off" value={label} disabled={sending} data-model-add-figure="name" onChange={(e) => { setLabel(e.target.value); if (error) setError(null) }} className={RECIPE.input} /></label>
        <label className="block space-y-1"><span className={RECIPE.label}>{W.figure}</span>
          <input autoComplete="off" value={typed} disabled={sending} placeholder={W.figureHint} data-model-add-figure="typed" onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }} className={`${RECIPE.input} tabular-nums`} /></label>
        <label className="block space-y-1"><span className={RECIPE.label}>{W.unit}</span>
          <input autoComplete="off" value={unit} disabled={sending} data-model-add-figure="unit" onChange={(e) => { setUnit(e.target.value); if (error) setError(null) }} className={RECIPE.input} /></label>
        {error === null ? null : <p role="alert" className={RECIPE.error} data-model-add-figure="error">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={sending || label.trim() === '' || typed.trim() === ''} className={RECIPE.primary} data-model-add-figure="add">
            {sending ? <span role="status">{W.saving}</span> : W.add}
          </button>
          <button type="button" disabled={sending} onClick={close} className={RECIPE.quiet}>{W.cancel}</button>
        </div>
      </form>
    </li>
  )
}

/** Remove a link core marks removable: asked once, then core's `remove` object posted verbatim; core names what depends on it if it refuses. */
export function RemoveLink({ link, row }: { link: ViewLink; row: string }): JSX.Element | null {
  const { sid, base: live } = useModelEdit()
  const remove = link.remove
  const [asking, setAsking] = useState(false)
  const [base, setBase] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = remove == null ? '' : editKey.removeLink(sid, remove)
  const sending = useWriteSending(key)
  if (remove == null || sid === null || (!asking && live === null)) return null
  const take = async () => {
    if (sending || base === null) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, ...remove }, (op) => writes.removeLink(sid, base, remove, op!))
      noteEditSaved(saved)
      if (await useViewStore.getState().modelChanged()) { useModelTab.getState().toggle(row) } else setError(W.savedNotShown)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : W.failed)
    }
  }
  return (
    <div className="space-y-2" data-model-remove-link={row} onClick={(e) => e.stopPropagation()}>
      {asking ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={W.removeAsk}>
          <span className="text-text-body">{W.removeAsk}</span>
          <button type="button" autoFocus aria-disabled={sending || undefined} onClick={() => void take()} className={`${RECIPE.secondary} ${sending ? 'opacity-50' : ''}`} data-model-remove-link-yes={row}>
            {sending ? <span role="status">{W.saving}</span> : W.remove}
          </button>
          <button type="button" aria-disabled={sending || undefined} onClick={() => { if (!sending) { setAsking(false); setError(null) } }} className={RECIPE.quiet}>{W.keep}</button>
        </div>
      ) : (
        <button type="button" onClick={() => { setBase(live); setError(null); setAsking(true) }} className={RECIPE.action} data-model-remove-link-open={row}>{W.removeLink}</button>
      )}
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
      className={`${typography.viewPanelMeta} inline-flex min-h-[28px] items-center gap-1.5 rounded-sm px-1 text-text-light hover:text-text-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`} data-model-ask={at}>
      <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 flex-none" /><span>{label}</span>
    </button>
  )
}

/**
 * THE PERSON'S OWN FIGURE, CHANGED ON ITS CARD (dgai-on-core G4). Offered exactly where core offers it (`card.figure.edit`, present only on
 * a figure the person may set, with no proposal held), in core's own words: its prompt labels the field. What they type goes to core as
 * typed (`POST …/edit` `typed`, API v1.9), and core reads it as its own page does; a figure it cannot read comes back as that card's
 * `figure.edit.ask`, shown here. Nothing is parsed or converted on this page. The edit is the person's: applied at once, then Olumi replies.
 */
import { useState } from 'react'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { writes, type ViewCard } from './client'
import { useViewStore } from './store'

export function FigureEdit({ card }: { card: ViewCard }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const key = `${sid}:edit:${card.id}`
  const sending = useWriteSending(key)
  const edit = card.figure?.edit
  const base = view?.model?.edit_base ?? null
  if (!edit || sid === null || base === null || view === null || !isForThisPage(view, me)) return null

  const save = async () => {
    if (typed.trim() === '' || sending) return
    setError(null)
    try {
      await runWrite(key, { op: true }, { base, quantity: card.id, typed }, (op) => writes.edit(sid, base, card.id, typed, op!))
      setOpen(false); setTyped('')
      await useViewStore.getState().modelChanged()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    }
  }

  if (!open) {
    return (
      <button type="button" data-testid={`view-figure-edit-${card.id}`} onClick={() => setOpen(true)}
        className={`nodrag ${typography.nodeLabel} cursor-pointer text-info underline underline-offset-2`}>Change figure</button>
    )
  }
  return (
    <form className="nodrag nopan grid gap-1" data-testid={`view-figure-form-${card.id}`}
      onSubmit={(e) => { e.preventDefault(); void save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) { setOpen(false); setError(null) } }}>
      <label htmlFor={`view-figure-${card.id}`} className={typography.nodeLabel}>{edit.prompt}</label>
      <input id={`view-figure-${card.id}`} data-testid={`view-figure-typed-${card.id}`} autoFocus autoComplete="off" spellCheck={false}
        value={typed} disabled={sending} onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
        className={`${typography.nodeLabel} w-full rounded border border-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`} />
      {error && <p role="alert" data-testid={`view-figure-error-${card.id}`} className={`${typography.nodeLabel} text-danger`}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" data-testid={`view-figure-set-${card.id}`} disabled={sending || typed.trim() === ''}
          className={`${typography.nodeLabel} cursor-pointer rounded bg-primary px-2 py-0.5 text-text-on-color disabled:opacity-50`}>Set figure</button>
        <button type="button" disabled={sending} onClick={() => { setOpen(false); setError(null) }}
          className={`${typography.nodeLabel} cursor-pointer text-text-light underline underline-offset-2`}>Cancel</button>
      </div>
    </form>
  )
}

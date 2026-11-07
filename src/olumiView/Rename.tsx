/**
 * RENAME A CARD (R25, the first direct structural edit; Paul's 6 Nov test: "I can't find manual editing"). Core's contract (DL 02:14Z,
 * amended 02:28Z): `POST …/rename { base, record, label, op }` → 201 `{ version, n, receipt }`, saved at once as a person-authored version
 * with no AI call; only the card's name changes (who gave a figure, its value and origin do not). Offered on an approved board only
 * (`edit_base` set); the question is renamed elsewhere. Every refusal is core's own words; the saved version is core's receipt. The
 * editor keeps the base it opened on, so a newer version never takes the person's words silently (core then asks them to rename again).
 */
import { useState } from 'react'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { runWrite, useWriteSending } from '../olumiCore/team/writes'
import { isForThisPage, useMe } from '../olumiCore/me'
import { writes } from './client'
import { useViewStore } from './store'
import { noteSaved } from './notice'

export const RENAME_WORDS = { open: 'Rename', save: 'Save name', cancel: 'Cancel', label: 'New name' } as const

export function Rename({ id, heading, shown }: { id: string; heading: string; shown: boolean }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  const at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(heading)
  const [base, setBase] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = `${sid}:rename:${id}`
  const sending = useWriteSending(key)
  const live = view?.model?.edit_base ?? null
  if (sid === null || view === null || at !== null || (!open && live === null) || !isForThisPage(view, me)) return null

  const save = async () => {
    const label = typed.trim()
    if (label === '' || sending || base === null) return
    setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { base, record: id, label }, (op) => writes.rename(sid, base, id, label, op!))
      noteSaved(saved)
      if (await useViewStore.getState().modelChanged()) setOpen(false)
      else setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    }
  }

  if (!open) return (
    <button type="button" data-testid={`view-rename-${id}`} onClick={(e) => { e.stopPropagation(); setTyped(heading); setBase(live); setError(null); setOpen(true) }}
      className={`nodrag ${typography.viewLabel} inline-flex min-h-[24px] items-center cursor-pointer text-info underline underline-offset-2 ${shown ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}>{RENAME_WORDS.open}</button>
  )
  return (
    <form className="nodrag nopan grid gap-1" data-testid={`view-rename-form-${id}`}
      onSubmit={(e) => { e.preventDefault(); void save() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) { setOpen(false); setError(null) } }}>
      <label htmlFor={`view-rename-${id}-input`} className={typography.viewLabel}>{RENAME_WORDS.label}</label>
      <input id={`view-rename-${id}-input`} data-testid={`view-rename-input-${id}`} autoFocus autoComplete="off" maxLength={120}
        value={typed} disabled={sending} onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
        className={`${typography.viewLabel} w-full rounded border border-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50`} />
      {error && <p role="alert" data-testid={`view-rename-error-${id}`} className={`${typography.viewLabel} text-danger`}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" data-testid={`view-rename-save-${id}`} disabled={sending || typed.trim() === ''}
          className={`${typography.viewLabel} min-h-[24px] cursor-pointer rounded bg-primary px-2 py-0.5 text-text-on-color disabled:opacity-50`}>{RENAME_WORDS.save}</button>
        <button type="button" disabled={sending} onClick={() => { setOpen(false); setError(null) }}
          className={`${typography.viewLabel} min-h-[24px] cursor-pointer text-text-light underline underline-offset-2`}>{RENAME_WORDS.cancel}</button>
      </div>
    </form>
  )
}

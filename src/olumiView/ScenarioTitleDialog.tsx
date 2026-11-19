/**
 * RENAME THE SCENARIO, on the olumi-core lane (More options > Rename). Core's route is the person's own title for a scenario
 * (`POST /api/account/scenarios/:id/title`, accountsApi.retitle): only this person sees it, everyone else on the scenario keeps theirs,
 * and an empty title returns to the scenario's own. The page's name is the View's `title`, which core answers with that own title, so
 * after a save the View is read again and the bar shows what core holds (never the typed text). The words are chrome; every refusal is
 * core's own. (The model's card names are renamed on the card itself: Rename.tsx.)
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { typography } from '../styles/typography'
import { controls } from '../styles/controls'
import { TeamApiError } from '../olumiCore/team/api'
import { accountsApi } from '../olumiCore/accounts/api'
import { useViewStore } from './store'

export const TITLE_WORDS = {
  heading: 'Rename scenario', label: 'Your title for this scenario', note: 'Only you see this title. Everyone else on it keeps theirs. Leave it empty to use the scenario\'s own.',
  save: 'Save title', cancel: 'Cancel', failed: 'That did not go through. Nothing was saved.',
} as const

export function ScenarioTitleDialog({ onClose }: { onClose: () => void }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const current = useViewStore((s) => s.view?.title ?? '')
  const [typed, setTyped] = useState(current)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  if (sid === null) return null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true); setError(null)
    try {
      await accountsApi.retitle(sid, typed.trim())
      // The View is what the bar shows: read it again so the name is core's, not the typed text. A read that fails says so.
      if (await useViewStore.getState().refresh()) onClose()
      else setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (err) {
      setError(err instanceof TeamApiError ? err.message : TITLE_WORDS.failed)
    } finally { setSending(false) }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={TITLE_WORDS.heading} data-testid="scenario-title-dialog"
      className="fixed inset-0 z-[1600] flex items-start justify-center bg-black/20 px-4 pt-24"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose() }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && !sending) onClose() }}>
      <form onSubmit={(e) => void save(e)} className="grid w-full max-w-[420px] gap-3 rounded-lg border border-panel-border bg-panel p-4 shadow-panel">
        <h2 className={`${typography.viewLabel} m-0 font-medium text-text-header`}>{TITLE_WORDS.heading}</h2>
        <label htmlFor="scenario-title-input" className={typography.viewLabel}>{TITLE_WORDS.label}</label>
        <input id="scenario-title-input" ref={inputRef} data-testid="scenario-title-input" autoComplete="off" maxLength={200} value={typed} disabled={sending}
          onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
          className={`${typography.viewLabel} w-full rounded-sm border border-field bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`} />
        <p className={`${typography.viewLabel} m-0 text-text-light`}>{TITLE_WORDS.note}</p>
        {error && <p role="alert" data-testid="scenario-title-error" className={`${typography.viewLabel} m-0 text-danger`}>{error}</p>}
        <div className="flex gap-3">
          <button type="submit" data-testid="scenario-title-save" disabled={sending}
            className={`${typography.viewLabel} min-h-[28px] cursor-pointer rounded-sm ${controls.actColours} px-3 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header disabled:cursor-not-allowed disabled:bg-panel-border disabled:text-text-light`}>{TITLE_WORDS.save}</button>
          <button type="button" disabled={sending} onClick={onClose}
            className={`${typography.viewLabel} min-h-[28px] cursor-pointer text-text-light underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>{TITLE_WORDS.cancel}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

/**
 * RENAME THE SCENARIO, on the olumi-core lane (More options > Rename). Core's route is the person's own title for a scenario
 * (`POST /api/account/scenarios/:id/title`, accountsApi.retitle): only this person sees it, everyone else on the scenario keeps theirs,
 * and an empty title returns to the scenario's own. The page's name is the View's `title`, which core answers with that own title, so
 * after a save the View is read again and the bar shows what core holds (never the typed text). The words are chrome; every refusal is
 * core's own. (The model's card names are renamed on the card itself: Rename.tsx.)
 */
import { useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { typography } from '../styles/typography'
import { TeamApiError } from '../olumiCore/team/api'
import { accountsApi } from '../olumiCore/accounts/api'
import { useViewStore } from './store'
import { CANVAS_LAYER_CLASS } from '../canvas/layers'
import { FLOAT_CLASS } from './look/float'
import { useDialogFocus } from './look/useDialogFocus'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../v5/blocks/chipClass'

export const TITLE_WORDS = {
  heading: 'Rename scenario', label: 'Your title for this scenario', note: 'Only you see this title. Everyone else on it keeps theirs. Leave it empty to use the scenario\'s own.',
  save: 'Save title', cancel: 'Cancel', failed: 'That did not go through. Nothing was saved.',
} as const

export function ScenarioTitleDialog({ onClose, opener }: { onClose: () => void; opener?: HTMLButtonElement | null }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const current = useViewStore((s) => s.view?.title ?? '')
  const [typed, setTyped] = useState(current)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { dialogRef: formRef, onKeyDown } = useDialogFocus<HTMLFormElement>({
    open: sid !== null,
    popup: true,
    initialFocus: () => inputRef.current,
    // The Rename menu item is gone when this dialog mounts. Return to its menu's trigger.
    opener: () => opener ?? document.querySelector<HTMLButtonElement>('button[aria-label="More options"]'),
    onEscape: onClose,
    canDismiss: () => !sending,
    selectInput: true,
  })
  if (sid === null) return null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true); setError(null)
    try {
      await accountsApi.retitle(sid, typed.trim())
      // The View carries the saved title, so read it again before closing.
      if (await useViewStore.getState().refresh()) onClose()
      else setError('Saved, but Olumi could not show it just now. Reload the page to see it.')
    } catch (err) {
      setError(err instanceof TeamApiError ? err.message : TITLE_WORDS.failed)
    } finally { setSending(false) }
  }

  return createPortal(
    <div
      className={`fixed inset-0 ${CANVAS_LAYER_CLASS.modalBackdrop} flex items-start justify-center overflow-y-auto bg-[var(--backdrop)] px-3 pr-[calc(var(--dock-right-offset,0rem)+var(--space-3))] pt-[var(--space-12)]`}
    >
      <form ref={formRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={TITLE_WORDS.heading} data-testid="scenario-title-dialog"
        onKeyDown={onKeyDown} onSubmit={(e) => void save(e)} className={`${FLOAT_CLASS} w-full max-w-[420px] outline-none`}>
        <h2 className={`${typography.panelHeader} m-0 text-text-header`}>{TITLE_WORDS.heading}</h2>
        <label htmlFor="scenario-title-input" className={typography.viewLabel}>{TITLE_WORDS.label}</label>
        <input id="scenario-title-input" ref={inputRef} data-testid="scenario-title-input" autoComplete="off" maxLength={200} value={typed} disabled={sending}
          onChange={(e) => { setTyped(e.target.value); if (error) setError(null) }}
          className={`${typography.viewLabel} min-h-7 w-full rounded-sm border border-field bg-panel px-2 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`} />
        <p className={`${typography.viewLabel} m-0 text-text-light`}>{TITLE_WORDS.note}</p>
        {error && <p role="alert" data-testid="scenario-title-error" className={`${typography.viewLabel} m-0 text-warning-ink`}>{error}</p>}
        <div className="flex gap-2">
          <button type="submit" data-testid="scenario-title-save" disabled={sending}
            className={VIEW_CHIP_PRIMARY_CLASS}>{TITLE_WORDS.save}</button>
          <button type="button" disabled={sending} onClick={onClose}
            className={VIEW_CHIP_CLASS}>{TITLE_WORDS.cancel}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
